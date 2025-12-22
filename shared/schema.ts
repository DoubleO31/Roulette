import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").defaultNow(),
  initialBalance: integer("initial_balance").default(0), // Tracking relative P/L usually starts at 0
  isActive: boolean("is_active").default(true),
});

export const spins = pgTable("spins", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  result: text("result").notNull(), // "0", "00", "1"-"36"
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, startTime: true });
export const insertSpinSchema = createInsertSchema(spins).omit({ id: true, createdAt: true });

// === TYPES ===
export type Session = typeof sessions.$inferSelect;
export type Spin = typeof spins.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertSpin = z.infer<typeof insertSpinSchema>;

// === API TYPES ===
export interface Bet {
  name: string;      // e.g., "Anchor: RED", "Mix: Dozen 1"
  type: "anchor" | "mix" | "party";
  amountUnits: number;
  description: string;
}

export interface GameState {
  currentBalance: number; // In dollars
  currentBalanceUnits: number;
  totalSpins: number;
  currentBlock: number;   // 1-based block index
  isPartyMode: boolean;
  nextBets: Bet[];
  lastResult: string | null;
  history: Spin[];
}

export type CreateSpinRequest = {
  sessionId: number;
  result: string;
};
