// THE RECORDED REPORT'S CONFIGURATION, CHECKED AGAINST CONTENT.
//
// docs/balance-runs.md is measured by hand (runsim is too slow for CI) and
// tools/balance.mjs copies it verbatim into docs/BALANCE.md §7. Copying alone
// let a stale report survive a retune: change balance.seatTiers or
// balance.bossTiers, regenerate, and --check passed with §7 still advertising
// the old multipliers beside rates measured under them. The win rates cannot
// be re-derived here, but the configuration they were measured under can, so
// every multiplier the report states is compared with the live registries and
// a mismatch is named. tools/balance.mjs fails on any problem returned.
//
// What is checked:
//   - the "Configured multipliers" bullet: its `balance.seatTiers` and
//     `balance.bossTiers` text must equal the live rows, formatted as below;
//   - every row of a table with an "Enemy HP ×" column: seatTierHpMult;
//   - every row of a table with a "Boss" column and "Boss HP ×" / "Boss
//     damage ×": bossTierScale for that boss encounter at that tier;
//   - at least one table of each kind exists.

import { seatTierHpMult, bossTierScale } from '../src/model/seats.js';

const safeGet = (reg, id) => { try { return reg.get(id) || null; } catch { return null; } };
const tierKeys = (table) => Object.keys(table).map(Number).filter(Number.isInteger).sort((a, b) => a - b);

/** The configured-multiplier text the report must carry, from live content. */
export function configuredMultiplierText(REG) {
  const seat = tierKeys(REG.balance.seatTiers).map((t) => `${t}: ${REG.balance.seatTiers[t]}`).join(', ');
  const boss = tierKeys(REG.balance.bossTiers).map((t) => `${t}: hp ${REG.balance.bossTiers[t].hp} / damage ${REG.balance.bossTiers[t].damage}`).join(', ');
  return { seat: `\`balance.seatTiers\` = ${seat};`, boss: `\`balance.bossTiers\` = ${boss}.` };
}

function tables(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) { cur = null; continue; }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cur) { cur = { header: cells, rows: [] }; out.push(cur); continue; }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    cur.rows.push(cells);
  }
  return out;
}

/** recordedMultiplierProblems(REG, text) → [] when every stated multiplier is live. */
export function recordedMultiplierProblems(REG, text) {
  const problems = [];
  const flat = text.replace(/\s+/g, ' ');
  const want = configuredMultiplierText(REG);
  if (!flat.includes(want.seat)) problems.push(`docs/balance-runs.md does not state the live balance.seatTiers (${want.seat})`);
  if (!flat.includes(want.boss)) problems.push(`docs/balance-runs.md does not state the live balance.bossTiers (${want.boss})`);
  const fmt = (n) => n.toFixed(3);
  let seatTables = 0, bossTables = 0;
  for (const { header, rows } of tables(text)) {
    const col = (name) => header.indexOf(name);
    const tier = col('Tier'), seat = col('Seat'), enemy = col('Enemy HP ×');
    const boss = col('Boss'), bossHp = col('Boss HP ×'), bossDmg = col('Boss damage ×');
    if (tier < 0) continue;
    if (enemy >= 0) seatTables++;
    if (boss >= 0 && bossHp >= 0 && bossDmg >= 0) bossTables++;
    for (const row of rows) {
      const t = Number(row[tier]);
      const where = `tier ${row[tier]}${seat >= 0 ? ` ${row[seat]}` : ''}`;
      if (enemy >= 0) {
        if (seat < 0 || !safeGet(REG.seats, row[seat])) { problems.push(`${where}: no such seat for the Enemy HP × column`); continue; }
        const live = fmt(seatTierHpMult(REG, row[seat], t));
        if (row[enemy] !== live) problems.push(`${where}: Enemy HP × ${row[enemy]} recorded, ${live} configured`);
      }
      if (boss >= 0 && bossHp >= 0 && bossDmg >= 0) {
        const id = row[boss].replace(/`/g, '');
        const enc = safeGet(REG.encounters, id);
        if (!enc || enc.pool !== 'boss') { problems.push(`${where}: '${id}' is not a boss encounter`); continue; }
        const scale = bossTierScale(REG, { encounter: enc, tier: t });
        if (row[bossHp] !== fmt(scale.hp)) problems.push(`${where} ${id}: Boss HP × ${row[bossHp]} recorded, ${fmt(scale.hp)} configured`);
        if (row[bossDmg] !== fmt(scale.damage)) problems.push(`${where} ${id}: Boss damage × ${row[bossDmg]} recorded, ${fmt(scale.damage)} configured`);
      }
    }
  }
  if (!seatTables) problems.push('docs/balance-runs.md has no table with an Enemy HP × column');
  if (!bossTables) problems.push('docs/balance-runs.md has no table with Boss, Boss HP × and Boss damage × columns');
  return problems;
}
