import { useState } from 'react';
import GameLayout from './GameLayout';
import Topbar from './Topbar';
import LeftSidebar from './LeftSidebar';
import Board from './Board';
import RightSidebar from './RightSidebar';
import { initialState } from './GameLogic';

function App() {
  const [gameState, setGameState] = useState(initialState);

  const resetGame = () => {
    setGameState(initialState);
  };

  const phase = gameState.goatsPlaced < 15 ? 'Placement' : 'Movement';

  return (
    <GameLayout
      topbar={<Topbar turn={gameState.currentPlayer} phase={phase} winner={gameState.winner} />}
      left={<LeftSidebar goatsRemaining={15 - gameState.goatsPlaced} captured={gameState.captured} />}
      center={<Board gameState={gameState} setGameState={setGameState} />}
      right={<RightSidebar selected={gameState.selected} piece={gameState.pieces[gameState.selected]} validMoves={gameState.validMoves} />}
      bottom={<button onClick={resetGame} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold">Restart Game</button>}
    />
  );
}

export default App;
