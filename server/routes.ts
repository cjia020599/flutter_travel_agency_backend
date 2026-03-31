import type { Express } from "express";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { registerSchema, loginSchema, updateProfileSchema, reportFiltersSchema, cars as carsTable, tours as toursTable, ratings as ratingsTable, notifications, getNotificationsInputSchema, createNotificationInputSchema } from "@shared/schema";

import { signToken, requireAuth, requireAdmin } from "./auth";
import { eq } from "drizzle-orm";


import { db } from "./db";

import { locations, attributes, tours, cars, roles, tourAttributes, carAttributes, bookings } from "@shared/schema";
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

      const input = updateProfileSchema.parse(req.body);
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
      console.error("Error creating tour:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.tours.update.path, async (req, res) => {
    try {
      const input = api.tours.update.input.parse(req.body);
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
      console.error("Error creating car:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.put(api.cars.update.path, async (req, res) => {
    try {
      const input = api.cars.update.input.parse(req.body);
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
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

