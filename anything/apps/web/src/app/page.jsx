"use client";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [code, setCode] = useState("");
  const [activeRooms, setActiveRooms] = useState("...");

  useEffect(() => {
    fetch("/api/rooms?limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.total !== undefined) setActiveRooms(d.total);
      })
      .catch(() => {});
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length >= 4) {
      window.location.href = `/join/${trimmed}`;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#F9FAFB",
        overflowX: "hidden",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(15,23,42,0.88)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🎬</span>
          <span
            style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.5px" }}
          >
            MovieTogether
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href="/dashboard"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 14,
              color: "#94A3B8",
              fontWeight: 500,
            }}
          >
            Dashboard
          </a>
          <a
            href="/rooms"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 14,
              color: "#94A3B8",
              fontWeight: 500,
            }}
          >
            Rooms
          </a>
          <a
            href="/rooms/create"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
              color: "#fff",
            }}
          >
            + Create Room
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        {/* Live badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 100,
            padding: "6px 16px",
            fontSize: 13,
            color: "#A5B4FC",
            marginBottom: 36,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: "#22C55E",
              display: "inline-block",
            }}
          />
          Watch parties happening right now
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 66px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-2px",
            marginBottom: 24,
            background: "linear-gradient(135deg, #FFFFFF 0%, #A5B4FC 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Watch anything,
          <br />
          together.
        </h1>

        <p
          style={{
            fontSize: 17,
            color: "#94A3B8",
            maxWidth: 500,
            margin: "0 auto 52px",
            lineHeight: 1.7,
          }}
        >
          Sync your stream with friends in real time. Chat, react, vote, and
          host watch parties — powered by Stremio's addon ecosystem.
        </p>

        {/* Join via invite code */}
        <form
          onSubmit={handleJoin}
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 52,
          }}
        >
          <input
            type="text"
            placeholder="Invite code (e.g. AB12CD34)"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            maxLength={8}
            style={{
              width: 220,
              padding: "13px 20px",
              borderRadius: 10,
              border: "1px solid rgba(99,102,241,0.35)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: 16,
              fontFamily: "inherit",
              letterSpacing: 4,
              outline: "none",
              textAlign: "center",
            }}
          />
          <button
            type="submit"
            disabled={code.trim().length < 4}
            style={{
              padding: "13px 28px",
              borderRadius: 10,
              border: "none",
              background:
                code.trim().length >= 4
                  ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
                  : "rgba(99,102,241,0.2)",
              color: code.trim().length >= 4 ? "#fff" : "#6B7280",
              fontSize: 15,
              fontWeight: 600,
              cursor: code.trim().length >= 4 ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            Join Room →
          </button>
        </form>

        {/* Quick action links */}
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginBottom: 52,
            flexWrap: "wrap",
          }}
        >
          <a
            href="/dashboard"
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "rgba(99,102,241,0.12)",
              color: "#A5B4FC",
              border: "1px solid rgba(99,102,241,0.25)",
            }}
          >
            🏠 Go to Dashboard
          </a>
          <a
            href="/rooms"
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "rgba(255,255,255,0.05)",
              color: "#94A3B8",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            🎬 Browse Public Rooms
          </a>
          <a
            href="/rooms/create"
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "rgba(255,255,255,0.05)",
              color: "#94A3B8",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            + Create Room
          </a>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 48,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Stremio Addons", value: "300+" },
            { label: "Stream Sources", value: "∞" },
            { label: "Active Rooms", value: activeRooms },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#E2E8F0" }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "20px 24px 80px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {[
            {
              icon: "🎬",
              title: "Any Stream, Any Source",
              desc: "Browse thousands of titles via Stremio addons. Pick your stream, click Watch Together.",
            },
            {
              icon: "🔄",
              title: "Real-Time Sync",
              desc: "Play, pause, and seek stays in sync across all participants — automatically.",
            },
            {
              icon: "👑",
              title: "Host & Co-host Controls",
              desc: "The host controls playback. In private rooms, grant controls to trusted members.",
            },
            {
              icon: "🗳️",
              title: "Democratic Voting",
              desc: "Let the group vote on what to watch next or when to take a break.",
            },
            {
              icon: "💬",
              title: "Live Chat & Reactions",
              desc: "Message the room, send flying emoji reactions, and use Discussion Mode.",
            },
            {
              icon: "🔒",
              title: "Public & Private Rooms",
              desc: "Share an open invite link or lock it down with invite-only access.",
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "24px 22px",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 14 }}>{icon}</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#F1F5F9",
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          textAlign: "center",
          padding: "60px 24px 80px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 20 }}>📱</div>
        <h2
          style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "-0.5px",
          }}
        >
          Get the MovieTogether app
        </h2>
        <p
          style={{
            color: "#94A3B8",
            marginBottom: 32,
            fontSize: 16,
            maxWidth: 420,
            margin: "0 auto 32px",
          }}
        >
          Host rooms, browse content, and join watch parties from your phone.
        </p>
        <p style={{ color: "#475569", fontSize: 13 }}>
          Available on iOS. Android coming soon.
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "22px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          color: "#475569",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🎬</span>
          <span>MovieTogether</span>
        </div>
        <div>Watch parties, reimagined.</div>
      </footer>
    </div>
  );
}
