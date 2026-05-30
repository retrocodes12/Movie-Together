"use client";
import { useState, useEffect } from "react";
import WebNav from "@/components/WebNav";

export default function JoinRoomPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
  }, []);

  const handleLookup = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("Enter a valid invite code.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/rooms?invite_code=${c}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const found = (data.rooms || [])[0];
      if (found) {
        setRoom(found);
        setStatus("found");
      } else {
        setStatus("idle");
        setError("No room found with that code.");
      }
    } catch {
      setStatus("idle");
      setError("Could not look up code. Try again.");
    }
  };

  const handleJoin = async () => {
    if (!room || !deviceId) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to join");
      }
      window.location.href = `/rooms/${room.id}`;
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Rooms" />
      <div
        style={{ maxWidth: 480, margin: "0 auto", padding: "100px 24px 60px" }}
      >
        <div style={{ marginBottom: 32 }}>
          <a href="/rooms" style={{ fontSize: 13, color: "#6366F1" }}>
            ← Rooms
          </a>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              marginTop: 10,
            }}
          >
            Join a Room
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 6 }}>
            Enter an invite code to join a watch party.
          </p>
        </div>

        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 28,
          }}
        >
          <form onSubmit={handleLookup}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#94A3B8",
                  marginBottom: 8,
                }}
              >
                Invite Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="e.g. ABCD1234"
                style={{
                  width: "100%",
                  padding: "14px",
                  textAlign: "center",
                  letterSpacing: 6,
                  fontSize: 22,
                  fontWeight: 700,
                  background: "#0B0F1A",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "#F1F5F9",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: "9px 12px",
                  color: "#FCA5A5",
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            {status !== "found" && (
              <button
                type="submit"
                disabled={code.trim().length < 4 || status === "loading"}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  background:
                    code.trim().length >= 4
                      ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
                      : "#1E293B",
                  color: code.trim().length >= 4 ? "#fff" : "#4B5563",
                }}
              >
                {status === "loading" ? "Looking up…" : "Find Room →"}
              </button>
            )}
          </form>

          {/* Room found */}
          {status === "found" && room && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div
                style={{
                  height: 1,
                  background: "rgba(255,255,255,0.06)",
                  margin: "20px 0",
                }}
              />
              <div
                style={{
                  background: "#0B0F1A",
                  borderRadius: 12,
                  padding: "16px",
                  marginBottom: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 28 }}>🎬</span>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: "#F1F5F9",
                      }}
                    >
                      {room.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      {room.movie_title}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    `👥 ${room.member_count || 0}/${room.max_members} members`,
                    `Host: @${room.host_username}`,
                    room.movie_genre,
                  ]
                    .filter(Boolean)
                    .map((t, i) => (
                      <span key={i} style={{ fontSize: 12, color: "#475569" }}>
                        {t}
                      </span>
                    ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setRoom(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 9,
                    fontSize: 14,
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.05)",
                    color: "#64748B",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  style={{
                    flex: 2,
                    padding: "11px",
                    borderRadius: 9,
                    fontSize: 14,
                    fontWeight: 700,
                    background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                    color: "#fff",
                  }}
                >
                  {joining ? "Joining…" : "Join Room 🎬"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            color: "#334155",
            fontSize: 13,
          }}
        >
          Don't have a code?{" "}
          <a href="/rooms" style={{ color: "#6366F1" }}>
            Browse public rooms
          </a>{" "}
          or{" "}
          <a href="/rooms/create" style={{ color: "#6366F1" }}>
            create your own
          </a>
          .
        </div>
      </div>
    </div>
  );
}
