// Finland adapter: turn a GTFS feed into a reachability graph of direct-ride
// edges. An edge from station X -> Y means "you can ride one train directly
// from X to Y without changing." We derive these from each trip's ordered stop
// list (all earlier->later stop pairs), so a BFS hop count maps to train rides
// and `connections = rides - 1`.
//
// "Ever possible": we keep an edge only if its GTFS service runs on at least one
// date on/after `today`, so future-opening and seasonal routes count (e.g. the
// Haaparanta service that opens 2026-06-08 but isn't running today).

import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv.mjs';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** "HHMMSS"-ish GTFS date as YYYYMMDD string compare works lexicographically. */
function todayStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** GTFS time "HH:MM:SS" (HH may exceed 23) -> minutes since midnight. */
function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Build the set of service_ids that operate on at least one date >= today,
 * along with each one's [start, end] window (for the optional "when" answer).
 */
function buildActiveServices(dir, today) {
  const windows = new Map(); // service_id -> {start, end}
  const active = new Set();

  const calPath = path.join(dir, 'calendar.txt');
  if (fs.existsSync(calPath)) {
    for (const c of parseCsv(fs.readFileSync(calPath, 'utf8'))) {
      const runsAnyDay = DAYS.some((d) => c[d] === '1');
      windows.set(c.service_id, { start: c.start_date, end: c.end_date });
      // active if the service window reaches into the future on a real weekday
      if (runsAnyDay && c.end_date >= today) active.add(c.service_id);
    }
  }

  const cdPath = path.join(dir, 'calendar_dates.txt');
  if (fs.existsSync(cdPath)) {
    for (const r of parseCsv(fs.readFileSync(cdPath, 'utf8'))) {
      const w = windows.get(r.service_id) || { start: r.date, end: r.date };
      if (r.date < w.start) w.start = r.date;
      if (r.date > w.end) w.end = r.date;
      windows.set(r.service_id, w);
      // exception_type 1 = service added on this date
      if (r.exception_type === '1' && r.date >= today) active.add(r.service_id);
    }
  }

  return { active, windows };
}

/**
 * Load a GTFS directory into a graph.
 * @returns {{graph: Map<string, Map<string, object>>, stations: Map<string, object>, today: string, stats: object}}
 */
/** GTFS route_type rail check, incl. extended types (100–117 = rail services). */
function isRailType(rt) {
  if (rt === '2') return true;
  const n = Number(rt);
  return n >= 100 && n <= 117;
}

export function loadFeed(dir, { today = todayStamp(), prefix = '', railOnly = false } = {}) {
  const t0 = Date.now();
  const P = prefix ? `${prefix}:` : ''; // namespace node ids per country

  // --- stops: map every stop to its parent station node, capture display info
  const stopRows = parseCsv(fs.readFileSync(path.join(dir, 'stops.txt'), 'utf8'));
  const nodeOf = new Map(); // stop_id -> (prefixed) node id (parent station if any)
  const stations = new Map(); // node id -> {id, name, lat, lon, country}
  for (const s of stopRows) {
    const raw = s.parent_station && s.parent_station.length ? s.parent_station : s.stop_id;
    nodeOf.set(s.stop_id, P + raw);
  }
  for (const s of stopRows) {
    const raw = s.parent_station && s.parent_station.length ? s.parent_station : s.stop_id;
    const node = P + raw;
    // prefer the parent row itself for the canonical name/coords
    if (!stations.has(node) || s.stop_id === raw) {
      stations.set(node, {
        id: node,
        name: s.stop_name,
        lat: Number(s.stop_lat),
        lon: Number(s.stop_lon),
        country: prefix || null,
      });
    }
  }

  // --- services active now-or-future
  const { active, windows } = buildActiveServices(dir, today);

  // --- routes: keep the set of rail route_ids when filtering to rail only
  let railRoutes = null;
  if (railOnly) {
    railRoutes = new Set();
    for (const r of parseCsv(fs.readFileSync(path.join(dir, 'routes.txt'), 'utf8'))) {
      if (isRailType(r.route_type)) railRoutes.add(r.route_id);
    }
  }

  // --- trips: trip_id -> {service_id, route_id}
  const tripInfo = new Map();
  for (const t of parseCsv(fs.readFileSync(path.join(dir, 'trips.txt'), 'utf8'))) {
    if (railRoutes && !railRoutes.has(t.route_id)) continue;
    tripInfo.set(t.trip_id, { service: t.service_id, route: t.route_id });
  }

  // --- stop_times: group by trip into ordered [seq, node, depMin, arrMin]
  const stText = fs.readFileSync(path.join(dir, 'stop_times.txt'), 'utf8');
  const stRows = parseCsv(stText);
  const byTrip = new Map();
  for (const r of stRows) {
    const node = nodeOf.get(r.stop_id);
    if (!node) continue;
    let arr = byTrip.get(r.trip_id);
    if (!arr) { arr = []; byTrip.set(r.trip_id, arr); }
    arr.push([Number(r.stop_sequence), node, toMinutes(r.departure_time), toMinutes(r.arrival_time)]);
  }

  // --- build all-pairs direct-ride edges per active trip
  const graph = new Map(); // from -> Map(to -> {minDuration, routes:Set, start, end})
  let tripsUsed = 0;
  let pairOps = 0;
  for (const [tripId, stops] of byTrip) {
    const info = tripInfo.get(tripId);
    if (!info || !active.has(info.service)) continue;
    tripsUsed++;
    stops.sort((a, b) => a[0] - b[0]);
    // collapse consecutive duplicate nodes (same physical station, two platforms)
    const seq = [];
    for (const s of stops) {
      if (seq.length && seq[seq.length - 1][0] === s[1]) continue;
      seq.push([s[1], s[2], s[3]]); // node, depMin, arrMin
    }
    const win = windows.get(info.service) || {};
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        pairOps++;
        const from = seq[i][0];
        const to = seq[j][0];
        if (from === to) continue;
        let nbrs = graph.get(from);
        if (!nbrs) { nbrs = new Map(); graph.set(from, nbrs); }
        let e = nbrs.get(to);
        if (!e) { e = { type: 'ride', minDuration: Infinity, routes: new Set(), start: win.start, end: win.end }; nbrs.set(to, e); }
        const dep = seq[i][1];
        const arr = seq[j][2];
        if (dep != null && arr != null) {
          const dur = arr - dep;
          if (dur > 0 && dur < e.minDuration) e.minDuration = dur;
        }
        e.routes.add(info.route);
        if (win.start && win.start < e.start) e.start = win.start;
        if (win.end && win.end > e.end) e.end = win.end;
      }
    }
  }

  let edgeCount = 0;
  for (const m of graph.values()) edgeCount += m.size;

  return {
    graph,
    stations,
    today,
    stats: {
      stops: stopRows.length,
      nodes: stations.size,
      activeServices: active.size,
      tripsUsed,
      pairOps,
      edges: edgeCount,
      loadMs: Date.now() - t0,
    },
  };
}
