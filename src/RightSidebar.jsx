function RightSidebar({ selected, piece, validMoves }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Selected Piece</h2>
      {selected !== null ? (
        <div>
          <p className="mb-2">Selected: <span className="font-semibold">{piece === 'tiger' ? 'Tiger' : 'Goat'}</span> at node {selected}</p>
          <p className="mb-2">Valid Moves:</p>
          <ul className="text-sm">
            {validMoves.length > 0 ? validMoves.map(move => <li key={move}>Node {move}</li>) : <li>No valid moves</li>}
          </ul>
        </div>
      ) : (
        <p>No piece selected</p>
      )}
    </div>
  );
}

export default RightSidebar;