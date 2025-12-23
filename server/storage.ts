import { db } from "./db";
import { sessions, spins, type Session, type Spin, type InsertSession, type InsertSpin } from "@shared/schema";
import { eq, asc, desc } from "drizzle-orm";

export interface IStorage {
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getSessions(): Promise<Session[]>;
  deleteSession(id: number): Promise<boolean>;
  createSpin(spin: InsertSpin): Promise<Spin>;
  getSpinsBySession(sessionId: number): Promise<Spin[]>;
}

export class DatabaseStorage implements IStorage {
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessions(): Promise<Session[]> {
    return await db.select().from(sessions).orderBy(desc(sessions.id));
  }

  async deleteSession(id: number): Promise<boolean> {
    const deleted = await db.transaction(async (tx) => {
      await tx.delete(spins).where(eq(spins.sessionId, id));
      const result = await tx.delete(sessions).where(eq(sessions.id, id)).returning({ id: sessions.id });
      return result.length > 0;
    });
    return deleted;
  }

  async createSpin(spin: InsertSpin): Promise<Spin> {
    const [newSpin] = await db.insert(spins).values(spin).returning();
    return newSpin;
  }

  async getSpinsBySession(sessionId: number): Promise<Spin[]> {
    return await db.select().from(spins).where(eq(spins.sessionId, sessionId)).orderBy(asc(spins.id));
  }
}

export const storage = new DatabaseStorage();
