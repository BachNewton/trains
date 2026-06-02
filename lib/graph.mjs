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
  const targetSet = new Set(targets);
  const visited = new Set();
  const parent = new Map(); // node -> {from, edge}
  let frontier = [];

  for (const s of sources) {
    if (visited.has(s)) continue;
    visited.add(s);
    frontier.push(s);
    if (targetSet.has(s)) {
      log(`source ${s} is already a target — 0 rides`);
      return { possible: true, rides: 0, connections: 0, path: [s] };
    }
  }

  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const node of frontier) {
      const nbrs = graph.get(node);
      if (!nbrs) continue;
      for (const [to, edge] of nbrs) {
        if (visited.has(to)) continue;
        visited.add(to);
        parent.set(to, { from: node, edge });
        if (targetSet.has(to)) {
          const path = reconstruct(parent, to);
          log(`reached target ${to} at depth ${depth} (visited ${visited.size} nodes)`);
          return { possible: true, rides: depth, connections: depth - 1, path };
        }
        next.push(to);
      }
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
