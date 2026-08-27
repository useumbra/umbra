type MarqueeProps = {
  items: readonly string[];
  reverse?: boolean;
};

export function Marquee({ items, reverse = false }: MarqueeProps) {
  const track = [...items, ...items];
  return (
    <div className="marquee" role="list" aria-label="Umbra capabilities">
      <div className={reverse ? "marquee-track reverse" : "marquee-track"}>
        {track.map((item, index) => (
          <span
            className="marquee-item"
            key={`${item}-${index}`}
            role="listitem"
            aria-hidden={index >= items.length}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
