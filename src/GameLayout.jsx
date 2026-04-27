function GameLayout({ topbar, left, center, right, bottom }) {
  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="bg-gray-800 p-4">{topbar}</div>
      <div className="flex-1 flex">
        <div className="w-1/4 p-4 border-r border-gray-700">{left}</div>
        <div className="w-1/2 flex justify-center items-center">{center}</div>
        <div className="w-1/4 p-4 border-l border-gray-700">{right}</div>
      </div>
      <div className="p-4 bg-gray-800 flex justify-center">{bottom}</div>
    </div>
  );
}

export default GameLayout;