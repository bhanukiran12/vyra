/**
 * Client-side helper to compute valid move destinations from a selected node.
 * Uses board adjacency + current state. Server is the authority — this is
 * only used to render neon-green hint markers.
 */

function lineLanding(nodes, fromId, overId) {
  const a = nodes.find((n) => n.id === fromId);
  const b = nodes.find((n) => n.id === overId);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tx = b.x + dx;
  const ty = b.y + dy;
  return { tx, ty };
}

export function computeValidDestinations({
  nodes,
  adjacency,
  state,
  yourSide,
  selected,
  pendingAbility,
}) {
  if (!state || !nodes || !adjacency) return [];
  if (state.phase === "finished") return [];
  if (pendingAbility === "decoy") {
    // any empty node is a target
    return state.board
      .map((v, i) => (v == null && state.decoy_node !== i ? i : null))
      .filter((x) => x !== null);
  }
  if (pendingAbility === "pounce") {
    if (selected == null) return [];
    if (state.board[selected] !== "tiger") return [];
    const landings = [];
    (adjacency[selected] || []).forEach((over) => {
      const land = lineLanding(nodes, selected, over);
      if (!land) return;
      (adjacency[over] || []).forEach((nb) => {
        if (nb === selected) return;
        const p = nodes.find((n) => n.id === nb);
        if (!p) return;
        if (Math.abs(p.x - land.tx) < 12 && Math.abs(p.y - land.ty) < 12) {
          if (state.board[nb] == null && state.decoy_node !== nb) {
            landings.push(nb);
          }
        }
      });
    });
    return landings;
  }
  if (pendingAbility === "roar" || pendingAbility === "fortify") {
    return [];
  }

  // Regular move / placement hints
  const isYourTurn = state.turn === yourSide;
  if (!isYourTurn) return [];

  if (state.phase === "placement") {
    if (yourSide === "goat" && selected == null) {
      return state.board
        .map((v, i) => (v == null && state.decoy_node !== i ? i : null))
        .filter((x) => x !== null);
    }
    if (yourSide === "tiger" && selected != null && state.board[selected] === "tiger") {
      return neighboursAndCaptures(state, adjacency, nodes, selected);
    }
    return [];
  }

  // movement phase
  if (selected == null) return [];
  if (state.board[selected] !== yourSide) return [];
  return neighboursAndCaptures(state, adjacency, nodes, selected);
}

function neighboursAndCaptures(state, adjacency, nodes, from) {
  const dests = [];
  (adjacency[from] || []).forEach((nb) => {
    if (state.board[nb] == null && state.decoy_node !== nb) dests.push(nb);
  });
  if (state.board[from] === "tiger") {
    (adjacency[from] || []).forEach((over) => {
      if (state.board[over] !== "goat") return;
      if (state.fortified_nodes?.includes(over)) return;
      const a = nodes.find((n) => n.id === from);
      const b = nodes.find((n) => n.id === over);
      if (!a || !b) return;
      const tx = b.x + (b.x - a.x);
      const ty = b.y + (b.y - a.y);
      (adjacency[over] || []).forEach((land) => {
        if (land === from) return;
        const p = nodes.find((n) => n.id === land);
        if (!p) return;
        if (Math.abs(p.x - tx) < 12 && Math.abs(p.y - ty) < 12) {
          if (state.board[land] == null && state.decoy_node !== land) dests.push(land);
        }
      });
    });
  }
  return Array.from(new Set(dests));
}

export function computeCaptureOver({ nodes, adjacency, state, from, to }) {
  // Returns the node id being captured if this is a capture move
  if (state.board[from] !== "tiger") return null;
  const fromNode = nodes.find((n) => n.id === from);
  const toNode = nodes.find((n) => n.id === to);
  if (!fromNode || !toNode) return null;
  const midx = (fromNode.x + toNode.x) / 2;
  const midy = (fromNode.y + toNode.y) / 2;
  for (const over of adjacency[from] || []) {
    const p = nodes.find((n) => n.id === over);
    if (!p) continue;
    if (Math.abs(p.x - midx) < 12 && Math.abs(p.y - midy) < 12) {
      if (state.board[over] === "goat") return over;
    }
  }
  return null;
}
