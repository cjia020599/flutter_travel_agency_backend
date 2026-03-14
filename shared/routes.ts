import { z } from "zod";
import {
  insertLocationSchema, locations,
  insertTourSchema, tours,
  insertCarSchema, cars,
  attributes,
  registerSchema, loginSchema, updateProfileSchema,
} from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const createTourInput = insertTourSchema.extend({
  attributeIds: z.array(z.number()).optional(),
  price: z.coerce.string().optional(),
  salePrice: z.coerce.string().optional(),
  mapLat: z.coerce.string().optional(),
  mapLng: z.coerce.string().optional(),
});
export const updateTourInput = createTourInput.partial();

export const createCarInput = insertCarSchema.extend({
  attributeIds: z.array(z.number()).optional(),
  price: z.coerce.string().optional(),
  salePrice: z.coerce.string().optional(),
  mapLat: z.coerce.string().optional(),
  mapLng: z.coerce.string().optional(),
});
export const updateCarInput = createCarInput.partial();

export const api = {
  auth: {
    register: {
      method: "POST" as const,
      path: "/api/auth/register" as const,
      input: registerSchema,
      responses: {
        201: z.object({ token: z.string(), user: z.any() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: loginSchema,
      responses: {
        200: z.object({ token: z.string(), user: z.any() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  user: {
    profile: {
      method: "GET" as const,
      path: "/api/user/profile" as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
    updateProfile: {
      method: "PUT" as const,
      path: "/api/user/profile/update" as const,
      input: updateProfileSchema,
      responses: { 200: z.any(), 400: errorSchemas.validation },
    },
  },
  admin: {
    roles: {
      method: "GET" as const,
      path: "/api/admin/roles" as const,
      responses: { 200: z.array(z.any()) },
    },
  },
  tours: {
    list: {
      method: "GET" as const,
      path: "/api/tours" as const,
      input: z
        .object({
          location_id: z.string().optional(),
          price_range: z.string().optional(),
          attribute_id: z.string().optional(),
          is_featured: z.string().optional(),
        })
        .optional(),
      responses: { 200: z.array(z.custom<typeof tours.$inferSelect>()) },
    },
    get: {
      method: "GET" as const,
      path: "/api/tours/:id" as const,
      responses: {
        200: z.custom<typeof tours.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/tours" as const,
      input: createTourInput,
      responses: {
        201: z.custom<typeof tours.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/tours/:id" as const,
      input: updateTourInput,
      responses: {
        200: z.custom<typeof tours.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/tours/:id" as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  cars: {
    list: {
      method: "GET" as const,
      path: "/api/cars" as const,
      input: z
        .object({
          location_id: z.string().optional(),
          price_range: z.string().optional(),
          attribute_id: z.string().optional(),
          is_featured: z.string().optional(),
        })
        .optional(),
      responses: { 200: z.array(z.custom<typeof cars.$inferSelect>()) },
    },
    get: {
      method: "GET" as const,
      path: "/api/cars/:id" as const,
      responses: {
        200: z.custom<typeof cars.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/cars" as const,
      input: createCarInput,
      responses: {
        201: z.custom<typeof cars.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/cars/:id" as const,
      input: updateCarInput,
      responses: {
        200: z.custom<typeof cars.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/cars/:id" as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },
  locations: {
    list: {
      method: "GET" as const,
      path: "/api/locations" as const,
      responses: { 200: z.array(z.custom<typeof locations.$inferSelect>()) },
    },
  },
  attributes: {
    list: {
      method: "GET" as const,
      path: "/api/attributes" as const,
      responses: { 200: z.array(z.custom<typeof attributes.$inferSelect>()) },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
