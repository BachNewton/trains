import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCities, resolveToStations, suggestCities } from '../lib/cities.mjs';

function stations(arr) {
  const m = new Map();
  for (const s of arr) m.set(s.id, { countries: [s.country], ...s });
  return m;
}

// Stockholm: 3 stations (incl. the genitive "Stockholms södra") close together.
// Göteborg/Malmö: single-station cities whose names carry the "Centralstation"
// qualifier (3 occurrences -> detected as generic and stripped).
// Oulunkylä: shares the "Oulu" prefix but is a Helsinki suburb ~600 km away.
const fixture = stations([
  { id: 'A', name: 'Stockholm Centralstation', lat: 59.3315, lon: 18.0549, country: 'SE' },
  { id: 'B', name: 'Stockholm City', lat: 59.3311, lon: 18.0594, country: 'SE' },
  { id: 'C', name: 'Stockholms södra', lat: 59.3136, lon: 18.0619, country: 'SE' },
  { id: 'D', name: 'Göteborg Centralstation', lat: 57.7089, lon: 11.9746, country: 'SE' },
  { id: 'G', name: 'Malmö Centralstation', lat: 55.6090, lon: 13.0001, country: 'SE' },
  { id: 'E', name: 'Oulu', lat: 65.0124, lon: 25.4861, country: 'FI' },
  { id: 'F', name: 'Oulunkylä', lat: 60.2290, lon: 24.9677, country: 'FI' },
]);

function cityLabels(idx) {
  return [...idx.cities.values()].map((c) => c.label);
}
function city(idx, label) {
  return [...idx.cities.values()].find((c) => c.label === label);
}

test('groups a city\'s stations (incl. genitive form) into one city', () => {
  const idx = buildCities(fixture);
  assert.ok(cityLabels(idx).includes('Stockholm'));
  assert.deepEqual(new Set(city(idx, 'Stockholm').stationIds), new Set(['A', 'B', 'C']));
});

test('strips a data-detected generic qualifier from single-station cities', () => {
  const idx = buildCities(fixture);
  const labels = cityLabels(idx);
  assert.ok(labels.includes('Göteborg'), 'expected "Göteborg", got: ' + labels.join(', '));
  assert.ok(labels.includes('Malmö'));
});

test('distance guard keeps a same-prefix far-away station separate', () => {
  const idx = buildCities(fixture);
  assert.ok(cityLabels(idx).includes('Oulu'));
  assert.ok(cityLabels(idx).includes('Oulunkylä'));
  assert.deepEqual(city(idx, 'Oulu').stationIds, ['E']);
});

test('resolveToStations fans a city out to all its stations', () => {
  const idx = buildCities(fixture);
  assert.deepEqual(new Set(resolveToStations('stockholm', idx).stationIds), new Set(['A', 'B', 'C']));
});

test('suggestCities returns one entry per city with its flags', () => {
  const idx = buildCities(fixture);
  const s = suggestCities('sto', idx);
  assert.equal(s.length, 1);
  assert.equal(s[0].name, 'Stockholm');
  assert.deepEqual(s[0].countries, ['SE']);
});
