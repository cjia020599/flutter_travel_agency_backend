import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== ROLES ====================
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== USERS ====================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  birthday: text("birthday"),
  avatar: text("avatar"),
  bio: text("bio"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  zipCode: text("zip_code"),
  roleId: integer("role_id").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== VENDOR INFO ====================
export const vendorProfiles = pgTable("vendor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  businessName: text("business_name").notNull(),
  commissionType: text("commission_type").notNull().default("default"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).default("0"),
});

// ==================== LOCATIONS ====================
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("publish"),
  deletedAt: timestamp("deleted_at"),
});

// ==================== MEDIA ====================
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  authorId: integer("author_id"),
});

// ==================== ATTRIBUTES ====================
export const attributes = pgTable("attributes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
});

// ==================== TOURS ====================
export const tours = pgTable("tours", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content"),
  categoryId: integer("category_id"),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").default(false),
  authorId: integer("author_id"),
  duration: integer("duration"),
  minPeople: integer("min_people"),
  maxPeople: integer("max_people"),
  minDayBeforeBooking: integer("min_day_before_booking"),
  itinerary: jsonb("itinerary"),
  faqs: jsonb("faqs"),
  include: jsonb("include"),
  exclude: jsonb("exclude"),
  surroundings: jsonb("surroundings"),
  mapLat: decimal("map_lat", { precision: 10, scale: 6 }),
  mapLng: decimal("map_lng", { precision: 10, scale: 6 }),
  mapZoom: integer("map_zoom"),
  realAddress: text("real_address"),
  price: decimal("price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  extraPrices: jsonb("extra_prices"),
  serviceFees: jsonb("service_fees"),
  personTypes: jsonb("person_types"),
  discountByPeople: jsonb("discount_by_people"),
  fixedDates: boolean("fixed_dates").default(false),
  openHours: jsonb("open_hours"),
  locationId: integer("location_id"),
  deletedAt: timestamp("deleted_at"),
});

// ==================== CARS ====================
export const cars = pgTable("cars", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content"),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").default(false),
  authorId: integer("author_id"),
  passenger: integer("passenger"),
  gearShift: text("gear_shift"),
  baggage: integer("baggage"),
  door: integer("door"),
  inventoryCount: integer("inventory_count").default(1),
  minDayStay: integer("min_day_stay"),
  minDayBeforeBooking: integer("min_day_before_booking"),
  mapLat: decimal("map_lat", { precision: 10, scale: 6 }),
  mapLng: decimal("map_lng", { precision: 10, scale: 6 }),
  mapZoom: integer("map_zoom"),
  realAddress: text("real_address"),
  price: decimal("price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  extraPrices: jsonb("extra_prices"),
  serviceFees: jsonb("service_fees"),
  fixedDates: boolean("fixed_dates").default(false),
  openHours: jsonb("open_hours"),
  locationId: integer("location_id"),
  deletedAt: timestamp("deleted_at"),
});

// ==================== MANY-TO-MANY ====================
export const tourAttributes = pgTable("tour_attributes", {
  id: serial("id").primaryKey(),
  tourId: integer("tour_id").notNull(),
  attributeId: integer("attribute_id").notNull(),
});

export const carAttributes = pgTable("car_attributes", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull(),
  attributeId: integer("attribute_id").notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  buyerPhone: text("buyer_phone"),
  moduleType: text("module_type").notNull(),
  moduleId: integer("module_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("confirmed"),
});

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  moduleType: text("module_type").notNull(),
  moduleId: integer("module_id").notNull(),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== INSERT SCHEMAS ====================
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertVendorProfileSchema = createInsertSchema(vendorProfiles).omit({ id: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, deletedAt: true });
export const insertMediaSchema = createInsertSchema(media).omit({ id: true });
export const insertAttributeSchema = createInsertSchema(attributes).omit({ id: true });
export const insertTourSchema = createInsertSchema(tours).omit({ id: true, deletedAt: true });
export const insertCarSchema = createInsertSchema(cars).omit({ id: true, deletedAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true }).extend({
  buyerName: z.string().optional(),
  buyerEmail: z.string().email().optional(),
  buyerPhone: z.string().optional(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createRatingInputSchema = z.object({
  moduleType: z.enum(["car", "tour"]),
  moduleId: z.coerce.number().int().positive(),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000).optional(),
});

export const updateRatingInputSchema = z.object({
  stars: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(1).max(2000).optional(),
}).refine((data) => data.stars !== undefined || data.comment !== undefined, {
  message: "At least one field (stars or comment) is required",
});

export const insertCarRentalSchema = insertBookingSchema.extend({
  moduleType: z.literal("car"),
  userId: z.coerce.number(),
});

export const insertTourBookingSchema = insertBookingSchema.extend({
  moduleType: z.literal("tour"),
  userId: z.coerce.number(),
});

// ==================== TYPES ====================
export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
export type VendorProfile = typeof vendorProfiles.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Attribute = typeof attributes.$inferSelect;
export type Tour = typeof tours.$inferSelect;
export type Car = typeof cars.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Rating = typeof ratings.$inferSelect;

export type CarRental = Booking & {
  car: Pick<Car, "id" | "title" | "price" | "imageUrl" | "locationId">;
  user: Pick<User, "id" | "firstName" | "lastName" | "email">;
};

export type TourBooking = Booking & {
  tour: Pick<Tour, "id" | "title" | "price" | "imageUrl" | "locationId">;
  user: Pick<User, "id" | "firstName" | "lastName" | "email">;
};

export type InsertCarRental = z.infer<typeof insertCarRentalSchema>;
export type InsertTourBooking = z.infer<typeof insertTourBookingSchema>;

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertVendorProfile = z.infer<typeof insertVendorProfileSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;
export type InsertTour = z.infer<typeof insertTourSchema>;
export type InsertCar = z.infer<typeof insertCarSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type CreateRatingInput = z.infer<typeof createRatingInputSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingInputSchema>;

// ==================== AUTH SCHEMAS ====================
export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["administrator", "vendor", "customer"]).default("customer"),
  businessName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  username: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  avatar: string | null;
  bio: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  roleId: number;
  roleName: string;
  roleCode: string;
  vendorProfile?: VendorProfile | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
