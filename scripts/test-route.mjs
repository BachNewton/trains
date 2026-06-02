// Quick validation of the reachability engine against the real Finnish GTFS.
// Run: node scripts/test-route.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeed } from '../lib/gtfs.mjs';
import { resolveCity } from '../lib/cities.mjs';
import { findRoute } from '../lib/graph.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const gtfsDir = path.join(root, '..', 'gtfs');

console.log('Loading feed from', gtfsDir);
const feed = loadFeed(gtfsDir, { today: '20260602' });
console.log('Feed stats:', feed.stats);

function query(fromCity, toCity) {
  console.log(`\n=== ${fromCity} -> ${toCity} ===`);
  const from = resolveCity(fromCity, feed.stations);
  const to = resolveCity(toCity, feed.stations);
  console.log(`resolved "${fromCity}" -> ${from.map((s) => s.id + '(' + s.name + ')').join(', ') || '(none)'}`);
  console.log(`resolved "${toCity}"   -> ${to.map((s) => s.id + '(' + s.name + ')').join(', ') || '(none)'}`);
  if (!from.length || !to.length) { console.log('RESULT: cannot resolve one of the cities'); return; }

  const res = findRoute(feed.graph, from.map((s) => s.id), to.map((s) => s.id), (m) => console.log('  bfs:', m));
  if (!res.possible) { console.log('RESULT: NOT possible by rail'); return; }
  const named = res.path.map((id) => feed.stations.get(id)?.name || id);
  console.log(`RESULT: POSSIBLE — ${res.connections} connection(s) over ${res.rides} ride(s)`);
  console.log('  path:', named.join('  ->  '));
  // show each ride's window + min duration
  for (let i = 0; i < res.path.length - 1; i++) {
    const e = feed.graph.get(res.path[i]).get(res.path[i + 1]);
    const dur = e.minDuration === Infinity ? '?' : Math.round(e.minDuration) + ' min';
    console.log(`    ride ${i + 1}: ${feed.stations.get(res.path[i]).name} -> ${feed.stations.get(res.path[i + 1]).name} | ~${dur} | runs ${e.start}–${e.end}`);
  }
}

query('Helsinki', 'Oulu');
query('Helsinki', 'Haparanda');
query('Helsinki', 'Rovaniemi');
query('Helsinki', 'Stockholm'); // expected: not resolvable yet (Sweden not loaded)
