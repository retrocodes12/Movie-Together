export function StreamUrlInput({ value, onChange, onSave, saving }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSave();
    }
  };

  return (
    <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste stream URL (HLS/DASH/MP4)…"
          style={{
            flex: 1,
            padding: "9px 14px",
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9,
            color: "#F1F5F9",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          style={{
            padding: "9px 16px",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            background: value.trim() ? "#2563EB" : "#1E293B",
            color: value.trim() ? "#fff" : "#4B5563",
          }}
        >
          {saving ? "…" : "Load"}
        </button>
      </div>
    </div>
  );
}
