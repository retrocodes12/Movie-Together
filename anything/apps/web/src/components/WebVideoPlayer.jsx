"use client";
import { useRef, useState, useEffect, useCallback } from "react";

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

export default function WebVideoPlayer({
  contentUrl,
  isHost,
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onSkipForward,
  onSkipBackward,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const controlsTimerRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(null);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const lastSyncRef = useRef(null);
  const syncInProgressRef = useRef(false);

  // ── Sync from server playbackState ──────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackState || syncInProgressRef.current) return;
    const ps = playbackState;
    const serverPos =
      (ps.position || 0) +
      (ps.status === "playing" && ps.updated_at
        ? (Date.now() - new Date(ps.updated_at).getTime()) / 1000
        : 0);
    const drift = Math.abs(v.currentTime - serverPos);
    if (drift > 2) {
      syncInProgressRef.current = true;
      v.currentTime = serverPos;
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 800);
    }
    if (ps.status === "playing" && v.paused && !isHost) {
      v.play().catch(() => {});
    } else if (ps.status !== "playing" && !v.paused && !isHost) {
      v.pause();
    }
    if (ps.speed && ps.speed !== v.playbackRate) v.playbackRate = ps.speed;
  }, [playbackState, isHost]);

  // ── Auto-hide controls ───────────────────────────────────────────
  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    return () => clearTimeout(controlsTimerRef.current);
  }, [playing]);

  // ── Video events ──────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = (e, fn) => v.addEventListener(e, fn);
    const off = (e, fn) => v.removeEventListener(e, fn);

    const onPlay = () => setPlaying(true);
    const onPauseEv = () => setPlaying(false);
    const onTime = () => {
      if (!isSeeking) setCurrentTime(v.currentTime);
    };
    const onDur = () => setDuration(v.duration || 0);
    const onBuf = () => {
      if (v.buffered.length > 0)
        setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onWait = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onErr = () => setError("Stream could not be loaded. Check the URL.");
    const onFullSc = () => setFullscreen(!!document.fullscreenElement);

    on("play", onPlay);
    on("pause", onPauseEv);
    on("timeupdate", onTime);
    on("durationchange", onDur);
    on("progress", onBuf);
    on("waiting", onWait);
    on("playing", onPlaying);
    on("error", onErr);
    document.addEventListener("fullscreenchange", onFullSc);
    return () => {
      off("play", onPlay);
      off("pause", onPauseEv);
      off("timeupdate", onTime);
      off("durationchange", onDur);
      off("progress", onBuf);
      off("waiting", onWait);
      off("playing", onPlaying);
      off("error", onErr);
      document.removeEventListener("fullscreenchange", onFullSc);
    };
  }, [isSeeking]);

  // ── Load new URL ──────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !contentUrl) return;
    setError(null);
    setRetries(0);
    v.src = contentUrl;
    v.load();
  }, [contentUrl]);

  // ── Controls ──────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!isHost) return;
    const v = videoRef.current;
    if (v.paused) {
      v.play().catch(() => {});
      onPlay?.(v.currentTime);
    } else {
      v.pause();
      onPause?.(v.currentTime);
    }
  };

  const handleSkipBack = () => {
    if (!isHost) return;
    const v = videoRef.current;
    const t = Math.max(0, v.currentTime - 10);
    v.currentTime = t;
    onSeek?.(t);
    onSkipBackward?.();
  };

  const handleSkipFwd = () => {
    if (!isHost) return;
    const v = videoRef.current;
    const t = Math.min(duration, v.currentTime + 10);
    v.currentTime = t;
    onSeek?.(t);
    onSkipForward?.();
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setMuted(vol === 0);
    if (videoRef.current) videoRef.current.volume = vol;
  };

  const handleMuteToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
  };

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const handleSpeedChange = (s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSettings(false);
  };

  // ── Seek bar ──────────────────────────────────────────────────────
  const getSeekPos = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width)) * duration;
  };

  const handleProgressDown = (e) => {
    if (!isHost || !duration) return;
    e.preventDefault();
    setIsSeeking(true);
    const pos = getSeekPos(e);
    setSeekPreview(pos);
  };

  const handleProgressMove = (e) => {
    if (!isSeeking || !isHost) return;
    const pos = getSeekPos(e);
    setSeekPreview(pos);
    if (videoRef.current) videoRef.current.currentTime = pos;
  };

  const handleProgressUp = (e) => {
    if (!isSeeking) return;
    const pos = getSeekPos(e);
    setIsSeeking(false);
    setSeekPreview(null);
    if (videoRef.current) videoRef.current.currentTime = pos;
    onSeek?.(pos);
  };

  useEffect(() => {
    if (!isSeeking) return;
    const onUp = (e) => handleProgressUp(e);
    const onMove = (e) => handleProgressMove(e);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isSeeking, duration]);

  const displayTime =
    isSeeking && seekPreview !== null ? seekPreview : currentTime;
  const progress = duration > 0 ? displayTime / duration : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  if (!contentUrl) {
    return (
      <div
        style={{
          background: "#000",
          aspectRatio: "16/9",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
        <div style={{ color: "#4B5563", fontSize: 15, fontWeight: 500 }}>
          No stream URL set
        </div>
        {isHost && (
          <div
            style={{
              color: "#374151",
              fontSize: 12,
              marginTop: 6,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            Use the Content tab to paste a stream URL (HLS, DASH, or MP4)
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        background: "#000",
        aspectRatio: fullscreen ? undefined : "16/9",
        width: "100%",
        borderRadius: fullscreen ? 0 : 12,
        overflow: "hidden",
        userSelect: "none",
      }}
      onMouseMove={showCtrl}
      onMouseLeave={() => {
        if (playing) setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
        }}
        crossOrigin="anonymous"
        playsInline
        onClick={handlePlayPause}
      />

      {/* Buffering overlay */}
      {buffering && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid rgba(255,255,255,0.2)",
              borderTopColor: "#3B82F6",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.85)",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <div style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 6 }}>
            Playback Error
          </div>
          <div
            style={{
              color: "#6B7280",
              fontSize: 13,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
          <button
            onClick={() => {
              setError(null);
              setRetries((r) => r + 1);
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }}
            style={{
              padding: "9px 20px",
              background: "#2563EB",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ↺ Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: showControls
            ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 40%)"
            : "transparent",
          transition: "opacity 0.3s",
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "all" : "none",
        }}
      >
        {/* Seeking preview */}
        {isSeeking && seekPreview !== null && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: "rgba(0,0,0,0.8)",
              borderRadius: 10,
              padding: "12px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>
              {fmt(seekPreview)}
            </div>
          </div>
        )}

        {/* Speed badge */}
        {speed !== 1 && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              background: "rgba(0,0,0,0.7)",
              borderRadius: 6,
              padding: "3px 9px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {speed}×
          </div>
        )}

        {/* Settings button */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={() => setShowSettings((s) => !s)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Settings"
          >
            ⚙️
          </button>
          <button
            onClick={handleFullscreen}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Fullscreen"
          >
            {fullscreen ? "⊙" : "⛶"}
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div
            style={{
              position: "absolute",
              top: 54,
              right: 14,
              background: "#1E293B",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              padding: 16,
              minWidth: 200,
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#64748B",
                marginBottom: 10,
                letterSpacing: 0.5,
              }}
            >
              PLAYBACK SPEED
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    background: speed === s ? "#2563EB" : "transparent",
                    color: speed === s ? "#fff" : "#94A3B8",
                    border:
                      speed === s ? "1px solid #2563EB" : "1px solid #334155",
                  }}
                >
                  {s === 1 ? "Normal" : `${s}×`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Center controls */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* Skip back */}
          <button
            onClick={handleSkipBack}
            style={{
              background: "none",
              color: "#fff",
              opacity: isHost ? 1 : 0.35,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
            title="Back 10s"
          >
            <span style={{ fontSize: 24 }}>⏮</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>10s</span>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: isHost ? "rgba(37,99,235,0.9)" : "rgba(55,65,81,0.7)",
              color: "#fff",
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isHost ? 1 : 0.5,
            }}
          >
            {buffering ? (
              <span
                style={{
                  width: 22,
                  height: 22,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  display: "block",
                }}
              />
            ) : playing ? (
              "⏸"
            ) : (
              "▶"
            )}
          </button>

          {/* Skip forward */}
          <button
            onClick={handleSkipFwd}
            style={{
              background: "none",
              color: "#fff",
              opacity: isHost ? 1 : 0.35,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
            title="Forward 10s"
          >
            <span style={{ fontSize: 24 }}>⏭</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>10s</span>
          </button>
        </div>

        {/* Bottom controls */}
        <div style={{ padding: "0 14px 12px" }}>
          {/* Progress bar */}
          <div
            ref={progressRef}
            onMouseDown={handleProgressDown}
            style={{
              height: 20,
              display: "flex",
              alignItems: "center",
              cursor: isHost ? "pointer" : "default",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                flex: 1,
                height: isSeeking ? 5 : 3,
                borderRadius: 3,
                background: "rgba(255,255,255,0.2)",
                position: "relative",
                overflow: "visible",
                transition: "height 0.1s",
              }}
            >
              {/* Buffered */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.1)",
                  width: `${bufPct}%`,
                }}
              />
              {/* Played */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 3,
                  background: "#3B82F6",
                  width: `${progress * 100}%`,
                }}
              />
              {/* Thumb */}
              {isHost && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${progress * 100}%`,
                    transform: "translate(-50%,-50%)",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: isSeeking ? "#fff" : "#3B82F6",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                  }}
                />
              )}
            </div>
          </div>

          {/* Time + volume + fullscreen row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Play/pause small */}
            <button
              onClick={handlePlayPause}
              style={{ color: "#fff", fontSize: 16, opacity: isHost ? 1 : 0.4 }}
            >
              {playing ? "⏸" : "▶"}
            </button>

            {/* Volume */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={handleMuteToggle}
                style={{ color: "#fff", fontSize: 15 }}
              >
                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              {showVolumeSlider && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{ width: 70, accentColor: "#3B82F6" }}
                />
              )}
            </div>

            {/* Time */}
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
              {fmt(displayTime)}
              {duration > 0 && (
                <span style={{ color: "#6B7280" }}> / {fmt(duration)}</span>
              )}
            </span>

            <div style={{ flex: 1 }} />

            {!isHost && (
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                Host controls playback
              </span>
            )}

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              style={{ color: "#fff", fontSize: 16 }}
            >
              {fullscreen ? "⊙" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
