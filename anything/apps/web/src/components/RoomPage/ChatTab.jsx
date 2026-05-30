import { useRef, useEffect } from "react";
import { ChatBubble } from "./ChatBubble";

export function ChatTab({
  messages,
  userId,
  msgText,
  onMsgTextChange,
  onSend,
  sending,
  roomEnded,
}) {
  const chatRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () =>
          chatRef.current?.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: "smooth",
          }),
        100,
      );
    }
  }, [messages.length]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      onSend();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      <div
        ref={chatRef}
        style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#334155",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 13 }}>No messages yet. Say hi! 👋</div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} isMe={msg.user_id === userId} />
          ))
        )}
      </div>
      {!roomEnded && (
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={msgText}
            onChange={(e) => onMsgTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the room…"
            maxLength={500}
            style={{
              flex: 1,
              padding: "9px 13px",
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              color: "#F1F5F9",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={onSend}
            disabled={!msgText.trim() || sending}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              fontSize: 15,
              fontWeight: 700,
              background: msgText.trim() ? "#2563EB" : "#1E293B",
              color: msgText.trim() ? "#fff" : "#4B5563",
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
