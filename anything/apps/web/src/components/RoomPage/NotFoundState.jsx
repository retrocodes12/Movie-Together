export function NotFoundState() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0F1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
          Room not found
        </div>
        <a href="/rooms" style={{ color: "#6366F1" }}>
          ← Back to rooms
        </a>
      </div>
    </div>
  );
}
