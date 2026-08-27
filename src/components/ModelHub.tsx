import { brand } from "@/config/brand";
import { models } from "@/config/models";

const products = [
  brand.products.chat,
  brand.products.code,
  brand.products.api,
  brand.products.privacy,
];

const spokes = [...products, ...models.slice(0, 8).map((model) => model.label)];

export function ModelHub() {
  const total = spokes.length;
  return (
    <div className="hub">
      <svg className="hub-lines" viewBox="0 0 100 100" aria-hidden="true">
        {spokes.map((label, index) => {
          const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={label}
              x1="50"
              y1="50"
              x2={(50 + 42 * Math.cos(angle)).toFixed(3)}
              y2={(50 + 42 * Math.sin(angle)).toFixed(3)}
            />
          );
        })}
        <circle className="hub-ring" cx="50" cy="50" r="42" fill="none" />
      </svg>
      <div className="hub-center">
        <span className="mark">◒</span>
        <span>{brand.wordmark}</span>
      </div>
      <ul className="hub-labels">
        {spokes.map((label, index) => {
          const angle = (index / total) * 360 - 90;
          const isProduct = products.includes(
            label as (typeof products)[number],
          );
          return (
            <li
              key={label}
              className={isProduct ? "hub-label is-product" : "hub-label"}
              style={
                {
                  "--angle": `${angle}deg`,
                } as React.CSSProperties
              }
            >
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
