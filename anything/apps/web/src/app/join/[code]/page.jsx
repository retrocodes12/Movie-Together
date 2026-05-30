"use client";
import { useEffect, useState } from "react";
import WebNav from "@/components/WebNav";

export default function JoinPage({ params }) {
  const code = params?.code || "";
  const [status, setStatus] = useState("loading");
  const [room, setRoom] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
  }, []);

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/rooms?invite_code=${code.toUpperCase()}`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data.rooms || [])[0];
        if (found) {
          setRoom(found);
          setStatus("found");
        } else setStatus("not_found");
      })
      .catch(() => setStatus("error"));
  }, [code]);

  const handleJoinInBrowser = async () => {
    if (!room || !deviceId) return;
    setJoining(true);
    setError("");
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
    } catch (e) {
      setError(e.message);
      setJoining(false);
    }
  };

  const memberCount = room ? parseInt(room.member_count) || 0 : 0;
  const isFull = room && memberCount >= room.max_members;

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav />
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "100px 24px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
        }}
      >
        <div
          style={{
            width: "100%",
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎬</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            MovieTogether
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>
            You've been invited to a watch party!
          </p>

          {status === "loading" && (
            <div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid #1E293B",
                  borderTopColor: "#6366F1",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              <p style={{ color: "#475569", fontSize: 14 }}>
                Looking up invite…
              </p>
            </div>
          )}

          {(status === "not_found" ||
            status === "error" ||
            status === "invalid") && (
            <div>
              <p style={{ color: "#FCA5A5", fontSize: 14, marginBottom: 20 }}>
                {status === "invalid"
                  ? "Invalid invite code."
                  : "This invite link is invalid or the room no longer exists."}
              </p>
              <a
                href="/rooms"
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  borderRadius: 9,
                  background: "#4F46E5",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Browse Rooms
              </a>
            </div>
          )}

          {status === "found" && room && (
            <div>
              {/* Room info */}
              <div
                style={{
                  background: "#0B0F1A",
                  borderRadius: 14,
                  padding: "18px 16px",
                  marginBottom: 20,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>🎬</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    color: "#F1F5F9",
                    marginBottom: 4,
                  }}
                >
                  {room.name}
                </div>
                <div
                  style={{ color: "#64748B", fontSize: 14, marginBottom: 12 }}
                >
                  {room.movie_title}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    👥 {memberCount}/{room.max_members} members
                  </span>
                  {room.movie_genre && (
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {room.movie_genre}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    @{room.host_username}
                  </span>
                </div>
              </div>

              {/* Invite code display */}
              <div
                style={{
                  background: "rgba(99,102,241,0.08)",
                  borderRadius: 12,
                  padding: "14px",
                  marginBottom: 20,
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#6366F1",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  INVITE CODE
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#818CF8",
                    letterSpacing: 6,
                  }}
                >
                  {room.invite_code}
                </div>
              </div>

              {error && (
                <p style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 12 }}>
                  {error}
                </p>
              )}

              {isFull ? (
                <div>
                  <p
                    style={{ color: "#F87171", fontSize: 14, marginBottom: 12 }}
                  >
                    This room is full ({room.max_members} members).
                  </p>
                  <a
                    href="/rooms"
                    style={{
                      display: "inline-block",
                      padding: "11px 24px",
                      borderRadius: 9,
                      background: "rgba(255,255,255,0.06)",
                      color: "#94A3B8",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    Browse Other Rooms
                  </a>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Join in browser */}
                  <button
                    onClick={handleJoinInBrowser}
                    disabled={joining}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 700,
                      background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                      color: "#fff",
                      opacity: joining ? 0.7 : 1,
                    }}
                  >
                    {joining ? "Joining…" : "🎬 Join in Browser"}
                  </button>

                  {/* Open in app */}
                  <a
                    href={`movietogether://join/${room.invite_code}`}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      background: "rgba(255,255,255,0.05)",
                      color: "#94A3B8",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    📱 Open in Mobile App
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
