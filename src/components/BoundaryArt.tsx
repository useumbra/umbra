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
        <clipPath id="umbra-art-lower">
          <rect x="0" y="100" width="200" height="100" />
        </clipPath>
      </defs>

      {rawTokens.map((token, index) => (
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
            style={{ animationDelay: `${index * 0.35}s` }}
          />
        </g>
      ))}

      <path
        d="M 300 6 C 292 60, 292 140, 300 194"
        className="art-membrane-line"
      />
      <path
        d="M 300 6 C 308 60, 308 140, 300 194"
        className="art-membrane-line"
      />

      <g transform="translate(264 64) scale(0.36)">
        <circle cx="100" cy="100" r="78" className="art-mark-ring" />
        <circle
          cx="100"
          cy="100"
          r="78"
          className="art-mark-fill"
          clipPath="url(#umbra-art-lower)"
        />
      </g>

      {cleanTokens.map((token, index) => (
        <g key={token.y}>
          <path
            d={`M 332 ${token.y + 9} H 420`}
            className="art-wire"
            style={{ animationDelay: `${index * 0.35}s` }}
          />
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
            style={{ animationDelay: `${index * 0.35}s` }}
          />
          <circle
            cx={592}
            cy={token.y + 9}
            r={9}
            className="art-node"
            style={{ animationDelay: `${index * 0.28}s` }}
          />
        </g>
      ))}

      <text x={8} y={22} className="art-caption">
        YOUR DEVICE
      </text>
      <text x={430} y={22} className="art-caption">
        PLACEHOLDERS
      </text>
      <text x={566} y={22} className="art-caption">
        MODELS
      </text>
    </svg>
  );
}
