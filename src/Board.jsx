import Node from './Node';
import { selectPiece, selectNode, neighbors } from './GameLogic';

const positions = [
  {x: 0, y: 0}, // 0
  {x: -1, y: 1}, // 1
  {x: 0, y: 1}, // 2
  {x: 1, y: 1}, // 3
  {x: -2, y: 2}, // 4
  {x: -1, y: 2}, // 5
  {x: 0, y: 2}, // 6
  {x: 1, y: 2}, // 7
  {x: 2, y: 2}, // 8
  {x: -3, y: 3}, // 9
  {x: -2, y: 3}, // 10
  {x: -1, y: 3}, // 11
  {x: 0, y: 3}, // 12
  {x: 1, y: 3}, // 13
  {x: 2, y: 3}, // 14
  {x: 3, y: 3}, // 15
  {x: -3, y: 4}, // 16
  {x: -2, y: 4}, // 17
  {x: -1, y: 4}, // 18
  {x: 0, y: 4}, // 19
  {x: 1, y: 4}, // 20
  {x: 2, y: 4}, // 21
  {x: 3, y: 4}, // 22
];

const scale = 60;
const offsetX = 300;
const offsetY = 120;

function Board({ gameState, setGameState }) {
  const handleClick = (id) => {
    let newState;
    if (gameState.selected === null) {
      newState = selectPiece(id, gameState);
      if (newState === gameState) {
        newState = selectNode(id, gameState);
      }
    } else {
      newState = selectNode(id, gameState);
    }
    setGameState(newState);
  };

  const edges = [];
  Object.keys(neighbors).forEach(a => {
    neighbors[a].forEach(b => {
      if (a < b) {
        edges.push([a, b]);
      }
    });
  });

  return (
    <svg width="600" height="500" className="border border-gray-600 bg-gray-800">
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={positions[a].x * scale + offsetX}
          y1={positions[a].y * scale + offsetY}
          x2={positions[b].x * scale + offsetX}
          y2={positions[b].y * scale + offsetY}
          stroke="gray"
          strokeWidth="2"
        />
      ))}
      {positions.map((pos, id) => (
        <Node
          key={id}
          id={id}
          x={pos.x * scale + offsetX}
          y={pos.y * scale + offsetY}
          piece={gameState.pieces[id]}
          selected={gameState.selected === id}
          valid={gameState.validMoves.includes(id)}
          onClick={() => handleClick(id)}
        />
      ))}
    </svg>
  );
}

export default Board;