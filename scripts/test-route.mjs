// Quick validation of the reachability engine through the unified (merged)
// graph. Run: node scripts/test-route.mjs

import { route } from '../lib/engine.mjs';

function query(fromCity, toCity) {
  console.log(`\n=== ${fromCity} -> ${toCity} ===`);
  const r = route(fromCity, toCity);
  if (!r.ok) { console.log('RESULT:', r.error); return; }
  if (!r.possible) { console.log('RESULT: NOT possible by rail'); return; }
  console.log(`RESULT: POSSIBLE — ${r.connections} connection(s) over ${r.rideCount} ride(s)`);
  console.log('  path:', r.path.map((p) => p.name).join('  ->  '));
  r.rides.forEach((ride, i) => {
    const dur = ride.approxMinutes == null ? '?' : ride.approxMinutes + ' min';
    console.log(`    ride ${i + 1}: ${ride.from} -> ${ride.to} | ~${dur} | runs ${ride.runs.start}–${ride.runs.end}`);
  });
}

query('Helsinki', 'Oulu');
query('Helsinki', 'Haparanda');
query('Helsinki', 'Rovaniemi');
query('Helsinki', 'Stockholm');
