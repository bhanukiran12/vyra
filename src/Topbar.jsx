function Topbar({ turn, phase, winner }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-2">Vyra</h1>
      <p className="text-lg">Current Turn: <span className="font-semibold">{turn === 'goat' ? 'Goat' : 'Tiger'}</span></p>
      <p className="text-lg">Phase: <span className="font-semibold">{phase}</span></p>
      {winner && <p className="text-xl text-yellow-400 font-bold mt-2">Winner: {winner === 'goat' ? 'Goats' : 'Tigers'}</p>}
    </div>
  );
}

export default Topbar;