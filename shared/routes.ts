import { z } from "zod";
import type { RegisterInput, LoginInput, UpdateProfileInput, Tour, Car, Location, Attribute, AuthUser, ChatbotQuestion } from "./schema";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  reportFiltersSchema,
  createNotificationInputSchema,
  getNotificationsInputSchema,
  createChatbotQuestionInputSchema,
  updateChatbotQuestionInputSchema,
  chatbotAskInputSchema,
} from "./schema";

// ==================== UTILITY ====================
export function buildUrl(template: string, params: Record<string, string | number>): string {
  let url = template;
    for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }
  return url;
}

// ==================== ROUTES ====================
export const api = {
  // Auth
  auth: {
    register: {
      path: "/api/auth/register",
      method: "POST" as const,
      input: registerSchema,
      responses: {
        201: z.object({ token: z.string(), user: z.object({} as AuthUser) }),
        400: z.object({ message: z.string() }),
      },
    },
    login: {
      path: "/api/auth/login",
      method: "POST" as const,
      input: loginSchema,
      responses: {
        200: z.object({ token: z.string(), user: z.object({} as AuthUser) }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  // User
  user: {
    profile: {
      path: "/api/user/profile",
      method: "GET" as const,
      responses: { 200: z.object({} as AuthUser) },
    },
    updateProfile: {
      path: "/api/user/profile",
      method: "PUT" as const,
      input: updateProfileSchema,
      responses: { 200: z.object({} as AuthUser) },
    },
  },
  // Tours
  tours: {
    list: {
      path: "/api/tours",
      method: "GET" as const,
      responses: { 200: z.array(z.object({} as Tour)) },
    },
    get: {
      path: "/api/tours/:id",
      method: "GET" as const,
      responses: { 200: z.object({} as Tour), 404: z.object({ message: z.literal("Not found") }) },
    },
    create: {
      path: "/api/tours",
      method: "POST" as const,
      input: z.object({
        title: z.string(),
        slug: z.string(),
        price: z.string().optional(),
        salePrice: z.string().optional(),
        status: z.string(),
        imageUrl: z.string().optional(),
        locationId: z.number().optional(),
        attributeIds: z.array(z.number()).optional(),
        // Add other tour fields as needed
      }),
      responses: {
        201: z.object({} as Tour),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      path: "/api/tours/:id",
      method: "PUT" as const,
      input: z.object({
        title: z.string().optional(),
        slug: z.string().optional(),
        price: z.string().optional(),
        // ... other fields
        attributeIds: z.array(z.number()).optional(),
      }),
      responses: { 200: z.object({} as Tour) },
    },
    delete: {
      path: "/api/tours/:id",
      method: "DELETE" as const,
    },
  },
  // Cars
  cars: {
    list: {
      path: "/api/cars",
      method: "GET" as const,
      responses: { 200: z.array(z.object({} as Car)) },
    },
    get: {
      path: "/api/cars/:id",
      method: "GET" as const,
      responses: { 200: z.object({} as Car), 404: z.object({ message: z.literal("Not found") }) },
    },
    create: {
      path: "/api/cars",
      method: "POST" as const,
      input: z.object({
        title: z.string(),
        slug: z.string(),
        price: z.string().optional(),
        passenger: z.number().optional(),
        gearShift: z.string().optional(),
        // etc
        attributeIds: z.array(z.number()).optional(),
      }),
      responses: {
        201: z.object({} as Car),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      path: "/api/cars/:id",
      method: "PUT" as const,
      input: z.object({
        title: z.string().optional(),
        // ... 
        attributeIds: z.array(z.number()).optional(),
      }),
      responses: { 200: z.object({} as Car) },
    },
    delete: {
      path: "/api/cars/:id",
      method: "DELETE" as const,
    },
  },
  // Locations
  locations: {
    list: {
      path: "/api/locations",
      method: "GET" as const,
      responses: { 200: z.array(z.object({} as Location)) },
    },
  },
  // Attributes
  attributes: {
    list: {
      path: "/api/attributes",
      method: "GET" as const,
      responses: { 200: z.array(z.object({} as Attribute)) },
    },
  },
  // Admin
  admin: {
    roles: {
      path: "/api/admin/roles",
      method: "GET" as const,
      responses: { 200: z.array(z.object({ id: z.number(), name: z.string(), code: z.string() })) },
    },
    users: {
      list: {
        path: "/api/admin/users",
        method: "GET" as const,
        responses: { 200: z.array(z.object({} as AuthUser)) },
      },
      get: {
        path: "/api/admin/users/:id",
        method: "GET" as const,
        responses: { 200: z.object({} as AuthUser) },
      },
      update: {
        path: "/api/admin/users/:id",
        method: "PUT" as const,
        input: updateProfileSchema,
        responses: { 200: z.object({} as AuthUser) },
      },
      delete: {
        path: "/api/admin/users/:id",
        method: "DELETE" as const,
      },
    },
  },
  // Bookings (Tour)
  tourBookings: {
    list: {
      path: "/api/tour-bookings",
      method: "GET" as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      path: "/api/tour-bookings",
      method: "POST" as const,
      input: z.object({
        tourId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        buyerName: z.string(),
        buyerEmail: z.string().email(),
        buyerPhone: z.string(),
      }),
      responses: { 201: z.any() },
    },
    delete: {
      path: "/api/tour-bookings/:id",
      method: "DELETE" as const,
    },
  },
  // Car Rentals
  carRentals: {
    list: {
      path: "/api/car-rentals",
      method: "GET" as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      path: "/api/car-rentals",
      method: "POST" as const,
      input: z.object({
        carId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        buyerName: z.string(),
        buyerEmail: z.string().email(),
        buyerPhone: z.string(),
      }),
      responses: { 201: z.any() },
    },
    delete: {
      path: "/api/car-rentals/:id",
      method: "DELETE" as const,
    },
  },
  // Notifications
  notifications: {
    list: {
      path: "/api/notifications",
      method: "GET" as const,
      responses: { 200: z.any() },
    },
    create: {
      path: "/api/notifications",
      method: "POST" as const,
      input: createNotificationInputSchema,
      responses: { 201: z.any() },
    },
    read: {
      path: "/api/notifications/:id/read",
      method: "PATCH" as const,
    },
  },
  // Chatbot
  chatbot: {
    list: {
      path: "/api/chatbot/questions",
      method: "GET" as const,
      responses: { 200: z.array(z.object({} as ChatbotQuestion)) },
    },
    create: {
      path: "/api/chatbot/questions",
      method: "POST" as const,
      input: createChatbotQuestionInputSchema,
      responses: { 201: z.object({} as ChatbotQuestion) },
    },
    update: {
      path: "/api/chatbot/questions/:id",
      method: "PUT" as const,
      input: updateChatbotQuestionInputSchema,
      responses: { 200: z.object({} as ChatbotQuestion) },
    },
    delete: {
      path: "/api/chatbot/questions/:id",
      method: "DELETE" as const,
    },
    ask: {
      path: "/api/chatbot/ask",
      method: "POST" as const,
      input: chatbotAskInputSchema,
      responses: { 200: z.any() },
    },
  },
} as const;

