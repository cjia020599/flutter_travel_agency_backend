import { db } from "./db";
import {
  locations, tours, cars, tourAttributes, carAttributes, attributes, bookings, notifications, ratings,
  users, roles, vendorProfiles, chatbotQuestions,
  type Tour, type InsertTour,
  type Car, type InsertCar,
  type Booking, type InsertTourBooking, type TourBooking, type InsertCarRental, type CarRental,
  type Location, type Attribute, type Rating, type InsertRating,
  type InsertLocation, type InsertAttribute,
  type User, type InsertUser,
  type Role,
  type VendorProfile, type InsertVendorProfile,
  type AuthUser, type UpdateProfileInput,
  type Notification,
  type ChatbotQuestion, type InsertChatbotQuestion,
  type TourSummary, type CarSummary, type BookingStats, type LocationStats, type ReportFilters
} from "@shared/schema";
import { eq, and, isNull, count, sum, avg, sql, desc } from "drizzle-orm";

export interface IStorage {
  getUserNotifications(userId: number, opts: { page: number; limit: number; unreadOnly: boolean }): Promise<Notification[]>;
  createNotification(data: { userId: number; title: string; message: string; type: string; data?: any }): Promise<Notification>;
  markNotificationRead(id: number): Promise<Notification | undefined>;

  // Chatbot
  getChatbotQuestions(): Promise<ChatbotQuestion[]>;
  getActiveChatbotQuestions(): Promise<ChatbotQuestion[]>;
  createChatbotQuestion(data: InsertChatbotQuestion): Promise<ChatbotQuestion>;
  updateChatbotQuestion(id: number, updates: Partial<InsertChatbotQuestion>): Promise<ChatbotQuestion>;
  deleteChatbotQuestion(id: number): Promise<void>;

  // Existing methods...
  getTours(): Promise<Tour[]>;
  getTour(id: number): Promise<Tour | undefined>;
  createTour(tour: InsertTour): Promise<Tour>;
  updateTour(id: number, updates: Partial<InsertTour>): Promise<Tour>;
  deleteTour(id: number): Promise<void>;

  getCars(): Promise<Car[]>;
  getCar(id: number): Promise<Car | undefined>;
  createCar(car: InsertCar): Promise<Car>;
  updateCar(id: number, updates: Partial<InsertCar>): Promise<Car>;
  deleteCar(id: number): Promise<void>;

  getLocations(): Promise<Location[]>;
  getAttributes(): Promise<Attribute[]>;

  getUsers(): Promise<AuthUser[]>;
  getUserById(id: number): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<UpdateProfileInput>): Promise<AuthUser>;
  deleteUser(id: number): Promise<void>;
  getRawUser(id: number): Promise<User | undefined>;

  createVendorProfile(profile: InsertVendorProfile): Promise<VendorProfile>;
  getVendorByUserId(userId: number): Promise<VendorProfile | undefined>;

  getRoles(): Promise<Role[]>;
  getRoleByCode(code: string): Promise<Role | undefined>;

  getTourSummary(filters?: ReportFilters): Promise<TourSummary[]>;
  getCarSummary(filters?: ReportFilters): Promise<CarSummary[]>;
  getBookingStats(filters?: ReportFilters): Promise<BookingStats>;
  getLocationStats(filters?: ReportFilters): Promise<LocationStats[]>;

  getCarRentals(filters?: { userId?: number }): Promise<CarRental[]>;
  createCarRental(rental: InsertCarRental): Promise<Booking>;
  cancelCarRental(id: number): Promise<void>;

  getTourBookings(filters?: { userId?: number }): Promise<TourBooking[]>;
  createTourBooking(booking: InsertTourBooking): Promise<Booking>;
  cancelTourBooking(id: number): Promise<void>;

  // ---- Ratings ----
  getRatings(moduleType: 'car' | 'tour', moduleId: number): Promise<Rating[]>;
  getUserRating(userId: number, moduleType: 'car' | 'tour', moduleId: number): Promise<Rating | undefined>;
  createRating(data: InsertRating): Promise<Rating>;
  updateRating(id: number, updates: Partial<InsertRating>): Promise<Rating>;
  deleteRating(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserNotifications(userId: number, opts: { page: number; limit: number; unreadOnly: boolean }): Promise<Notification[]> {
    const offset = (opts.page - 1) * opts.limit;
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(opts.limit)
      .offset(offset);
    
    if (opts.unreadOnly) {
      query = query.where(isNull(notifications.readAt));
    }
    
    return await query;
  }

  async createNotification(data: { userId: number; title: string; message: string; type: string; data?: any }): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({
      ...data,
      readAt: null,
    }).returning();
    return notification!;
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  // ---- Chatbot ----
  async getChatbotQuestions(): Promise<ChatbotQuestion[]> {
    return db.select().from(chatbotQuestions).orderBy(desc(chatbotQuestions.createdAt));
  }

  async getActiveChatbotQuestions(): Promise<ChatbotQuestion[]> {
    return db.select().from(chatbotQuestions).where(eq(chatbotQuestions.active, true));
  }

  async createChatbotQuestion(data: InsertChatbotQuestion): Promise<ChatbotQuestion> {
    const [r] = await db.insert(chatbotQuestions).values(data).returning();
    return r;
  }

  async updateChatbotQuestion(id: number, updates: Partial<InsertChatbotQuestion>): Promise<ChatbotQuestion> {
    const [r] = await db.update(chatbotQuestions).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(chatbotQuestions.id, id)).returning();
    return r;
  }

  async deleteChatbotQuestion(id: number): Promise<void> {
    await db.delete(chatbotQuestions).where(eq(chatbotQuestions.id, id));
  }

  // ---- Ratings ----
  async getRatings(moduleType: 'car' | 'tour', moduleId: number): Promise<Rating[]> {
    return db.select().from(ratings).where(
      and(
        eq(ratings.moduleType, moduleType),
        eq(ratings.moduleId, moduleId)
      )
    ).orderBy(desc(ratings.createdAt));
  }

  async getUserRating(userId: number, moduleType: 'car' | 'tour', moduleId: number): Promise<Rating | undefined> {
    const [r] = await db.select().from(ratings).where(
      and(
        eq(ratings.userId, userId),
        eq(ratings.moduleType, moduleType),
        eq(ratings.moduleId, moduleId)
      )
    );
    return r;
  }

  async createRating(data: InsertRating): Promise<Rating> {
    const [r] = await db.insert(ratings).values(data).returning();
    return r;
  }

  async updateRating(id: number, updates: Partial<InsertRating>): Promise<Rating> {
    const [r] = await db.update(ratings).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(ratings.id, id)).returning();
    if (!r) throw new Error(`Rating ${id} not found`);
    return r;
  }

  async deleteRating(id: number): Promise<void> {
    await db.delete(ratings).where(eq(ratings.id, id));
  }

  // ---- Tours ----
  async getTours(): Promise<Tour[]> {
    return db.select().from(tours);
  }
  async getTour(id: number): Promise<Tour | undefined> {
    const [r] = await db.select().from(tours).where(eq(tours.id, id));
    return r;
  }
  async createTour(tour: InsertTour): Promise<Tour> {
    const [r] = await db.insert(tours).values(tour).returning();
    return r;
  }
  async updateTour(id: number, updates: Partial<InsertTour>): Promise<Tour> {
    console.log('STORAGE updateTour id:', id, 'updates:', updates);
    const [r] = await db.update(tours).set(updates).where(eq(tours.id, id)).returning();
    if (!r) {
      console.error('updateTour failed - no rows affected for id:', id);
      throw new Error(`Failed to update tour ${id} - no rows matched`);
    }
    console.log('STORAGE updateTour success:', r.id);
    return r;
  }
  async deleteTour(id: number): Promise<void> {
    await db.update(tours).set({ deletedAt: new Date() }).where(eq(tours.id, id));
  }

  // ---- Cars ----
  async getCars(): Promise<Car[]> {
    return db.select().from(cars);
  }
  async getCar(id: number): Promise<Car | undefined> {
    const [r] = await db.select().from(cars).where(eq(cars.id, id));
    return r;
  }
  async createCar(car: InsertCar): Promise<Car> {
    const [r] = await db.insert(cars).values(car).returning();
    return r;
  }
  async updateCar(id: number, updates: Partial<InsertCar>): Promise<Car> {
    console.log('STORAGE updateCar id:', id, 'updates:', updates);
    const [r] = await db.update(cars).set(updates).where(eq(cars.id, id)).returning();
    if (!r) {
      console.error('updateCar failed - no rows affected for id:', id);
      throw new Error(`Failed to update car ${id} - no rows matched`);
    }
    console.log('STORAGE updateCar success:', r.id);
    return r;
  }
  async deleteCar(id: number): Promise<void> {
    await db.update(cars).set({ deletedAt: new Date() }).where(eq(cars.id, id));
  }

  // ---- Lookups ----
  async getLocations(): Promise<Location[]> {
    return db.select().from(locations);
  }
  async getAttributes(): Promise<Attribute[]> {
    return db.select().from(attributes);
  }

  // ---- Users ----
  private async buildAuthUser(user: User): Promise<AuthUser> {
    const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId!));
    const vendor = await this.getVendorByUserId(user.id);
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      birthday: user.birthday,
      avatar: user.avatar,
      bio: user.bio,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      state: user.state,
      country: user.country,
      zipCode: user.zipCode,
      roleId: user.roleId,
      roleName: role?.name ?? "Customer",
      roleCode: role?.code ?? "customer",
      vendorProfile: vendor ?? null,
    };
  }

  async getUserById(id: number): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    return this.buildAuthUser(user);
  }

  async getRawUser(id: number): Promise<User | undefined> {
    const [r] = await db.select().from(users).where(eq(users.id, id));
    return r;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [r] = await db.select().from(users).where(eq(users.email, email));
    return r;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [r] = await db.select().from(users).where(eq(users.username, username));
    return r;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [r] = await db.insert(users).values(user).returning();
    return r;
  }

  async updateUser(id: number, updates: Partial<UpdateProfileInput>): Promise<AuthUser> {
    await db.update(users).set(updates).where(eq(users.id, id));
    return this.getUserById(id) as Promise<AuthUser>;
  }

  async getUsers(): Promise<AuthUser[]> {
    const all = await db.select().from(users);
    return Promise.all(all.map((u) => this.buildAuthUser(u)));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ---- Vendor ----
  async createVendorProfile(profile: InsertVendorProfile): Promise<VendorProfile> {
    const [r] = await db.insert(vendorProfiles).values(profile).returning();
    return r;
  }
  async getVendorByUserId(userId: number): Promise<VendorProfile | undefined> {
    const [r] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, userId));
    return r;
  }

  // ---- Roles ----
  async getRoles(): Promise<Role[]> {
    return db.select().from(roles);
  }
  async getRoleByCode(code: string): Promise<Role | undefined> {
    const [r] = await db.select().from(roles).where(eq(roles.code, code));
    return r;
  }

  // ---- Car Rentals ----
  async getCarRentals(filters?: { userId?: number }): Promise<CarRental[]> {
    const query = db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        moduleType: bookings.moduleType,
        moduleId: bookings.moduleId,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        status: bookings.status,
        car: cars.id,
        carTitle: cars.title,
        carPrice: cars.price,
        carImageUrl: cars.imageUrl,
        carLocationId: cars.locationId,
        user: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(bookings)
      .leftJoin(cars, eq(bookings.moduleId, cars.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.moduleType, "car"),
          isNull(cars.deletedAt),
          filters?.userId ? eq(bookings.userId, filters.userId) : sql`true`
        )
      );

    const results = await query;
    return results.map((r) => ({
      id: r.id,
      userId: r.userId,
      moduleType: r.moduleType,
      moduleId: r.moduleId,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      buyerName: null,
      buyerEmail: null,
      buyerPhone: null,
      car: {
        id: r.car!,
        title: r.carTitle!,
        price: r.carPrice!,
        imageUrl: r.carImageUrl!,
        locationId: r.carLocationId!,
      },
      user: {
        id: r.user!,
        firstName: r.userFirstName!,
        lastName: r.userLastName!,
        email: r.userEmail!,
      },
    }));
  }

  async createCarRental(rental: InsertCarRental): Promise<Booking> {
    const [result] = await db.insert(bookings).values(rental as any).returning();
    return result;
  }

  async cancelCarRental(id: number): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }

  // ---- Tour Bookings ----
  async getTourBookings(filters?: { userId?: number }): Promise<TourBooking[]> {
    const query = db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        moduleType: bookings.moduleType,
        moduleId: bookings.moduleId,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        status: bookings.status,
        buyerName: bookings.buyerName,
        buyerEmail: bookings.buyerEmail,
        buyerPhone: bookings.buyerPhone,
        tour: tours.id,
        tourTitle: tours.title,
        tourPrice: tours.price,
        tourImageUrl: tours.imageUrl,
        tourLocationId: tours.locationId,
        user: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(bookings)
      .leftJoin(tours, eq(bookings.moduleId, tours.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.moduleType, "tour"),
          isNull(tours.deletedAt),
          filters?.userId ? eq(bookings.userId, filters.userId) : sql`true`
        )
      );

    const results = await query;
    return results.map(r => ({
      ...r,
      tour: {
        id: r.tour!,
        title: r.tourTitle!,
        price: r.tourPrice!,
        imageUrl: r.tourImageUrl!,
        locationId: r.tourLocationId!,
      },
      user: {
        id: r.user!,
        firstName: r.userFirstName!,
        lastName: r.userLastName!,
        email: r.userEmail!,
      },
    })) as TourBooking[];
  }

  async createTourBooking(booking: InsertTourBooking): Promise<Booking> {
    const [result] = await db.insert(bookings).values(booking as any).returning();
    return result;
  }

  async cancelTourBooking(id: number): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }

  // ---- Reports ----
  async getTourSummary(filters?: ReportFilters): Promise<TourSummary[]> {
    let query = db.select({
      status: tours.status,
      count: count(),
      avgPrice: avg(tours.price),
    }).from(tours).where(isNull(tours.deletedAt));

    if (filters?.vendorId) {
      query = query.where(eq(tours.authorId, filters.vendorId));
    }
    if (filters?.status) {
      query = query.where(eq(tours.status, filters.status));
    }
    if (filters?.locationId) {
      query = query.where(eq(tours.locationId, filters.locationId));
    }

    query = query.groupBy(tours.status);
    const results = await query;
    return results.map(r => ({
      status: r.status || 'unknown',
      count: Number(r.count),
      avgPrice: parseFloat(r.avgPrice || '0'),
    }));
  }

  async getCarSummary(filters?: ReportFilters): Promise<CarSummary[]> {
    let query = db.select({
      status: cars.status,
      count: count(),
      avgPrice: avg(cars.price),
      avgPassenger: avg(cars.passenger),
    }).from(cars).where(isNull(cars.deletedAt));

    if (filters?.vendorId) {
      query = query.where(eq(cars.authorId, filters.vendorId));
    }
    if (filters?.status) {
      query = query.where(eq(cars.status, filters.status));
    }
    if (filters?.locationId) {
      query = query.where(eq(cars.locationId, filters.locationId));
    }

    query = query.groupBy(cars.status);
    const results = await query;
    return results.map(r => ({
      status: r.status || 'unknown',
      count: Number(r.count),
      avgPrice: parseFloat(r.avgPrice || '0'),
      avgPassenger: parseFloat(r.avgPassenger || '0'),
    }));
  }

  async getBookingStats(filters?: ReportFilters): Promise<BookingStats> {
    try {
      const totalQuery = await db.select({ count: count() }).from(bookings);
      const confirmedQuery = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, 'confirmed'));
      const cancelledQuery = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, 'cancelled'));
      
      // Tour stats
      const tourStats = await db
        .select({ 
          count: count(), 
          revenue: sum(sql`t."price"::numeric` as any)
        })
        .from(bookings)
        .leftJoin(tours, eq(bookings.moduleId, tours.id))
        .where(eq(bookings.moduleType, 'tour'));
      
      // Car stats
      const carStats = await db
        .select({ 
          count: count(), 
          revenue: sum(sql`c."price"::numeric` as any)
        })
        .from(bookings)
        .leftJoin(cars, eq(bookings.moduleId, cars.id))
        .where(eq(bookings.moduleType, 'car'));

      return {
        totalBookings: Number(totalQuery[0]?.count || 0),
        totalRevenue: 0,
        confirmed: Number(confirmedQuery[0]?.count || 0),
        cancelled: Number(cancelledQuery[0]?.count || 0),
        byModuleType: [
          { type: 'tour' as const, count: Number(tourStats[0]?.count || 0), revenue: 0 },
          { type: 'car' as const, count: Number(carStats[0]?.count || 0), revenue: 0 },
        ],
      };
    } catch (error) {
      console.error('Booking stats error:', error);
      return {
        totalBookings: 0,
        totalRevenue: 0,
        confirmed: 0,
        cancelled: 0,
        byModuleType: [],
      };
    }
  }

  async getLocationStats(filters?: ReportFilters): Promise<LocationStats[]> {
    try {
      const query = await db.select({
        id: locations.id,
        name: locations.name,
        tours: count(tours.id).as('tours'),
        cars: count(cars.id).as('cars'),
        bookings: count().as('bookings'),
        revenue: sql`0`.as('revenue'),
      }).from(locations)
        .leftJoin(tours, eq(locations.id, tours.locationId))
        .leftJoin(cars, eq(locations.id, cars.locationId))
        .where(isNull(locations.deletedAt))
        .groupBy(locations.id, locations.name);

      return (await query).map(r => ({
        id: Number(r.id),
        name: r.name || '',
        tours: Number(r.tours || 0),
        cars: Number(r.cars || 0),
        bookings: Number(r.bookings || 0),
        revenue: 0,
      }));
    } catch (error) {
      console.error('Location stats error:', error);
      return [];
    }
  }

  // ---- Car Rentals ----
  async getCarRentals(filters?: { userId?: number }): Promise<CarRental[]> {
    const query = db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        moduleType: bookings.moduleType,
        moduleId: bookings.moduleId,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        status: bookings.status,
        car: cars.id,
        carTitle: cars.title,
        carPrice: cars.price,
        carImageUrl: cars.imageUrl,
        carLocationId: cars.locationId,
        user: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(bookings)
      .leftJoin(cars, eq(bookings.moduleId, cars.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.moduleType, "car"),
          isNull(cars.deletedAt),
          filters?.userId ? eq(bookings.userId, filters.userId) : sql`true`
        )
      );

    const results = await query;
    return results.map((r) => ({
      id: r.id,
      userId: r.userId,
      moduleType: r.moduleType,
      moduleId: r.moduleId,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      buyerName: null,
      buyerEmail: null,
      buyerPhone: null,
      car: {
        id: r.car!,
        title: r.carTitle!,
        price: r.carPrice!,
        imageUrl: r.carImageUrl!,
        locationId: r.carLocationId!,
      },
      user: {
        id: r.user!,
        firstName: r.userFirstName!,
        lastName: r.userLastName!,
        email: r.userEmail!,
      },
    }));
  }

  async createCarRental(rental: InsertCarRental): Promise<Booking> {
    const [result] = await db.insert(bookings).values(rental as any).returning();
    return result;
  }

  async cancelCarRental(id: number): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }

  // ---- Tour Bookings ----
  async getTourBookings(filters?: { userId?: number }): Promise<TourBooking[]> {
    const query = db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        moduleType: bookings.moduleType,
        moduleId: bookings.moduleId,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        status: bookings.status,
        buyerName: bookings.buyerName,
        buyerEmail: bookings.buyerEmail,
        buyerPhone: bookings.buyerPhone,
        tour: tours.id,
        tourTitle: tours.title,
        tourPrice: tours.price,
        tourImageUrl: tours.imageUrl,
        tourLocationId: tours.locationId,
        user: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(bookings)
      .leftJoin(tours, eq(bookings.moduleId, tours.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.moduleType, "tour"),
          isNull(tours.deletedAt),
          filters?.userId ? eq(bookings.userId, filters.userId) : sql`true`
        )
      );

    const results = await query;
    return results.map(r => ({
      ...r,
      tour: {
        id: r.tour!,
        title: r.tourTitle!,
        price: r.tourPrice!,
        imageUrl: r.tourImageUrl!,
        locationId: r.tourLocationId!,
      },
      user: {
        id: r.user!,
        firstName: r.userFirstName!,
        lastName: r.userLastName!,
        email: r.userEmail!,
      },
    })) as TourBooking[];
  }

  async createTourBooking(booking: InsertTourBooking): Promise<Booking> {
    const [result] = await db.insert(bookings).values(booking as any).returning();
    return result;
  }

  async cancelTourBooking(id: number): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }
}

export const storage = new DatabaseStorage();

