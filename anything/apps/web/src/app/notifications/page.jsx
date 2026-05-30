"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WebNav from "@/components/WebNav";

const ICONS = {
  friend_request: "👥",
  room_invite: "🎬",
  host_changed: "👑",
  vote: "🗳️",
  default: "🔔",
};

export default function NotificationsPage() {
  const [deviceId, setDeviceId] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    let id = localStorage.getItem("mt_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mt_device_id", id);
    }
    setDeviceId(id);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications", deviceId],
    queryFn: async () => {
      if (!deviceId) return { notifications: [] };
      const res = await fetch(
        `/api/notifications?device_id=${deviceId}&limit=50`,
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!deviceId,
    refetchInterval: 20000,
  });
  const notifications = data?.notifications || [];
  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!deviceId) return;
      await fetch(`/api/notifications?device_id=${deviceId}`, {
        method: "PATCH",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Alerts" />
      <div
        style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px 60px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px" }}
            >
              Notifications
            </h1>
            {unread > 0 && (
              <p style={{ color: "#6366F1", fontSize: 13, marginTop: 4 }}>
                {unread} unread
              </p>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "rgba(99,102,241,0.1)",
                color: "#818CF8",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            style={{ textAlign: "center", padding: "60px", color: "#475569" }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #1E293B",
                borderTopColor: "#6366F1",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              All caught up
            </div>
            <div style={{ color: "#475569", fontSize: 14 }}>
              No notifications yet.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "14px 16px",
                  background: n.read
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(99,102,241,0.07)",
                  border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.2)"}`,
                  borderRadius: 12,
                  animation: "fadeIn 0.3s ease",
                  cursor: n.data?.room_id ? "pointer" : "default",
                }}
                onClick={() => {
                  if (n.data?.room_id)
                    window.location.href = `/rooms/${n.data.room_id}`;
                }}
              >
                <div style={{ fontSize: 26, flexShrink: 0 }}>
                  {ICONS[n.type] || ICONS.default}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#F1F5F9",
                      marginBottom: 3,
                    }}
                  >
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#334155", marginTop: 5 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.read && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#6366F1",
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
