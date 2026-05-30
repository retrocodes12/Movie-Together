"use client";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/rooms", label: "Rooms", icon: "🎬" },
  { href: "/friends", label: "Friends", icon: "👥" },
  { href: "/notifications", label: "Alerts", icon: "🔔" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function WebNav({ active = "" }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Check for unread notifications
    const deviceId =
      typeof window !== "undefined"
        ? localStorage.getItem("mt_device_id")
        : null;
    if (!deviceId) return;
    fetch(`/api/notifications?device_id=${deviceId}&unread=true`)
      .then((r) => r.json())
      .then((d) => setUnread(d.notifications?.length || 0))
      .catch(() => {});
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: "rgba(11,15,26,0.92)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 60,
      }}
    >
      {/* Logo */}
      <a
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
        }}
      >
        <span style={{ fontSize: 24 }}>🎬</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "-0.3px",
            color: "#F1F5F9",
          }}
        >
          MovieTogether
        </span>
      </a>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {NAV.map(({ href, label, icon }) => {
          const isActive = active === label || active === href;
          const isNotif = label === "Alerts";
          return (
            <a
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                position: "relative",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? "#F1F5F9" : "#64748B",
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                transition: "all 0.15s",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span
                style={{
                  display: "none",
                  "@media(min-width:640px)": { display: "inline" },
                }}
              >
                {label}
              </span>
              {isNotif && unread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 6,
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", gap: 10 }}>
        <a
          href="/rooms/create"
          style={{
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            color: "#fff",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>+</span> New Room
        </a>
      </div>
    </nav>
  );
}
