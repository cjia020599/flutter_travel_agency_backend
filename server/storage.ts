import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull, count, sum, avg, sql, desc, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import { roles, users, vendorProfiles, tours, cars, locations, attributes, attributeTerms, categories, bookings, ratings, notifications } from "@shared/schema";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export const storage = new (class DatabaseStorage {
  async getRoles(): Promise<Role[]> {
    return db.select().from(roles);
  }
  async getRatings(moduleType: 'car' | 'tour', moduleId: number) {
    return db.select({
      id: schema.ratings.id,
      userId: schema.ratings.userId,
      moduleType: schema.ratings.moduleType,
      moduleId: schema.ratings.moduleId,
      stars: schema.ratings.stars,
      comment: schema.ratings.comment,
      createdAt: schema.ratings.createdAt,
      updatedAt: schema.ratings.updatedAt,
      userName: schema.users.firstName,
      userAvatar: schema.users.avatar,
      userInitials: sql<string>`concat(substring(${schema.users.firstName}, 1, 1), substring(${schema.users.lastName}, 1, 1))`,
    }).from(schema.ratings).innerJoin(schema.users, eq(schema.ratings.userId, schema.users.id)).where(
      and(
        eq(schema.ratings.moduleType, moduleType),
        eq(schema.ratings.moduleId, moduleId)
      )
    ).orderBy(desc(schema.ratings.createdAt));
  }

  async getUserRating(userId: number, moduleType: 'car' | 'tour', moduleId: number) {
    const [r] = await db.select().from(schema.ratings).where(
      and(
        eq(schema.ratings.userId, userId),
        eq(schema.ratings.moduleType, moduleType),
        eq(schema.ratings.moduleId, moduleId)
      )
    );
    return r;
  }

  async getRatingById(id: number) {
    const [r] = await db.select().from(schema.ratings).where(eq(schema.ratings.id, id));
    return r;
  }

  async createRating(data: typeof schema.ratings.$inferInsert) {
    const [r] = await db.insert(schema.ratings).values(data).returning();
    return r;
  }

  async updateRating(id: number, updates: Partial<typeof schema.ratings.$inferInsert>) {
    const [r] = await db.update(schema.ratings).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(schema.ratings.id, id)).returning();
    if (!r) throw new Error(`Rating ${id} not found`);
    return r;
  }

  async deleteRating(id: number) {
    await db.delete(schema.ratings).where(eq(schema.ratings.id, id));
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
    const [r] = await db.update(tours).set(updates).where(eq(tours.id, id)).returning();
    return r;
  }
  async deleteTour(id: number): Promise<void> {
    await db.update(tours).set({ deletedAt: new Date() }).where(eq(tours.id, id));
  }
  async getDeletedTours(): Promise<Tour[]> {
    return db.select().from(tours).where(sql`${tours.deletedAt} is not null`);
  }
  async restoreTour(id: number): Promise<Tour | undefined> {
    const [r] = await db.update(tours).set({ deletedAt: null }).where(eq(tours.id, id)).returning();
    return r;
  }
  async forceDeleteTour(id: number): Promise<void> {
    await db.delete(tours).where(eq(tours.id, id));
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
  async createAttribute(data: InsertAttribute): Promise<Attribute> {
    const [r] = await db.insert(attributes).values(data).returning();
    return r;
  }
  async updateAttribute(id: number, updates: Partial<InsertAttribute>): Promise<Attribute | undefined> {
    const [r] = await db.update(attributes).set(updates).where(eq(attributes.id, id)).returning();
    return r;
  }
  async deleteAttribute(id: number): Promise<void> {
    await db.delete(attributes).where(eq(attributes.id, id));
  }

  async getAttributeTerms(attributeId: number): Promise<AttributeTerm[]> {
    return db.select().from(attributeTerms).where(eq(attributeTerms.attributeId, attributeId));
  }
  async createAttributeTerm(term: InsertAttributeTerm): Promise<AttributeTerm> {
    const [r] = await db.insert(attributeTerms).values(term).returning();
    return r;
  }
  async deleteAttributeTerm(termId: number): Promise<void> {
    await db.delete(attributeTerms).where(eq(attributeTerms.id, termId));
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }
  async createCategory(data: InsertCategory): Promise<Category> {
    const [r] = await db.insert(categories).values(data).returning();
    return r;
  }
  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const [r] = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return r;
  }
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
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

  async updateUser(
    id: number,
    updates: Partial<UpdateProfileInput> & { roleId?: number },
  ): Promise<AuthUser> {
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

  async getBookingSalesLines(filters?: ReportFilters): Promise<Array<{
    bookingId: number;
    serviceName: string;
    moduleType: "tour" | "car";
    pax: number;
    price: number;
    salePrice: number;
    amount: number;
    taxRate: number;
    tax: number;
    total: number;
  }>> {
    const defaultTaxRate = 0.12;
    const query = db
      .select({
        bookingId: bookings.id,
        moduleType: bookings.moduleType,
        tourTitle: tours.title,
        carTitle: cars.title,
        tourAuthorId: tours.authorId,
        carAuthorId: cars.authorId,
        tourPrice: tours.price,
        carPrice: cars.price,
        tourSalePrice: tours.salePrice,
        carSalePrice: cars.salePrice,
      })
      .from(bookings)
      .leftJoin(tours, and(eq(bookings.moduleType, "tour"), eq(bookings.moduleId, tours.id)))
      .leftJoin(cars, and(eq(bookings.moduleType, "car"), eq(bookings.moduleId, cars.id)))
      .where(
        and(
          filters?.vendorId
              ? or(eq(tours.authorId, filters.vendorId), eq(cars.authorId, filters.vendorId))
              : sql`true`,
          filters?.fromDate ? sql`${bookings.startDate} >= ${new Date(filters.fromDate)}` : sql`true`,
          filters?.toDate ? sql`${bookings.endDate} <= ${new Date(filters.toDate)}` : sql`true`,
        )
      );

    const rows = await query;
    return rows.map((row) => {
      const normalizedType = row.moduleType === "car" ? "car" : "tour";
      const basePrice = Number(
        normalizedType === "tour" ? (row.tourPrice ?? 0) : (row.carPrice ?? 0),
      );
      const salePrice = Number(
        normalizedType === "tour"
            ? (row.tourSalePrice ?? row.tourPrice ?? 0)
            : (row.carSalePrice ?? row.carPrice ?? 0),
      );
      const pax = 1;
      const amount = salePrice * pax;
      const tax = amount * defaultTaxRate;
      return {
        bookingId: row.bookingId,
        serviceName:
          normalizedType === "tour"
            ? (row.tourTitle ?? `Tour #${row.bookingId}`)
            : (row.carTitle ?? `Car #${row.bookingId}`),
        moduleType: normalizedType,
        pax,
        price: basePrice,
        salePrice,
        amount,
        taxRate: defaultTaxRate,
        tax,
        total: amount + tax,
      };
    });
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

  // ---- Notifications ----
  async getUserNotifications(userId: number, input: { page: number; limit: number; unreadOnly: boolean }): Promise<Notification[]> {
    let query = db.select().from(notifications).where(eq(notifications.userId, userId));
    if (input.unreadOnly) {
      query = query.where(isNull(notifications.readAt));
    }
    const offset = (input.page - 1) * input.limit;
    return query
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit)
      .offset(offset);
  }

  async createNotification(notification: typeof notifications.$inferInsert): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [result] = await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)).returning();
    return result;
  }

  // ---- Chatbot Questions ----
  async getChatbotQuestions(): Promise<typeof schema.chatbotQuestions.$inferSelect[]> {
    return db.select().from(schema.chatbotQuestions);
  }

  async getActiveChatbotQuestions(): Promise<typeof schema.chatbotQuestions.$inferSelect[]> {
    return db.select().from(schema.chatbotQuestions).where(eq(schema.chatbotQuestions.active, true));
  }

  async createChatbotQuestion(data: typeof schema.insertChatbotQuestionSchema._input): Promise<typeof schema.chatbotQuestions.$inferSelect> {
    const [result] = await db.insert(schema.chatbotQuestions).values(data).returning();
    return result;
  }

  async updateChatbotQuestion(id: number, updates: Partial<typeof schema.insertChatbotQuestionSchema._input>): Promise<typeof schema.chatbotQuestions.$inferSelect | undefined> {
    const [result] = await db.update(schema.chatbotQuestions).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(schema.chatbotQuestions.id, id)).returning();
    return result;
  }

  async deleteChatbotQuestion(id: number): Promise<void> {
    await db.delete(schema.chatbotQuestions).where(eq(schema.chatbotQuestions.id, id));
  }
}
)

