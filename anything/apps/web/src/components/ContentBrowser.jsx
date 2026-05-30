"use client";
/**
 * ContentBrowser — Nuvio-style content discovery for MovieTogether web
 * Uses /api/stremio (Stremio addon ecosystem) for search, metadata, and streams
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const TYPE_TABS = [
  { key: "movie", label: "Movies", icon: "🎬" },
  { key: "series", label: "Series", icon: "📺" },
];

const STREAM_TYPE_LABELS = {
  hls: { label: "HLS", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  dash: { label: "DASH", color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
  direct: { label: "Direct", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  torrent: { label: "Torrent", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  youtube: { label: "YouTube", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  web: { label: "URL", color: "#64748B", bg: "rgba(100,116,139,0.12)" },
};

const QUALITY_COLORS = {
  "4K": "#F59E0B",
  "1080p": "#10B981",
  "720p": "#6366F1",
  "480p": "#64748B",
};

function PosterCard({ item, onClick, selected }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderRadius: 10,
        border: selected ? "2px solid #6366F1" : "2px solid transparent",
        overflow: "hidden",
        position: "relative",
        transition: "all 0.18s",
        flexShrink: 0,
        width: 130,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.6)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          aspectRatio: "2/3",
          background: "#111827",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {item.poster && !imgErr ? (
          <img
            src={item.poster}
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg,#1E293B,#0F172A)",
            }}
          >
            <span style={{ fontSize: 36 }}>
              {item.type === "series" ? "📺" : "🎬"}
            </span>
          </div>
        )}
        {selected && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 28 }}>✓</span>
          </div>
        )}
      </div>
      <div style={{ padding: "8px 8px 10px", background: "#0D1117" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: "#E2E8F0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
        >
          {item.name}
        </div>
        {item.year && (
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            {item.year}
          </div>
        )}
        {item.imdb_rating && (
          <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 1 }}>
            ⭐ {item.imdb_rating}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamRow({ stream, onSelect }) {
  const st = STREAM_TYPE_LABELS[stream.streamType] || STREAM_TYPE_LABELS.web;
  const qColor = QUALITY_COLORS[stream.quality] || "#64748B";
  if (!stream.playable) return null;
  return (
    <div
      onClick={() => onSelect(stream)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "13px 14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
        e.currentTarget.style.background = "rgba(99,102,241,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 100,
            background: st.bg,
            color: st.color,
          }}
        >
          {st.label}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13, color: "#E2E8F0" }}>
            {stream.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: qColor }}>
            {stream.quality}
          </span>
        </div>
        {stream.description && (
          <div
            style={{
              fontSize: 11,
              color: "#64748B",
              lineHeight: 1.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {stream.description}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>
          {stream.source}
        </div>
      </div>
      <div style={{ flexShrink: 0, color: "#6366F1", fontSize: 20 }}>▶</div>
    </div>
  );
}

export default function ContentBrowser({ onSelectStream, onClose }) {
  const [type, setType] = useState("movie");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [view, setView] = useState("browse"); // "browse"|"detail"|"streams"
  const searchTimer = useRef(null);

  // Debounced search
  const triggerSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val.trim()), 450);
  };

  // Catalog fetch (no search)
  const { data: catalogData, isLoading: catLoading } = useQuery({
    queryKey: ["content-catalog", type],
    queryFn: async () => {
      const res = await fetch(`/api/stremio?action=catalogs`);
      if (!res.ok) throw new Error("failed");
      const { catalogs } = await res.json();
      const cat =
        catalogs.find((c) => c.type === type && c.id !== "top") ||
        catalogs.find((c) => c.type === type);
      if (!cat) return { results: [] };
      const r2 = await fetch(
        `/api/stremio?action=catalog&addon_url=${encodeURIComponent(cat.addon.url)}&type=${type}&catalog_id=${encodeURIComponent(cat.id)}`,
      );
      if (!r2.ok) throw new Error("failed");
      return r2.json();
    },
    enabled: !search,
    staleTime: 1000 * 60 * 5,
  });

  // Search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["content-search", search, type],
    queryFn: async () => {
      if (!search || search.length < 2) return { results: [] };
      const res = await fetch(
        `/api/stremio?query=${encodeURIComponent(search)}&type=${type}`,
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: search.length >= 2,
    staleTime: 1000 * 30,
  });

  const items = search ? searchData?.results || [] : catalogData?.results || [];
  const isLoading = search ? searchLoading : catLoading;

  // Meta + streams for selected item
  const streamId = selectedItem
    ? selectedItem.type === "series"
      ? `${selectedItem.id}:${season}:${episode}`
      : selectedItem.id
    : null;

  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ["streams", streamId, type],
    queryFn: async () => {
      const res = await fetch(
        `/api/stremio?action=streams&type=${type}&id=${encodeURIComponent(streamId)}`,
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!streamId && view === "streams",
    staleTime: 1000 * 60 * 2,
  });

  const streams = (streamsData?.direct_streams || []).filter((s) => s.playable);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setView("detail");
  };

  const handleLoadStreams = () => setView("streams");

  const handleSelectStream = (stream) => {
    const firstSubtitle = Array.isArray(stream.subtitles) ? stream.subtitles[0] : null;
    const subtitleUrl = firstSubtitle?.url || firstSubtitle?.externalUrl || null;
    const subtitleLabel = firstSubtitle?.name || firstSubtitle?.title || firstSubtitle?.lang || "Subtitles";

    onSelectStream({
      url: stream.url,
      title: selectedItem?.name,
      poster: selectedItem?.poster,
      quality: stream.quality,
      source: stream.source,
      streamType: stream.streamType,
      mimeType: stream.mimeType,
      subtitles: stream.subtitles || [],
      headers: stream.headers || {},
      subtitleUrl,
      subtitleLabel,
    });
    onClose?.();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0B0F1A",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        {view !== "browse" && (
          <button
            onClick={() => {
              if (view === "streams") setView("detail");
              else {
                setView("browse");
                setSelectedItem(null);
              }
            }}
            style={{
              color: "#6366F1",
              fontSize: 18,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 6px 0 0",
            }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#F1F5F9" }}>
            {view === "browse"
              ? "Browse Content"
              : view === "detail"
                ? selectedItem?.name
                : "Select Stream"}
          </div>
          {view === "streams" && (
            <div style={{ fontSize: 11, color: "#475569" }}>
              {selectedItem?.type === "series"
                ? `S${season}E${episode} · `
                : ""}
              {streams.length} streams available
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              color: "#475569",
              fontSize: 18,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Browse view */}
      {view === "browse" && (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Type tabs + search */}
          <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {TYPE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      type === t.key
                        ? "rgba(99,102,241,0.2)"
                        : "rgba(255,255,255,0.04)",
                    color: type === t.key ? "#818CF8" : "#64748B",
                    border: `1px solid ${type === t.key ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                triggerSearch(e.target.value);
              }}
              placeholder={`Search ${type === "movie" ? "movies" : "series"}…`}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9,
                color: "#F1F5F9",
                fontSize: 13,
                outline: "none",
                marginBottom: 12,
              }}
            />
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
            {isLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#475569",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    border: "3px solid #1E293B",
                    borderTopColor: "#6366F1",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px",
                  }}
                />
                <div style={{ fontSize: 13 }}>Loading…</div>
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 16px",
                  color: "#334155",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>
                  {type === "movie" ? "🎬" : "📺"}
                </div>
                <div style={{ fontSize: 13 }}>
                  {search
                    ? `No results for "${search}"`
                    : "No content available"}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {items.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    onClick={() => handleSelectItem(item)}
                    selected={selectedItem?.id === item.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail view */}
      {view === "detail" && selectedItem && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {/* Hero */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 90,
                flexShrink: 0,
                borderRadius: 8,
                overflow: "hidden",
                background: "#111827",
                aspectRatio: "2/3",
              }}
            >
              {selectedItem.poster ? (
                <img
                  src={selectedItem.poster}
                  alt={selectedItem.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 28 }}>
                    {selectedItem.type === "series" ? "📺" : "🎬"}
                  </span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#F1F5F9",
                  marginBottom: 4,
                  lineHeight: 1.3,
                }}
              >
                {selectedItem.name}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                {selectedItem.year && (
                  <span style={{ fontSize: 11, color: "#64748B" }}>
                    {selectedItem.year}
                  </span>
                )}
                {selectedItem.imdb_rating && (
                  <span style={{ fontSize: 11, color: "#F59E0B" }}>
                    ⭐ {selectedItem.imdb_rating}
                  </span>
                )}
                {(selectedItem.genres || []).slice(0, 2).map((g) => (
                  <span
                    key={g}
                    style={{
                      fontSize: 10,
                      padding: "1px 7px",
                      borderRadius: 100,
                      background: "rgba(99,102,241,0.12)",
                      color: "#818CF8",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
              {selectedItem.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748B",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {selectedItem.description}
                </div>
              )}
            </div>
          </div>

          {/* Series episode picker */}
          {selectedItem.type === "series" && (
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                EPISODE
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#64748B",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Season
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={season}
                    onChange={(e) => setSeason(parseInt(e.target.value) || 1)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "#0B0F1A",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#F1F5F9",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#64748B",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Episode
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={episode}
                    onChange={(e) => setEpisode(parseInt(e.target.value) || 1)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "#0B0F1A",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#F1F5F9",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLoadStreams}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Find Streams →
          </button>
        </div>
      )}

      {/* Streams view */}
      {view === "streams" && (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            {streamsLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#475569",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    border: "3px solid #1E293B",
                    borderTopColor: "#6366F1",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px",
                  }}
                />
                <div style={{ fontSize: 13 }}>Finding streams…</div>
              </div>
            ) : streams.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 16px",
                  color: "#334155",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: 6,
                  }}
                >
                  No streams found
                </div>
                <div style={{ fontSize: 12 }}>
                  Try a different episode or check your addons.
                </div>
              </div>
            ) : (
              <div>
                {/* Quality groups */}
                {["4K", "1080p", "720p", "480p", "Unknown"].map((q) => {
                  const group = streams.filter((s) => s.quality === q);
                  if (!group.length) return null;
                  return (
                    <div key={q} style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: QUALITY_COLORS[q] || "#64748B",
                          letterSpacing: 1,
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>{q}</span>
                        <div
                          style={{
                            flex: 1,
                            height: 1,
                            background: "rgba(255,255,255,0.06)",
                          }}
                        />
                        <span style={{ color: "#334155" }}>{group.length}</span>
                      </div>
                      {group.map((s, i) => (
                        <StreamRow
                          key={i}
                          stream={s}
                          onSelect={handleSelectStream}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
