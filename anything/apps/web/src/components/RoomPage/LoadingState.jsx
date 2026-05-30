export function LoadingState() {
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
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #1E293B",
            borderTopColor: "#6366F1",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        <div style={{ color: "#475569" }}>Loading room…</div>
      </div>
    </div>
  );
}
