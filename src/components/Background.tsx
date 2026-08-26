import "./background.css";

export function Background() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-aurora">
        <span className="aurora aurora-1" />
        <span className="aurora aurora-2" />
        <span className="aurora aurora-3" />
      </div>
      <div className="backdrop-grid" />
      <div className="backdrop-beam" />
      <div className="backdrop-noise" />
      <div className="backdrop-vignette" />
    </div>
  );
}
