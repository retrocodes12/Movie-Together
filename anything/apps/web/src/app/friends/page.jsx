"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WebNav from "@/components/WebNav";

export default function FriendsPage() {
  const [deviceId, setDeviceId] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState("friends");
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
    queryKey: ["friends", deviceId],
    queryFn: async () => {
      if (!deviceId) return { friends: [] };
      const res = await fetch(`/api/friends?device_id=${deviceId}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!deviceId,
    refetchInterval: 30000,
  });

  const friends = (data?.friends || []).filter((f) => f.status === "accepted");
  const pending = (data?.friends || []).filter((f) => f.status === "pending");

  const handleSearch = async () => {
    if (!search.trim() || !deviceId) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(search)}&device_id=${deviceId}`,
      );
      const d = await res.json();
      setSearchResults(d.users || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const sendRequest = useMutation({
    mutationFn: async (addresseeId) => {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          addressee_id: addresseeId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      setSearchResults([]);
      setSearch("");
    },
  });

  const respondRequest = useMutation({
    mutationFn: async ({ friendshipId, status }) => {
      const res = await fetch(`/api/friends?friendship_id=${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const TABS = [
    { key: "friends", label: `Friends (${friends.length})` },
    {
      key: "pending",
      label: `Requests ${pending.length > 0 ? `(${pending.length})` : ""}`,
    },
    { key: "find", label: "Find People" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A" }}>
      <WebNav active="Friends" />
      <div
        style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 60px" }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            marginBottom: 24,
          }}
        >
          Friends
        </h1>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: 0,
          }}
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: tab === key ? "#F1F5F9" : "#475569",
                borderBottom:
                  tab === key ? "2px solid #6366F1" : "2px solid transparent",
                marginBottom: -1,
                background: "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Friends list */}
        {tab === "friends" && (
          <div>
            {isLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#475569",
                }}
              >
                Loading…
              </div>
            ) : friends.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  No friends yet
                </div>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Find people using the search tab!
                </div>
              </div>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "rgba(99,102,241,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {f.avatar_url || "🎬"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "#F1F5F9",
                      }}
                    >
                      {f.display_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      @{f.username}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: f.is_online ? "#22C55E" : "#374151",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: f.is_online ? "#22C55E" : "#475569",
                      }}
                    >
                      {f.is_online ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pending requests */}
        {tab === "pending" && (
          <div>
            {pending.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  No pending friend requests.
                </div>
              </div>
            ) : (
              pending.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    background: "#111827",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 12,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "rgba(99,102,241,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {f.avatar_url || "🎬"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "#F1F5F9",
                      }}
                    >
                      {f.display_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      @{f.username}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        respondRequest.mutate({
                          friendshipId: f.id,
                          status: "accepted",
                        })
                      }
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(34,197,94,0.15)",
                        color: "#22C55E",
                        border: "1px solid rgba(34,197,94,0.3)",
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        respondRequest.mutate({
                          friendshipId: f.id,
                          status: "rejected",
                        })
                      }
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(239,68,68,0.1)",
                        color: "#EF4444",
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Find people */}
        {tab === "find" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by username or display name…"
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  color: "#F1F5F9",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !search.trim()}
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: search.trim() ? "#4F46E5" : "#1E293B",
                  color: search.trim() ? "#fff" : "#4B5563",
                }}
              >
                {searching ? "…" : "Search"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(99,102,241,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {u.avatar_url || "🎬"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#F1F5F9",
                        }}
                      >
                        {u.display_name}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        @{u.username}
                      </div>
                    </div>
                    <button
                      onClick={() => sendRequest.mutate(u.id)}
                      disabled={sendRequest.isPending}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(99,102,241,0.15)",
                        color: "#818CF8",
                        border: "1px solid rgba(99,102,241,0.3)",
                      }}
                    >
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}
            {search && searchResults.length === 0 && !searching && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#475569",
                  fontSize: 14,
                }}
              >
                No users found for "{search}".
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
