import { db } from "./db";
import {
  locations, tours, cars, tourAttributes, carAttributes, attributes, bookings,
  users, roles, vendorProfiles,
  type Tour, type InsertTour,
  type Car, type InsertCar,
  type Booking, type InsertTourBooking, type TourBooking, type InsertCarRental, type CarRental,
  type Location, type Attribute,
  type InsertLocation, type InsertAttribute,
  type User, type InsertUser,
  type Role,
  type VendorProfile, type InsertVendorProfile,
  type AuthUser, type UpdateProfileInput,
} from "@shared/schema";
import { eq, and, isNull, count, sum, avg, sql, groupBy } from "drizzle-orm";


export interface IStorage {
  // Tours
  getTours(): Promise<Tour[]>;
  getTour(id: number): Promise<Tour | undefined>;
  createTour(tour: InsertTour): Promise<Tour>;
  updateTour(id: number, updates: Partial<InsertTour>): Promise<Tour>;
  deleteTour(id: number): Promise<void>;

  // Cars
  getCars(): Promise<Car[]>;
  getCar(id: number): Promise<Car | undefined>;
  createCar(car: InsertCar): Promise<Car>;
  updateCar(id: number, updates: Partial<InsertCar>): Promise<Car>;
  deleteCar(id: number): Promise<void>;

  // Lookups
  getLocations(): Promise<Location[]>;
  getAttributes(): Promise<Attribute[]>;

  // Auth / Users
  getUsers(): Promise<AuthUser[]>;
  getUserById(id: number): Promise<AuthUser | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<UpdateProfileInput>): Promise<AuthUser>;
  deleteUser(id: number): Promise<void>;
  getRawUser(id: number): Promise<User | undefined>;

  // Vendor
  createVendorProfile(profile: InsertVendorProfile): Promise<VendorProfile>;
  getVendorByUserId(userId: number): Promise<VendorProfile | undefined>;

  // Roles
  getRoles(): Promise<Role[]>;
  getRoleByCode(code: string): Promise<Role | undefined>;

// Reports
  getTourSummary(filters?: ReportFilters): Promise<TourSummary[]>;
  getCarSummary(filters?: ReportFilters): Promise<CarSummary[]>;
  getBookingStats(filters?: ReportFilters): Promise<BookingStats>;
  getLocationStats(filters?: ReportFilters): Promise<LocationStats[]>;

// Car Rentals
  getCarRentals(filters?: { userId?: number }): Promise<CarRental[]>;
  createCarRental(rental: InsertCarRental): Promise<Booking>;
  cancelCarRental(id: number): Promise<void>;
  
  // Tour Bookings
  getTourBookings(filters?: { userId?: number }): Promise<TourBooking[]>;

  createTourBooking(booking: InsertTourBooking): Promise<Booking>;
  cancelTourBooking(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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
    const [r] = await db.update(tours).set(updates).where(eq(tours.id, id)).returning();
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
    const [r] = await db.update(cars).set(updates).where(eq(cars.id, id)).returning();
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


async getBookingStats(filters?: any): Promise<BookingStats> {
    const where: any[] = [isNull(tours.deletedAt), isNull(cars.deletedAt)]; // assume no deletedAt on bookings
    if (filters?.vendorId) where.push(sql`t."authorId" = ${filters.vendorId} OR c."authorId" = ${filters.vendorId}`);
    if (filters?.status) where.push(eq(bookings.status, filters.status));
    if (filters?.locationId) where.push(sql`t."locationId" = ${filters.locationId} OR c."locationId" = ${filters.locationId}`);
    if (filters?.fromDate) where.push(sql`b."startDate" >= ${filters.fromDate}`);
    if (filters?.toDate) where.push(sql`b."endDate" <= ${filters.toDate}`);


    const totalQuery = await db.select({ count: count() }).from(bookings).where(sql`true`); // simplified
    const revenueQuery = await db.select({ sum: sum(sql`EXTRACT(days FROM (b."endDate" - b."startDate")) * COALESCE(t."price", c."price")::numeric` as any) }).from(bookings as any).leftJoin(tours, eq(bookings.moduleId, tours.id)).leftJoin(cars, and(eq(bookings.moduleId, cars.id), eq(bookings.moduleType, sql`'car'`))).where(sql`true`);
    const confirmedQuery = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, 'confirmed'));
    const cancelledQuery = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, 'cancelled'));
    // Simplified - full impl needs better joins

    // byModuleType
    const tourStats = await db.select({ count: count(), revenue: sum(sql`EXTRACT(days FROM (b."endDate" - b."startDate")) * t."price"::numeric` as any) }).from(bookings).leftJoin(tours, eq(bookings.moduleId, tours.id)).where(eq(bookings.moduleType, 'tour'));
    const carStats = await db.select({ count: count(), revenue: sum(sql`EXTRACT(days FROM (b."endDate" - b."startDate")) * c."price"::numeric` as any) }).from(bookings).leftJoin(cars, eq(bookings.moduleId, cars.id)).where(eq(bookings.moduleType, 'car'));

    return {
      totalBookings: Number(totalQuery[0].count),
      totalRevenue: parseFloat(revenueQuery[0].sum || '0'),
      confirmed: Number(confirmedQuery[0].count),
      cancelled: Number(cancelledQuery[0].count),
      byModuleType: [
        { type: 'tour' as const, count: Number(tourStats[0].count), revenue: parseFloat(tourStats[0].revenue || '0') },
        { type: 'car' as const, count: Number(carStats[0].count), revenue: parseFloat(carStats[0].revenue || '0') },
      ],
    };
  }

async getLocationStats(filters?: any): Promise<LocationStats[]> {
    const query = await db.select({
      id: locations.id,
      name: locations.name,
      tours: count(tours.id),
      cars: count(cars.id),
      bookings: count(bookings.id),
      revenue: sum(sql`EXTRACT(days FROM (b."endDate" - b."startDate")) * COALESCE(t."price", c."price")::numeric` as any),
    }).from(locations)
      .leftJoin(tours, eq(locations.id, tours.locationId))
      .leftJoin(cars, eq(locations.id, cars.locationId))
      .leftJoin(bookings, or(eq(bookings.moduleId, tours.id), eq(bookings.moduleId, cars.id)))
      .where(isNull(locations.deletedAt))
      .where(filters?.vendorId ? sql`t.authorId = ${filters.vendorId} OR c.authorId = ${filters.vendorId}` : sql`true`)
      .groupBy(locations.id, locations.name);


    return query.map(r => ({
      id: r.id,
      name: r.name,
      tours: Number(r.tours),
      cars: Number(r.cars),
      bookings: Number(r.bookings),
      revenue: parseFloat(r.revenue || '0'),
    }));
  }
}

export const storage = new DatabaseStorage();

