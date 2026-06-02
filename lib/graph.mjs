// Reachability over the direct-ride edge graph. v1 question: between two sets of
// stations, is there ANY path, and what's the fewest train rides (=> connections)?
// Plain multi-source breadth-first search: each hop is one ride, so the first
// time we reach a target the BFS depth is the minimum ride count.

/**
 * @param {Map<string,Map<string,object>>} graph  from -> Map(to -> edge)
 * @param {string[]} sources  starting station node ids
 * @param {string[]} targets  destination station node ids
 * @param {(msg:string)=>void} [log]
 * @returns {{possible:boolean, rides:number, connections:number, path:string[]}}
 */
export function findRoute(graph, sources, targets, log = () => {}) {
  const deg = (n) => graph.get(n)?.size || 0;
  const targetSet = new Set(targets);
  const visited = new Set();
  const parent = new Map(); // node -> {from, edge}

  // Process higher-degree stations first so multi-station cities resolve to
  // their major station (e.g. "Oulu", not the "Oulunlahti" halt) in the path.
  let frontier = [...new Set(sources)].sort((a, b) => deg(b) - deg(a));
  frontier.forEach((s) => visited.add(s));

  const startTargets = frontier.filter((s) => targetSet.has(s));
  if (startTargets.length) {
    const best = startTargets.sort((a, b) => deg(b) - deg(a))[0];
    log(`origin and destination share station ${best} — 0 rides`);
    return { possible: true, rides: 0, connections: 0, path: [best] };
  }

  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    const reached = [];
    for (const node of frontier) {
      const nbrs = graph.get(node);
      if (!nbrs) continue;
      for (const [to, edge] of nbrs) {
        if (visited.has(to)) continue;
        visited.add(to);
        parent.set(to, { from: node, edge });
        if (targetSet.has(to)) reached.push(to);
        else next.push(to);
      }
    }
    if (reached.length) {
      // finish the level, then pick the most-connected destination station
      const best = reached.sort((a, b) => deg(b) - deg(a))[0];
      log(`reached ${reached.length} destination station(s) at depth ${depth}; chose ${best}`);
      return { possible: true, rides: depth, connections: depth - 1, path: reconstruct(parent, best) };
    }
    log(`depth ${depth}: frontier ${frontier.length} -> ${next.length} (visited ${visited.size})`);
    frontier = next;
  }

  return { possible: false, rides: Infinity, connections: Infinity, path: [] };
}

function reconstruct(parent, end) {
  const path = [end];
  let cur = end;
  while (parent.has(cur)) {
    cur = parent.get(cur).from;
    path.push(cur);
  }
  return path.reverse();
}
