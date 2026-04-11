import type { Express, Response } from "express";
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { tourAttributes, carAttributes, roles, locations, attributes, tours, cars, bookings, notifications } from "@shared/schema";
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
  return normalizeUpdateBody(body);
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
    const priceLabel = priceValue ? ` - $${priceValue}` : "";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

app.post('/api/upload/image', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 1 }]), async (req, res) => {
    try {
      console.log('req.files:', req.files);
      const filesArray = Array.isArray(req.files) ? req.files : [];
      console.log('filesArray:', filesArray.map((f: any) => ({fieldname: f.fieldname, mimetype: f.mimetype})));
      
      // Handle multer.fields structure: req.files[fieldname][]
      const files = (req.files ?? {}) as MulterFiles;
      let file: Express.Multer.File | null = null;
      if (files.image && Array.isArray(files.image)) {
        file = files.image[0];
      } else if (files.images && Array.isArray(files.images)) {
        file = files.images[0];
      }
      
      if (!file) {
        console.log('No matching file found. req.files structure:', Object.keys(req.files || {}));
        return res.status(400).json({ message: 'No file uploaded - use field "image" or "images"' });
      }
      console.log('Processing file:', file.fieldname, file.originalname, file.mimetype);

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        fs.unlinkSync(file.path); // Clean up temp file
        return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        fs.unlinkSync(file.path); // Clean up temp file
        return res.status(400).json({ message: 'File size must be less than 5MB' });
      }

      // Upload to Cloudinary with WebP conversion
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'travel-agency',
        format: 'webp', // Convert to WebP
        transformation: [
          { width: 1200, height: 800, crop: 'limit' }, // Resize if larger
          { quality: 'auto' }, // Auto quality optimization
          { fetch_format: 'auto' } // Auto format optimization
        ]
      });

      // Clean up temp file
      fs.unlinkSync(file.path);

      res.json({ 
        url: result.secure_url,
        publicId: result.public_id 
      });
    } catch (error) {
      console.error('Upload error:', error);
      // Clean up temp files if they exist
      const files = req.files as any[];
      if (Array.isArray(files)) {
        files.forEach(f => {
          if (f && f.path && fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
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

      const input = updateProfileSchema.parse(normalizeProfileBody(req.body));
      if (!rejectEmptyProfileUpdate(input, res)) return;
      const updated = await storage.updateUser(id, input);
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
    res.json(all.filter((t) => !t.deletedAt));
  });

  app.get(api.tours.get.path, async (req, res) => {
    const tour = await storage.getTour(Number(req.params.id));
    if (!tour || tour.deletedAt) return res.status(404).json({ message: "Not found" });
    res.json(tour);
  });

  app.post(api.tours.create.path, async (req, res) => {
    try {
      const input = api.tours.create.input.parse(req.body);
      const { attributeIds, ...tourData } = input;
      const tour = await storage.createTour({
        ...tourData,
        authorId: (req as any).user?.id,
      });
      if (attributeIds && attributeIds.length > 0) {
        const values = attributeIds.map(attrId => ({ tourId: tour.id, attributeId: attrId }));
        await db.insert(tourAttributes).values(values);
      }
      res.status(201).json(tour);
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
      res.json(tour);
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

  app.post(api.cars.create.path, async (req, res) => {
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

  // ===================== CAR RENTALS =====================
  app.get(api.carRentals.list.path, requireAuth, async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    if (userId && userId !== (req as any).user.id) {
      return res.status(403).json({ message: "Unauthorized to view other user's rentals" });
    }
    const rentals = await storage.getCarRentals({ userId: (req as any).user.id });
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
      const stats = await storage.getBookingStats(filters);
      res.json(stats);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
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

    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    if (userId && userId !== (req as any).user.id) {
      return res.status(403).json({ message: "Unauthorized to view other user's bookings" });
    }
    const bookings = await storage.getTourBookings({ userId: (req as any).user.id });
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
      const builtin = detectBuiltinChatbotResponse(input.question);
      const intentFromInput = input.intent;
      const moduleTypeFromInput = input.moduleType ?? null;
      const user = (req as any).user as { city?: string | null; country?: string | null } | undefined;
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
      const minScore = input.minScore ?? 0.35;
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
      if (!best || best.score < minScore) {
        return res.json({
          answer: "Sorry, I don't have an answer for that yet.",
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
      if (existingLocs.length === 0) {
        await db.insert(locations).values([
          { name: "Paris", slug: "paris" },
          { name: "London", slug: "london" },
          { name: "Tokyo", slug: "tokyo" },
        ]);
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
    } catch (e) {
      console.log("Seed error:", e);
    }
  }, 1500);

  return httpServer;
}

