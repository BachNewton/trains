import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRoute } from '../lib/graph.mjs';

// tiny synthetic graph: list of [from, to] direct-ride edges
function G(edges) {
  const m = new Map();
  for (const [f, t] of edges) {
    if (!m.has(f)) m.set(f, new Map());
    m.get(f).set(t, { type: 'ride' });
  }
  return m;
}

test('direct ride is 0 connections', () => {
  const r = findRoute(G([['A', 'B']]), ['A'], ['B']);
  assert.equal(r.possible, true);
  assert.equal(r.connections, 0);
  assert.deepEqual(r.path, ['A', 'B']);
});

test('two rides is 1 connection', () => {
  const r = findRoute(G([['A', 'B'], ['B', 'C']]), ['A'], ['C']);
  assert.equal(r.connections, 1);
  assert.equal(r.rides, 2);
  assert.deepEqual(r.path, ['A', 'B', 'C']);
});

test('unreachable destination', () => {
  const r = findRoute(G([['A', 'B']]), ['A'], ['Z']);
  assert.equal(r.possible, false);
});

test('origin already at destination is 0 connections', () => {
  const r = findRoute(G([['A', 'B']]), ['A'], ['A']);
  assert.equal(r.connections, 0);
  assert.deepEqual(r.path, ['A']);
});

test('prefers the higher-degree destination station among equals', () => {
  // both T1 and T2 are reachable in one ride; T1 is more connected
  const g = G([['S', 'T1'], ['S', 'T2'], ['T1', 'P'], ['T1', 'Q']]);
  const r = findRoute(g, ['S'], ['T1', 'T2']);
  assert.equal(r.connections, 0);
  assert.equal(r.path.at(-1), 'T1');
});
