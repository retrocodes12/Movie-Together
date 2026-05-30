"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WebNav from "@/components/WebNav";

const AVATARS = [
  "🎬",
  "🎭",
  "🍿",
  "🎥",
  "🦁",
  "🐺",
  "🦊",
  "🐉",
  "🚀",
  "⚡",
  "🌙",
  "🌊",
  "🔥",
  "🎮",
  "🎸",
  "🎺",
];

export default function ProfilePage() {
  const [deviceId, setDeviceId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    avatar_url: "🎬",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", deviceId],
    queryFn: async () => {
      if (!deviceId) return null;
      const res = await fetch(`/api/profile?device_id=${deviceId}`);
      if (!res.ok) throw new Error("No profile");
      return res.json();
    },
    enabled: !!deviceId,
  });
  const profile = data?.user;

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "🎬",
      });
      localStorage.setItem("mt_user", JSON.stringify(profile));
    }
  }, [profile]);

  const { data: historyData } = useQuery({
    queryKey: ["watch-history-profile", deviceId],
    queryFn: async () => {
      if (!deviceId) return { history: [] };
      const res = await fetch(
        `/api/watchhistory?device_id=${deviceId}&limit=10`,
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!deviceId,
  });
  const history = historyData?.history || [];

  const handleSave = async () => {
    if (!deviceId) return;
    setSaving(true);
    setSaveError("");

    const isNewProfile = !profile;
    const method = isNewProfile ? "POST" : "PUT";
    const payload = isNewProfile
      ? { device_id: deviceId, username: form.username, display_name: form.display_name, avatar_url: form.avatar_url, bio: form.bio }
      : { device_id: deviceId, display_name: form.display_name, avatar_url: form.avatar_url, bio: form.bio };

    try {
      const res = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d?.error || "Failed");
      }
      if (d?.user) {
        localStorage.setItem("mt_user", JSON.stringify(d.user));
      }
      qc.invalidateQueries({ queryKey: ["profile", deviceId] });
      setEditing(false);
    } catch (e) {
      setSaveError(e?.message || "Failed to save profile");
    }

    setSaving(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    background: "#0B0F1A",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9,
    color: "#F1F5F9",
    fontSize: 14,
    outline: "none",
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
        <WebNav active="Profile" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 200,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid #1E293B",
              borderTopColor: "#6366F1",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
        <WebNav active="Profile" />
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "100px 24px" }}>
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
              No profile yet
            </div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>
              Create your profile to start joining watch parties.
            </div>
            <div style={{ marginBottom: 14 }}>
              <input
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
                }
                placeholder="Display name"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/\s/g, ""),
                  }))
                }
                placeholder="username"
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={
                saving || !form.display_name.trim() || !form.username.trim()
              }
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: "#fff",
              }}
            >
              {saving ? "Creating…" : "Create Profile"}
            </button>
            {saveError && (
              <div style={{ color: "#FCA5A5", fontSize: 13, marginTop: 10 }}>
                {saveError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Profile" />
      <div
        style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px 60px" }}
      >
        {/* Profile card */}
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 28,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: editing ? 20 : 0,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(99,102,241,0.15)",
                border: "2px solid rgba(99,102,241,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
              }}
            >
              {form.avatar_url}
            </div>
            <div style={{ flex: 1 }}>
              {editing ? null : (
                <>
                  <div
                    style={{ fontWeight: 700, fontSize: 22, color: "#F1F5F9" }}
                  >
                    {profile.display_name}
                  </div>
                  <div style={{ fontSize: 14, color: "#475569" }}>
                    @{profile.username}
                  </div>
                  {profile.bio && (
                    <div
                      style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}
                    >
                      {profile.bio}
                    </div>
                  )}
                </>
              )}
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94A3B8",
                }}
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                animation: "fadeIn 0.2s ease",
              }}
            >
              {/* Avatar picker */}
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Avatar
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setForm((f) => ({ ...f, avatar_url: a }))}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        fontSize: 22,
                        background:
                          form.avatar_url === a
                            ? "rgba(99,102,241,0.25)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          form.avatar_url === a
                            ? "2px solid #6366F1"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Display Name
                </label>
                <input
                  style={inputStyle}
                  value={form.display_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Username
                </label>
                <input
                  style={inputStyle}
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    }))
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Bio
                </label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Tell the room about yourself…"
                />
              </div>
              {saveError && (
                <div style={{ color: "#FCA5A5", fontSize: 13 }}>
                  {saveError}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setEditing(false);
                    setSaveError("");
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 9,
                    fontSize: 14,
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#64748B",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
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
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Rooms Hosted", value: profile.rooms_hosted || 0 },
            { label: "Rooms Joined", value: profile.rooms_joined || 0 },
            {
              label: "Hours Watched",
              value: `${Math.round(history.reduce((a, h) => a + (h.watch_duration || 0), 0) / 3600)}h`,
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "18px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 700, color: "#F1F5F9" }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Watch history */}
        {history.length > 0 && (
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              🕐 Watch History
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {history.map((h, i) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom:
                      i < history.length - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                  }}
                >
                  <span style={{ fontSize: 20 }}>🎬</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      {h.movie_title}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      {h.movie_genre && `${h.movie_genre} · `}
                      {h.watch_duration > 0 &&
                        `${Math.floor(h.watch_duration / 60)}m`}
                    </div>
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}
                  >
                    {new Date(h.watched_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
