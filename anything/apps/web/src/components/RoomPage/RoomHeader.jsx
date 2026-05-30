export function RoomHeader({
  room,
  onlineCount,
  membersCount,
  onShare,
  onLeave,
  extraBadges = [],
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#0D1117",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        <a href="/rooms" style={{ color: "#64748B", fontSize: 18 }}>
          ←
        </a>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: "#F1F5F9",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {room.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: onlineCount > 0 ? "#22C55E" : "#4B5563",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12, color: "#475569" }}>
              {onlineCount} online · {membersCount} members
            </span>
            {!room.is_public && (
              <span
                style={{
                  fontSize: 10,
                  color: "#F59E0B",
                  background: "rgba(245,158,11,0.1)",
                  padding: "1px 7px",
                  borderRadius: 100,
                }}
              >
                🔒 Private
              </span>
            )}
            {extraBadges.map((badge, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  color: badge.color,
                  background: badge.bg,
                  padding: "1px 7px",
                  borderRadius: 100,
                }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94A3B8",
            fontSize: 13,
          }}
        >
          🔗 {room.invite_code}
        </button>
        <button
          onClick={onLeave}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#EF4444",
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
