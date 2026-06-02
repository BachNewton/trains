// Shared engine entry point used by both the API route and the test script.
// Loads the GTFS feed once (cached in module scope) and answers a city->city
// reachability query, logging the interesting steps to the server console.

import fs from 'node:fs';
import path from 'node:path';
import { loadFeed } from './gtfs.mjs';
import { mergeFeeds } from './merge.mjs';
import { resolveCity } from './cities.mjs';
import { findRoute } from './graph.mjs';

let cached = null;

/**
 * Country feed registry. Adding a country = one entry here + dropping its
 * `dir` folder (gtfs-<cc>) into the project. `railOnly` filters all-modes
 * national feeds down to trains; feeds that are already rail-only leave it off.
 */
export const COUNTRIES = [
  { code: 'FI', name: 'Finland', dir: 'gtfs/fi', railOnly: false },
  { code: 'SE', name: 'Sweden', dir: 'gtfs/se', railOnly: true },
];

/**
 * Load + cache the unified graph. Each country is a GTFS feed loaded by an
 * adapter; mergeFeeds() bridges same-place stations across borders. A country
 * is loaded only if its feed has actually been fetched into its dir.
 */
export function getFeed() {
  if (cached) return cached;
  const feeds = [];

  for (const c of COUNTRIES) {
    const dir = path.join(process.cwd(), c.dir);
    if (!fs.existsSync(path.join(dir, 'stops.txt'))) {
      console.log(`[engine] ${c.name} (${c.code}) feed not present at ${dir} — skipping`);
      continue;
    }
    console.log(`[engine] loading ${c.name} (${c.code}) feed from ${dir}${c.railOnly ? ' [rail only]' : ''}`);
    const feed = loadFeed(dir, { prefix: c.code, railOnly: c.railOnly });
    console.log(`[engine] ${c.code}:`, JSON.stringify(feed.stats));
    feeds.push(feed);
  }

  cached = mergeFeeds(feeds, { log: (m) => console.log('  [merge]', m) });
  console.log('[engine] unified graph:', JSON.stringify(cached.stats));
  return cached;
}

/**
 * Answer the v1 question: is `fromCity` -> `toCity` possible by rail, and with
 * how many connections?
 */
export function route(fromCity, toCity) {
  const feed = getFeed();
  const log = (m) => console.log('  [route]', m);
  console.log(`[route] query "${fromCity}" -> "${toCity}"`);

  const from = resolveCity(fromCity, feed.stations);
  const to = resolveCity(toCity, feed.stations);
  log(`resolved from: ${from.map((s) => `${s.id}(${s.name})`).join(', ') || '(none)'}`);
  log(`resolved to:   ${to.map((s) => `${s.id}(${s.name})`).join(', ') || '(none)'}`);

  if (!from.length) return { ok: false, error: `Unknown origin city: "${fromCity}"` };
  if (!to.length) return { ok: false, error: `Unknown destination city: "${toCity}"` };

  const res = findRoute(feed.graph, from.map((s) => s.id), to.map((s) => s.id), log);

  if (!res.possible) {
    log('RESULT: not possible by rail');
    return { ok: true, possible: false, from: fromCity, to: toCity };
  }

  const rides = [];
  for (let i = 0; i < res.path.length - 1; i++) {
    const a = res.path[i];
    const b = res.path[i + 1];
    const e = feed.graph.get(a).get(b);
    rides.push({
      from: feed.stations.get(a)?.name || a,
      to: feed.stations.get(b)?.name || b,
      approxMinutes: e.minDuration === Infinity ? null : Math.round(e.minDuration),
      runs: { start: e.start, end: e.end },
    });
  }
  const path = res.path.map((id) => ({ id, name: feed.stations.get(id)?.name || id }));
  log(`RESULT: possible, ${res.connections} connection(s) over ${res.rides} ride(s): ${path.map((p) => p.name).join(' -> ')}`);

  return { ok: true, possible: true, from: fromCity, to: toCity, connections: res.connections, rideCount: res.rides, path, rides };
}
