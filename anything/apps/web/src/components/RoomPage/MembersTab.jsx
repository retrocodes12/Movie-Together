export function MembersTab({
  members,
  userId,
  hostId,
  isHost,
  isPublic,
  onToggleControl,
  permLoading,
}) {
  const onlineCount = members.filter((m) => m.is_online).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
      <div style={{ fontSize: 11, color: "#334155", marginBottom: 12 }}>
        {onlineCount} online · {members.length} total
      </div>
      {members.map((m) => {
        const mIsHost = hostId === m.user_id;
        const isMe = m.user_id === userId;
        return (
          <div
            key={m.user_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(99,102,241,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                {m.avatar_url || "🎬"}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: m.is_online ? "#22C55E" : "#374151",
                  border: "2px solid #0D1117",
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#F1F5F9",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.display_name}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>
                @{m.username}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexShrink: 0,
                alignItems: "center",
              }}
            >
              {mIsHost && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 100,
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(245,158,11,0.15)",
                    color: "#F59E0B",
                  }}
                >
                  👑 Host
                </span>
              )}
              {!mIsHost && m.has_playback_control && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 100,
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(99,102,241,0.15)",
                    color: "#818CF8",
                  }}
                >
                  🎮 Co-host
                </span>
              )}
              {isMe && !mIsHost && (
                <span
                  style={{
                    padding: "2px 7px",
                    borderRadius: 100,
                    fontSize: 10,
                    background: "rgba(99,102,241,0.1)",
                    color: "#6366F1",
                  }}
                >
                  You
                </span>
              )}
              {isHost && !isPublic && !mIsHost && (
                <button
                  disabled={permLoading === m.user_id}
                  onClick={() =>
                    onToggleControl(m.user_id, m.has_playback_control)
                  }
                  style={{
                    padding: "3px 9px",
                    borderRadius: 100,
                    fontSize: 10,
                    fontWeight: 700,
                    background: m.has_playback_control
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(34,197,94,0.1)",
                    color: m.has_playback_control ? "#EF4444" : "#22C55E",
                    border: `1px solid ${m.has_playback_control ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                  }}
                >
                  {permLoading === m.user_id
                    ? "…"
                    : m.has_playback_control
                      ? "Revoke"
                      : "Controls"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
