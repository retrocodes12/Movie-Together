"use client";
/**
 * NuvioPlayer — Professional streaming player for MovieTogether
 * Architecture ported from NuvioMedia/NuvioWeb playerController.js
 * Supports: HLS (.m3u8), DASH (.mpd), MP4/WebM/MKV (native), external subtitles
 */
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { PlayerController } from "@/player/playerController";

const fmt = (s) => {
  if (!s || isNaN(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const ENGINE_LABELS = {
  "hls.js": "HLS",
  "dash.js": "DASH",
  native: "Native",
  none: "—",
};

function Badge({ label, color = "#475569" }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 100,
        background: "rgba(255,255,255,0.08)",
        color,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </span>
  );
}

export default function NuvioPlayer({
  contentUrl,
  mimeType,
  subtitleUrl,
  subtitleLabel,
  headers,
  videoId,
  roomId,
  isHost,
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onEngineChange,
  title,
  poster,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const hideTimer = useRef(null);
  const loadTimer = useRef(null);
  const lastSyncRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [engine, setEngine] = useState("none");

  const [menu, setMenu] = useState(null); // "speed"|"audio"|"sub"|"quality"|"info"
  const [speed, setSpeed] = useState(1);
  const [audioTracks, setAudioTracks] = useState([]);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(-1);
  const [selectedSub, setSelectedSub] = useState(-1);
  const [selectedQuality, setSelectedQuality] = useState(-1);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(null);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const headersKey = useMemo(() => JSON.stringify(headers || {}), [headers]);
  const requestHeaders = useMemo(() => {
    try {
      return JSON.parse(headersKey);
    } catch (_) {
      return {};
    }
  }, [headersKey]);

  /* ── Show / hide controls ─────────────────────────────────── */
  const nudgeControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing && !menu) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3800);
    }
  }, [playing, menu]);

  useEffect(() => {
    if (!playing || menu) {
      setShowControls(true);
      clearTimeout(hideTimer.current);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing, menu]);

  /* ── Wire PlayerController to video element ───────────────── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    PlayerController.video = v;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!isSeeking) setCurrentTime(v.currentTime);
    };
    const onDur = () => setDuration(v.duration || 0);
    const onBuf = () => {
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onWait = () => setBuffering(true);
    const onReady = () => {
      clearTimeout(loadTimer.current);
      setBuffering(false);
    };
    const onPlaying = () => onReady();
    const onErr = () => {
      const mediaError = v.error;
      const message = mediaError
        ? mediaError.message ||
          `Playback failed (code ${mediaError.code || "unknown"}).`
        : "Stream could not be loaded. Verify the URL is accessible.";
      setError({
        message,
        code: mediaError ? `media_error_${mediaError.code || "unknown"}` : "media_error",
      });
      setBuffering(false);
    };
    const onFull = () => setFullscreen(!!document.fullscreenElement);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("progress", onBuf);
    v.addEventListener("waiting", onWait);
    v.addEventListener("loadedmetadata", onReady);
    v.addEventListener("canplay", onReady);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onErr);
    v.addEventListener("volumechange", onVol);
    document.addEventListener("fullscreenchange", onFull);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("progress", onBuf);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("loadedmetadata", onReady);
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onErr);
      v.removeEventListener("volumechange", onVol);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [isSeeking]);

  /* ── Load stream when URL changes ─────────────────────────── */
  useEffect(() => {
    if (!contentUrl) {
      setError(null);
      return;
    }
    setError(null);
    setBuffering(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.readyState >= 2) return;
      setBuffering(false);
      setError({
        message:
          "This stream did not start. The server may be expired, blocked, or using a codec/container this browser cannot play.",
        code: "stream_load_timeout",
      });
    }, 20000);

    (async () => {
      try {
        await PlayerController.load({
          url: contentUrl,
          mimeType,
          headers: requestHeaders,
          videoId: videoId || contentUrl,
          roomId,
          subtitleUrl,
          subtitleLabel,
          autoPlay: true,
          startTime: 0,
          onEngineReady: (eng, instance) => {
            setEngine(eng);
            if (eng !== "native") {
              setBuffering(false);
              clearTimeout(loadTimer.current);
            }
            setTimeout(() => {
              setAudioTracks(PlayerController.getAudioTracks());
              setSubtitleTracks(PlayerController.getSubtitleTracks());
              setQualityLevels(PlayerController.getQualityLevels());
            }, 800);
            onEngineChange?.(eng);
          },
          onError: (err) => {
            setBuffering(false);
            clearTimeout(loadTimer.current);
            setError(err);
          },
        });
      } catch (err) {
        setBuffering(false);
        clearTimeout(loadTimer.current);
        setError({
          message:
            (err && err.message) ||
            "Playback failed while loading the stream. Verify the URL and try again.",
          code: err?.code || "load_error",
        });
      }
    })();

    return () => {
      clearTimeout(loadTimer.current);
    };
  }, [
    contentUrl,
    mimeType,
    subtitleUrl,
    subtitleLabel,
    videoId,
    roomId,
    requestHeaders,
    onEngineChange,
  ]);

  /* ── Sync from room playback state ─────────────────────────── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackState || isHost) return;
    const ps = playbackState;
    const serverPos =
      (ps.position || 0) +
      (ps.status === "playing" && ps.updated_at
        ? (Date.now() - new Date(ps.updated_at).getTime()) / 1000
        : 0);
    const drift = Math.abs(v.currentTime - serverPos);
    if (drift > 2.5) {
      v.currentTime = serverPos;
    }
    if (ps.status === "playing" && v.paused) v.play().catch(() => {});
    else if (ps.status !== "playing" && !v.paused) v.pause();
    if (ps.speed && ps.speed !== v.playbackRate) v.playbackRate = ps.speed;
  }, [playbackState, isHost]);

  /* ── Keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSkip(-10);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSkip(10);
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        const v = Math.min(1, volume + 0.1);
        setVolume(v);
        if (videoRef.current) videoRef.current.volume = v;
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const v = Math.max(0, volume - 0.1);
        setVolume(v);
        if (videoRef.current) videoRef.current.volume = v;
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        PlayerController.setFullscreen(containerRef.current);
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        handleMuteToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playing, volume, isHost]);

  /* ── Controls ───────────────────────────────────────────────── */
  const handlePlayPause = useCallback(() => {
    if (!isHost) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      PlayerController.play();
      onPlay?.(v.currentTime);
    } else {
      PlayerController.pause();
      onPause?.(v.currentTime);
    }
  }, [isHost, onPlay, onPause]);

  const handleSkip = useCallback(
    (delta) => {
      if (!isHost) return;
      const v = videoRef.current;
      if (!v) return;
      const t = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
      PlayerController.seek(t);
      (delta > 0 ? onSkipForward : onSkipBackward)?.();
      onSeek?.(t);
    },
    [isHost, onSeek, onSkipForward, onSkipBackward],
  );

  const handleMuteToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    PlayerController.setMuted(!v.muted);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    PlayerController.setVolume(vol);
  };

  const handleSpeedChange = (s) => {
    setSpeed(s);
    PlayerController.setSpeed(s);
    setMenu(null);
  };

  const handleAudioTrack = (index) => {
    setSelectedAudio(index);
    PlayerController.setAudioTrack(index);
    setMenu(null);
  };

  const handleSubTrack = (index, native) => {
    setSelectedSub(index);
    PlayerController.setSubtitleTrack(index, native);
    setMenu(null);
  };

  const handleQuality = (index) => {
    setSelectedQuality(index);
    PlayerController.setQualityLevel(index);
    setMenu(null);
  };

  const handleRetry = () => {
    setError(null);
    if (!contentUrl) return;
    setBuffering(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.readyState >= 2) return;
      setBuffering(false);
      setError({
        message:
          "This stream did not start. The server may be expired, blocked, or using a codec/container this browser cannot play.",
        code: "stream_load_timeout",
      });
    }, 20000);
    PlayerController.load({
      url: contentUrl,
      mimeType,
      headers: requestHeaders,
      videoId,
      roomId,
      subtitleUrl,
      subtitleLabel,
      autoPlay: true,
      onEngineReady: (eng) => {
        setEngine(eng);
        if (eng !== "native") {
          setBuffering(false);
          clearTimeout(loadTimer.current);
        }
      },
      onError: (err) => {
        setBuffering(false);
        clearTimeout(loadTimer.current);
        setError(err);
      },
    });
  };

  /* ── Seek bar ───────────────────────────────────────────────── */
  const getSeekPos = (e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width)) * duration;
  };

  const onProgressDown = (e) => {
    if (!isHost || !duration) return;
    e.preventDefault();
    setIsSeeking(true);
    setSeekPreview(getSeekPos(e));
  };

  useEffect(() => {
    if (!isSeeking) return;
    const move = (e) => {
      const p = getSeekPos(e);
      setSeekPreview(p);
      if (videoRef.current) videoRef.current.currentTime = p;
    };
    const up = (e) => {
      const p = getSeekPos(e);
      setIsSeeking(false);
      setSeekPreview(null);
      PlayerController.seek(p);
      onSeek?.(p);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [isSeeking, duration, onSeek]);

  const displayTime =
    isSeeking && seekPreview != null ? seekPreview : currentTime;
  const progress = duration > 0 ? displayTime / duration : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  /* ── Empty state ─────────────────────────────────────────────── */
  if (!contentUrl) {
    return (
      <div
        style={{
          ...PLAYER_WRAP,
          aspectRatio: "16/9",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 56, opacity: 0.3 }}>🎬</div>
        <div style={{ color: "#4B5563", fontSize: 15, fontWeight: 500 }}>
          No stream loaded
        </div>
        {isHost && (
          <div
            style={{
              color: "#374151",
              fontSize: 12,
              textAlign: "center",
              maxWidth: 260,
            }}
          >
            Paste a stream URL in the panel below to begin
          </div>
        )}
      </div>
    );
  }

  const menuItems =
    menu === "speed"
      ? SPEEDS.map((s) => ({
          label: s === 1 ? "Normal" : `${s}×`,
          value: s,
          active: speed === s,
          onClick: () => handleSpeedChange(s),
        }))
      : menu === "audio"
        ? audioTracks.length
          ? audioTracks.map((t) => ({
              label: t.label,
              value: t.index,
              active: selectedAudio === t.index,
              onClick: () => handleAudioTrack(t.index),
            }))
          : [
              {
                label: "No audio tracks",
                value: -1,
                active: false,
                onClick: () => {},
              },
            ]
        : menu === "sub"
          ? [
              {
                label: "Off",
                value: -1,
                active: selectedSub === -1,
                onClick: () => handleSubTrack(-1),
              },
              ...subtitleTracks.map((t) => ({
                label: t.label,
                value: t.index,
                active: selectedSub === t.index,
                onClick: () => handleSubTrack(t.index, t.native),
              })),
            ]
          : menu === "quality"
            ? [
                {
                  label: "Auto",
                  value: -1,
                  active: selectedQuality === -1,
                  onClick: () => handleQuality(-1),
                },
                ...qualityLevels.map((q) => ({
                  label: q.label,
                  value: q.index,
                  active: selectedQuality === q.index,
                  onClick: () => handleQuality(q.index),
                })),
              ]
            : [];

  return (
    <div
      ref={containerRef}
      onMouseMove={nudgeControls}
      onMouseLeave={() => {
        if (playing && !menu) setShowControls(false);
      }}
      onClick={() => {
        if (menu) {
          setMenu(null);
          return;
        }
      }}
      style={{
        ...PLAYER_WRAP,
        cursor: showControls ? "default" : "none",
        borderRadius: fullscreen ? 0 : 14,
      }}
    >
      {/* ── Video element ── */}
      <video
        ref={videoRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
          background: "#000",
        }}
        playsInline
        poster={poster}
        onClick={handlePlayPause}
      />

      {/* ── Buffering spinner ── */}
      {buffering && !error && (
        <div style={OVERLAY_CENTER}>
          <div style={SPINNER} />
        </div>
      )}

      {/* ── Error overlay ── */}
      {error && (
        <div
          style={{
            ...OVERLAY_CENTER,
            flexDirection: "column",
            gap: 12,
            padding: 24,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div
            style={{
              color: "#F1F5F9",
              fontWeight: 700,
              fontSize: 15,
              textAlign: "center",
            }}
          >
            Playback Error
          </div>
          <div
            style={{
              color: "#94A3B8",
              fontSize: 13,
              textAlign: "center",
              maxWidth: 360,
              lineHeight: 1.6,
            }}
          >
            {error.message}
          </div>
          {error.code && (
            <div
              style={{
                fontSize: 10,
                color: "#475569",
                fontFamily: "monospace",
                background: "#0B0F1A",
                padding: "3px 10px",
                borderRadius: 6,
              }}
            >
              ERR:{error.code}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={handleRetry} style={BTN_PRIMARY}>
              ↺ Retry
            </button>
            {contentUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(contentUrl)}
                style={BTN_GHOST}
              >
                Copy URL
              </button>
            )}
            {contentUrl && (
              <a
                href={contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={BTN_GHOST}
              >
                Open externally ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Controls overlay ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: showControls
            ? "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)"
            : "transparent",
          transition: "opacity 0.35s",
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "all" : "none",
        }}
      >
        {/* Title bar */}
        {title && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "14px 20px",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: "#F1F5F9",
                flex: 1,
              }}
            >
              {title}
            </div>
            <Badge label={ENGINE_LABELS[engine] || engine} color="#818CF8" />
          </div>
        )}

        {/* Seeking big indicator */}
        {isSeeking && seekPreview != null && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(12px)",
              borderRadius: 14,
              padding: "14px 28px",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontSize: 30,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(seekPreview)}
            </div>
          </div>
        )}

        {/* Center controls row */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <button
            onClick={() => handleSkip(-10)}
            style={CENTER_BTN(isHost)}
            title="Back 10s"
          >
            <span style={{ fontSize: 22 }}>⏮</span>
            <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
              10s
            </span>
          </button>
          <button
            onClick={handlePlayPause}
            style={{
              width: 66,
              height: 66,
              borderRadius: "50%",
              background: isHost
                ? "rgba(99,102,241,0.85)"
                : "rgba(30,41,59,0.6)",
              backdropFilter: "blur(8px)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isHost ? 1 : 0.45,
              boxShadow: isHost ? "0 0 30px rgba(99,102,241,0.3)" : "none",
            }}
          >
            {buffering ? (
              <div style={{ ...SPINNER, width: 22, height: 22 }} />
            ) : playing ? (
              "⏸"
            ) : (
              "▶"
            )}
          </button>
          <button
            onClick={() => handleSkip(10)}
            style={CENTER_BTN(isHost)}
            title="Forward 10s"
          >
            <span style={{ fontSize: 22 }}>⏭</span>
            <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
              10s
            </span>
          </button>
        </div>

        {/* Settings pop-up menu */}
        {menu && menuItems.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 90,
              right: 16,
              background: "rgba(15,23,42,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: "8px",
              minWidth: 200,
              zIndex: 20,
              animation: "fadeIn 0.15s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#6366F1",
                padding: "4px 10px 8px",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {menu === "speed"
                ? "Speed"
                : menu === "audio"
                  ? "Audio Track"
                  : menu === "sub"
                    ? "Subtitles"
                    : "Quality"}
            </div>
            {menuItems.map((item) => (
              <button
                key={item.value}
                onClick={item.onClick}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 500,
                  color: item.active ? "#F1F5F9" : "#64748B",
                  background: item.active
                    ? "rgba(99,102,241,0.2)"
                    : "transparent",
                  transition: "all 0.1s",
                }}
              >
                <span>{item.label}</span>
                {item.active && (
                  <span style={{ color: "#6366F1", fontSize: 14 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Bottom bar */}
        <div style={{ padding: "0 14px 14px" }}>
          {/* Progress bar */}
          <div
            ref={progressRef}
            onMouseDown={onProgressDown}
            style={{
              height: 22,
              display: "flex",
              alignItems: "center",
              cursor: isHost ? "pointer" : "default",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                height: isSeeking ? 5 : 3,
                borderRadius: 3,
                background: "rgba(255,255,255,0.15)",
                position: "relative",
                transition: "height 0.1s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.1)",
                  width: `${bufPct}%`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 3,
                  background: "linear-gradient(90deg,#6366F1,#818CF8)",
                  width: `${progress * 100}%`,
                }}
              />
              {isHost && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${progress * 100}%`,
                    transform: "translate(-50%,-50%)",
                    width: isSeeking ? 16 : 12,
                    height: isSeeking ? 16 : 12,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 0 8px rgba(99,102,241,0.8)",
                    transition: "width 0.1s, height 0.1s",
                  }}
                />
              )}
            </div>
          </div>

          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Play/pause */}
            <button
              onClick={handlePlayPause}
              style={CTRL_BTN}
              disabled={!isHost}
            >
              <span style={{ fontSize: 16, opacity: isHost ? 1 : 0.4 }}>
                {playing ? "⏸" : "▶"}
              </span>
            </button>

            {/* Volume */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={() => setShowVolSlider(true)}
              onMouseLeave={() => setShowVolSlider(false)}
            >
              <button onClick={handleMuteToggle} style={CTRL_BTN}>
                <span style={{ fontSize: 15 }}>
                  {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                </span>
              </button>
              <div
                style={{
                  width: showVolSlider ? 80 : 0,
                  overflow: "hidden",
                  transition: "width 0.2s",
                }}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: 80,
                    accentColor: "#6366F1",
                    display: "block",
                  }}
                />
              </div>
            </div>

            {/* Time */}
            <span
              style={{
                color: "#fff",
                fontSize: 12,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                minWidth: 90,
              }}
            >
              {fmt(displayTime)}
              {duration > 0 && (
                <span style={{ color: "#475569" }}> / {fmt(duration)}</span>
              )}
            </span>

            <div style={{ flex: 1 }} />

            {/* Engine badge */}
            {engine !== "none" && (
              <Badge label={ENGINE_LABELS[engine] || engine} color="#475569" />
            )}

            {/* Non-host label */}
            {!isHost && (
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                Host controls
              </span>
            )}

            {/* Settings buttons */}
            {[
              {
                key: "speed",
                icon: speed !== 1 ? `${speed}×` : "⚙",
                title: "Speed",
              },
              {
                key: "sub",
                icon: "CC",
                title: "Subtitles",
                disabled: subtitleTracks.length === 0,
              },
              {
                key: "audio",
                icon: "🎵",
                title: "Audio",
                disabled: audioTracks.length === 0,
              },
              {
                key: "quality",
                icon: "HD",
                title: "Quality",
                disabled: qualityLevels.length === 0,
              },
            ].map(({ key, icon, title, disabled }) => (
              <button
                key={key}
                disabled={disabled}
                title={title}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu((m) => (m === key ? null : key));
                }}
                style={{
                  ...CTRL_BTN,
                  opacity: disabled ? 0.25 : 1,
                  background:
                    menu === key ? "rgba(99,102,241,0.3)" : "transparent",
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 28,
                }}
              >
                {icon}
              </button>
            ))}

            {/* External link */}
            {contentUrl && (
              <a
                href={contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in external player"
                style={{
                  ...CTRL_BTN,
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                ↗
              </a>
            )}

            {/* Fullscreen */}
            <button
              onClick={() =>
                PlayerController.setFullscreen(containerRef.current)
              }
              style={CTRL_BTN}
              title="Fullscreen (F)"
            >
              <span style={{ fontSize: 15 }}>{fullscreen ? "⊙" : "⛶"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Style constants ─────────────────────────────────────────── */
const PLAYER_WRAP = {
  position: "relative",
  background: "#000",
  aspectRatio: "16/9",
  width: "100%",
  display: "flex",
  overflow: "hidden",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
};

const OVERLAY_CENTER = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const SPINNER = {
  width: 44,
  height: 44,
  border: "3px solid rgba(255,255,255,0.1)",
  borderTopColor: "#6366F1",
  borderRadius: "50%",
  animation: "spin 0.75s linear infinite",
};

const CTRL_BTN = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "#E2E8F0",
  padding: "5px 7px",
  borderRadius: 7,
  fontSize: 15,
  transition: "background 0.15s",
  border: "none",
  cursor: "pointer",
};

const BTN_PRIMARY = {
  padding: "9px 20px",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 700,
  background: "#4F46E5",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const BTN_GHOST = {
  padding: "9px 18px",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 600,
  background: "rgba(255,255,255,0.08)",
  color: "#94A3B8",
  border: "1px solid rgba(255,255,255,0.1)",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const CENTER_BTN = (active) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: "none",
  color: "#fff",
  opacity: active ? 0.9 : 0.3,
  border: "none",
  cursor: active ? "pointer" : "default",
});
