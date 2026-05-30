"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import WebNav from "@/components/WebNav";

const FEATURED = [
  {
    title: "Interstellar",
    genre: "Sci-Fi",
    year: 2014,
    emoji: "🚀",
    color: "#1E3A5F",
  },
  {
    title: "The Dark Knight",
    genre: "Action",
    year: 2008,
    emoji: "🦇",
    color: "#1A1A2E",
  },
  {
    title: "Parasite",
    genre: "Thriller",
    year: 2019,
    emoji: "🏚️",
    color: "#1E2D1E",
  },
  {
    title: "Everything Everywhere",
    genre: "Drama",
    year: 2022,
    emoji: "🥨",
    color: "#2D1E3A",
  },
  {
    title: "Dune: Part Two",
    genre: "Sci-Fi",
    year: 2024,
    emoji: "🏜️",
    color: "#3A2A1A",
  },
  {
    title: "Oppenheimer",
    genre: "Drama",
    year: 2023,
    emoji: "☢️",
    color: "#2A1A1A",
  },
];

function RoomCard({ room, onClick }) {
  const memberCount = parseInt(room.member_count) || 0;
  const isFull = memberCount >= room.max_members;
  const isPlaying = room.status === "playing";
  return (
    <div
      onClick={onClick}
      style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "16px",
        cursor: "pointer",
        transition: "all 0.2s",
        animation: "fadeIn 0.3s ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              flexShrink: 0,
              background: "rgba(99,102,241,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 22 }}>🎬</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
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
                fontSize: 12,
                color: "#64748B",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {room.movie_title}
            </div>
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            marginLeft: 8,
            padding: "3px 9px",
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 700,
            background: isPlaying
              ? "rgba(245,158,11,0.15)"
              : isFull
                ? "rgba(239,68,68,0.15)"
                : "rgba(34,197,94,0.15)",
            color: isPlaying ? "#F59E0B" : isFull ? "#EF4444" : "#22C55E",
          }}
        >
          {isPlaying ? "● LIVE" : isFull ? "FULL" : "OPEN"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          `👥 ${memberCount}/${room.max_members}`,
          room.movie_genre,
          `@${room.host_username}`,
        ]
          .filter(Boolean)
          .map((tag, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                color: "#475569",
                padding: "2px 8px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {tag}
            </span>
          ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [deviceId, setDeviceId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
    const u = localStorage.getItem("mt_user");
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch {}
    }
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ["rooms-home"],
    queryFn: async () => {
      const res = await fetch("/api/rooms?limit=20");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 15000,
  });
  const rooms = data?.rooms || [];
  const liveRooms = rooms.filter((r) => r.status === "playing");
  const openRooms = rooms.filter((r) => r.status !== "ended");

  const { data: historyData } = useQuery({
    queryKey: ["watch-history", deviceId],
    queryFn: async () => {
      if (!deviceId) return { history: [] };
      const res = await fetch(
        `/api/watchhistory?device_id=${deviceId}&limit=6`,
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!deviceId,
  });
  const history = historyData?.history || [];

  const goToRoom = (id) => (window.location.href = `/rooms/${id}`);

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Home" />
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 48px" }}
      >
        {/* Hero greeting */}
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#F1F5F9",
              letterSpacing: "-0.5px",
            }}
          >
            {user
              ? `Welcome back, ${user.display_name} 👋`
              : "Welcome to MovieTogether 🎬"}
          </div>
          <div style={{ fontSize: 15, color: "#475569", marginTop: 6 }}>
            {liveRooms.length > 0
              ? `${liveRooms.length} room${liveRooms.length > 1 ? "s" : ""} watching live right now`
              : "No rooms live yet — be the first to start one!"}
          </div>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 40,
            flexWrap: "wrap",
          }}
        >
          {[
            { href: "/rooms/create", label: "🎬 Create Room", primary: true },
            { href: "/rooms/join", label: "🔗 Join with Code", primary: false },
            { href: "/rooms", label: "📋 Browse Rooms", primary: false },
          ].map(({ href, label, primary }) => (
            <a
              key={href}
              href={href}
              style={{
                padding: "11px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                background: primary
                  ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
                  : "rgba(255,255,255,0.06)",
                color: primary ? "#fff" : "#94A3B8",
                border: primary ? "none" : "1px solid rgba(255,255,255,0.1)",
                transition: "all 0.2s",
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Featured movies */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#94A3B8",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ✨ Popular This Week
          </h2>
          <div
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {FEATURED.map((m) => (
              <a
                key={m.title}
                href="/rooms/create"
                style={{
                  flexShrink: 0,
                  width: 150,
                  background: m.color,
                  borderRadius: 12,
                  padding: "16px 14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                  transition: "transform 0.2s",
                  display: "block",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-3px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>{m.emoji}</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#F1F5F9",
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}
                >
                  {m.title}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  {m.genre} · {m.year}
                </div>
              </a>
            ))}
          </div>
        </section>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}
        >
          {/* Live rooms */}
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: "#22C55E",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "blink 2s infinite",
                  }}
                />
                Live Now
              </h2>
              <a href="/rooms" style={{ fontSize: 12, color: "#6366F1" }}>
                See all →
              </a>
            </div>
            {liveRooms.length === 0 ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "28px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎬</div>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  No live rooms yet
                </div>
              </div>
            ) : (
              liveRooms
                .slice(0, 4)
                .map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    onClick={() => goToRoom(r.id)}
                  />
                ))
            )}
          </section>

          {/* Open rooms */}
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#94A3B8" }}>
                🔓 Open Rooms
              </h2>
              <a href="/rooms" style={{ fontSize: 12, color: "#6366F1" }}>
                Browse →
              </a>
            </div>
            {openRooms.length === 0 ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "28px",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#475569", fontSize: 14 }}>
                  No open rooms
                </div>
              </div>
            ) : (
              openRooms
                .slice(0, 4)
                .map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    onClick={() => goToRoom(r.id)}
                  />
                ))
            )}
          </section>
        </div>

        {/* Watch history */}
        {history.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#94A3B8",
                marginBottom: 14,
              }}
            >
              🕐 Recently Watched
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: 12,
              }}
            >
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#E2E8F0",
                      marginBottom: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.movie_title}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569" }}>
                    {h.movie_genre && `${h.movie_genre} · `}
                    {h.watch_duration > 0 &&
                      `${Math.floor(h.watch_duration / 60)}m watched`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
