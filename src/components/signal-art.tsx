// Code-native artwork: a field of waves converges into a single signal.
export function SignalArt({ compact = false }: { compact?: boolean }) {
  const paths = Array.from({ length: 45 }, (_, i) => {
    const y = 12 + i * 6.3;
    const d = Array.from({ length: 101 }, (_, j) => {
      const x = j * 5;
      const envelope = Math.exp(-Math.pow((x - 260) / 106, 2));
      const displacement = Math.sin(x / 36 + i * 0.075) * envelope * 66;
      return `${j === 0 ? "M" : "L"}${x.toFixed(1)},${(y + displacement).toFixed(1)}`;
    }).join(" ");
    return (
      <path
        key={i}
        d={d}
        stroke="currentColor"
        strokeWidth={i % 3 === 0 ? ".85" : ".5"}
        opacity={0.18 + Math.sin((i / 45) * Math.PI) * 0.55}
      />
    );
  });
  return (
    <div className={`signal-art ${compact ? "signal-art-compact" : ""}`} aria-hidden="true">
      <div className="art-glow" />
      <svg viewBox="0 0 500 310" fill="none" className="wave-field">
        {paths}
      </svg>
      <div className="art-cross art-cross-one">+</div>
      <div className="art-cross art-cross-two">+</div>
      <span className="art-coordinate">SIGNAL / FIELD 001</span>
      <span className="art-frequency">LESS NOISE. MORE CLARITY.</span>
    </div>
  );
}
