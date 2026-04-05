import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull, count, sum, avg, sql, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export const storage = new (class DatabaseStorage {
// All your methods here - paste the COMPLETE clean class body from storage-clean.ts&#10;&#10;  async getRoles() {&#10;    return db.select().from(schema.roles);&#10;  }
  async getRatings(moduleType: 'car' | 'tour', moduleId: number) {
    return db.select().from(schema.ratings).where(
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

  // Add other methods as needed...
})();

export type * from "@shared/schema";

