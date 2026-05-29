"use client";
import { useEffect, useState } from "react";

export default function JoinPage({ params }) {
  const code = params?.code || "";
  const [status, setStatus] = useState("loading");
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/rooms?invite_code=${code.toUpperCase()}`)
      .then((r) => r.json())
      .then((data) => {
        const foundRoom = (data.rooms || [])[0];
        if (foundRoom) {
          setRoom(foundRoom);
          setStatus("found");
        } else {
          setStatus("not_found");
        }
      })
      .catch(() => setStatus("error"));
  }, [code]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0F172A",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "90%",
          backgroundColor: "#1E293B",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #334155",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
        <h1
          style={{
            color: "#F9FAFB",
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 8px",
          }}
        >
          MovieTogether
        </h1>

        {status === "loading" && (
          <p style={{ color: "#94A3B8" }}>Looking up invite…</p>
        )}
        {status === "not_found" && (
          <p style={{ color: "#F87171" }}>
            This invite link is invalid or the room no longer exists.
          </p>
        )}
        {status === "error" && (
          <p style={{ color: "#F87171" }}>
            Something went wrong. Please try again.
          </p>
        )}
        {status === "invalid" && (
          <p style={{ color: "#F87171" }}>Invalid invite code.</p>
        )}

        {status === "found" && room && (
          <>
            <p style={{ color: "#94A3B8", margin: "0 0 16px" }}>
              You've been invited to:
            </p>
            <div
              style={{
                backgroundColor: "#0F172A",
                borderRadius: 10,
                padding: 16,
                marginBottom: 24,
                border: "1px solid #334155",
              }}
            >
              <p
                style={{
                  color: "#F9FAFB",
                  fontWeight: 700,
                  fontSize: 17,
                  margin: "0 0 4px",
                }}
              >
                {room.name}
              </p>
              <p style={{ color: "#94A3B8", margin: 0, fontSize: 14 }}>
                🎬 {room.movie_title}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#1D3461",
                borderRadius: 10,
                padding: 12,
                marginBottom: 24,
              }}
            >
              <p style={{ color: "#94A3B8", margin: "0 0 4px", fontSize: 12 }}>
                Invite Code
              </p>
              <p
                style={{
                  color: "#3B82F6",
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: 6,
                  margin: 0,
                }}
              >
                {room.invite_code}
              </p>
            </div>

            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>
              Open the MovieTogether app and enter this code to join, or tap
              below if you have it installed.
            </p>

            <a
              href={`movietogether://join/${room.invite_code}`}
              style={{
                display: "block",
                backgroundColor: "#2563EB",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 12,
              }}
            >
              Open in MovieTogether App
            </a>
            <p style={{ color: "#4B5563", fontSize: 12, margin: 0 }}>
              Don't have the app? Download MovieTogether to join watch parties.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
