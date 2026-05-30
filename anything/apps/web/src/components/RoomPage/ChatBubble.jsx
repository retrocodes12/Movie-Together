export function ChatBubble({ msg, isMe }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
      }}
    >
      {!isMe && (
        <div
          style={{
            fontSize: 11,
            color: "#475569",
            marginBottom: 3,
            paddingLeft: 4,
          }}
        >
          {msg.display_name}
        </div>
      )}
      <div
        style={{
          maxWidth: "78%",
          padding: "9px 13px",
          borderRadius: 12,
          borderBottomRightRadius: isMe ? 3 : 12,
          borderBottomLeftRadius: isMe ? 12 : 3,
          background: isMe ? "#2563EB" : "#1E293B",
          border: isMe ? "none" : "1px solid rgba(255,255,255,0.07)",
          fontSize: 13,
          color: "#F1F5F9",
          lineHeight: 1.5,
        }}
      >
        {msg.message}
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{time}</div>
    </div>
  );
}
