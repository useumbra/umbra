const orbit = [0, 45, 90, 135, 180, 225, 270, 315];

export function HeroSigil() {
  return (
    <div className="sigil" aria-hidden="true">
      <svg viewBox="0 0 420 420" role="presentation">
        <defs>
          <path
            id="sigil-ring-path"
            d="M 210 210 m -164 0 a 164 164 0 1 1 328 0 a 164 164 0 1 1 -328 0"
          />
          <clipPath id="sigil-bottom">
            <rect x="0" y="210" width="420" height="210" />
          </clipPath>
          <radialGradient id="sigil-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="210" cy="210" r="150" fill="url(#sigil-glow)" />

        <g className="sigil-spin">
          <circle
            className="sigil-dashed"
            cx="210"
            cy="210"
            r="196"
            fill="none"
          />
        </g>
        <g className="sigil-spin-reverse">
          <circle
            className="sigil-dashed-fine"
            cx="210"
            cy="210"
            r="176"
            fill="none"
          />
        </g>

        <g className="sigil-caption">
          <text>
            <textPath href="#sigil-ring-path" startOffset="0%">
              private · browser-first · no logs · your keys stay home ·
            </textPath>
          </text>
        </g>

        <g className="sigil-orbit">
          {orbit.map((angle) => (
            <circle
              key={angle}
              className="sigil-node"
              cx={(210 + 128 * Math.cos((angle * Math.PI) / 180)).toFixed(3)}
              cy={(210 + 128 * Math.sin((angle * Math.PI) / 180)).toFixed(3)}
              r={angle % 90 === 0 ? 5 : 3}
            />
          ))}
        </g>

        <circle className="sigil-core-ring" cx="210" cy="210" r="86" />
        <circle
          className="sigil-core-fill"
          cx="210"
          cy="210"
          r="86"
          clipPath="url(#sigil-bottom)"
        />
        <line className="sigil-axis" x1="124" y1="210" x2="296" y2="210" />
      </svg>
    </div>
  );
}
