import { db } from "./db";
import {
  locations, tours, cars, tourAttributes, carAttributes, attributes, bookings,
  users, roles, vendorProfiles,
  type Tour, type InsertTour,
  type Car, type InsertCar,
  type Booking, type InsertCarRental, type CarRental,
  type Location, type Attribute,
  type InsertLocation, type InsertAttribute,
  type User, type InsertUser,
  type Role,
  type VendorProfile, type InsertVendorProfile,
  type AuthUser, type UpdateProfileInput,
} from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

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

  // Car Rentals
  getCarRentals(filters?: { userId?: number }): Promise<CarRental[]>;
  createCarRental(rental: InsertCarRental): Promise<Booking>;
  cancelCarRental(id: number): Promise<void>;
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
    return results.map(r => ({
      ...r,
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
    })) as CarRental[];
  }

  async createCarRental(rental: InsertCarRental): Promise<Booking> {
    const parsedDates = {
      ...rental,
      startDate: new Date(rental.startDate as string),
      endDate: new Date(rental.endDate as string),
    };
    const [result] = await db.insert(bookings).values(parsedDates as any).returning();
    return result;
  }

  async cancelCarRental(id: number): Promise<void> {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
  }
}

export const storage = new DatabaseStorage();
