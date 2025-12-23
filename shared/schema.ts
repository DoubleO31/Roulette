import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").defaultNow(),
  // Starting bankroll in dollars (set 0 if you only care about P/L)
  initialBalance: integer("initial_balance").default(0),
  // Bet unit in dollars (U). Default matches the md rule doc ($5).
  unitValue: integer("unit_value").default(5),
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
  unitValue: number;         // Dollars per unit (U)
  initialBalance: number;    // Dollars
  pnlUnits: number;          // Net units from bets
  pnlDollars: number;        // Net dollars from bets
  currentBalance: number;    // Dollars (initialBalance + pnlDollars)
  currentBalanceUnits: number; // Same as pnlUnits (kept for backward UI compatibility)
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
