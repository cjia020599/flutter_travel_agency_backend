import type { Express } from "express";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { registerSchema, loginSchema, updateProfileSchema } from "@shared/schema";
import { signToken, requireAuth, requireAdmin } from "./auth";
import { eq } from "drizzle-orm";
import { locations, attributes, tours, cars, roles, tourAttributes, carAttributes } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ===================== AUTH =====================

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);

      const existing = await storage.getUserByEmail(input.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const existingUsername = await storage.getUserByUsername(input.username);
      if (existingUsername) return res.status(400).json({ message: "Username already taken" });

      const role = await storage.getRoleByCode(input.role);
      if (!role) return res.status(400).json({ message: "Invalid role" });

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        email: input.email,
        password: hashedPassword,
        roleId: role.id,
      });

      if (input.role === "vendor" && input.businessName) {
        await storage.createVendorProfile({
          userId: user.id,
          businessName: input.businessName,
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
      console.error(e);
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
      const input = updateProfileSchema.parse(req.body);
      const updated = await storage.updateUser(user.id, input);
      return res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===================== ADMIN =====================

  app.get(api.admin.roles.path, requireAuth, async (req, res) => {
    const roles = await storage.getRoles();
    return res.json(roles);
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
      const tour = await storage.createTour(tourData);
      if (attributeIds && attributeIds.length > 0) {
        const values = attributeIds.map(attrId => ({ tourId: tour.id, attributeId: attrId }));
        await db.insert(tourAttributes).values(values);
      }
      res.status(201).json(tour);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.tours.update.path, async (req, res) => {
    try {
      const input = api.tours.update.input.parse(req.body);
      const { attributeIds, ...tourData } = input;
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
      const { attributeIds, ...carData } = input;
      const car = await storage.createCar(carData);
      if (attributeIds && attributeIds.length > 0) {
        const values = attributeIds.map(attrId => ({ carId: car.id, attributeId: attrId }));
        await db.insert(carAttributes).values(values);
      }
      res.status(201).json(car);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message, field: e.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.cars.update.path, async (req, res) => {
    try {
      const input = api.cars.update.input.parse(req.body);
      const { attributeIds, ...carData } = input;
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
