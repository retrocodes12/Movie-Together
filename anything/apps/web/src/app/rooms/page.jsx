"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WebNav from "@/components/WebNav";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting" },
  { key: "playing", label: "Live" },
];

function RoomRow({ room }) {
  const memberCount = parseInt(room.member_count) || 0;
  const isFull = memberCount >= room.max_members;
  const isPlaying = room.status === "playing";

  return (
    <a
      href={`/rooms/${room.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "16px 20px",
        textDecoration: "none",
        transition: "all 0.15s",
        marginBottom: 10,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
        e.currentTarget.style.background = "#131E35";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.background = "#111827";
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          flexShrink: 0,
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        🎬
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
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
            fontSize: 13,
            color: "#64748B",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {room.movie_title}
        </div>
        <div
          style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}
        >
          {[
            `👥 ${memberCount}/${room.max_members}`,
            room.movie_genre,
            `Host: @${room.host_username}`,
          ]
            .filter(Boolean)
            .map((t, i) => (
              <span key={i} style={{ fontSize: 11, color: "#475569" }}>
                {t}
              </span>
            ))}
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 700,
            background: isPlaying
              ? "rgba(245,158,11,0.15)"
              : isFull
                ? "rgba(239,68,68,0.1)"
                : "rgba(34,197,94,0.1)",
            color: isPlaying ? "#F59E0B" : isFull ? "#EF4444" : "#22C55E",
          }}
        >
          {isPlaying ? "● LIVE" : isFull ? "FULL" : "OPEN"}
        </span>
        <span style={{ fontSize: 11, color: "#334155" }}>
          {room.is_public ? "🌐 Public" : "🔒 Private"}
        </span>
      </div>
    </a>
  );
}

export default function RoomsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rooms-list"],
    queryFn: async () => {
      const res = await fetch("/api/rooms?limit=50");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 12000,
  });

  const allRooms = data?.rooms || [];
  const rooms = allRooms
    .filter((r) => filter === "all" || r.status === filter)
    .filter(
      (r) =>
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.movie_title.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Rooms" />
      <div
        style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 48px" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}
            >
              Watch Rooms
            </h1>
            <p style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>
              {data?.total || 0} room{data?.total !== 1 ? "s" : ""} available
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="/rooms/join"
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                background: "rgba(255,255,255,0.06)",
                color: "#94A3B8",
                border: "1px solid rgba(255,255,255,0.1)",
                textDecoration: "none",
              }}
            >
              🔗 Join with Code
            </a>
            <a
              href="/rooms/create"
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              + Create Room
            </a>
          </div>
        </div>

        {/* Search + filters */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <input
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: "9px 14px",
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9,
              color: "#F1F5F9",
              fontSize: 14,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  background:
                    filter === f.key ? "rgba(99,102,241,0.2)" : "transparent",
                  color: filter === f.key ? "#818CF8" : "#475569",
                  border:
                    filter === f.key
                      ? "1px solid rgba(99,102,241,0.4)"
                      : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            style={{
              padding: "8px 14px",
              borderRadius: 9,
              fontSize: 13,
              background: "rgba(255,255,255,0.05)",
              color: "#64748B",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div
            style={{ textAlign: "center", padding: "60px", color: "#475569" }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #334155",
                borderTopColor: "#6366F1",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            Loading rooms…
          </div>
        ) : rooms.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              No rooms found
            </div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 20 }}>
              {search
                ? "Try a different search term."
                : "Be the first to create a watch party!"}
            </div>
            <a
              href="/rooms/create"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 600,
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Create Room
            </a>
          </div>
        ) : (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {rooms.map((r) => (
              <RoomRow key={r.id} room={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
