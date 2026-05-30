const EMOJIS = ["❤️", "😂", "😮", "👏", "🔥", "😢", "😡", "🎉"];

export function ReactionBar({ onReact, loading }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "12px 20px",
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        marginTop: 12,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#334155",
          alignSelf: "center",
          marginRight: 4,
        }}
      >
        React:
      </span>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          disabled={loading !== null}
          style={{
            fontSize: 20,
            padding: "4px 8px",
            borderRadius: 8,
            background:
              loading === emoji
                ? "rgba(99,102,241,0.2)"
                : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            opacity: loading !== null && loading !== emoji ? 0.5 : 1,
            transition: "all 0.15s",
            transform: loading === emoji ? "scale(0.85)" : "scale(1)",
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
