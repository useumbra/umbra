const rawTokens = [
  { y: 34, width: 96, label: "name" },
  { y: 68, width: 132, label: "wallet" },
  { y: 102, width: 78, label: "email" },
  { y: 136, width: 112, label: "city" },
];

const cleanTokens = [
  { y: 34, width: 84 },
  { y: 68, width: 84 },
  { y: 102, width: 84 },
  { y: 136, width: 84 },
];

export function BoundaryArt() {
  return (
    <svg
      className="boundary-art"
      viewBox="0 0 640 200"
      role="img"
      aria-label="Raw details entering a privacy boundary and leaving as placeholders"
    >
      <defs>
        <linearGradient id="umbra-art-membrane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="umbra-art-lower">
          <rect x="0" y="100" width="200" height="100" />
        </clipPath>
      </defs>

      {rawTokens.map((token) => (
        <g key={token.label}>
          <rect
            x={8}
            y={token.y}
            width={token.width}
            height={18}
            rx={9}
            className="art-raw"
          />
          <path
            d={`M ${token.width + 18} ${token.y + 9} H 268`}
            className="art-wire"
          />
        </g>
      ))}

      <path
        d="M 296 6 C 276 60, 276 140, 296 194"
        className="art-membrane-line"
      />
      <rect
        x={294}
        y={6}
        width={4}
        height={188}
        fill="url(#umbra-art-membrane)"
      />

      <g transform="translate(276 76) scale(0.48)">
        <circle cx="100" cy="100" r="78" className="art-mark-ring" />
        <circle
          cx="100"
          cy="100"
          r="78"
          className="art-mark-fill"
          clipPath="url(#umbra-art-lower)"
        />
      </g>

      {cleanTokens.map((token) => (
        <g key={token.y}>
          <path d={`M 322 ${token.y + 9} H 420`} className="art-wire" />
          <rect
            x={430}
            y={token.y}
            width={token.width}
            height={18}
            rx={4}
            className="art-clean"
          />
          <path
            d={`M ${430 + token.width + 10} ${token.y + 9} H 574`}
            className="art-wire"
          />
          <circle cx={592} cy={token.y + 9} r={9} className="art-node" />
        </g>
      ))}

      <text x={8} y={22} className="art-caption">
        YOUR DEVICE
      </text>
      <text x={430} y={22} className="art-caption">
        PLACEHOLDERS
      </text>
      <text x={556} y={188} className="art-caption">
        MODELS
      </text>
    </svg>
  );
}
