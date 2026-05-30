"use client";
import { useState, useEffect } from "react";
import WebNav from "@/components/WebNav";

const GENRES = [
  "Action",
  "Drama",
  "Sci-Fi",
  "Horror",
  "Comedy",
  "Thriller",
  "Animation",
  "Documentary",
  "Romance",
  "Fantasy",
];

export default function CreateRoomPage() {
  const [deviceId, setDeviceId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    movie_title: "",
    movie_description: "",
    movie_genre: "Action",
    movie_year: new Date().getFullYear(),
    stream_url: "",
    max_members: 10,
    is_public: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.movie_title.trim()) {
      setError("Room name and movie title are required.");
      return;
    }
    if (!deviceId) {
      setError("Device not initialized. Refresh and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          device_id: deviceId,
          max_members: parseInt(form.max_members) || 10,
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to create room");
      const data = await res.json();
      window.location.href = `/rooms/${data.room.id}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    background: "#0B0F1A",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9,
    color: "#F1F5F9",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  };
  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#94A3B8",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Rooms" />
      <div
        style={{ maxWidth: 620, margin: "0 auto", padding: "90px 24px 60px" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <a
            href="/rooms"
            style={{
              fontSize: 13,
              color: "#6366F1",
              marginBottom: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Rooms
          </a>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              marginTop: 8,
            }}
          >
            Create a Room
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 6 }}>
            Set up your watch party and invite friends.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            {/* Room name */}
            <div>
              <label style={labelStyle}>Room Name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Friday Movie Night"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
            </div>

            {/* Movie title */}
            <div>
              <label style={labelStyle}>Movie / Show Title *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Interstellar"
                value={form.movie_title}
                onChange={(e) => set("movie_title", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
            </div>

            {/* Genre + Year row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Genre</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.movie_genre}
                  onChange={(e) => set("movie_genre", e.target.value)}
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Year</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1900"
                  max="2030"
                  value={form.movie_year}
                  onChange={(e) => set("movie_year", e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                placeholder="Brief synopsis or why you want to watch this…"
                value={form.movie_description}
                onChange={(e) => set("movie_description", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
            </div>

            {/* Stream URL */}
            <div>
              <label style={labelStyle}>Stream URL (optional)</label>
              <input
                style={inputStyle}
                type="url"
                placeholder="https://… (HLS, DASH, or MP4)"
                value={form.stream_url}
                onChange={(e) => set("stream_url", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
              />
              <p style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>
                You can add or change this later inside the room.
              </p>
            </div>

            {/* Max members */}
            <div>
              <label style={labelStyle}>
                Max Members:{" "}
                <strong style={{ color: "#F1F5F9" }}>{form.max_members}</strong>
              </label>
              <input
                type="range"
                min="2"
                max="50"
                value={form.max_members}
                onChange={(e) => set("max_members", e.target.value)}
                style={{ width: "100%", accentColor: "#6366F1" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#334155",
                  marginTop: 4,
                }}
              >
                <span>2</span>
                <span>50</span>
              </div>
            </div>

            {/* Privacy toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <div
                  style={{ fontWeight: 600, fontSize: 14, color: "#F1F5F9" }}
                >
                  {form.is_public ? "🌐 Public Room" : "🔒 Private Room"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  {form.is_public
                    ? "Anyone can browse and join this room."
                    : "Only people with the invite code or link can join."}
                </div>
              </div>
              <div
                onClick={() => set("is_public", !form.is_public)}
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  cursor: "pointer",
                  background: form.is_public ? "#6366F1" : "#1F2937",
                  border:
                    "2px solid " + (form.is_public ? "#6366F1" : "#374151"),
                  position: "relative",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: form.is_public ? 24 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 9,
                  padding: "10px 14px",
                  color: "#FCA5A5",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                background: loading
                  ? "#374151"
                  : "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: loading ? "#6B7280" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Creating…" : "Create Watch Room 🎬"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
