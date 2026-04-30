import type { Express, Response } from "express";
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { tourAttributes, carAttributes, roles, locations, attributes, attributeTerms, categories, tours, cars, bookings, notifications, chatbotQuestions } from "@shared/schema";
import type { Rating } from "@shared/schema";
import { registerSchema, loginSchema, updateProfileSchema, reportFiltersSchema, createNotificationInputSchema, getNotificationsInputSchema, createChatbotQuestionInputSchema, updateChatbotQuestionInputSchema, chatbotAskInputSchema, createRatingInputSchema, updateRatingInputSchema } from "@shared/schema";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import { api } from "@shared/routes";


import { signToken, requireAuth, requireAdmin } from "./auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";


import { db } from "./db";

// Removed duplicate schema imports

import { type TourBooking } from "@shared/schema";
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';

type MulterFiles = { [fieldname: string]: Express.Multer.File[] };

// Configure multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// Helper function to extract publicId from Cloudinary URL
function extractPublicId(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
  return matches ? matches[1] : null;
}

// Helper function to delete old image
async function deleteOldImage(oldImageUrl: string | null) {
  if (!oldImageUrl) return;
  
  const publicId = extractPublicId(oldImageUrl);
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log('Deleted old image:', publicId);
    } catch (error) {
      console.error('Failed to delete old image:', error);
    }
  }
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function normalizeProfileBody(body: Record<string, unknown>) {
  const normalized = { ...body };
  const allowedKeys = new Set(Object.keys(updateProfileSchema.shape));

  for (const [key, value] of Object.entries(normalized)) {
    if (!key.includes("_")) continue;
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (allowedKeys.has(camel) && normalized[camel] === undefined) {
      normalized[camel] = value;
    }
  }

  return normalized;
}

function rejectEmptyProfileUpdate(input: Record<string, unknown>, res: Response) {
  if (Object.keys(input).length > 0) return true;
  res.status(400).json({ message: "No valid profile fields to update" });
  return false;
}

function normalizeUpdateBody(body: Record<string, unknown>) {
  const normalized = { ...body };

  for (const [key, value] of Object.entries(body)) {
    if (!key.includes("_")) continue;
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (!(camelKey in normalized)) {
      normalized[camelKey] = value;
    }
  }

  return normalized;
}

function normalizeTourBody(body: Record<string, unknown>) {
  const normalized = normalizeUpdateBody(body);

  if (normalized.realTourAddress !== undefined && normalized.realAddress === undefined) {
    normalized.realAddress = normalized.realTourAddress;
  }
  if (normalized.address !== undefined && normalized.realAddress === undefined) {
    normalized.realAddress = normalized.address;
  }

  if (normalized.fixedDateEnabled !== undefined && normalized.fixedDates === undefined) {
    normalized.fixedDates = normalized.fixedDateEnabled;
  }
  if (normalized.enableFixedDate !== undefined && normalized.fixedDates === undefined) {
    normalized.fixedDates = normalized.enableFixedDate;
  }
  if (normalized.enableServiceFee !== undefined && normalized.serviceFeeEnabled === undefined) {
    normalized.serviceFeeEnabled = normalized.enableServiceFee;
  }
  if (normalized.enableOpenHours !== undefined && normalized.openHoursEnabled === undefined) {
    normalized.openHoursEnabled = normalized.enableOpenHours;
  }
  const surroundingsEducation = normalized.surroundingsEducation;
  const surroundingsHealth = normalized.surroundingsHealth;
  const surroundingsTransportation = normalized.surroundingsTransportation;
  if (
    normalized.surroundings === undefined &&
    (surroundingsEducation !== undefined ||
      surroundingsHealth !== undefined ||
      surroundingsTransportation !== undefined)
  ) {
    normalized.surroundings = {
      education: surroundingsEducation ?? [],
      health: surroundingsHealth ?? [],
      transportation: surroundingsTransportation ?? [],
    };
  }
  return normalized;
}

function normalizeCarBody(body: Record<string, unknown>) {
  return normalizeUpdateBody(body);
}

function rejectEmptyTourUpdate(input: Record<string, unknown>, res: Response) {
  if (Object.keys(input).length > 0) return true;
  res.status(400).json({ message: "No valid tour fields to update" });
  return false;
}

function rejectEmptyCarUpdate(input: Record<string, unknown>, res: Response) {
  if (Object.keys(input).length > 0) return true;
  res.status(400).json({ message: "No valid car fields to update" });
  return false;
}

function jaccardScore(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const t of aSet) {
    if (bSet.has(t)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function similarityScore(query: string, candidate: string, keywords: string[]): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;

  let score = 0;
  if (q.includes(c) || c.includes(q)) {
    score = Math.max(score, 0.85);
  }

  const qTokens = tokenize(q);
  const cTokens = tokenize(c);
  score = Math.max(score, jaccardScore(qTokens, cTokens));

  if (keywords.length > 0) {
    const qSet = new Set(qTokens);
    let keywordHits = 0;
    for (const kw of keywords) {
      const kwNorm = normalizeText(String(kw));
      if (!kwNorm) continue;
      if (qSet.has(kwNorm)) keywordHits += 1;
    }
    const keywordBoost = Math.min(0.2, keywordHits * 0.05);
    score = Math.min(1, score + keywordBoost);
  }

  return score;
}

type BuiltinChatbotMatch = {
  answer: string;
  intent: "near_me" | "best_deal" | "most_popular";
  suggestions: SuggestionItem[];
  moduleType: "car" | "tour" | null;
};

type AnalyticsIntentKey =
  | "sales_overview"
  | "most_booked"
  | "top_revenue_service"
  | "booking_volume"
  | "revenue_trend"
  | "cancellation_health"
  | "confirmation_health"
  | "module_mix"
  | "average_ticket";

type AnalyticsIntentMatch = {
  key: AnalyticsIntentKey;
  label: string;
};

const analyticsIntentPatterns: Array<{
  key: AnalyticsIntentKey;
  label: string;
  patterns: RegExp[];
}> = [
  { key: "most_booked", label: "Most booked service", patterns: [/\bmost booked\b/, /\btop booked\b/, /\bbest seller\b/, /\bhighest booking\b/] },
  { key: "top_revenue_service", label: "Top revenue service", patterns: [/\btop revenue\b/, /\bhighest revenue\b/, /\bbiggest revenue\b/, /\bmost revenue\b/] },
  { key: "revenue_trend", label: "Revenue trend", patterns: [/\brevenue trend\b/, /\bsales trend\b/, /\btrend\b/, /\bgrowth\b/, /\bdecline\b/] },
  { key: "cancellation_health", label: "Cancellation health", patterns: [/\bcancel rate\b/, /\bcancellation\b/, /\bcancelled\b/, /\bcanceled\b/] },
  { key: "confirmation_health", label: "Confirmation health", patterns: [/\bconfirmation rate\b/, /\bconfirmed rate\b/, /\bconfirm rate\b/] },
  { key: "module_mix", label: "Tour vs car mix", patterns: [/\btour vs car\b/, /\bmodule mix\b/, /\bproduct mix\b/, /\bservice mix\b/] },
  { key: "average_ticket", label: "Average order value", patterns: [/\baverage ticket\b/, /\baverage order\b/, /\baov\b/, /\bavg booking value\b/] },
  { key: "booking_volume", label: "Booking volume", patterns: [/\bbooking volume\b/, /\bbooking count\b/, /\bhow many bookings\b/, /\btotal bookings\b/] },
  { key: "sales_overview", label: "Sales overview", patterns: [/\bdata analysis\b/, /\banalysis\b/, /\bsales analysis\b/, /\bbusiness analysis\b/, /\bperformance\b/, /\boverview\b/] },
];

function detectAnalyticsIntent(question: string): AnalyticsIntentMatch | null {
  const q = normalizeText(question);
  if (!q) return null;
  const isAnalyticsLike =
    q.includes("analysis") ||
    q.includes("analytics") ||
    q.includes("sales") ||
    q.includes("revenue") ||
    q.includes("booked") ||
    q.includes("booking") ||
    q.includes("trend") ||
    q.includes("performance") ||
    q.includes("business");
  if (!isAnalyticsLike) return null;

  for (const item of analyticsIntentPatterns) {
    if (item.patterns.some((p) => p.test(q))) {
      return { key: item.key, label: item.label };
    }
  }
  return { key: "sales_overview", label: "Sales overview" };
}

function percentage(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

function classifyLevel(value: number, low: number, high: number): "low" | "normal" | "high" {
  if (value <= low) return "low";
  if (value >= high) return "high";
  return "normal";
}

function formatTrend(deltaPct: number): string {
  if (!Number.isFinite(deltaPct)) return "stable";
  if (deltaPct > 3) return `up ${deltaPct.toFixed(1)}%`;
  if (deltaPct < -3) return `down ${Math.abs(deltaPct).toFixed(1)}%`;
  return "almost flat";
}

function buildImprovementActions(input: {
  cancelRate: number;
  confirmRate: number;
  pendingBookings: number;
  totalBookings: number;
  moduleCounter: { tour: number; car: number };
  trendText: string;
  mostBookedService?: string;
  topRevenueService?: string;
}): string[] {
  const actions: string[] = [];

  if (input.cancelRate >= 20) {
    actions.push("High cancellation risk: tighten booking confirmations, require clearer payment/terms, and send reminder messages 24 hours before schedule.");
  } else if (input.cancelRate >= 8) {
    actions.push("Moderate cancellations: review top cancelled services and fix the main pain points (timing, pricing, or service expectations).");
  } else {
    actions.push("Cancellation is healthy: keep current process and track weekly to prevent sudden spikes.");
  }

  if (input.confirmRate < 40) {
    actions.push("Low confirmation rate: simplify checkout, reduce form fields, and add fast follow-up for pending inquiries.");
  } else if (input.confirmRate < 75) {
    actions.push("Confirmation is average: test better offer messaging, urgency cues, and faster response times.");
  } else {
    actions.push("Strong confirmation: scale winning campaigns and replicate for lower-performing services.");
  }

  if (input.pendingBookings > Math.max(3, Math.floor(input.totalBookings * 0.2))) {
    actions.push("Pending bookings are high: assign a response SLA and automate follow-up within 15-30 minutes.");
  }

  if (input.trendText.includes("down")) {
    actions.push("Revenue trend is down: launch short-term promos for top-demand services and reactivate past customers.");
  } else if (input.trendText.includes("up")) {
    actions.push("Revenue trend is up: protect momentum by increasing capacity on best-selling services.");
  } else {
    actions.push("Revenue is stable: run A/B pricing or bundled offers to unlock incremental growth.");
  }

  const totalModule = input.moduleCounter.tour + input.moduleCounter.car;
  if (totalModule > 0) {
    const tourShare = (input.moduleCounter.tour / totalModule) * 100;
    const carShare = (input.moduleCounter.car / totalModule) * 100;
    if (tourShare > 70) {
      actions.push("Demand is tour-heavy: improve car rental bundles to diversify revenue and reduce concentration risk.");
    } else if (carShare > 70) {
      actions.push("Demand is car-heavy: add tour cross-sells to increase attachment rate.");
    } else {
      actions.push("Balanced product mix: optimize cross-sell journeys to raise average ticket.");
    }
  }

  if (input.mostBookedService && input.topRevenueService && input.mostBookedService !== input.topRevenueService) {
    actions.push(`"${input.mostBookedService}" drives demand while "${input.topRevenueService}" drives revenue; use upsell paths from demand to higher-value services.`);
  }

  return actions.slice(0, 7);
}

async function buildAnalyticsAnswer(
  question: string,
  analyticsIntent: AnalyticsIntentMatch,
  user?: { id?: number; roleCode?: string | null }
): Promise<string> {
  const filters: { vendorId?: number } = {};
  if (user?.roleCode === "vendor" && typeof user.id === "number") {
    filters.vendorId = user.id;
  }

  const items = await storage.getBookingSalesLines(filters);
  if (items.length === 0) {
    return "I checked your database but there are no booking sales records yet, so I cannot compute analysis right now.";
  }

  const billableStatuses = new Set(["confirmed", "completed"]);
  const normalizedStatus = (value: string | null | undefined) =>
    (value ?? "").toString().trim().toLowerCase();
  const billable = items.filter((row) => billableStatuses.has(normalizedStatus(row.status)));
  const totalBookings = items.length;
  const billableBookings = billable.length;
  const cancelledBookings = items.filter((row) => normalizedStatus(row.status) === "cancelled").length;
  const pendingBookings = items.filter((row) => normalizedStatus(row.status) === "pending").length;
  const totalRevenue = billable.reduce((sum, row) => sum + row.total, 0);
  const averageTicket = billableBookings > 0 ? totalRevenue / billableBookings : 0;
  const cancelRate = percentage(cancelledBookings, totalBookings);
  const confirmRate = percentage(billableBookings, totalBookings);

  const bookingByService = new Map<string, number>();
  const revenueByService = new Map<string, number>();
  const moduleCounter = { tour: 0, car: 0 };
  for (const row of items) {
    const service = row.serviceName;
    bookingByService.set(service, (bookingByService.get(service) ?? 0) + 1);
    if (billableStatuses.has(normalizedStatus(row.status))) {
      revenueByService.set(service, (revenueByService.get(service) ?? 0) + row.total);
    }
    if (row.moduleType === "tour") moduleCounter.tour += 1;
    if (row.moduleType === "car") moduleCounter.car += 1;
  }

  const mostBooked = [...bookingByService.entries()].sort((a, b) => b[1] - a[1])[0];
  const topRevenueService = [...revenueByService.entries()].sort((a, b) => b[1] - a[1])[0];

  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 29);
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 30);
  const previousEnd = new Date(currentStart);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);

  const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;
  const currentRevenue = billable
    .filter((row) => inRange(new Date(row.bookingDate), currentStart, now))
    .reduce((sum, row) => sum + row.total, 0);
  const previousRevenue = billable
    .filter((row) => inRange(new Date(row.bookingDate), previousStart, previousEnd))
    .reduce((sum, row) => sum + row.total, 0);
  const revenueDeltaPct = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  const cancelLevel = classifyLevel(cancelRate, 8, 20);
  const confirmLevel = classifyLevel(confirmRate, 40, 75);
  const trendText = formatTrend(revenueDeltaPct);
  const improvementActions = buildImprovementActions({
    cancelRate,
    confirmRate,
    pendingBookings,
    totalBookings,
    moduleCounter,
    trendText,
    mostBookedService: mostBooked?.[0],
    topRevenueService: topRevenueService?.[0],
  });
  const actionListText = improvementActions.map((a, i) => `${i + 1}. ${a}`).join("\n");

  if (analyticsIntent.key === "most_booked") {
    return mostBooked
      ? `Most booked service is "${mostBooked[0]}" with ${mostBooked[1]} bookings. Current cancellation rate is ${cancelRate.toFixed(1)}% (${cancelLevel}), so demand is ${cancelLevel === "high" ? "strong but needs cancellation control" : "healthy"}.\n\nHow to improve further:\n${actionListText}`
      : "I checked your database but there is no identifiable most-booked service yet.";
  }

  if (analyticsIntent.key === "top_revenue_service") {
    return topRevenueService
      ? `Top revenue service is "${topRevenueService[0]}" with about ₱${topRevenueService[1].toFixed(2)} in billable revenue. Overall average ticket is ₱${averageTicket.toFixed(2)} across ${billableBookings} billable bookings.\n\nHow to improve further:\n${actionListText}`
      : "I checked your database but there is no billable revenue yet.";
  }

  if (analyticsIntent.key === "booking_volume") {
    return `Total bookings: ${totalBookings}. Billable: ${billableBookings}. Pending: ${pendingBookings}. Cancelled: ${cancelledBookings}. Confirmation health is ${confirmLevel} at ${confirmRate.toFixed(1)}%.\n\nHow to improve further:\n${actionListText}`;
  }

  if (analyticsIntent.key === "revenue_trend") {
    return `Revenue trend (latest 30 days): ₱${currentRevenue.toFixed(2)}, compared with previous 30 days: ₱${previousRevenue.toFixed(2)} (${trendText}). This indicates ${trendText.includes("up") ? "growth momentum" : trendText.includes("down") ? "a slowdown that needs action" : "a stable period"}.\n\nHow to improve further:\n${actionListText}`;
  }

  if (analyticsIntent.key === "cancellation_health") {
    return `Cancellation rate is ${cancelRate.toFixed(1)}% (${cancelledBookings}/${totalBookings}), which is ${cancelLevel}. ${cancelLevel === "high" ? "You should review service quality, scheduling, and payment friction." : "Current cancellation level is manageable."}\n\nHow to improve further:\n${actionListText}`;
  }

  if (analyticsIntent.key === "confirmation_health") {
    return `Confirmation rate is ${confirmRate.toFixed(1)}% (${billableBookings}/${totalBookings}), which is ${confirmLevel}. ${confirmLevel === "low" ? "Improving follow-up and checkout flow should help." : "This is a good conversion signal."}\n\nHow to improve further:\n${actionListText}`;
  }

  if (analyticsIntent.key === "module_mix") {
    const total = moduleCounter.tour + moduleCounter.car;
    const tourShare = percentage(moduleCounter.tour, total);
    const carShare = percentage(moduleCounter.car, total);
    return `Booking mix is Tours ${moduleCounter.tour} (${tourShare.toFixed(1)}%) and Cars ${moduleCounter.car} (${carShare.toFixed(1)}%). This shows where demand currently concentrates in your database.\n\nHow to improve further:\n${actionListText}`;
  }

  if (analyticsIntent.key === "average_ticket") {
    return `Average ticket value is ₱${averageTicket.toFixed(2)} based on ${billableBookings} billable bookings, with total billable revenue of ₱${totalRevenue.toFixed(2)}.\n\nHow to improve further:\n${actionListText}`;
  }

  return [
    `Sales overview from your database:`,
    `- Total bookings: ${totalBookings} (billable ${billableBookings}, pending ${pendingBookings}, cancelled ${cancelledBookings})`,
    `- Billable revenue: ₱${totalRevenue.toFixed(2)} | Avg ticket: ₱${averageTicket.toFixed(2)}`,
    `- Confirmation rate: ${confirmRate.toFixed(1)}% (${confirmLevel}) | Cancellation rate: ${cancelRate.toFixed(1)}% (${cancelLevel})`,
    `- Revenue trend (last 30 days vs previous): ${trendText}`,
    mostBooked ? `- Most booked: ${mostBooked[0]} (${mostBooked[1]} bookings)` : "- Most booked: N/A",
    "",
    "How to improve further:",
    ...improvementActions.map((a, i) => `${i + 1}. ${a}`),
  ].join("\n");
}

function detectBuiltinChatbotResponse(question: string): BuiltinChatbotMatch | null {
  const q = normalizeText(question);
  if (!q) return null;

  const matchAny = (patterns: RegExp[]) => patterns.some((p) => p.test(q));

  const carPatterns = [
    /\bcar\b/,
    /\bcars\b/,
    /\bvehicle\b/,
    /\bvehicles\b/,
    /\brental\b/,
    /\brent a car\b/,
    /\brent\b/,
    /\bauto\b/,
    /\bsuv\b/,
    /\bsedan\b/,
    /\bvan\b/,
  ];
  const tourPatterns = [
    /\btour\b/,
    /\btours\b/,
    /\btrip\b/,
    /\btrips\b/,
    /\bactivity\b/,
    /\bactivities\b/,
    /\battraction\b/,
    /\battractions\b/,
    /\bsightseeing\b/,
    /\bexcursion\b/,
  ];

  const hasCar = matchAny(carPatterns);
  const hasTour = matchAny(tourPatterns);
  const moduleType = hasCar && !hasTour ? "car" : hasTour && !hasCar ? "tour" : null;

  const nearMePatterns = [
    /\bnear\b/,
    /\bnear me\b/,
    /\bnearby\b/,
    /\bclosest\b/,
    /\baround me\b/,
    /\baround here\b/,
    /\bin my area\b/,
    /\bnear my location\b/,
    /\bclose to me\b/,
    /\bclose by\b/,
    /\bclosest to me\b/,
    /\bnear my place\b/,
    /\bnear my area\b/,
    /\bnear us\b/,
    /\bnear here\b/,
    /\bwithin walking distance\b/,
  ];
  const hasNearMe = matchAny(nearMePatterns);

  const bestDealPatterns = [
    /\bbest deal\b/,
    /\bbest deals\b/,
    /\bbest price\b/,
    /\blowest price\b/,
    /\blowest cost\b/,
    /\bcheapest\b/,
    /\bcheap\b/,
    /\bcheaper\b/,
    /\bbudget\b/,
    /\bmost affordable\b/,
    /\baffordable\b/,
    /\bbest value\b/,
    /\bgood deal\b/,
    /\bgreat deal\b/,
    /\bdiscount\b/,
    /\bdiscounted\b/,
    /\bon sale\b/,
    /\bsale\b/,
    /\bpromo\b/,
    /\bpromotion\b/,
    /\bdeal of the day\b/,
    /\bspecial offer\b/,
    /\boffers\b/,
    /\bbargain\b/,
    /\bvalue for money\b/,
  ];
  const hasBestDeal = matchAny(bestDealPatterns);

  const mostPopularPatterns = [
    /\bmost popular\b/,
    /\bpopular\b/,
    /\btop rated\b/,
    /\bhighest rated\b/,
    /\bbest rated\b/,
    /\btop\b/,
    /\btop picks\b/,
    /\btop choice\b/,
    /\btrending\b/,
    /\bpopular right now\b/,
    /\bmost booked\b/,
    /\bmost loved\b/,
    /\bhot\b/,
    /\bviral\b/,
    /\brecommended\b/,
    /\bfamous\b/,
  ];
  const hasMostPopular = matchAny(mostPopularPatterns);

  let intent = hasBestDeal ? "best_deal" : hasNearMe ? "near_me" : hasMostPopular ? "most_popular" : null;
  if (!intent && q.includes("more")) {
    intent = "most_popular";
  }
  if (!intent) return null;

  return {
    intent,
    answer: "",
    suggestions: [],
    moduleType,
  };
}

type SuggestionItem = {
  id: number;
  title: string;
  price: string | null;
  salePrice: string | null;
  imageUrl: string | null;
  kind: "tour" | "car";
  featured: boolean | null;
};

function wantsMoreSuggestions(question: string): boolean {
  const q = normalizeText(question);
  if (!q) return false;
  return (
    q.includes("more") ||
    q.includes("another") ||
    q.includes("else") ||
    q.includes("others") ||
    q.includes("more than") ||
    q.includes("show more") ||
    q.includes("more options") ||
    q.includes("more items")
  );
}

function clampSuggestionCount(count: number): number {
  if (Number.isNaN(count)) return 3;
  return Math.max(1, Math.min(10, count));
}

const FAQ_STOPWORDS = new Set([
  "what", "which", "who", "where", "when", "why", "how", "can", "do", "does", "did",
  "is", "are", "was", "were", "a", "an", "the", "of", "to", "for", "and", "or", "on",
  "in", "at", "by", "with", "your", "our", "you", "we", "it", "this", "that", "from",
  "be", "as", "if", "any", "please", "about",
]);

function buildFaqKeywords(question: string, answer: string): string[] {
  const tokens = tokenize(`${question} ${answer}`);
  const filtered = tokens.filter((t) => t.length >= 3 && !FAQ_STOPWORDS.has(t));
  return Array.from(new Set(filtered)).slice(0, 18);
}

function buildFaqAliases(question: string): string[] {
  const aliases = new Set<string>();
  const trimmed = question.trim();
  if (!trimmed) return [];
  aliases.add(trimmed.replace(/\?$/, ""));
  aliases.add(trimmed.replace(/travelista travel and tours/gi, "travelista"));
  aliases.add(trimmed.replace(/TRAVELISTA Travel and Tours/g, "Travelista"));
  return Array.from(aliases)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== trimmed.toLowerCase());
}

function isConfidentFaqMatch(
  best: { score: number } | undefined,
  second: { score: number } | undefined,
  minScore: number
): boolean {
  if (!best || best.score < minScore) return false;
  const gap = best.score - (second?.score ?? 0);
  return best.score >= 0.72 || gap >= 0.08;
}

const travelistaFaqSeed: Array<{ question: string; answer: string }> = [
  {
    question: "What types of tours does Travelista Travel and Tours offer?",
    answer:
      "Travelista Travel and Tours provides a wide range of travel packages including local tours, customized group tours, and special packages for destinations across the Philippines.",
  },
  {
    question: "How can I book a tour with TRAVELISTA Travel and Tours?",
    answer:
      "You can book by sending a message on their Facebook page, calling their contact number listed on the page, or visiting their office during business hours.",
  },
  {
    question: "Are the tour packages customizable?",
    answer:
      "Yes, TRAVELISTA Travel and Tours allows customization of tours to fit your preferences and travel needs. You can discuss your preferred destinations and activities with their travel consultants.",
  },
  {
    question: "What is the cancellation or refund policy?",
    answer:
      "Our cancellation policy depends on the specific tour or package. Please refer to the terms and conditions provided during booking or contact us for more details.",
  },
  {
    question: "Does TRAVELISTA Travel and Tours provide transport and accommodation?",
    answer:
      "Yes, many of their packages include transportation and lodging. They also offer assistance in arranging hotel stays and travel logistics to ensure a smooth experience.",
  },
  {
    question: "What are your business hours?",
    answer: "We are open from 8:00 AM to 6:00 PM daily.",
  },
  {
    question: "Where is your office located?",
    answer: "Our office is located at 61 D. LACAO ST PUERTO PRINCESA CITY.",
  },
  {
    question: "How can I contact you?",
    answer:
      "You can reach us via phone at +12345678901, email at travelista.travelandtours@gmail.com.",
  },
  {
    question: "How do I book a tour or package?",
    answer: "You can book through our website, by calling us, or by visiting our office.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept cash, GCASH and online bank transfers.",
  },
  {
    question: "What is your bank?",
    answer: "Banco De Oro (BDO).",
  },
  {
    question: "What is your bank account details?",
    answer:
      "For bank deposit, please remit payment to SWIFT CODE / BIC: TRVLLSTTA, Account Name: TRAVELISTA TRAVEL AND TOURS, Bank Name / Branch: Banco De Oro - Rockwell Center, Makati City, Bank Account No.: 00 40 000 11 888.",
  },
  {
    question: "Is a deposit required to secure my booking?",
    answer: "Yes, a deposit is required. The amount varies depending on the tour or package.",
  },
  {
    question: "What is included in the tour package?",
    answer:
      "Our tour packages typically include transportation, accommodation, meals (as specified), entrance fees, and a tour guide. Please check the specific inclusions for each package.",
  },
  {
    question: "Are flights included in your packages?",
    answer:
      "Flights can be included upon request. Please let us know your preferred travel dates and origin so we can provide you with the best options.",
  },
  {
    question: "Can I reschedule my tour?",
    answer:
      "Rescheduling is subject to availability and may incur additional charges. Please contact us as soon as possible to discuss your options.",
  },
  {
    question: "What happens if the tour is canceled due to bad weather?",
    answer: "If a tour is canceled due to bad weather, we will offer a reschedule or a full refund.",
  },
  {
    question: "What should I bring on the tour?",
    answer:
      "We recommend bringing comfortable clothing, swimwear, sunscreen, a hat, sunglasses, a reusable water bottle, and a camera.",
  },
  {
    question: "Are meals provided during the tour?",
    answer: "Some tours include meals. Please check the tour details for specific information.",
  },
  {
    question: "Are your tours child-friendly?",
    answer:
      "Yes, many of our tours are suitable for children. Please inquire about age restrictions or recommendations for specific tours.",
  },
  {
    question: "Do you offer private tours?",
    answer: "Yes, we offer private tours. Please contact us for arrangements and pricing.",
  },
  {
    question: "Do I need travel insurance?",
    answer: "While not required, we highly recommend purchasing travel insurance for your peace of mind.",
  },
  {
    question: "What health and safety protocols are in place?",
    answer:
      "We follow all local health and safety guidelines to ensure a safe and enjoyable experience for our guests. This includes regular sanitization, social distancing, and mask requirements where applicable.",
  },
  {
    question: "Are there any travel restrictions I should be aware of?",
    answer:
      "Please check the latest travel advisories and requirements from the local government and your country of origin before traveling.",
  },
  {
    question: "Can you customize a tour package for me?",
    answer: "Yes, we can customize tour packages to fit your preferences and budget.",
  },
  {
    question: "Do you offer group discounts?",
    answer: "Yes, we offer discounts for large groups. Please contact us for more information.",
  },
  {
    question: "Can you arrange transportation from the airport?",
    answer: "Yes, we can arrange airport transfers. Please provide your flight details when booking.",
  },
  {
    question: "Do you offer hotel booking services?",
    answer: "Yes, we can assist with hotel bookings.",
  },
  {
    question: "Can you help with visa applications?",
    answer:
      "We can provide guidance and information on visa requirements, but we do not process visa applications directly.",
  },
  {
    question: "Do you offer car rental services?",
    answer: "Yes, we can arrange car rentals for your convenience.",
  },
];

function priceNumber(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function effectivePrice(item: SuggestionItem): number {
  return priceNumber(item.salePrice ?? item.price);
}

function pickSentenceVariant(key: string, count: number): number {
  const base = key.length + count;
  return base % 3;
}

function formatSuggestionList(suggestions: SuggestionItem[]): string {
  if (suggestions.length === 0) return "";
  const lines = suggestions.map((item, index) => {
    const priceValue = item.salePrice ?? item.price;
    const priceLabel = priceValue ? ` - ₱${priceValue}` : "";
    return `${index + 1}. ${item.title} (${item.kind})${priceLabel}`;
  });
  return lines.join("\n");
}

async function fetchSuggestions(
  intent: BuiltinChatbotMatch["intent"],
  count: number,
  moduleType: "car" | "tour" | null,
  exclude: SuggestionItem[],
  locationId: number | null
): Promise<SuggestionItem[]> {
  const limitPerType = Math.max(3, count);
  let toursList: SuggestionItem[] = [];
  let carsList: SuggestionItem[] = [];

  if (moduleType !== "car") {
    const tourRows = await db
      .select({
        id: tours.id,
        title: tours.title,
        price: tours.price,
        salePrice: tours.salePrice,
        imageUrl: tours.imageUrl,
        isFeatured: tours.isFeatured,
      })
      .from(tours)
      .where(
        and(
          eq(tours.status, "publish"),
          isNull(tours.deletedAt),
          locationId ? eq(tours.locationId, locationId) : sql`true`
        )
      )
      .orderBy(desc(tours.isFeatured), desc(tours.id))
      .limit(limitPerType);

    toursList = tourRows.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price ?? null,
      salePrice: r.salePrice ?? null,
      imageUrl: r.imageUrl ?? null,
      kind: "tour",
      featured: r.isFeatured ?? null,
    }));
  }

  if (moduleType !== "tour") {
    const carRows = await db
      .select({
        id: cars.id,
        title: cars.title,
        price: cars.price,
        salePrice: cars.salePrice,
        imageUrl: cars.imageUrl,
        isFeatured: cars.isFeatured,
      })
      .from(cars)
      .where(
        and(
          eq(cars.status, "publish"),
          isNull(cars.deletedAt),
          locationId ? eq(cars.locationId, locationId) : sql`true`
        )
      )
      .orderBy(desc(cars.isFeatured), desc(cars.id))
      .limit(limitPerType);

    carsList = carRows.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price ?? null,
      salePrice: r.salePrice ?? null,
      imageUrl: r.imageUrl ?? null,
      kind: "car",
      featured: r.isFeatured ?? null,
    }));
  }

  const excludeKey = new Set(exclude.map((item) => `${item.kind}:${item.id}`));
  let combined = [...toursList, ...carsList].filter((item) => !excludeKey.has(`${item.kind}:${item.id}`));

  if (intent === "best_deal") {
    combined = combined.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  } else if (intent === "most_popular") {
    combined = combined.sort((a, b) => {
      const aFeat = a.featured ? 1 : 0;
      const bFeat = b.featured ? 1 : 0;
      if (aFeat !== bFeat) return bFeat - aFeat;
      return effectivePrice(a) - effectivePrice(b);
    });
  } else {
    combined = combined.sort((a, b) => {
      const aFeat = a.featured ? 1 : 0;
      const bFeat = b.featured ? 1 : 0;
      if (aFeat !== bFeat) return bFeat - aFeat;
      return effectivePrice(a) - effectivePrice(b);
    });
  }

  if (locationId && combined.length === 0) {
    return fetchSuggestions(intent, count, moduleType, exclude, null);
  }

  return combined.slice(0, count);
}

function splitSuggestions(suggestions: SuggestionItem[]) {
  return {
    tours: suggestions.filter((s) => s.kind === "tour"),
    cars: suggestions.filter((s) => s.kind === "car"),
  };
}

async function resolveLocationIdForUser(user?: { city?: string | null; country?: string | null }): Promise<number | null> {
  if (!user) return null;
  const candidates = [user.city, user.country]
    .map((v) => (v ? String(v).trim() : ""))
    .filter(Boolean);

  for (const name of candidates) {
    const lower = name.toLowerCase();
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(sql`lower(${locations.name}) = ${lower}`, isNull(locations.deletedAt)))
      .limit(1);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
}

async function fetchTourAttributeIds(tourId: number): Promise<number[]> {
  const rows = await db
    .select({ attributeId: tourAttributes.attributeId })
    .from(tourAttributes)
    .where(eq(tourAttributes.tourId, tourId));
  return rows.map((row) => row.attributeId);
}

async function ensureAdminSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      status TEXT NOT NULL DEFAULT 'publish',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attribute_terms (
      id SERIAL PRIMARY KEY,
      attribute_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS banner_image_url TEXT;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS banner_image_public_id TEXT;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS gallery JSONB;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS meta_title TEXT;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS meta_description TEXT;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS service_fee_enabled BOOLEAN DEFAULT FALSE;`);
  await db.execute(sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS open_hours_enabled BOOLEAN DEFAULT FALSE;`);
  await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS gallery JSONB;`);
  await db.execute(sql`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS slug TEXT;`);
  await db.execute(sql`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS position_order INTEGER DEFAULT 0;`);
  await db.execute(sql`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS hide_in_detail BOOLEAN DEFAULT FALSE;`);
  await db.execute(sql`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS hide_in_filter BOOLEAN DEFAULT FALSE;`);
  await db.execute(sql`ALTER TABLE attributes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await ensureAdminSchema();

  // ===================== AUTH =====================

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const normalizedInput = {
        ...input,
        email: input.email.trim().toLowerCase(),
        username: input.username.trim(),
        businessName: input.businessName?.trim(),
      };

      if (normalizedInput.role === "vendor" && !normalizedInput.businessName) {
        return res.status(400).json({ message: "Business name is required for vendor accounts" });
      }

      const existing = await storage.getUserByEmail(normalizedInput.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const existingUsername = await storage.getUserByUsername(normalizedInput.username);
      if (existingUsername) return res.status(400).json({ message: "Username already taken" });

      const role = await storage.getRoleByCode(normalizedInput.role);
      if (!role) return res.status(400).json({ message: "Invalid role" });

      const hashedPassword = await bcrypt.hash(normalizedInput.password, 10);
      const user = await storage.createUser({
        firstName: normalizedInput.firstName,
        lastName: normalizedInput.lastName,
        username: normalizedInput.username,
        email: normalizedInput.email,
        password: hashedPassword,
        roleId: role.id,
      });

      if (normalizedInput.role === "vendor") {
        await storage.createVendorProfile({
          userId: user.id,
          businessName: normalizedInput.businessName!,
          commissionType: "default",
          commissionValue: "0",
        });
      }

      const authUser = await storage.getUserById(user.id);
      const token = signToken({ userId: user.id, roleCode: role.code });
      return res.status(201).json({ token, user: authUser });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }

      console.error("Registration error:", e);
      if (typeof e === "object" && e !== null && "code" in e && (e as any).code === "23505") {
        const constraint = (e as any).constraint;
        if (constraint?.includes("users_email")) {
          return res.status(400).json({ message: "Email already registered" });
        }
        if (constraint?.includes("users_username")) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      const authUser = await storage.getUserById(user.id);
      const token = signToken({ userId: user.id, roleCode: authUser!.roleCode });
      return res.json({ token, user: authUser });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===================== USER =====================

  app.get(api.user.profile.path, requireAuth, async (req, res) => {
    const user = (req as any).user;
    return res.json(user);
  });

  app.put(api.user.updateProfile.path, requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = updateProfileSchema.parse(normalizeProfileBody(req.body));
      if (!rejectEmptyProfileUpdate(input, res)) return;
      const updated = await storage.updateUser(user.id, input);
      return res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/user/profile/update", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = updateProfileSchema.parse(normalizeProfileBody(req.body));
      if (!rejectEmptyProfileUpdate(input, res)) return;
      const updated = await storage.updateUser(user.id, input);
      return res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===================== IMAGE UPLOAD =====================

app.post('/api/upload/image', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 10 }]), async (req, res) => {
    try {
      // Handle multer.fields structure: req.files[fieldname][]
      const files = (req.files ?? {}) as MulterFiles;
      const uploadFiles: Express.Multer.File[] = [
        ...(Array.isArray(files.image) ? files.image : []),
        ...(Array.isArray(files.images) ? files.images : []),
      ];

      if (uploadFiles.length === 0) {
        return res.status(400).json({ message: 'No file uploaded - use field "image" or "images"' });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      for (const file of uploadFiles) {
        if (!allowedTypes.includes(file.mimetype)) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
        }
      }

      // Validate file size (5MB max)
      for (const file of uploadFiles) {
        if (file.size > 5 * 1024 * 1024) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ message: 'File size must be less than 5MB' });
        }
      }

      const uploads: Array<{ url: string; publicId: string }> = [];
      for (const file of uploadFiles) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'travel-agency',
          format: 'webp', // Convert to WebP
          transformation: [
            { width: 1200, height: 800, crop: 'limit' }, // Resize if larger
            { quality: 'auto' }, // Auto quality optimization
            { fetch_format: 'auto' } // Auto format optimization
          ]
        });
        uploads.push({
          url: result.secure_url,
          publicId: result.public_id,
        });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }

      const firstUpload = uploads[0];

      res.json({
        url: firstUpload?.url,
        publicId: firstUpload?.publicId,
        images: uploads,
      });
    } catch (error) {
      console.error('Upload error:', error);
      // Clean up temp files if they exist
      const files = (req.files ?? {}) as MulterFiles;
      const cleanupFiles = [
        ...(Array.isArray(files.image) ? files.image : []),
        ...(Array.isArray(files.images) ? files.images : []),
      ];
      for (const file of cleanupFiles) {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      res.status(500).json({ message: 'Upload failed' });
    }
  });



  // Delete image from Cloudinary
  app.delete('/api/upload/image/:publicId', requireAuth, async (req, res) => {
    try {
      const publicIdParam = req.params.publicId;
      const publicId = Array.isArray(publicIdParam) ? publicIdParam[0] : publicIdParam;
      
      if (!publicId) {
        return res.status(400).json({ message: 'Public ID is required' });
      }

      // Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        res.json({ message: 'Image deleted successfully' });
      } else {
        res.status(400).json({ message: 'Failed to delete image' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ message: 'Delete failed' });
    }
  });

  // ===================== ADMIN =====================

  app.get(api.admin.roles.path, requireAuth, async (req, res) => {
    const roles = await storage.getRoles();
    return res.json(roles);
  });

  app.get(api.admin.users.list.path, requireAuth, requireAdmin, async (req, res) => {
    const currentUser = (req as any).user;
    const users = await storage.getUsers();
    return res.json(users.filter((u) => u.id !== currentUser.id));
  });

  app.get(api.admin.users.get.path, requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Not found" });
    return res.json(user);
  });

  app.put(api.admin.users.update.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "Not found" });

      const adminUpdateUserSchema = updateProfileSchema.extend({
        // Backward compatibility for existing frontend payloads.
        userName: z.string().optional(),
        role: z.enum(["administrator", "vendor", "customer"]).optional(),
        roleCode: z.enum(["administrator", "vendor", "customer"]).optional(),
        roleId: z.number().int().positive().optional(),
      });
      const input = adminUpdateUserSchema.parse(normalizeProfileBody(req.body));
      const normalizedInput: Record<string, unknown> = { ...input };
      if (
        typeof normalizedInput.userName === "string" &&
        normalizedInput.userName.trim() &&
        normalizedInput.username === undefined
      ) {
        normalizedInput.username = normalizedInput.userName.trim();
      }
      delete normalizedInput.userName;

      const roleCodeInput = (normalizedInput.roleCode ?? normalizedInput.role) as
        | "administrator"
        | "vendor"
        | "customer"
        | undefined;
      if (roleCodeInput) {
        const role = await storage.getRoleByCode(roleCodeInput);
        if (!role) return res.status(400).json({ message: "Invalid role" });
        normalizedInput.roleId = role.id;
      } else if (normalizedInput.roleId !== undefined) {
        const roleExists = (await storage.getRoles()).some((r) => r.id === Number(normalizedInput.roleId));
        if (!roleExists) return res.status(400).json({ message: "Invalid roleId" });
      }

      delete normalizedInput.role;
      delete normalizedInput.roleCode;

      if (!rejectEmptyProfileUpdate(normalizedInput, res)) return;
      const updated = await storage.updateUser(
        id,
        normalizedInput as Partial<UpdateProfileInput> & { roleId?: number },
      );
      return res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.admin.users.delete.path, requireAuth, requireAdmin, async (req, res) => {
    const currentUser = (req as any).user;
    const id = Number(req.params.id);
    if (id === currentUser.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Not found" });
    await storage.deleteUser(id);
    return res.status(204).end();
  });

  // ===================== TOURS =====================

  app.get(api.tours.list.path, async (req, res) => {
    const all = await storage.getTours();
    const active = all.filter((t) => !t.deletedAt);
    const withAttributes = await Promise.all(
      active.map(async (tour) => ({
        ...tour,
        attributeIds: await fetchTourAttributeIds(tour.id),
      }))
    );
    res.json(withAttributes);
  });

  app.get(api.tours.get.path, async (req, res) => {
    const tour = await storage.getTour(Number(req.params.id));
    if (!tour || tour.deletedAt) return res.status(404).json({ message: "Not found" });
    const attributeIds = await fetchTourAttributeIds(tour.id);
    res.json({ ...tour, attributeIds });
  });

  app.post(api.tours.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.tours.create.input.parse(normalizeTourBody(req.body));
      const { attributeIds, ...tourData } = input;
      const tour = await storage.createTour({
        ...tourData,
        authorId: (req as any).user?.id,
      });
      if (attributeIds && attributeIds.length > 0) {
        const values = attributeIds.map(attrId => ({ tourId: tour.id, attributeId: attrId }));
        await db.insert(tourAttributes).values(values);
      }
      const savedAttributeIds = await fetchTourAttributeIds(tour.id);
      res.status(201).json({ ...tour, attributeIds: savedAttributeIds });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error("Error creating tour:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.tours.update.path, async (req, res) => {
    try {
      const input = api.tours.update.input.parse(normalizeTourBody(req.body));
      if (!rejectEmptyTourUpdate(input, res)) return;
      
      const { attributeIds, ...tourData } = input;
      
      // Get current tour to check for image changes
      const currentTour = await storage.getTour(Number(req.params.id));
      if (!currentTour) return res.status(404).json({ message: "Not found" });
      
      // If imageUrl is being changed or removed, delete old image
      if (tourData.imageUrl !== undefined && tourData.imageUrl !== currentTour.imageUrl) {
        await deleteOldImage(currentTour.imageUrl);
      }
      
      const tour = await storage.updateTour(Number(req.params.id), tourData);
      if (!tour) return res.status(404).json({ message: "Not found" });
      if (attributeIds !== undefined) {
        // Delete existing attributes
        await db.delete(tourAttributes).where(eq(tourAttributes.tourId, tour.id));
        // Insert new ones
        if (attributeIds.length > 0) {
          const values = attributeIds.map(attrId => ({ tourId: tour.id, attributeId: attrId }));
          await db.insert(tourAttributes).values(values);
        }
      }
      const savedAttributeIds = await fetchTourAttributeIds(tour.id);
      res.json({ ...tour, attributeIds: savedAttributeIds });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.delete(api.tours.delete.path, async (req, res) => {
    const tour = await storage.getTour(Number(req.params.id));
    if (tour) {
      await deleteOldImage(tour.imageUrl);
    }
    await storage.deleteTour(Number(req.params.id));
    res.status(204).end();
  });

  app.get(api.tours.recovery.list.path, requireAuth, requireAdmin, async (_req, res) => {
    const deleted = await storage.getDeletedTours();
    res.json(deleted);
  });

  app.patch(api.tours.recovery.restore.path, requireAuth, requireAdmin, async (req, res) => {
    const restored = await storage.restoreTour(Number(req.params.id));
    if (!restored) return res.status(404).json({ message: "Not found" });
    res.json(restored);
  });

  app.delete(api.tours.recovery.forceDelete.path, requireAuth, requireAdmin, async (req, res) => {
    await storage.forceDeleteTour(Number(req.params.id));
    res.status(204).end();
  });

  // ===================== CARS =====================

  app.get(api.cars.list.path, async (req, res) => {
    const all = await storage.getCars();
    res.json(all.filter((c) => !c.deletedAt));
  });

  app.get(api.cars.get.path, async (req, res) => {
    const car = await storage.getCar(Number(req.params.id));
    if (!car || car.deletedAt) return res.status(404).json({ message: "Not found" });
    res.json(car);
  });

  app.post(api.cars.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.cars.create.input.parse(req.body);
      console.log("Creating car with input:", input);
      const { attributeIds, ...carData } = input;
      const car = await storage.createCar({
        ...carData,
        authorId: (req as any).user?.id,
      });
      if (attributeIds && attributeIds.length > 0) {
        const values = attributeIds.map(attrId => ({ carId: car.id, attributeId: attrId }));
        await db.insert(carAttributes).values(values);
      }
      res.status(201).json(car);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error("Error creating car:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.cars.update.path, async (req, res) => {
    try {
      const input = api.cars.update.input.parse(normalizeCarBody(req.body));
      if (!rejectEmptyCarUpdate(input, res)) return;
      
      const { attributeIds, ...carData } = input;
      
      // Get current car to check for image changes
      const currentCar = await storage.getCar(Number(req.params.id));
      if (!currentCar) return res.status(404).json({ message: "Not found" });
      
      // If imageUrl is being changed or removed, delete old image
      if (carData.imageUrl !== undefined && carData.imageUrl !== currentCar.imageUrl) {
        await deleteOldImage(currentCar.imageUrl);
      }
      
      const car = await storage.updateCar(Number(req.params.id), carData);
      if (!car) return res.status(404).json({ message: "Not found" });
      if (attributeIds !== undefined) {
        // Delete existing attributes
        await db.delete(carAttributes).where(eq(carAttributes.carId, car.id));
        // Insert new ones
        if (attributeIds.length > 0) {
          const values = attributeIds.map(attrId => ({ carId: car.id, attributeId: attrId }));
          await db.insert(carAttributes).values(values);
        }
      }
      res.json(car);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.delete(api.cars.delete.path, async (req, res) => {
    const car = await storage.getCar(Number(req.params.id));
    if (car) {
      await deleteOldImage(car.imageUrl);
    }
    await storage.deleteCar(Number(req.params.id));
    res.status(204).end();
  });

  // ===================== LOOKUPS =====================

  app.get(api.locations.list.path, async (req, res) => {
    res.json(await storage.getLocations());
  });

  app.get(api.attributes.list.path, async (req, res) => {
    res.json(await storage.getAttributes());
  });

  app.post(api.attributes.create.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const input = api.attributes.create.input.parse(req.body);
      const created = await storage.createAttribute(input);
      res.status(201).json(created);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.attributes.update.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.attributes.update.input.parse(req.body);
      const updated = await storage.updateAttribute(id, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.attributes.delete.path, requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteAttribute(Number(req.params.id));
    res.status(204).end();
  });

  app.get(api.attributes.terms.list.path, async (req, res) => {
    const attributeId = Number(req.params.id);
    res.json(await storage.getAttributeTerms(attributeId));
  });

  app.post(api.attributes.terms.create.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const attributeId = Number(req.params.id);
      const input = api.attributes.terms.create.input.parse(req.body);
      const created = await storage.createAttributeTerm({
        attributeId,
        name: input.name,
        slug: input.slug,
      });
      res.status(201).json(created);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.attributes.terms.delete.path, requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteAttributeTerm(Number(req.params.termId));
    res.status(204).end();
  });

  app.get(api.categories.list.path, async (_req, res) => {
    res.json(await storage.getCategories());
  });

  app.post(api.categories.create.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const created = await storage.createCategory({
        ...input,
        parentId: input.parentId ?? null,
        status: input.status ?? "publish",
      });
      res.status(201).json(created);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.categories.update.path, requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.categories.update.input.parse(req.body);
      const updated = await storage.updateCategory(id, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.categories.delete.path, requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).end();
  });

  // ===================== CAR RENTALS =====================
  app.get(api.carRentals.list.path, requireAuth, async (req, res) => {
    const viewer = (req as any).user;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    if (userId && userId !== viewer.id && viewer.roleCode !== "administrator") {
      return res.status(403).json({ message: "Unauthorized to view other user's rentals" });
    }
    const rentals = await storage.getCarRentals({ userId: viewer.roleCode === "administrator" ? userId : viewer.id });
    res.json(rentals);
  });

  // ===================== TOUR BOOKINGS =====================
  // ===================== REPORTS =====================
app.get('/api/reports/tours', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      if (user.roleCode === 'vendor') {
        filters.vendorId = user.id;
      }
      const summary = await storage.getTourSummary(filters);
      res.json(summary);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });


app.get('/api/reports/cars', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      if (user.roleCode === 'vendor') {
        filters.vendorId = user.id;
      }
      const summary = await storage.getCarSummary(filters);
      res.json(summary);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });


  app.get('/api/reports/bookings', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      if (user.roleCode === 'vendor') {
        filters.vendorId = user.id;
      }
      const [summary, items] = await Promise.all([
        storage.getBookingStats(filters),
        storage.getBookingSalesLines(filters),
      ]);
      const totals = items.reduce(
        (acc, item) => {
          acc.amount += item.amount;
          acc.tax += item.tax;
          acc.total += item.total;
          return acc;
        },
        { amount: 0, tax: 0, total: 0 },
      );
      res.json({
        summary,
        items,
        taxRate: items[0]?.taxRate ?? 0.12,
        totals,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/reports/dashboard', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      if (user.roleCode === 'vendor') {
        filters.vendorId = user.id;
      }
      const [tourSummary, carSummary, bookingStats, bookingItems] = await Promise.all([
        storage.getTourSummary(filters),
        storage.getCarSummary(filters),
        storage.getBookingStats(filters),
        storage.getBookingSalesLines(filters),
      ]);

      const servicesCount = tourSummary.reduce((sum, row) => sum + row.count, 0) +
        carSummary.reduce((sum, row) => sum + row.count, 0);
      const totalAmount = bookingItems.reduce((sum, row) => sum + row.amount, 0);
      const totalTax = bookingItems.reduce((sum, row) => sum + row.tax, 0);
      const totalRevenue = bookingItems.reduce((sum, row) => sum + row.total, 0);

      const chartByDay = new Map<string, { date: string; revenue: number; earning: number }>();
      for (const item of bookingItems) {
        const date = new Date(item.bookingDate).toISOString().split('T')[0];
        const current = chartByDay.get(date) ?? { date, revenue: 0, earning: 0 };
        current.revenue += item.total;
        current.earning += item.amount;
        chartByDay.set(date, current);
      }
      const chart = Array.from(chartByDay.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

      const recentBookings = [...bookingItems]
        .sort((a, b) => b.bookingId - a.bookingId)
        .slice(0, 10)
        .map((item) => ({
          id: item.bookingId,
          item: item.serviceName,
          total: item.total,
          paid: item.amount,
          status: item.status,
          createdAt: item.bookingDate,
        }));

      res.json({
        metrics: {
          revenue: totalRevenue,
          earning: totalAmount,
          bookings: bookingItems.length,
          services: servicesCount,
          tax: totalTax,
        },
        chart,
        recentBookings,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error("Dashboard report error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/reports/revenues', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      const isAdmin = user.roleCode === 'administrator';

      const now = new Date();
      const fallbackEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const fallbackStart = new Date(fallbackEnd);
      fallbackStart.setDate(fallbackStart.getDate() - 6);
      fallbackStart.setHours(0, 0, 0, 0);

      const startDate = filters.fromDate
        ? new Date(filters.fromDate)
        : fallbackStart;
      const endDate = filters.toDate
        ? new Date(filters.toDate)
        : fallbackEnd;
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const scopedFilters = {
        ...filters,
        fromDate: startDate.toISOString(),
        toDate: endDate.toISOString(),
      };

      const bookingItems = await storage.getBookingSalesLines(scopedFilters);
      const visibleItems = isAdmin
        ? bookingItems
        : bookingItems.filter(
            (item) =>
              item.serviceOwnerId === user.id || item.bookingUserId === user.id,
          );

      const normalizeStatus = (status: string | null | undefined) =>
        (status ?? '').toString().trim().toLowerCase();
      const billableStatuses = new Set(['confirmed', 'completed']);
      const billableItems = visibleItems.filter((item) =>
        billableStatuses.has(normalizeStatus(item.status)),
      );
      const earnings = billableItems.reduce((sum, row) => sum + row.amount, 0);
      const totalRevenue = billableItems.reduce((sum, row) => sum + row.total, 0);
      const totalTax = billableItems.reduce((sum, row) => sum + row.tax, 0);
      const pendingBookings = visibleItems.filter(
        (item) => normalizeStatus(item.status) === 'pending',
      ).length;
      const services = new Set(
        billableItems.map((item) => `${item.moduleType}:${item.serviceName}`),
      ).size;

      const chartByDay = new Map<string, { date: string; revenue: number; earning: number }>();
      for (const item of billableItems) {
        const date = new Date(item.bookingDate).toISOString().split('T')[0];
        const current = chartByDay.get(date) ?? { date, revenue: 0, earning: 0 };
        current.revenue += item.total;
        current.earning += item.amount;
        chartByDay.set(date, current);
      }

      const chart = Array.from(chartByDay.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      res.json({
        metrics: {
          pending: pendingBookings,
          earnings,
          bookings: billableItems.length,
          services,
          revenue: totalRevenue,
          tax: totalTax,
        },
        chart,
        fromDate: startDate.toISOString(),
        toDate: endDate.toISOString(),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error("Revenue report error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  app.get('/api/reports/locations', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsedFilters = reportFiltersSchema.parse(req.query);
      const filters = parsedFilters;
      if (user.roleCode === 'vendor') {
        filters.vendorId = user.id;
      }
      const stats = await storage.getLocationStats(filters);
      res.json(stats);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // ===================== TOUR BOOKINGS =====================
  app.get(api.tourBookings!.list.path, requireAuth, async (req, res) => {
    const viewer = (req as any).user;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    if (userId && userId !== viewer.id && viewer.roleCode !== "administrator") {
      return res.status(403).json({ message: "Unauthorized to view other user's bookings" });
    }
    const bookings = await storage.getTourBookings({ userId: viewer.roleCode === "administrator" ? userId : viewer.id });
    res.json(bookings);
  });

  app.post(api.tourBookings!.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.tourBookings!.create.input.parse({
        ...req.body,
        tourId: Number(req.body.tourId)
      });
      const booking = await storage.createTourBooking({
        userId: (req as any).user.id,
        moduleType: "tour",
        moduleId: input.tourId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        buyerPhone: input.buyerPhone,
        status: "confirmed",
      });
      // Create notifications for buyer and vendor (if any)
      try {
        const buyerId = (req as any).user.id as number;
        const tour = await storage.getTour(input.tourId);
        const buyerNotification = await storage.createNotification({
          userId: buyerId,
          title: "Tour booking confirmed",
          message: `Your booking for "${tour?.title ?? "tour"}" is confirmed.`,
          type: "booking",
          data: { moduleType: "tour", moduleId: input.tourId, bookingId: booking.id },
        });
        (global as any).emitNotification?.(buyerId, buyerNotification);

        if (tour?.authorId && tour.authorId !== buyerId) {
          const vendorNotification = await storage.createNotification({
            userId: tour.authorId,
            title: "New tour booking",
            message: `A new booking was made for "${tour.title}".`,
            type: "booking",
            data: { moduleType: "tour", moduleId: input.tourId, bookingId: booking.id, buyerId },
          });
          (global as any).emitNotification?.(tour.authorId, vendorNotification);
        }
      } catch (notifyErr) {
        console.error("Tour booking notification error:", notifyErr);
      }
      res.status(201).json(booking);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, errors: e.errors });
      }
      console.error("Error creating tour booking:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message: "Internal Error", error: errorMessage });
    }
  });

  app.delete(api.tourBookings!.delete.path, requireAuth, async (req, res) => {
    const bookingId = Number(req.params.id);
    const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (booking.length === 0 || booking[0].status === "cancelled") {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking[0].userId !== (req as any).user.id) {
      return res.status(403).json({ message: "Unauthorized to cancel this booking" });
    }
    await storage.cancelTourBooking(bookingId);
    res.status(204).end();
  });

  app.post(api.carRentals.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.carRentals.create.input.parse({
        ...req.body,
        carId: Number(req.body.carId)
      });
      const rental = await storage.createCarRental({
        userId: (req as any).user.id,
        moduleType: "car",
        moduleId: input.carId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        buyerPhone: input.buyerPhone,
        status: "confirmed",
      });
      // Create notifications for buyer and vendor (if any)
      try {
        const buyerId = (req as any).user.id as number;
        const car = await storage.getCar(input.carId);
        const buyerNotification = await storage.createNotification({
          userId: buyerId,
          title: "Car rental confirmed",
          message: `Your rental for "${car?.title ?? "car"}" is confirmed.`,
          type: "booking",
          data: { moduleType: "car", moduleId: input.carId, bookingId: rental.id },
        });
        (global as any).emitNotification?.(buyerId, buyerNotification);

        if (car?.authorId && car.authorId !== buyerId) {
          const vendorNotification = await storage.createNotification({
            userId: car.authorId,
            title: "New car rental",
            message: `A new rental was made for "${car.title}".`,
            type: "booking",
            data: { moduleType: "car", moduleId: input.carId, bookingId: rental.id, buyerId },
          });
          (global as any).emitNotification?.(car.authorId, vendorNotification);
        }
      } catch (notifyErr) {
        console.error("Car rental notification error:", notifyErr);
      }
      res.status(201).json(rental);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, errors: e.errors });
      }
      console.error("Error creating rental:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message: "Internal Error", error: errorMessage });
    }
  });

  app.delete(api.carRentals.delete.path, requireAuth, async (req, res) => {
    const rentalId = Number(req.params.id);
    const rental = await db.select().from(bookings).where(eq(bookings.id, rentalId)).limit(1);
    if (rental.length === 0 || rental[0].status === "cancelled") {
      return res.status(404).json({ message: "Rental not found" });
    }
    if (rental[0].userId !== (req as any).user.id) {
      return res.status(403).json({ message: "Unauthorized to cancel this rental" });
    }
    await storage.cancelCarRental(rentalId);
    res.status(204).end();
  });

// ===================== NOTIFICATIONS =====================

  // GET /api/notifications - List user notifications (paginated, unread option)
  app.get(api.notifications.list.path, requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const input = getNotificationsInputSchema.parse(req.query);
      
      const notifications = await storage.getUserNotifications(user.id, input);
      res.json(notifications);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/notifications - Create notification (admin/vendor)
  app.post(api.notifications.create.path, requireAuth, async (req, res) => {
    try {
      const input = createNotificationInputSchema.parse(req.body);
      const notification = await storage.createNotification(input);
      (global as any).emitNotification?.(notification.userId, notification);
      res.status(201).json(notification);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/notifications/:id/read - Mark notification as read
  app.patch(api.notifications.read.path.replace(':id', ':id'), requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const id = Number(req.params.id);
      const notification = await storage.markNotificationRead(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      if (notification.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.json(notification);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

// ===================== RATINGS =====================
  // GET /api/ratings/:moduleType/:moduleId - List ratings for specific car/tour
  app.get(api.ratings.listByModule.path, requireAuth, async (req, res) => {
    try {
      const moduleType = req.params.moduleType as 'car' | 'tour';
      const moduleId = Number(req.params.moduleId);
      
      if (!['car', 'tour'].includes(moduleType)) {
        return res.status(400).json({ message: 'Invalid moduleType. Must be "car" or "tour"' });
      }
      
      const ratings = await storage.getRatings(moduleType, moduleId);
      res.json(ratings);
    } catch (e) {
      console.error('Ratings list error:', e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/ratings - Create new rating
  app.post(api.ratings.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.ratings.create.input.parse(req.body);
      console.log('Creating rating:', input);
      
      // Check if user already rated this item
      const existing = await storage.getUserRating(
        (req as any).user.id, 
        input.moduleType, 
        input.moduleId
      );
      if (existing) {
        return res.status(400).json({ message: "User already rated this item" });
      }
      
      const rating = await storage.createRating({
        ...input,
        userId: (req as any).user.id,
      });
      res.status(201).json(rating);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error('Rating create error:', e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /api/ratings/:id - Update rating (user's own only)
  app.put(api.ratings.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.ratings.update.input.parse(req.body);
      
      const rating = await storage.getRatingById(id);
      if (!rating || rating.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Rating not found or unauthorized" });
      }
      
      const updated = await storage.updateRating(id, input);
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error('Rating update error:', e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/ratings/:id - Delete rating (user's own only)
  app.delete(api.ratings.delete.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      
      const rating = await storage.getRatingById(id);
      if (!rating || rating.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Rating not found or unauthorized" });
      }
      
      await storage.deleteRating(id);
      res.status(204).end();
    } catch (e) {
      console.error('Rating delete error:', e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===================== CHATBOT =====================
  app.get(api.chatbot.list.path, async (_req, res) => {
    const items = await storage.getChatbotQuestions();
    res.json(items);
  });

  app.post(api.chatbot.create.path, async (req, res) => {
    try {
      const input = createChatbotQuestionInputSchema.parse(req.body);
      const item = await storage.createChatbotQuestion({
        question: input.question,
        answer: input.answer,
        aliases: input.aliases ?? [],
        keywords: input.keywords ?? [],
        active: input.active ?? true,
      });
      res.status(201).json(item);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.chatbot.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = updateChatbotQuestionInputSchema.parse(req.body);
      const updated = await storage.updateChatbotQuestion(id, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.chatbot.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteChatbotQuestion(id);
    res.status(204).end();
  });

  app.post(api.chatbot.ask.path, async (req, res) => {
    try {
      const input = chatbotAskInputSchema.parse(req.body);
      const analyticsIntent = detectAnalyticsIntent(input.question);
      const user = (req as any).user as
        | { id?: number; roleCode?: string | null; city?: string | null; country?: string | null }
        | undefined;
      if (analyticsIntent) {
        const answer = await buildAnalyticsAnswer(input.question, analyticsIntent, user);
        return res.json({
          answer,
          matched: { intent: "data_analysis", analysisIntent: analyticsIntent.key },
          suggestions: [],
          top: [],
        });
      }
      const builtin = detectBuiltinChatbotResponse(input.question);
      const intentFromInput = input.intent;
      const moduleTypeFromInput = input.moduleType ?? null;
      const excludeItems: SuggestionItem[] = (input.exclude ?? []).map((item) => ({
        id: item.id,
        title: "",
        price: null,
        salePrice: null,
        imageUrl: null,
        kind: item.kind,
        featured: null,
      }));
      const locationId = await resolveLocationIdForUser(user);
      const effectiveBuiltin =
        builtin ??
        (intentFromInput
          ? { intent: intentFromInput, answer: "", suggestions: [], moduleType: moduleTypeFromInput }
          : null);

      if (effectiveBuiltin) {
        if (!effectiveBuiltin.moduleType && moduleTypeFromInput) {
          effectiveBuiltin.moduleType = moduleTypeFromInput;
        }
        const defaultCount = wantsMoreSuggestions(input.question) ? 5 : 3;
        const count = clampSuggestionCount(input.topK ?? defaultCount);
        const suggestions = await fetchSuggestions(
          effectiveBuiltin.intent,
          count,
          effectiveBuiltin.moduleType,
          excludeItems,
          locationId
        );
        const split = splitSuggestions(suggestions);
        const listText =
          effectiveBuiltin.moduleType === "car"
            ? formatSuggestionList(split.cars)
            : effectiveBuiltin.moduleType === "tour"
            ? formatSuggestionList(split.tours)
            : [
                split.tours.length ? `Tours:\n${formatSuggestionList(split.tours)}` : "",
                split.cars.length ? `Cars:\n${formatSuggestionList(split.cars)}` : "",
              ]
                .filter(Boolean)
                .join("\n");
        const variant = pickSentenceVariant(input.question, count);

        let intro = "";
        let outro = "";
        if (effectiveBuiltin.intent === "near_me") {
          const target =
            effectiveBuiltin.moduleType === "car"
              ? "cars"
              : effectiveBuiltin.moduleType === "tour"
              ? "tours"
              : "options";
          const intros = [
            `Here are some nearby ${target} to get you started:`,
            `I can help with nearby ${target}. Here are a few ideas:`,
            `Nearby ${target} coming up:`,
          ];
          intro = intros[variant];
        } else if (effectiveBuiltin.intent === "best_deal") {
          const target =
            effectiveBuiltin.moduleType === "car"
              ? "cars"
              : effectiveBuiltin.moduleType === "tour"
              ? "tours"
              : "options";
          const intros = [
            `Here are budget-friendly ${target}:`,
            `Best deal ${target} to start with:`,
            `Lowest-priced ${target} right now:`,
          ];
          intro = intros[variant];
        } else {
          const target =
            effectiveBuiltin.moduleType === "car"
              ? "cars"
              : effectiveBuiltin.moduleType === "tour"
              ? "tours"
              : "options";
          const intros = [
            `Popular ${target} right now:`,
            `Top ${target} people like:`,
            `Here are the most popular ${target}:`,
          ];
          intro = intros[variant];
        }

        const answerParts = [];
        if (listText) {
          answerParts.push(intro);
          answerParts.push(listText);
          const moreTarget =
            effectiveBuiltin.moduleType === "car"
              ? "Car"
              : effectiveBuiltin.moduleType === "tour"
              ? "Tour"
              : "Car or Tour";
          outro = `You can see more result when you search in the ${moreTarget} tab page.`;
          answerParts.push(outro);
        } else {
          answerParts.push(intro);
          answerParts.push("No results found yet.");
        }

        return res.json({
          answer: answerParts.filter(Boolean).join("\n"),
          matched: { intent: effectiveBuiltin.intent, moduleType: effectiveBuiltin.moduleType },
          suggestions,
          top: [],
        });
      }
      const items = await storage.getActiveChatbotQuestions();
      const minScore = input.minScore ?? 0.45;
      const topK = input.topK ?? 3;

      const results = items
        .map((item) => {
          const aliases = Array.isArray(item.aliases) ? item.aliases : [];
          const keywords = Array.isArray(item.keywords) ? item.keywords : [];
          const candidates = [item.question, ...aliases.map(String)];
          let best = 0;
          let matched = item.question;
          for (const c of candidates) {
            const score = similarityScore(input.question, String(c), keywords as string[]);
            if (score > best) {
              best = score;
              matched = String(c);
            }
          }
          return {
            id: item.id,
            question: item.question,
            answer: item.answer,
            score: best,
            matched,
          };
        })
        .sort((a, b) => b.score - a.score);

      const best = results[0];
      const secondBest = results[1];
      if (!isConfidentFaqMatch(best, secondBest, minScore)) {
        return res.json({
          answer: "I want to make sure I answer correctly. Please rephrase your question with a bit more detail.",
          matched: null,
          top: results.slice(0, topK),
        });
      }

      return res.json({
        answer: best.answer,
        matched: {
          id: best.id,
          question: best.question,
          matched: best.matched,
          score: best.score,
        },
        top: results.slice(0, topK),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Setup WebSocket Server for Notifications
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/notifications' });

  const clientRooms = new Map<number, WebSocket[]>();
  const roomClients = new Map<number, WebSocket[]>();

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      ws.close(1008, 'Server configuration error');
      return;
    }
    const decoded = jwt.verify(token, secret) as any;
      const userId = decoded.userId;

      // Join user room
      if (!clientRooms.has(userId)) clientRooms.set(userId, []);
      if (!roomClients.has(userId)) roomClients.set(userId, []);
      
      clientRooms.get(userId)!.push(ws);
      roomClients.get(userId)!.push(ws);

      ws.userId = userId;

      ws.on('close', () => {
        const clients = clientRooms.get(userId) || [];
        const index = clients.indexOf(ws);
        if (index > -1) clients.splice(index, 1);
        if (clients.length === 0) {
          clientRooms.delete(userId);
          roomClients.delete(userId);
        }
      });

      console.log(`WS connected: user ${userId}`);
    } catch (e) {
      ws.close(1008, 'Invalid token');
    }
  });

  // Global emit function for sending notifications to user room
  (global as any).emitNotification = (userId: number, notification: any) => {
    const clients = roomClients.get(userId) || [];
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }
    });
    console.log(`Emitted notification to user ${userId}:`, notification.title);
  };

  // ===================== SEED =====================
  setTimeout(async () => {
    try {
      const existingRoles = await storage.getRoles();

      if (existingRoles.length === 0) {
        await db.insert(roles).values([
          { name: "Administrator", code: "administrator" },
          { name: "Vendor", code: "vendor" },
          { name: "Customer", code: "customer" },
        ]);
      }

      const existingLocs = await storage.getLocations();
      const phPlacesByRegion: Record<string, string[]> = {
        "NCR": ["Metro Manila"],
        "CAR": ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"],
        "Region I": ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"],
        "Region II": ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"],
        "Region III": ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"],
        "Region IV-A": ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"],
        "Region IV-B": ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"],
        "Region V": ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"],
        "Region VI": ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"],
        "Region VII": ["Bohol", "Cebu", "Negros Oriental", "Siquijor"],
        "Region VIII": ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"],
        "Region IX": ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"],
        "Region X": ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"],
        "Region XI": ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"],
        "Region XII": ["Cotabato", "Sarangani", "South Cotabato", "Sultan Kudarat"],
        "Region XIII": ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"],
        "BARMM": ["Basilan", "Lanao del Sur", "Maguindanao del Norte", "Maguindanao del Sur", "Sulu", "Tawi-Tawi"],
      };
      const slugify = (name: string) =>
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      const allPlaces = Array.from(
        new Set(Object.values(phPlacesByRegion).flat()),
      ).sort((a, b) => a.localeCompare(b));
      const phLocations = allPlaces.map((name) => ({ name, slug: slugify(name) }));
      const existingSlugs = existingLocs.map((l) => (l.slug ?? "").toLowerCase());
      const defaultSeedSlugs = new Set(["paris", "london", "tokyo"]);
      const hasOnlyDefaultSeed =
        existingSlugs.length > 0 && existingSlugs.every((slug) => defaultSeedSlugs.has(slug));

      // Replace old demo seed names while preserving IDs.
      if (hasOnlyDefaultSeed) {
        await db.update(locations).set({ name: "Manila", slug: "manila" }).where(eq(locations.slug, "paris"));
        await db.update(locations).set({ name: "Cebu City", slug: "cebu-city" }).where(eq(locations.slug, "london"));
        await db.update(locations).set({ name: "Davao City", slug: "davao-city" }).where(eq(locations.slug, "tokyo"));
      }

      const refreshedLocs = await storage.getLocations();
      for (const location of phLocations) {
        const exists = refreshedLocs.some((l) => (l.slug ?? "").toLowerCase() === location.slug);
        if (exists) continue;
        await db.insert(locations).values(location);
      }

      if (existingLocs.length === 0) {
        await db.insert(attributes).values([
          { name: "Luxury", type: "Travel Style" },
          { name: "Budget", type: "Travel Style" },
          { name: "Air Conditioning", type: "Car Feature" },
          { name: "GPS", type: "Car Feature" },
        ]);
        await db.insert(tours).values([
          { title: "Eiffel Tower Tour", slug: "eiffel-tower-tour", price: "49.99", salePrice: "39.99", status: "publish" },
          { title: "London Eye VIP", slug: "london-eye-vip", price: "89.99", status: "publish", isFeatured: true },
        ]);
        await db.insert(cars).values([
          { title: "Toyota Corolla", slug: "toyota-corolla", price: "45.00", passenger: 5, gearShift: "Auto", baggage: 2, door: 4, status: "publish" },
          { title: "Mercedes S-Class", slug: "mercedes-s-class", price: "120.00", passenger: 4, gearShift: "Auto", baggage: 3, door: 4, status: "publish", isFeatured: true },
        ]);
      }

      const existingFaqs = await db
        .select({
          id: chatbotQuestions.id,
          question: chatbotQuestions.question,
          aliases: chatbotQuestions.aliases,
          keywords: chatbotQuestions.keywords,
        })
        .from(chatbotQuestions);
      const existingFaqMap = new Map(
        existingFaqs
          .map((row) => [String(row.question ?? "").trim().toLowerCase(), row] as const)
          .filter(([k]) => k.length > 0)
      );
      const missingFaqs = travelistaFaqSeed.filter(
        (item) => !existingFaqMap.has(item.question.trim().toLowerCase())
      );
      if (missingFaqs.length > 0) {
        await db.insert(chatbotQuestions).values(
          missingFaqs.map((item) => ({
            question: item.question,
            answer: item.answer,
            aliases: buildFaqAliases(item.question),
            keywords: buildFaqKeywords(item.question, item.answer),
            active: true,
          }))
        );
      }

      for (const faq of travelistaFaqSeed) {
        const key = faq.question.trim().toLowerCase();
        const existing = existingFaqMap.get(key);
        if (!existing) continue;
        const existingAliases = Array.isArray(existing.aliases) ? existing.aliases : [];
        const existingKeywords = Array.isArray(existing.keywords) ? existing.keywords : [];
        if (existingAliases.length > 0 && existingKeywords.length > 0) continue;

        await db
          .update(chatbotQuestions)
          .set({
            aliases: existingAliases.length > 0 ? existingAliases : buildFaqAliases(faq.question),
            keywords: existingKeywords.length > 0 ? existingKeywords : buildFaqKeywords(faq.question, faq.answer),
          })
          .where(eq(chatbotQuestions.id, existing.id));
      }
    } catch (e) {
      console.log("Seed error:", e);
    }
  }, 1500);

  return httpServer;
}

