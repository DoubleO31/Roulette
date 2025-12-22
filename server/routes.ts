import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { type Bet, type GameState, type Spin } from "@shared/schema";

const UNIT = 5; // $5

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
function calculateGameState(spins: Spin[]): GameState {
  let balanceUnits = 0;
  let historyLog: any[] = [];
  
  // Replay history to calculate balance
  // We need to know what the bets WERE for each spin to calculate P/L
  // This implies we need to simulate the state evolution.
  
  // Simulation State
  let currentBlockIndex = 0; // 0-9
  let blockNumber = 1;       // 1, 2, 3...
  
  // Anchor tracking
  // Cycle: BLACK, ODD, RED, EVEN, 1-18, 19-36
  const ANCHOR_CYCLE = [
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

  // Helper to determine bets for a given state (before result)
  const getBetsForState = (
    blockNum: number, 
    blockIdx: number, 
    lastResult: string | null, 
    currentBalUnits: number,
    prevAnchorResults: boolean[] // [true (win), false (loss), ...] for current block's anchor
  ) => {
    const bets: Bet[] = [];
    
    // 1. ANCHOR BET
    const anchorBaseIdx = (blockNum - 1) % ANCHOR_CYCLE.length;
    let anchor = ANCHOR_CYCLE[anchorBaseIdx];
    
    // Check 2-loss flip rule within the block
    let consecutiveLosses = 0;
    for (let i = prevAnchorResults.length - 1; i >= 0; i--) {
      if (!prevAnchorResults[i]) consecutiveLosses++;
      else break;
    }
    
    // If we have 2+ consecutive losses in this block, flip the anchor
    const isFlipped = consecutiveLosses >= 2;
    // Actually, rule says "if anchor loses 2 spins in a row, flip for REST of block"
    // So we need to check if we EVER hit 2 consecutive losses in this block
    let hasFlippedInBlock = false;
    let run = 0;
    for (const res of prevAnchorResults) {
      if (!res) run++;
      else run = 0;
      if (run >= 2) {
        hasFlippedInBlock = true;
        break;
      }
    }

    if (hasFlippedInBlock) {
       bets.push({
         name: `Anchor: ${anchor.pairLabel}`,
         type: 'anchor',
         amountUnits: 1,
         description: `Flipped from ${anchor.label} due to losses`
       });
    } else {
       bets.push({
         name: `Anchor: ${anchor.label}`,
         type: 'anchor',
         amountUnits: 1,
         description: 'Standard rotation'
       });
    }

    // 2. MIX BET
    // Based on LAST spin result. If no last result (start of session), maybe skip or random?
    // Plan says: "At start of 10-spin block, choose BET 2 using last result number as seed"
    // "Rule: do not change BET 2 mid-block."
    
    // We need the result that happened right before this block started.
    // If blockNum=1, use lastResult (which might be null if brand new, assume no bet or user provides manual seed? let's assume no bet 2 on very first spin if no history)
    
    // Wait, we need to look back to finding the seed.
    // Since we are simulating, we can track the 'activeMixBet' for the block.
    
    let mixBet: Bet | null = null;
    
    // Logic: calculate seed from the result just before the current block started.
    // If spin index is 0 (first spin of session), check if there's a prior result. 
    // For this simulation, we'll return the determined mix bet.
    
    return { anchorBet: bets[0], mixBet, partyBet: null };
  };

  // --- REPLAY LOOP ---
  let activeMixBet: Bet | null = null;
  let activePartyIndex = 0;
  let anchorResultsInBlock: boolean[] = [];

  // Variables to hold state for "NEXT" prediction
  let lastSpinResult = null;
  
  for (let i = 0; i < spins.length; i++) {
    const spin = spins[i];
    const spinIdx = i + 1; // 1-based index
    const currentBlockNum = Math.ceil(spinIdx / 10);
    const currentBlockIdx = (spinIdx - 1) % 10; // 0-9
    
    // If start of new block, reset block tracking
    if (currentBlockIdx === 0) {
      anchorResultsInBlock = [];
      // Determine Mix Bet for this block based on Previous Spin (i-1)
      if (i > 0) {
        const prevRes = spins[i-1].result;
        const seed = getSeed(prevRes);
        const isDozen = seed % 2 !== 0; // Odd = Dozen
        const mod3 = seed % 3;
        
        let label = "";
        let desc = `Seed ${seed} (${isDozen ? 'Odd' : 'Even'})`;
        
        if (isDozen) {
          if (mod3 === 0) label = "Dozen 1 (1-12)"; // Plan says S mod 3 = 0 -> 1-12. Usually mod 3=0 is 3,6,9... wait. 
          // Plan: "S mod 3 = 0 -> 1-12"
          else if (mod3 === 1) label = "Dozen 2 (13-24)";
          else label = "Dozen 3 (25-36)";
        } else {
          // Column
          if (mod3 === 0) label = "Col 1";
          else if (mod3 === 1) label = "Col 2";
          else label = "Col 3";
        }
        
        activeMixBet = {
          name: label,
          type: 'mix',
          amountUnits: 1,
          description: desc
        };
      } else {
        // First spin of session - Plan doesn't strictly say. 
        // We can default to NO Mix bet or ask user. Let's assume NO Mix bet for spin 1.
        activeMixBet = null;
      }
    }

    // Determine Anchor Bet for this spin
    const anchorBaseIdx = (currentBlockNum - 1) % ANCHOR_CYCLE.length;
    const baseAnchor = ANCHOR_CYCLE[anchorBaseIdx];
    
    // Check flip status
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

    // Determine Party Bet
    // "Party Mode is allowed if Session P/L >= +4U OR most recent result seed S mod 7 = 0"
    // "Max 1 Party spin per 10-spin block" -> Need to track if we partied in this block
    // IMPORTANT: The prompt says "Party Mode is 1 spin only when called". 
    // And "Assistant responds each spin with Bets for next spin".
    // So for the PAST spins, we need to know if we *did* bet party. 
    // We can't know for sure without storing it, but we can approximate:
    // If logic triggered, we bet it.
    // However, the rule "Max 1 Party spin per 10-spin block" makes it deterministic.
    // We need to track `partySpinUsedInBlock`.
    
    // Wait, "Party Mode is 1 spin only when called by the assistant".
    // Since we are rebuilding state, we apply the logic:
    // Did we trigger party this block yet?
    
    // We need to store `hasPartiedInBlock` in the replay loop.
    let partyBet: Bet | null = null;
    // We only trigger party if we haven't yet this block
    // BUT we need the decision from BEFORE the spin.
    // We need `prevResult` and `prevBalance`.
    
    // Let's simplified: We assume we ALWAYS take the party bet if conditions met and available.
    // Condition check uses state at start of spin `i`.
    
    // --- SCORING THE SPIN ---
    const res = spin.result;
    let spinPnL = 0;
    
    // 1. Anchor PnL
    let anchorWin = false;
    if (currentAnchor.type === 'color') {
      anchorWin = getColor(res) === currentAnchor.value;
    } else if (currentAnchor.type === 'parity') {
      anchorWin = (currentAnchor.value === 'odd' && isOdd(res)) || (currentAnchor.value === 'even' && !isOdd(res));
    } else if (currentAnchor.type === 'range') {
      anchorWin = (currentAnchor.value === 'low' && isLow(res)) || (currentAnchor.value === 'high' && isHigh(res));
    }
    
    spinPnL += anchorWin ? 1 : -1;
    anchorResultsInBlock.push(anchorWin); // Record for flip logic
    
    // 2. Mix PnL
    if (activeMixBet) {
      let mixWin = false;
      const n = parseInt(res);
      if (res !== '0' && res !== '00') {
        if (activeMixBet.name.includes("Dozen 1")) mixWin = n <= 12;
        else if (activeMixBet.name.includes("Dozen 2")) mixWin = n > 12 && n <= 24;
        else if (activeMixBet.name.includes("Dozen 3")) mixWin = n > 24;
        else if (activeMixBet.name.includes("Col 1")) mixWin = n % 3 === 1;
        else if (activeMixBet.name.includes("Col 2")) mixWin = n % 3 === 2;
        else if (activeMixBet.name.includes("Col 3")) mixWin = n % 3 === 0;
      }
      spinPnL += mixWin ? 2 : -1;
    }
    
    // 3. Party PnL
    // Check if we partied on this spin `i`.
    // Conditions: P/L >= 4 OR (lastSeed % 7 === 0). AND not partied yet in block.
    // Note: Party condition is based on PREVIOUS state.
    // We need a variable `hasPartiedInBlock` that resets on block change.
    
    // We track this outside the spin loop? No, inside.
    // We need to know if *this specific spin* was a party spin.
    // That depends on `balanceUnits` BEFORE `spinPnL` was added, and `spins[i-1]`.
    
    // Check party condition for THIS spin
    let isPartySpin = false;
    // Condition 1: P/L >= 4
    const condPL = balanceUnits >= 4;
    // Condition 2: Last seed mod 7 == 0
    let condSeed = false;
    if (i > 0) {
      const s = getSeed(spins[i-1].result);
      if (s % 7 === 0) condSeed = true;
    }
    
    // We need to track if we ALREADY partied in this block (spins startIdx to i-1)
    // This is tricky in a loop. We can just use a flag `partyUsedInCurrentBlock`.
    
    // But wait, if we are at spin `i`, we need to know if we partied at spin `i-1`? 
    // No, we need to know if we partied at any spin in the current block BEFORE `i`.
    
    // Let's add `partyUsedInCurrentBlock` to state.
    
    // RESTART LOGIC for loop clarity:
    // We need to maintain `partyUsedInCurrentBlock` state.
  }
  
  // --- REAL REPLAY IMPLEMENTATION ---
  balanceUnits = 0;
  let partyUsedInCurrentBlock = false;
  activeMixBet = null;
  anchorResultsInBlock = [];
  activePartyIndex = 0; // Rotates C1...C6
  
  for (let i = 0; i < spins.length; i++) {
    const spin = spins[i];
    const spinIdx = i + 1;
    const currentBlockNum = Math.ceil(spinIdx / 10);
    const currentBlockIdx = (spinIdx - 1) % 10;
    
    // Reset block state
    if (currentBlockIdx === 0) {
      anchorResultsInBlock = [];
      partyUsedInCurrentBlock = false;
      
      // Determine Mix Bet
      let seed: number;
      if (currentBlockNum === 1) {
        // Block 1: Use default seed 37 (Odd → Dozen, 37%3=1 → Dozen 2)
        seed = 37;
      } else {
        // Other blocks: Use result from previous block's last spin (spin i-1)
        const prevRes = spins[i-1].result;
        seed = getSeed(prevRes);
      }
      
      const mixInfo = getMixBetFromSeed(seed);
      activeMixBet = { name: mixInfo.name, type: 'mix', amountUnits: 1, description: mixInfo.description };
    }

    // Determine Anchor
    const anchorBaseIdx = (currentBlockNum - 1) % ANCHOR_CYCLE.length;
    const baseAnchor = ANCHOR_CYCLE[anchorBaseIdx];
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
    else if (currentAnchor.type === 'parity') anchorWin = (currentAnchor.value === 'odd' && isOdd(res)) || (currentAnchor.value === 'even' && !isOdd(res));
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
      const partyConf = PARTY_CORNERS[activePartyIndex];
      // Check win
      const n = parseInt(res);
      const partyWin = res !== '0' && res !== '00' && partyConf.nums.includes(n);
      balanceUnits += partyWin ? 8 : -1; // Corner pays 8:1
      
      // Rotate party index
      activePartyIndex = (activePartyIndex + 1) % PARTY_CORNERS.length;
    }
  }

  // --- PREDICT NEXT BETS ---
  // Now we are at the state AFTER all spins. Prepare bets for (spins.length + 1)
  const nextSpinIdx = spins.length + 1;
  const nextBlockNum = Math.ceil(nextSpinIdx / 10);
  const nextBlockIdx = (nextSpinIdx - 1) % 10;
  
  const nextBets: Bet[] = [];
  
  // 1. Next Mix Bet
  // If new block, calculate new mix bet from LAST result
  if (nextBlockIdx === 0) {
    // New block starting
    let seed: number;
    if (nextBlockNum === 1) {
      // Should not happen (we already processed block 1), but just in case
      seed = 37;
    } else {
      // Use result from previous block's last spin
      const prevRes = spins[spins.length - 1].result;
      seed = getSeed(prevRes);
    }
    const mixInfo = getMixBetFromSeed(seed);
    activeMixBet = { name: mixInfo.name, type: 'mix', amountUnits: 1, description: mixInfo.description };
    partyUsedInCurrentBlock = false; // Reset for new block
    anchorResultsInBlock = []; // Reset
  }
  
  // 2. Next Anchor Bet
  const anchorBaseIdx = (nextBlockNum - 1) % ANCHOR_CYCLE.length;
  const baseAnchor = ANCHOR_CYCLE[anchorBaseIdx];
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
       const partyConf = PARTY_CORNERS[activePartyIndex];
       nextBets.push({
         name: `Party: ${partyConf.label}`,
         type: 'party',
         amountUnits: 1,
         description: condPL ? "Trigger: P/L >= +4U" : "Trigger: Seed % 7 == 0"
       });
     }
  }

  return {
    currentBalance: balanceUnits * UNIT,
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
    const session = await storage.createSession({ initialBalance: 0 });
    res.status(201).json(session);
  });

  app.get(api.sessions.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const session = await storage.getSession(id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    
    const spins = await storage.getSpinsBySession(id);
    const state = calculateGameState(spins);
    res.json(state);
  });

  app.post(api.spins.create.path, async (req, res) => {
    try {
      const { sessionId, result } = api.spins.create.input.parse(req.body);
      
      // Save spin
      await storage.createSpin({ sessionId, result });
      
      // Recalculate state
      const spins = await storage.getSpinsBySession(sessionId);
      const state = calculateGameState(spins);
      
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
