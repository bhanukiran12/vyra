// GameLogic.js

export const neighbors = {
  0: [1, 2, 3],
  1: [0, 2, 4, 5],
  2: [0, 1, 3, 5, 6],
  3: [0, 2, 6, 7, 8],
  4: [1, 5, 9, 10],
  5: [1, 2, 4, 6, 10, 11],
  6: [2, 3, 5, 7, 11, 12],
  7: [3, 6, 8, 12, 13],
  8: [3, 7, 13, 14, 15],
  9: [4, 10, 16, 17],
  10: [4, 5, 9, 11, 17, 18],
  11: [5, 6, 10, 12, 18, 19],
  12: [6, 7, 11, 13, 19, 20],
  13: [7, 8, 12, 14, 20, 21],
  14: [8, 13, 15, 21, 22],
  15: [8, 14, 22],
  16: [9, 17],
  17: [9, 10, 16, 18],
  18: [10, 11, 17, 19],
  19: [11, 12, 18, 20],
  20: [12, 13, 19, 21],
  21: [13, 14, 20, 22],
  22: [14, 15, 21]
};

export const initialPieces = {
  0: 'tiger',
  8: 'tiger',
  15: 'tiger'
};

export const initialState = {
  pieces: { ...initialPieces },
  goatsPlaced: 0,
  captured: 0,
  currentPlayer: 'goat',
  selected: null,
  validMoves: [],
  winner: null
};

export function getValidMoves(pieceId, pieces, goatsPlaced) {
  const piece = pieces[pieceId];
  if (!piece) return [];

  const moves = [];
  const neigh = neighbors[pieceId];

  if (piece === 'tiger') {
    // Adjacent empty
    neigh.forEach(n => {
      if (!pieces[n]) moves.push(n);
    });
    // Jumps
    neigh.forEach(n => {
      if (pieces[n] === 'goat') {
        // Find the jump target
        const dx = n - pieceId;
        const target = n + dx;
        if (neighbors[n].includes(target) && !pieces[target]) {
          moves.push(target);
        }
      }
    });
  } else if (piece === 'goat') {
    if (goatsPlaced < 15) {
      // Placement phase, but for selected goat, wait no, goats are placed, not moved yet.
      // This function is for moving existing pieces.
      // For placement, it's different.
      return [];
    } else {
      // Move to adjacent empty
      neigh.forEach(n => {
        if (!pieces[n]) moves.push(n);
      });
    }
  }
  return moves;
}

export function isValidMove(from, to, pieces, goatsPlaced) {
  const moves = getValidMoves(from, pieces, goatsPlaced);
  return moves.includes(to);
}

export function makeMove(from, to, state) {
  const newState = { ...state };
  newState.pieces = { ...state.pieces };

  const piece = state.pieces[from];
  if (piece === 'tiger') {
    // Check if jump
    const neigh = neighbors[from];
    let jumped = null;
    neigh.forEach(n => {
      if (pieces[n] === 'goat') {
        const dx = n - from;
        const target = n + dx;
        if (target === to) {
          jumped = n;
        }
      }
    });
    if (jumped !== null) {
      delete newState.pieces[jumped];
      newState.captured += 1;
    }
  }

  delete newState.pieces[from];
  newState.pieces[to] = piece;

  newState.selected = null;
  newState.validMoves = [];

  // Switch turn
  newState.currentPlayer = state.currentPlayer === 'goat' ? 'tiger' : 'goat';

  // Check win
  if (newState.captured >= 6) {
    newState.winner = 'tiger';
  } else {
    // Check if goats win
    const tigers = Object.keys(newState.pieces).filter(id => newState.pieces[id] === 'tiger');
    let tigerCanMove = false;
    for (let t of tigers) {
      if (getValidMoves(parseInt(t), newState.pieces, newState.goatsPlaced).length > 0) {
        tigerCanMove = true;
        break;
      }
    }
    if (!tigerCanMove) {
      newState.winner = 'goat';
    }
  }

  return newState;
}

export function placeGoat(nodeId, state) {
  if (state.pieces[nodeId] || state.goatsPlaced >= 15) return state;

  const newState = { ...state };
  newState.pieces = { ...state.pieces };
  newState.pieces[nodeId] = 'goat';
  newState.goatsPlaced += 1;

  if (newState.goatsPlaced < 15) {
    // Still goat turn
  } else {
    // Switch to tiger? No, after placement, goat can move, but turn is goat.
    // The rules: after all goats placed, goats can move.
    // So, currentPlayer remains goat.
  }

  // But if goatsPlaced == 15, and it's goat turn, but now movement.

  // Check if tigers can move now? But no.

  newState.selected = null;
  newState.validMoves = [];

  // Switch turn only if not all placed? No, during placement, alternate turns.

  // The rules: Goat player places 1 goat per turn, Tiger player can move.

  // So, after placing, switch to tiger.

  newState.currentPlayer = 'tiger';

  return newState;
}

export function selectPiece(pieceId, state) {
  if (state.winner) return state;

  const piece = state.pieces[pieceId];
  if (!piece) return state;

  if (state.currentPlayer === 'goat' && piece !== 'goat') return state;
  if (state.currentPlayer === 'tiger' && piece !== 'tiger') return state;

  const newState = { ...state };
  newState.selected = pieceId;
  newState.validMoves = getValidMoves(pieceId, state.pieces, state.goatsPlaced);
  return newState;
}

export function selectNode(nodeId, state) {
  if (state.winner) return state;

  if (state.selected !== null) {
    // Try to move
    if (isValidMove(state.selected, nodeId, state.pieces, state.goatsPlaced)) {
      return makeMove(state.selected, nodeId, state);
    }
  } else if (state.currentPlayer === 'goat' && state.goatsPlaced < 15 && !state.pieces[nodeId]) {
    // Place goat
    return placeGoat(nodeId, state);
  }
  return state;
}