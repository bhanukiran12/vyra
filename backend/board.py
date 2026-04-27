"""
Aadu Puli Aatam (Goats vs Tigers) board definition.

Graph structure:
- 23 nodes arranged in a triangular grid (1 apex + 4 horizontal rows of 2..5 + 2 x-junctions)
  plus 6 square extension nodes below creating a 23-node classic board.

Indices 0..22. Coordinates (x, y) with origin top-left used for SVG rendering
on a 800x900 viewBox.
"""

# Node positions fitted for a 600x680 SVG viewBox.
# Row 0 (apex): 1 node
# Rows 1..4 inside triangle: 2, 3, 4, 5 nodes
# Extension below (rectangular grid): 2 rows x 4 nodes  -> 8 extra
# Total classic layout: 1+2+3+4+5 = 15 triangle nodes + 8 extension = 23
NODES = [
    # Triangle apex
    {"id": 0,  "x": 300, "y": 60},

    # Row 1 (2 nodes)
    {"id": 1,  "x": 220, "y": 150},
    {"id": 2,  "x": 380, "y": 150},

    # Row 2 (3 nodes)
    {"id": 3,  "x": 170, "y": 240},
    {"id": 4,  "x": 300, "y": 240},
    {"id": 5,  "x": 430, "y": 240},

    # Row 3 (4 nodes)
    {"id": 6,  "x": 120, "y": 330},
    {"id": 7,  "x": 240, "y": 330},
    {"id": 8,  "x": 360, "y": 330},
    {"id": 9,  "x": 480, "y": 330},

    # Row 4 (5 nodes) - base of triangle
    {"id": 10, "x": 70,  "y": 420},
    {"id": 11, "x": 185, "y": 420},
    {"id": 12, "x": 300, "y": 420},
    {"id": 13, "x": 415, "y": 420},
    {"id": 14, "x": 530, "y": 420},

    # Extension row 1 (below triangle base) — 4 nodes
    {"id": 15, "x": 185, "y": 510},
    {"id": 16, "x": 300, "y": 510},
    {"id": 17, "x": 415, "y": 510},

    # Extension row 2 — 4 nodes
    {"id": 18, "x": 185, "y": 600},
    {"id": 19, "x": 300, "y": 600},
    {"id": 20, "x": 415, "y": 600},

    # Extension row 3 — 2 corner nodes to form second diamond
    {"id": 21, "x": 240, "y": 680},
    {"id": 22, "x": 360, "y": 680},
]

# Undirected adjacency list. Each edge listed once in both directions.
# Edges: triangle sides, horizontal row links, and diagonals through the board,
# plus extension grid edges and diagonals.
_EDGES = [
    # Apex to row 1
    (0, 1), (0, 2),
    # Row 1 horizontal + to row 2
    (1, 2),
    (1, 3), (1, 4), (2, 4), (2, 5),
    # Row 2 horizontal + to row 3
    (3, 4), (4, 5),
    (3, 6), (3, 7), (4, 7), (4, 8), (5, 8), (5, 9),
    # Row 3 horizontal + to row 4
    (6, 7), (7, 8), (8, 9),
    (6, 10), (6, 11), (7, 11), (7, 12), (8, 12), (8, 13), (9, 13), (9, 14),
    # Row 4 horizontal
    (10, 11), (11, 12), (12, 13), (13, 14),
    # Base to extension row 1 (only interior nodes connect)
    (11, 15), (12, 16), (13, 17),
    # Extension row 1 horizontal + diagonals
    (15, 16), (16, 17),
    (15, 18), (15, 19), (16, 19), (17, 19), (17, 20),
    # Extension row 2 horizontal
    (18, 19), (19, 20),
    # Extension row 2 to lower corners
    (18, 21), (19, 21), (19, 22), (20, 22),
    # Lower corners
    (21, 22),
]


def build_adjacency():
    adj = {n["id"]: set() for n in NODES}
    for a, b in _EDGES:
        adj[a].add(b)
        adj[b].add(a)
    return {k: sorted(v) for k, v in adj.items()}


ADJACENCY = build_adjacency()
NODE_COUNT = len(NODES)


def get_jump_target(from_id: int, over_id: int):
    """
    For a tiger at from_id jumping over a goat at over_id:
    returns the landing node id if (from -> over -> landing) is collinear
    (same direction vector) and landing is adjacent to `over_id`.
    Uses the geometric collinearity test from NODES coordinates.
    """
    a = NODES[from_id]
    b = NODES[over_id]
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    target_x = b["x"] + dx
    target_y = b["y"] + dy
    # Find a neighbour of over_id whose position matches target (within tolerance)
    for nb in ADJACENCY[over_id]:
        if nb == from_id:
            continue
        n = NODES[nb]
        if abs(n["x"] - target_x) < 12 and abs(n["y"] - target_y) < 12:
            return nb
    return None


def get_pounce_targets(from_id: int):
    """
    Pounce ability: jump 2 nodes in a straight line regardless of whether
    a goat is in between. Returns list of (landing, over) where landing and
    over are both valid nodes along the same collinear line.
    """
    results = []
    for over in ADJACENCY[from_id]:
        a = NODES[from_id]
        b = NODES[over]
        dx = b["x"] - a["x"]
        dy = b["y"] - a["y"]
        tx = b["x"] + dx
        ty = b["y"] + dy
        for nb in ADJACENCY[over]:
            if nb == from_id:
                continue
            n = NODES[nb]
            if abs(n["x"] - tx) < 12 and abs(n["y"] - ty) < 12:
                results.append((nb, over))
    return results


def find_triangles(node_ids):
    """Return list of 3-tuples of node ids that form a mutual triangle."""
    s = set(node_ids)
    tris = []
    nlist = sorted(s)
    for i, a in enumerate(nlist):
        for j in range(i + 1, len(nlist)):
            b = nlist[j]
            if b not in ADJACENCY[a]:
                continue
            for k in range(j + 1, len(nlist)):
                c = nlist[k]
                if c in ADJACENCY[a] and c in ADJACENCY[b]:
                    tris.append((a, b, c))
    return tris
