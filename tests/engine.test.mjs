import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { route, suggestPlaces } from '../lib/engine.mjs';

// These exercise the real merged FI+SE graph, so they only run once the feeds
// have been fetched (npm run fetch). On a fresh clone they skip cleanly.
const hasData = fs.existsSync(path.join(process.cwd(), 'gtfs', 'fi', 'stops.txt'));
const skip = hasData ? false : 'GTFS feeds not fetched (run: npm run fetch)';

test('Helsinki -> Oulu is a direct, 0-connection rail route', { skip }, () => {
  const r = route('Helsinki', 'Oulu');
  assert.equal(r.possible, true);
  assert.equal(r.connections, 0);
  assert.match(r.path.at(0).name, /Helsinki/);
  assert.match(r.path.at(-1).name, /Oulu/);
});

test('Helsinki -> Stockholm is possible across the border', { skip }, () => {
  const r = route('Helsinki', 'Stockholm');
  assert.equal(r.possible, true);
  assert.ok(r.connections >= 1, 'expected at least one connection across countries');
  assert.match(r.path.at(0).name, /Helsinki/);
  assert.match(r.path.at(-1).name, /Stockholm/);
});

test('an unknown city is reported, not crashed', { skip }, () => {
  const r = route('Helsinki', 'Atlantis');
  assert.equal(r.ok, false);
  assert.match(r.error, /Unknown destination/);
});

test('typing a city returns exactly one suggestion for it', { skip }, () => {
  const s = suggestPlaces('stockholm');
  assert.equal(s.filter((x) => x.name === 'Stockholm').length, 1);
});
