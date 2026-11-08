// src/model/validate/seats.js — seats (SPEC §13).
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { isPlainObject } from './shared.js';

export function seatProblems(b, err, ctx) {
  // ---- Seats (SPEC §13) ------------------------------------------------------
  // Three rules the schema cannot say: baselines are one per seat and cover
  // 1..N; the null seat is exactly one boss row; every seat can be climbed —
  // it has a normal, an elite and a boss row, or a map for it cannot be built.
  {
    const seats = Array.isArray(b.seats) ? b.seats.filter(Boolean) : [];
    const encounters = Array.isArray(b.encounters) ? b.encounters.filter(Boolean) : [];
    const tiers = seats.map((seat) => seat.baseTier).sort((x, y) => x - y);
    if (seats.length && tiers.some((tier, i) => tier !== i + 1)) {
      err('seats', `baseTier values must be exactly 1..${seats.length}, one per seat (got ${JSON.stringify(tiers)})`);
    }
    const nullSeat = encounters.filter((encounter) => encounter.seat === null);
    if (encounters.length && nullSeat.length !== 1) {
      err('encounters', `exactly one encounter may carry seat: null — the final tier's extra terminal (got ${nullSeat.length}: ${nullSeat.map((e) => e.id).join(', ') || 'none'})`);
    }
    for (const encounter of nullSeat) {
      if (encounter.pool !== 'boss') err(`encounters.${encounter.id}.seat`, 'the null-seat encounter must be a boss');
    }
    for (const seat of seats) {
      for (const pool of ['normal', 'elite', 'boss']) {
        if (!encounters.some((encounter) => encounter.seat === seat.id && encounter.pool === pool)) {
          err(`seats.${seat.id}`, `no '${pool}' encounter is bound to this seat; a map for it cannot be built`);
        }
      }
    }
    const table = b.balance && b.balance.seatTiers;
    const cycle = b.balance && b.balance.endless && b.balance.endless.actsPerCycle;
    if (b.balance !== undefined) {
      if (!isPlainObject(table)) {
        err('balance.seatTiers', 'must be an object keyed by tier (1..actsPerCycle) with a positive multiplier each');
      } else {
        for (let tier = 1; tier <= (Number(cycle) || 0); tier++) {
          const mult = table[tier];
          if (typeof mult !== 'number' || !(mult > 0)) err(`balance.seatTiers.${tier}`, `tier ${tier} needs a positive multiplier (got ${JSON.stringify(mult)})`);
        }
        if (table[1] !== 1) err('balance.seatTiers.1', `tier 1 is the definition of scale 1 and must be exactly 1 (got ${JSON.stringify(table[1])})`);
        for (const key of Object.keys(table)) {
          const tier = Number(key);
          if (!Number.isInteger(tier) || tier < 1 || tier > (Number(cycle) || 0)) err(`balance.seatTiers.${key}`, `tier keys must be 1..${cycle}`);
        }
      }
      // balance.bossTiers (§13.3): one { hp, damage } per tier, both positive.
      const bossTable = b.balance.bossTiers;
      if (!isPlainObject(bossTable)) {
        err('balance.bossTiers', 'must be an object keyed by tier (1..actsPerCycle), each { hp, damage } with positive multipliers');
      } else {
        for (let tier = 1; tier <= (Number(cycle) || 0); tier++) {
          const row = bossTable[tier];
          if (!isPlainObject(row)) { err(`balance.bossTiers.${tier}`, `tier ${tier} needs a { hp, damage } row`); continue; }
          for (const field of ['hp', 'damage']) {
            if (typeof row[field] !== 'number' || !(row[field] > 0)) err(`balance.bossTiers.${tier}.${field}`, `needs a positive multiplier (got ${JSON.stringify(row[field])})`);
          }
          for (const field of Object.keys(row)) if (field !== 'hp' && field !== 'damage') err(`balance.bossTiers.${tier}.${field}`, 'unknown field (a tier row is { hp, damage })');
        }
        for (const key of Object.keys(bossTable)) {
          const tier = Number(key);
          if (!Number.isInteger(tier) || tier < 1 || tier > (Number(cycle) || 0)) err(`balance.bossTiers.${key}`, `tier keys must be 1..${cycle}`);
        }
      }
    }
  }
}
