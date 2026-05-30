export function InfoTab({
  room,
  membersCount,
  connectionStatus,
  onShare,
  extraInfo = [],
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
      <div
        style={{
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 12,
          padding: "16px",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#6366F1",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          INVITE CODE
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#818CF8",
            letterSpacing: 6,
            marginBottom: 10,
          }}
        >
          {room.invite_code}
        </div>
        <button
          onClick={onShare}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: "#4F46E5",
            color: "#fff",
          }}
        >
          🔗 Share Invite
        </button>
      </div>

      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {[
          { label: "Room", value: room.name },
          { label: "Movie", value: room.movie_title },
          { label: "Genre", value: room.movie_genre || "—" },
          { label: "Year", value: room.movie_year?.toString() || "—" },
          { label: "Host", value: `@${room.host_username}` },
          { label: "Status", value: room.status },
          {
            label: "Capacity",
            value: `${membersCount}/${room.max_members}`,
          },
          {
            label: "Visibility",
            value: room.is_public ? "🌐 Public" : "🔒 Private",
          },
          { label: "Connection", value: connectionStatus },
          ...extraInfo,
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderBottom:
                i < arr.length - 1
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "none",
            }}
          >
            <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
            <span
              style={{
                fontSize: 12,
                color: "#E2E8F0",
                fontWeight: 500,
                textAlign: "right",
                maxWidth: "60%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {room.movie_description && (
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "14px",
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#475569",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            SYNOPSIS
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
            {room.movie_description}
          </div>
        </div>
      )}
    </div>
  );
}
