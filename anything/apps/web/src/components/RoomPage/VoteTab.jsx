export function VoteTab({ voteForm, onVoteFormChange, onSubmitVote }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
        Start a democratic vote — everyone in the room can weigh in.
      </div>

      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "16px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6366F1",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          🗳️ New Vote
        </div>
        <div style={{ marginBottom: 10 }}>
          <label
            style={{
              fontSize: 11,
              color: "#475569",
              display: "block",
              marginBottom: 4,
            }}
          >
            Vote Label
          </label>
          <input
            value={voteForm.label}
            onChange={(e) =>
              onVoteFormChange({ ...voteForm, label: e.target.value })
            }
            placeholder="e.g. Skip intro? / Take a break?"
            style={{
              width: "100%",
              padding: "9px 12px",
              background: "#0B0F1A",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "#F1F5F9",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 11,
              color: "#475569",
              display: "block",
              marginBottom: 6,
            }}
          >
            Type
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {["skip", "pause", "custom"].map((t) => (
              <button
                key={t}
                onClick={() => onVoteFormChange({ ...voteForm, type: t })}
                style={{
                  flex: 1,
                  padding: "7px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    voteForm.type === t
                      ? "rgba(99,102,241,0.2)"
                      : "transparent",
                  color: voteForm.type === t ? "#818CF8" : "#475569",
                  border: `1px solid ${voteForm.type === t ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onSubmitVote}
          disabled={!voteForm.label.trim()}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 700,
            background: voteForm.label.trim() ? "#4F46E5" : "#1E293B",
            color: voteForm.label.trim() ? "#fff" : "#4B5563",
          }}
        >
          Start Vote
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
        Active votes will appear here for all members to respond.
      </div>
    </div>
  );
}
