function LeftSidebar({ goatsRemaining, captured }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Game Info</h2>
      <p className="mb-2">Goats Remaining: <span className="font-semibold">{goatsRemaining}</span></p>
      <p className="mb-4">Goats Captured: <span className="font-semibold">{captured}/6</span></p>
      <h3 className="text-lg font-semibold mb-2">Instructions</h3>
      <ul className="text-sm space-y-1">
        <li>• Click a piece to select it</li>
        <li>• Valid moves are highlighted in green</li>
        <li>• Click a highlighted node to move</li>
        <li>• Tigers can jump over goats to capture</li>
        <li>• Goats place pieces first, then both move</li>
      </ul>
    </div>
  );
}

export default LeftSidebar;