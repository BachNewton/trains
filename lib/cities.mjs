// Derive a *city* layer over the station graph — fully automatically, no
// hardcoded city or language tables. Users think "Stockholm", not "Stockholm
// Odenplan vs Centralstation vs Stockholms södra". We cluster stations that
// BOTH share a name prefix AND sit close together:
//
//   - shared prefix  -> "Stockholm City" / "Stockholms södra" are one city
//   - distance guard -> "Oulunkylä" (a Helsinki suburb) shares the "Oulu"
//                       prefix but is ~600 km away, so it never joins "Oulu"
//
// The city label is the longest common prefix of its members' names, so it
// falls out as "Stockholm" / "Helsinki" / "Oulu" without any lookup table.

const EARTH_M = 6371000;
const CITY_RADIUS_M = 12000; // stations within this range may share a city
const MIN_PREFIX = 4; // shared prefix must be at least this many chars

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function norm(s) {
  return fold(s).toLowerCase().trim();
}

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
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

/** Longest common prefix of the names, trimmed so we never cut a word in half. */
function commonLabel(names) {
  if (names.length === 1) return names[0];
  let lcp = names.reduce((acc, n) => {
    let k = 0;
    const m = Math.min(acc.length, n.length);
    while (k < m && acc[k].toLowerCase() === n[k].toLowerCase()) k++;
    return acc.slice(0, k);
  });
  const cutMidWord = names.some((n) => /\p{L}/u.test(n.charAt(lcp.length)));
  if (cutMidWord) {
    const sep = Math.max(lcp.lastIndexOf(' '), lcp.lastIndexOf('/'), lcp.lastIndexOf('-'));
    if (sep > 0) lcp = lcp.slice(0, sep);
  }
  lcp = lcp.replace(/[\s/\-]+$/, '').trim();
  return lcp || names[0];
}

/**
 * @param {Map<string,object>} stations  unified node id -> {id,name,lat,lon,countries}
 * @returns {{cities:Map<string,object>, stationToCity:Map<string,string>}}
 */
export function buildCities(stations, { radiusM = CITY_RADIUS_M } = {}) {
  const list = [...stations.values()];
  const norms = list.map((s) => norm(s.name));
  const uf = new UnionFind();
  list.forEach((s) => uf.find(s.id));

  // Data-driven "generic qualifier" detection: words that recur as NON-leading
  // tokens across many stations ("Centralstation", "tavara"/freight, etc.) are
  // qualifiers, not city names. The leading token is never counted, so a real
  // city like "Helsinki" (which leads its stations) is never treated as generic.
  const GENERIC_MIN = 3;
  const tailFreq = new Map();
  for (const s of list) {
    const toks = norm(s.name).split(/[\s/]+/).filter(Boolean);
    for (let i = 1; i < toks.length; i++) tailFreq.set(toks[i], (tailFreq.get(toks[i]) || 0) + 1);
  }
  const cleanLabel = (name) => {
    const words = name.split(/\s+/).filter(Boolean);
    const out = [words[0]];
    for (let i = 1; i < words.length; i++) {
      if ((tailFreq.get(norm(words[i])) || 0) >= GENERIC_MIN) break;
      out.push(words[i]);
    }
    return out.join(' ');
  };

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = norms[i], b = norms[j];
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      const fw = short.split(' ')[0];
      if (fw.length < MIN_PREFIX) continue;
      if (long !== short && !long.startsWith(fw)) continue;
      const A = list[i], B = list[j];
      if (!Number.isFinite(A.lat) || !Number.isFinite(B.lat)) continue;
      if (Math.abs(A.lat - B.lat) > 0.2 || Math.abs(A.lon - B.lon) > 0.4) continue; // bbox prefilter
      if (haversine(A, B) <= radiusM) uf.union(A.id, B.id);
    }
  }

  const groups = new Map();
  for (const s of list) {
    const r = uf.find(s.id);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(s);
  }

  const cities = new Map();
  const stationToCity = new Map();
  for (const [root, members] of groups) {
    const label = cleanLabel(commonLabel(members.map((m) => m.name)));
    const countries = new Set();
    for (const m of members) for (const c of (m.countries || (m.country ? [m.country] : []))) countries.add(c);
    cities.set(root, {
      id: root,
      label,
      stationIds: members.map((m) => m.id),
      countries: [...countries],
      lat: members[0].lat,
      lon: members[0].lon,
    });
    members.forEach((m) => stationToCity.set(m.id, root));
  }
  return { cities, stationToCity };
}

/** Resolve a typed city name to the station ids the BFS should fan out over. */
export function resolveToStations(query, cityIndex) {
  const q = norm(query);
  if (!q) return { cities: [], stationIds: [] };
  const all = [...cityIndex.cities.values()];
  let matches = all.filter((c) => norm(c.label) === q);
  if (!matches.length) matches = all.filter((c) => norm(c.label).startsWith(q));
  if (!matches.length) matches = all.filter((c) => norm(c.label).includes(q));
  const stationIds = [...new Set(matches.flatMap((c) => c.stationIds))];
  return { cities: matches, stationIds };
}

/** Typeahead: one entry per city, ranked by prefix match then brevity. */
export function suggestCities(query, cityIndex, limit = 12) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const c of cityIndex.cities.values()) {
    const idx = norm(c.label).indexOf(q);
    if (idx === -1) continue;
    scored.push({ name: c.label, countries: c.countries, startsWith: idx === 0 });
  }
  scored.sort((a, b) => (b.startsWith - a.startsWith) || (a.name.length - b.name.length) || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map(({ name, countries }) => ({ name, countries }));
}
