function Node({ id, x, y, piece, selected, valid, onClick }) {
  let fill = 'white';
  let stroke = 'gray';
  let strokeWidth = 2;

  if (selected) {
    stroke = 'yellow';
    strokeWidth = 4;
  } else if (valid) {
    stroke = 'green';
    strokeWidth = 4;
  }

  return (
    <g onClick={onClick} className="cursor-pointer">
      <circle
        cx={x}
        cy={y}
        r="25"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {piece && (
        <text
          x={x}
          y={y + 7}
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill={piece === 'tiger' ? 'red' : 'blue'}
        >
          {piece === 'tiger' ? 'T' : 'G'}
        </text>
      )}
    </g>
  );
}

export default Node;