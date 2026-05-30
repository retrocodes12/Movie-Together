import { useEffect } from "react";

export function FlyingEmoji({ emoji, x, id, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        bottom: 80,
        fontSize: 28,
        pointerEvents: "none",
        zIndex: 9999,
        animation: "fly 1.4s ease-out forwards",
      }}
    >
      {emoji}
    </div>
  );
}
