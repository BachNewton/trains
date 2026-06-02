// Resolve a user-facing city name to the set of station nodes that serve it.
// Users think in cities; the graph is stations. A city query matches any
// station whose name contains the query (case-insensitive), plus a small alias
// table for the obvious ones / cross-language spellings.

const ALIASES = {
  helsinki: ['helsinki'],
  oulu: ['oulu'],
  rovaniemi: ['rovaniemi'],
  tornio: ['tornio'],
  // Finnish feed spells Haparanda as "Haaparanta"; accept both.
  haparanda: ['haaparanta', 'haparanda'],
  haaparanta: ['haaparanta'],
  kolari: ['kolari'],
  tampere: ['tampere'],
  turku: ['turku'],
};

/**
 * Resolve with precedence: an exact name match wins outright (so "Oulu" -> the
 * "Oulu" station, never the Helsinki suburb "Oulunkylä" or freight yard "Oulu
 * tavara"). Only when nothing matches exactly do we fall back to substring
 * matching (which is how "Haparanda" finds "Haaparanta pohjoinen").
 *
 * @param {string} query  city name typed by the user
 * @param {Map<string,object>} stations  node id -> {id,name,...}
 * @returns {{id:string,name:string}[]} matching station nodes
 */
export function resolveCity(query, stations) {
  const q = query.trim().toLowerCase();
  const needles = ALIASES[q] || [q];
  const exact = [];
  const contains = [];
  for (const st of stations.values()) {
    const name = (st.name || '').toLowerCase();
    if (needles.some((n) => name === n)) exact.push({ id: st.id, name: st.name });
    else if (needles.some((n) => name.includes(n))) contains.push({ id: st.id, name: st.name });
  }
  return exact.length ? exact : contains;
}
