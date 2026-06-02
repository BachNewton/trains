// Merge several country feeds into one graph. The interesting part is the
// "same place, different stations" problem: a station that is physically one
// spot but appears as two nodes in two feeds (e.g. Finland's "Haaparanta
// pohjoinen" and Sweden's "Haparanda station", ~80 m apart). We union stations
// within a walking-distance threshold into a single logical node, so a path
// through the border is counted as one ordinary change (connections = rides-1)
// rather than an extra phantom "transfer" hop.

const EARTH_M = 6371000;

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); return x; }
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    while (this.parent.get(x) !== r) { const n = this.parent.get(x); this.parent.set(x, r); x = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.parent.set(ra, rb); }
}

/**
 * @param {Array<{graph:Map, stations:Map, stats?:object}>} feeds
 * @param {{thresholdMeters?:number, log?:(m:string)=>void}} [opts]
 * @returns {{graph:Map, stations:Map, merges:Array, stats:object}}
 */
export function mergeFeeds(feeds, { thresholdMeters = 200, log = () => {} } = {}) {
  const t0 = Date.now();
  // gather all stations
  const all = [];
  for (const f of feeds) for (const st of f.stations.values()) all.push(st);

  // union stations that are within threshold AND from different feeds
  // (intra-feed same-place is already handled by GTFS parent_station).
  const uf = new UnionFind();
  all.forEach((s) => uf.find(s.id));
  const merges = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (a.country === b.country) continue; // only bridge across feeds
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) continue;
      // cheap bounding-box reject before the trig
      if (Math.abs(a.lat - b.lat) > 0.01 || Math.abs(a.lon - b.lon) > 0.03) continue;
      const d = haversine(a, b);
      if (d <= thresholdMeters) {
        uf.union(a.id, b.id);
        merges.push({ a: `${a.id}(${a.name})`, b: `${b.id}(${b.name})`, meters: Math.round(d) });
      }
    }
  }
  merges.forEach((m) => log(`merged ${m.a} <-> ${m.b} (${m.meters} m)`));

  // build canonical stations keyed by union-find root
  const byId = new Map(all.map((s) => [s.id, s]));
  const stations = new Map();
  const rootOf = (id) => uf.find(id);
  for (const s of all) {
    const root = rootOf(s.id);
    let canon = stations.get(root);
    if (!canon) {
      canon = { id: root, names: new Set(), countries: new Set(), lat: s.lat, lon: s.lon, members: [] };
      stations.set(root, canon);
    }
    canon.names.add(s.name);
    if (s.country) canon.countries.add(s.country);
    canon.members.push(s.id);
  }
  for (const c of stations.values()) {
    c.name = [...c.names].join(' / ');
    c.countries = [...c.countries];
    delete c.names;
  }

  // remap every edge to canonical endpoints, merging duplicates
  const graph = new Map();
  let edgeCount = 0;
  for (const f of feeds) {
    for (const [from, nbrs] of f.graph) {
      const rf = rootOf(from);
      for (const [to, edge] of nbrs) {
        const rt = rootOf(to);
        if (rf === rt) continue; // collapsed into the same node
        let m = graph.get(rf);
        if (!m) { m = new Map(); graph.set(rf, m); }
        let e = m.get(rt);
        if (!e) { e = { type: edge.type || 'ride', minDuration: edge.minDuration, routes: new Set(edge.routes), start: edge.start, end: edge.end }; m.set(rt, e); edgeCount++; }
        else {
          if (edge.minDuration < e.minDuration) e.minDuration = edge.minDuration;
          for (const r of edge.routes) e.routes.add(r);
          if (edge.start && (!e.start || edge.start < e.start)) e.start = edge.start;
          if (edge.end && (!e.end || edge.end > e.end)) e.end = edge.end;
        }
      }
    }
  }

  return {
    graph,
    stations,
    merges,
    stats: {
      feeds: feeds.length,
      totalStations: all.length,
      mergedNodes: stations.size,
      crossFeedMerges: merges.length,
      edges: edgeCount,
      mergeMs: Date.now() - t0,
    },
  };
}
