import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { type Bet, type GameState, type Spin } from "@shared/schema";

const DEFAULT_UNIT = 5; // $5 (can be overridden per session)

// --- HELPER FUNCTIONS FOR ROULETTE LOGIC ---

// Number properties
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function getColor(nStr: string): 'red' | 'black' | 'green' {
  if (nStr === '0' || nStr === '00') return 'green';
  const n = parseInt(nStr);
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}
function isOdd(nStr: string): boolean {
  if (nStr === '0' || nStr === '00') return false;
  return parseInt(nStr) % 2 !== 0;
}
function isEven(nStr: string): boolean {
  if (nStr === '0' || nStr === '00') return false;
  return parseInt(nStr) % 2 === 0;
}
function isLow(nStr: string): boolean { // 1-18
  if (nStr === '0' || nStr === '00') return false;
  const n = parseInt(nStr);
  return n >= 1 && n <= 18;
}
function isHigh(nStr: string): boolean { // 19-36
  if (nStr === '0' || nStr === '00') return false;
  const n = parseInt(nStr);
  return n >= 19 && n <= 36;
}
function getDozen(nStr: string): 1 | 2 | 3 | null {
  if (nStr === '0' || nStr === '00') return null;
  const n = parseInt(nStr);
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}
function getColumn(nStr: string): 1 | 2 | 3 | null {
  if (nStr === '0' || nStr === '00') return null;
  const n = parseInt(nStr);
  return (n % 3 === 0 ? 3 : n % 3) as 1 | 2 | 3;
}
function getSeed(nStr: string): number {
  if (nStr === '00') return 37;
  if (nStr === '0') return 0;
  return parseInt(nStr);
}

function getPartyIndex(seed: number, count: number, total: number): number {
  const safeSeed = Number.isFinite(seed) ? seed : 0;
  return (safeSeed + count) % total;
}

// Helper to get Mix Bet label and description from seed
function getMixBetFromSeed(seed: number): { name: string; description: string } {
  const isDozen = seed % 2 !== 0;
  const mod3 = seed % 3;
  
  let label = "";
  let desc = `Seed ${seed} (${isDozen ? 'Odd' : 'Even'})`;
  
  if (isDozen) {
    if (mod3 === 0) label = "Dozen 1 (1-12)";
    else if (mod3 === 1) label = "Dozen 2 (13-24)";
    else label = "Dozen 3 (25-36)";
  } else {
    if (mod3 === 0) label = "Col 1 (1,4,7...)";
    else if (mod3 === 1) label = "Col 2 (2,5,8...)";
    else label = "Col 3 (3,6,9...)";
  }
  
  return { name: label, description: desc };
}

// Logic to determine Next Bets
function calculateGameState(spins: Spin[], opts: { initialBalance: number; unitValue: number }): GameState {
  let balanceUnits = 0; // P/L in units (U)
  
  // Replay history to calculate balance
  // We need to know what the bets WERE for each spin to calculate P/L
  // This implies we need to simulate the state evolution.
  
  // Anchor options (BET 1). We'll pick one per 10-spin block using a seed.
  const ANCHOR_OPTIONS = [
    { type: 'color', value: 'black', label: 'BLACK', pair: 'red', pairLabel: 'RED' },
    { type: 'parity', value: 'odd', label: 'ODD', pair: 'even', pairLabel: 'EVEN' },
    { type: 'color', value: 'red', label: 'RED', pair: 'black', pairLabel: 'BLACK' },
    { type: 'parity', value: 'even', label: 'EVEN', pair: 'odd', pairLabel: 'ODD' },
    { type: 'range', value: 'low', label: '1-18', pair: 'high', pairLabel: '19-36' },
    { type: 'range', value: 'high', label: '19-36', pair: 'low', pairLabel: '1-18' }
  ];
  
  // Party Corners
  const PARTY_CORNERS = [
    { label: '26-27-29-30', nums: [26,27,29,30] },
    { label: '14-15-17-18', nums: [14,15,17,18] },
    { label: '8-9-11-12', nums: [8,9,11,12] },
    { label: '2-3-5-6', nums: [2,3,5,6] },
    { label: '20-21-23-24', nums: [20,21,23,24] },
    { label: '32-33-35-36', nums: [32,33,35,36] },
  ];

  // --- REPLAY LOOP ---
  let activeMixBet: Bet | null = null;
  let mixBlockSize = 0;
  let mixSpinsInBlock = 0;
  let partyCount = 0;
  let anchorResultsInBlock: boolean[] = [];
  let activeAnchorBase = ANCHOR_OPTIONS[0];

  // (Old draft replay loop removed — it referenced undefined variables and could
  // cause incorrect balance calc. The real replay starts below.)

  // --- REAL REPLAY IMPLEMENTATION ---
  balanceUnits = 0;
  let partyUsedInCurrentBlock = false;
  activeMixBet = null;
  mixBlockSize = 0;
  mixSpinsInBlock = 0;
  anchorResultsInBlock = [];
  partyCount = 0; // Counts how many party bets have been called so far
  activeAnchorBase = ANCHOR_OPTIONS[0];
  
  for (let i = 0; i < spins.length; i++) {
    const spin = spins[i];
    const spinIdx = i + 1;
    const currentBlockNum = Math.ceil(spinIdx / 10);
    const currentBlockIdx = (spinIdx - 1) % 10;
    
    // Reset block state
    if (currentBlockIdx === 0) {
      anchorResultsInBlock = [];
      partyUsedInCurrentBlock = false;
      
      // Determine block seed (used for BOTH anchor + mix). For block 1, use 37.
      let seed: number;
      if (currentBlockNum === 1) {
        seed = 37;
      } else {
        const prevRes = spins[i-1].result;
        seed = getSeed(prevRes);
      }

      // Randomized BET 1 (Anchor) per 10-spin block
      activeAnchorBase = ANCHOR_OPTIONS[seed % ANCHOR_OPTIONS.length];
      
    }

    // Randomized BET 2 (Mix) per variable block (3-6 spins)
    if (mixSpinsInBlock === 0) {
      let mixSeed: number;
      if (i === 0) {
        mixSeed = 37;
      } else {
        mixSeed = getSeed(spins[i - 1].result);
      }
      mixBlockSize = 3 + (mixSeed % 4);
      const mixInfo = getMixBetFromSeed(mixSeed);
      activeMixBet = { name: mixInfo.name, type: 'mix', amountUnits: 1, description: mixInfo.description };
    }

    // Determine Anchor (with in-block 2-loss flip)
    const baseAnchor = activeAnchorBase;
    let hasFlipped = false;
    let run = 0;
    for (const r of anchorResultsInBlock) {
      if (!r) run++;
      else run = 0;
      if (run >= 2) { hasFlipped = true; break; }
    }
    const currentAnchor = hasFlipped ?
      { ...baseAnchor, label: baseAnchor.pairLabel, value: baseAnchor.pair, type: baseAnchor.type } :
      baseAnchor;

    // Determine Party
    let isParty = false;
    if (!partyUsedInCurrentBlock) {
       // Check triggers
       const condPL = balanceUnits >= 4;
       let condSeed = false;
       if (i > 0) {
         if (getSeed(spins[i-1].result) % 7 === 0) condSeed = true;
       }
       if (condPL || condSeed) {
         isParty = true;
         partyUsedInCurrentBlock = true; // Mark as used
       }
    }
    
    // Calculate PnL for this spin
    const res = spin.result;
    
    // Anchor PnL
    let anchorWin = false;
    if (currentAnchor.type === 'color') anchorWin = getColor(res) === currentAnchor.value;
    else if (currentAnchor.type === 'parity') {
      anchorWin = (currentAnchor.value === 'odd' && isOdd(res)) || (currentAnchor.value === 'even' && isEven(res));
    }
    else if (currentAnchor.type === 'range') anchorWin = (currentAnchor.value === 'low' && isLow(res)) || (currentAnchor.value === 'high' && isHigh(res));
    
    balanceUnits += anchorWin ? 1 : -1;
    anchorResultsInBlock.push(anchorWin);
    
    // Mix PnL
    if (activeMixBet) {
      let mixWin = false;
      const n = parseInt(res);
      if (res !== '0' && res !== '00') {
         // Simplify check
         const name = activeMixBet.name;
         if (name.includes("Dozen 1")) mixWin = n <= 12;
         else if (name.includes("Dozen 2")) mixWin = n > 12 && n <= 24;
         else if (name.includes("Dozen 3")) mixWin = n > 24;
         else if (name.includes("Col 1")) mixWin = n % 3 === 1;
         else if (name.includes("Col 2")) mixWin = n % 3 === 2;
         else if (name.includes("Col 3")) mixWin = n % 3 === 0;
      }
      balanceUnits += mixWin ? 2 : -1;
    }
    
    // Party PnL
    if (isParty) {
      // Which party bet?
      const partySeed = i > 0 ? getSeed(spins[i - 1].result) : 37;
      const partyIndex = getPartyIndex(partySeed, partyCount, PARTY_CORNERS.length);
      const partyConf = PARTY_CORNERS[partyIndex];
      // Check win
      const n = parseInt(res);
      const partyWin = res !== '0' && res !== '00' && partyConf.nums.includes(n);
      balanceUnits += partyWin ? 8 : -1; // Corner pays 8:1
      
      // Rotate party index
      partyCount += 1;
    }

    mixSpinsInBlock += 1;
    if (mixSpinsInBlock >= mixBlockSize) {
      mixSpinsInBlock = 0;
    }
  }

  // --- PREDICT NEXT BETS ---
  // Now we are at the state AFTER all spins. Prepare bets for (spins.length + 1)
  const nextSpinIdx = spins.length + 1;
  const nextBlockNum = Math.ceil(nextSpinIdx / 10);
  const nextBlockIdx = (nextSpinIdx - 1) % 10;
  
  const nextBets: Bet[] = [];
  
  // If next spin starts a new block, recompute seed-based bets (Anchor)
  if (nextBlockIdx === 0) {
    let seed: number;
    if (nextBlockNum === 1) {
      seed = 37;
    } else {
      const prevRes = spins[spins.length - 1].result;
      seed = getSeed(prevRes);
    }
    activeAnchorBase = ANCHOR_OPTIONS[seed % ANCHOR_OPTIONS.length];
    partyUsedInCurrentBlock = false; // Reset for new block
    anchorResultsInBlock = []; // Reset
  }

  // Mix bet may start a new variable-sized block (3-6 spins)
  if (mixSpinsInBlock === 0) {
    let mixSeed: number;
    if (spins.length === 0) {
      mixSeed = 37;
    } else {
      mixSeed = getSeed(spins[spins.length - 1].result);
    }
    mixBlockSize = 3 + (mixSeed % 4);
    const mixInfo = getMixBetFromSeed(mixSeed);
    activeMixBet = { name: mixInfo.name, type: 'mix', amountUnits: 1, description: mixInfo.description };
  }
  
  // 2. Next Anchor Bet (uses current block's chosen anchor)
  const baseAnchor = activeAnchorBase;
  let hasFlipped = false;
  let run = 0;
  for (const r of anchorResultsInBlock) {
    if (!r) run++;
    else run = 0;
    if (run >= 2) { hasFlipped = true; break; }
  }
  const nextAnchor = hasFlipped ?
      { ...baseAnchor, label: baseAnchor.pairLabel } :
      baseAnchor;
      
  nextBets.push({
    name: `Anchor: ${nextAnchor.label}`,
    type: 'anchor',
    amountUnits: 1,
    description: hasFlipped ? "Flipped (2-loss rule)" : "Standard rotation"
  });
  
  if (activeMixBet) {
    nextBets.push(activeMixBet);
  }
  
  // 3. Next Party Bet
  // Check triggers for NEXT spin
  if (!partyUsedInCurrentBlock) {
     const condPL = balanceUnits >= 4;
     let condSeed = false;
     if (spins.length > 0) {
       if (getSeed(spins[spins.length - 1].result) % 7 === 0) condSeed = true;
     }
     
     if (condPL || condSeed) {
       const partySeed = spins.length > 0 ? getSeed(spins[spins.length - 1].result) : 37;
       const partyIndex = getPartyIndex(partySeed, partyCount, PARTY_CORNERS.length);
       const partyConf = PARTY_CORNERS[partyIndex];
       nextBets.push({
         name: `Party: ${partyConf.label}`,
         type: 'party',
         amountUnits: 1,
         description: condPL ? "Trigger: P/L >= +4U" : "Trigger: Seed % 7 == 0"
       });
     }
  }

  const unitValue = Number.isFinite(opts.unitValue) && opts.unitValue > 0 ? opts.unitValue : DEFAULT_UNIT;
  const initialBalance = Number.isFinite(opts.initialBalance) ? opts.initialBalance : 0;

  return {
    unitValue,
    initialBalance,
    pnlUnits: balanceUnits,
    pnlDollars: balanceUnits * unitValue,
    currentBalance: initialBalance + balanceUnits * unitValue,
    currentBalanceUnits: balanceUnits,
    totalSpins: spins.length,
    currentBlock: nextBlockNum,
    isPartyMode: nextBets.some(b => b.type === 'party'),
    nextBets,
    lastResult: spins.length > 0 ? spins[spins.length-1].result : null,
    history: spins
  };
}


export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  
  app.post(api.sessions.create.path, async (req, res) => {
    const input = api.sessions.create.input?.parse(req.body ?? {}) ?? { initialBalance: 100, unitValue: DEFAULT_UNIT };
    const session = await storage.createSession({
      initialBalance: input.initialBalance,
      unitValue: input.unitValue,
    });
    res.status(201).json(session);
  });

  app.get(api.sessions.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const session = await storage.getSession(id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    
    const spins = await storage.getSpinsBySession(id);
    const state = calculateGameState(spins, { initialBalance: session.initialBalance ?? 0, unitValue: session.unitValue ?? DEFAULT_UNIT });
    res.json(state);
  });

  app.post(api.spins.create.path, async (req, res) => {
    try {
      const { sessionId, result } = api.spins.create.input.parse(req.body);
      
      // Save spin
      await storage.createSpin({ sessionId, result });
      
      // Recalculate state
      const spins = await storage.getSpinsBySession(sessionId);
      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const state = calculateGameState(spins, { initialBalance: session.initialBalance ?? 0, unitValue: session.unitValue ?? DEFAULT_UNIT });
      
      res.status(201).json(state);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  return httpServer;
}
