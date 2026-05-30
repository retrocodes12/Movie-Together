/**
 * PlayerController — adapted from NuvioMedia/NuvioWeb playerController.js
 * Browser-only version. WebOS/Tizen/AvPlay stripped out.
 * Manages engine lifecycle: native → hls.js → dash.js
 */
import { nativeVideoEngine } from "./engines/nativeVideoEngine.js";
import { hlsJsEngine } from "./engines/hlsJsEngine.js";
import { dashJsEngine } from "./engines/dashJsEngine.js";
import { watchProgressRepository } from "./watchProgressRepository.js";
import { loadHlsJs, loadDashJs } from "./loadStreamingLibs.js";

const PROGRESS_SAVE_INTERVAL_MS = 5000;

export const PlayerController = {
  video: null,
  hlsInstance: null,
  dashInstance: null,
  playbackEngine: "none",

  currentVideoId: null,
  currentPlaybackUrl: "",
  currentPlaybackHeaders: {},
  currentPlaybackMediaSourceType: null,
  externalSubtitleUrl: null,
  externalSubtitleLabel: null,

  isPlaying: false,
  playRequestToken: 0,
  progressSaveTimer: null,
  lastSavedTime: 0,

  /* ── Engine selection ───────────────────────────────────────── */
  isExpectedPlayInterruption(error) {
    const message = String(error?.message || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();
    return (
      name === "aborterror" ||
      message.includes("interrupted by a new load request") ||
      message.includes("the play() request was interrupted")
    );
  },

  _handlePlayError(err, onError) {
    if (!err || this.isExpectedPlayInterruption(err)) return;
    if (err.name === "NotAllowedError") {
      this.isPlaying = false;
      return;
    }
    onError?.({
      code: err.name || "playback_start_failed",
      message: err.message || "Playback failed while starting.",
      fatal: false,
      raw: err,
    });
  },

  normalizeMimeType(mimeType) {
    return String(mimeType || "")
      .toLowerCase()
      .split(";")[0]
      .trim();
  },

  guessMediaMimeType(url) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    const inferByPath = (pathname = "", search = null) => {
      const path = String(pathname || "").toLowerCase();
      const formatHint = String(
        search?.get?.("format") ||
        search?.get?.("type") ||
        search?.get?.("mime") ||
        search?.get?.("output") ||
        ""
      ).toLowerCase();
      if (path.endsWith(".m3u8")) {
        return "application/vnd.apple.mpegurl";
      }
      if (path.endsWith(".mpd")) {
        return "application/dash+xml";
      }
      if (path.includes(".ism/manifest") || path.includes(".isml/manifest")) {
        return "application/vnd.ms-sstr+xml";
      }
      if (formatHint === "m3u8" || formatHint === "hls") {
        return "application/vnd.apple.mpegurl";
      }
      if (formatHint === "mpd" || formatHint === "dash") {
        return "application/dash+xml";
      }
      if (path.includes("/playlist")) {
        return "application/vnd.apple.mpegurl";
      }
      const extensionMatch = path.match(
        /\.(mp4|m4v|mov|webm|mkv|avi|wmv|ts|m2ts|mpg|mpeg|3gp|mp3|aac|flac)(?=($|[/?#&]))/i,
      );
      if (extensionMatch) {
        const extension = String(extensionMatch[1] || "").toLowerCase();
        const directMimeMap = {
          "3gp": "video/3gpp",
          aac: "audio/aac",
          avi: "video/x-msvideo",
          flac: "audio/flac",
          m2ts: "video/mp2t",
          m4v: "video/mp4",
          mkv: "video/x-matroska",
          mov: "video/quicktime",
          mp3: "audio/mpeg",
          mp4: "video/mp4",
          mpeg: "video/mpeg",
          mpg: "video/mpeg",
          ts: "video/mp2t",
          webm: "video/webm",
          wmv: "video/x-ms-wmv",
        };
        return directMimeMap[extension] || null;
      }
      return null;
    };
    try {
      const parsed = new URL(raw);
      return inferByPath(parsed.pathname, parsed.searchParams);
    } catch (_) {
      return inferByPath(raw, null);
    }
  },

  isHlsMime(mime) {
    const n = this.normalizeMimeType(mime);
    return (
      n === "application/vnd.apple.mpegurl" ||
      n === "application/x-mpegurl" ||
      n === "audio/mpegurl" ||
      n === "audio/x-mpegurl"
    );
  },

  isDashMime(mime) {
    return this.normalizeMimeType(mime) === "application/dash+xml";
  },

  canPlayNatively(mimeType) {
    return this.video ? nativeVideoEngine.canPlay(this.video, mimeType) : false;
  },

  canUseHlsJs() {
    return hlsJsEngine.isSupported();
  },

  canUseDashJs() {
    return dashJsEngine.isSupported();
  },

  isLikelySmoothStreamingMimeType(mimeType) {
    return this.normalizeMimeType(mimeType) === "application/vnd.ms-sstr+xml";
  },

  /* ── Teardown ───────────────────────────────────────────────── */
  _destroyHls() {
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch (_) {}
      this.hlsInstance = null;
    }
  },

  _destroyDash() {
    if (this.dashInstance) {
      try {
        this.dashInstance.reset?.();
        this.dashInstance.destroy?.();
      } catch (_) {}
      this.dashInstance = null;
    }
  },

  destroy() {
    this._destroyHls();
    this._destroyDash();
    this._stopProgressSave();
    if (this.video) {
      this.video.removeAttribute("src");
      this.video.load();
    }
    this.playbackEngine = "none";
    this.isPlaying = false;
    this.currentPlaybackUrl = "";
    this.currentVideoId = null;
    this.playRequestToken += 1;
  },

  /* ── Progress saving ────────────────────────────────────────── */
  _startProgressSave(videoId, roomId) {
    this._stopProgressSave();
    this.progressSaveTimer = setInterval(() => {
      if (!this.video || !videoId) return;
      watchProgressRepository.save({
        videoId,
        currentTime: this.video.currentTime,
        duration: this.video.duration,
        roomId,
      });
    }, PROGRESS_SAVE_INTERVAL_MS);
  },

  _stopProgressSave() {
    if (this.progressSaveTimer) {
      clearInterval(this.progressSaveTimer);
      this.progressSaveTimer = null;
    }
  },

  /* ── Subtitle track injection ───────────────────────────────── */
  _addExternalSubtitleTrack(url, label = "Subtitles") {
    if (!this.video || !url) return;
    // Remove existing external subtitle tracks
    Array.from(this.video.querySelectorAll("track[data-external]")).forEach(
      (t) => t.remove(),
    );
    const track = document.createElement("track");
    track.src = url;
    track.kind = "subtitles";
    track.label = label;
    track.srclang = "und";
    track.default = true;
    track.setAttribute("data-external", "1");
    this.video.appendChild(track);
    // Wait for load then enable
    setTimeout(() => {
      const tracks = Array.from(this.video.textTracks || []);
      const t = tracks.find((t) => t.label === label);
      if (t) t.mode = "showing";
    }, 300);
  },

  /* ── Main load function ─────────────────────────────────────── */
  async load({
    url,
    mimeType,
    headers = {},
    videoId,
    roomId,
    subtitleUrl,
    subtitleLabel,
    autoPlay = true,
    startTime = 0,
    onEngineReady,
    onError,
  }) {
    if (!this.video || !url) return;

    const token = ++this.playRequestToken;
    const isStale = () => token !== this.playRequestToken;

    this._destroyHls();
    this._destroyDash();
    this._stopProgressSave();

    this.currentPlaybackUrl = url;
    this.currentPlaybackHeaders = headers;
    this.currentVideoId = videoId || url;
    this.externalSubtitleUrl = subtitleUrl || null;

    const resolvedMime = mimeType || this.guessMediaMimeType(url);

    // ── Attempt order: HLS → DASH → native ─────────────────────
    const isHls = resolvedMime
      ? this.isHlsMime(resolvedMime)
      : url.includes(".m3u8");
    const isDash = resolvedMime
      ? this.isDashMime(resolvedMime)
      : url.includes(".mpd");

    let engineOk = false;

    // 1. HLS via hls.js
    if (isHls && !this.canPlayNatively(resolvedMime)) {
      try {
        await loadHlsJs();
        if (isStale()) return;
        if (hlsJsEngine.isSupported()) {
          this._loadViaHls(
            url,
            headers,
            startTime,
            autoPlay,
            videoId,
            roomId,
            subtitleUrl,
            subtitleLabel,
            onEngineReady,
            onError,
          );
          engineOk = true;
        }
      } catch (_) {}
    }

    // 2. HLS natively (Safari)
    if (!engineOk && isHls && this.canPlayNatively(resolvedMime)) {
      this._loadViaNative(
        url,
        resolvedMime,
        startTime,
        autoPlay,
        videoId,
        roomId,
        subtitleUrl,
        subtitleLabel,
        onEngineReady,
        onError,
      );
      engineOk = true;
    }

    // 3. DASH via dash.js
    if (!engineOk && isDash) {
      try {
        await loadDashJs();
        if (isStale()) return;
        if (dashJsEngine.isSupported()) {
          this._loadViaDash(
            url,
            startTime,
            autoPlay,
            videoId,
            roomId,
            subtitleUrl,
            subtitleLabel,
            onEngineReady,
            onError,
          );
          engineOk = true;
        }
      } catch (_) {}
    }

    // 4. Native fallback
    if (!engineOk) {
      this._loadViaNative(
        url,
        resolvedMime,
        startTime,
        autoPlay,
        videoId,
        roomId,
        subtitleUrl,
        subtitleLabel,
        onEngineReady,
        onError,
      );
    }
  },

  _loadViaNative(
    url,
    mimeType,
    startTime,
    autoPlay,
    videoId,
    roomId,
    subtitleUrl,
    subtitleLabel,
    onEngineReady,
    onError,
  ) {
    this.playbackEngine = "native";
    nativeVideoEngine.load(this.video, url, mimeType);

    const attachPlay = () => {
      if (!autoPlay) return;
      this.video.play().catch((err) => this._handlePlayError(err, onError));
    };

    if (startTime > 2) {
      const onCanPlay = () => {
        this.video.removeEventListener("canplay", onCanPlay);
        this.video.currentTime = startTime;
        attachPlay();
      };
      this.video.addEventListener("canplay", onCanPlay);
    } else if (autoPlay) {
      const onCanPlay = () => {
        this.video.removeEventListener("canplay", onCanPlay);
        attachPlay();
      };
      this.video.addEventListener("canplay", onCanPlay);
    }

    if (subtitleUrl) this._addExternalSubtitleTrack(subtitleUrl, subtitleLabel);
    this._startProgressSave(videoId, roomId);
    onEngineReady?.("native");
  },

  _loadViaHls(
    url,
    headers,
    startTime,
    autoPlay,
    videoId,
    roomId,
    subtitleUrl,
    subtitleLabel,
    onEngineReady,
    onError,
  ) {
    this.playbackEngine = "hls.js";
    let fallbackTried = false;
    const xhrSetup =
      Object.keys(headers || {}).length > 0
        ? (xhr) => {
            Object.entries(headers).forEach(([k, v]) => {
              try {
                xhr.setRequestHeader(k, v);
              } catch (_) {}
            });
          }
        : undefined;

    const hls = hlsJsEngine.create(xhrSetup ? { xhrSetup } : {});
    if (!hls) {
      this._loadViaNative(
        url,
        null,
        startTime,
        autoPlay,
        videoId,
        roomId,
        subtitleUrl,
        subtitleLabel,
        onEngineReady,
        onError,
      );
      return;
    }

    this.hlsInstance = hls;
    hls.loadSource(url);
    hls.attachMedia(this.video);

    hls.on(
      globalThis.Hls?.Events?.MANIFEST_PARSED || "hlsManifestParsed",
      () => {
        if (startTime > 2) this.video.currentTime = startTime;
        if (autoPlay)
          this.video.play().catch((err) => this._handlePlayError(err, onError));
        if (subtitleUrl)
          this._addExternalSubtitleTrack(subtitleUrl, subtitleLabel);
        this._startProgressSave(videoId, roomId);
        onEngineReady?.("hls.js", hls);
      },
    );

    hls.on(globalThis.Hls?.Events?.ERROR || "hlsError", (event, data) => {
      if (data?.fatal) {
        if (data.type === globalThis.Hls?.ErrorTypes?.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch (_) {}
        }
        if (data.type === globalThis.Hls?.ErrorTypes?.NETWORK_ERROR) {
          try {
            hls.startLoad();
            return;
          } catch (_) {}
        }
        if (!fallbackTried) {
          fallbackTried = true;
          this._destroyHls();
          this._loadViaNative(
            url,
            null,
            startTime,
            autoPlay,
            videoId,
            roomId,
            subtitleUrl,
            subtitleLabel,
            onEngineReady,
            onError,
          );
          return;
        }
        const msg =
          data.type === "networkError"
            ? "HLS network error — check the stream URL or CORS headers."
            : data.type === "mediaError"
              ? "HLS media decode error."
              : "HLS stream failed.";
        onError?.({ code: data.type, message: msg, fatal: true, raw: data });
      }
    });
  },

  _loadViaDash(
    url,
    startTime,
    autoPlay,
    videoId,
    roomId,
    subtitleUrl,
    subtitleLabel,
    onEngineReady,
    onError,
  ) {
    this.playbackEngine = "dash.js";
    let fallbackTried = false;
    const player = dashJsEngine.createPlayer();
    if (!player) {
      this._loadViaNative(
        url,
        null,
        startTime,
        autoPlay,
        videoId,
        roomId,
        subtitleUrl,
        subtitleLabel,
        onEngineReady,
        onError,
      );
      return;
    }

    this.dashInstance = player;
    player.updateSettings({
      streaming: { buffer: { fastSwitchEnabled: true } },
    });
    dashJsEngine.initialize(player, this.video, url, false);

    const events = dashJsEngine.getEvents();
    player.on(events.STREAM_INITIALIZED || "streamInitialized", () => {
      if (startTime > 2) this.video.currentTime = startTime;
      if (autoPlay)
        this.video.play().catch((err) => this._handlePlayError(err, onError));
      if (subtitleUrl)
        this._addExternalSubtitleTrack(subtitleUrl, subtitleLabel);
      this._startProgressSave(videoId, roomId);
      onEngineReady?.("dash.js", player);
    });

    player.on(events.ERROR || "error", (e) => {
      if (!fallbackTried) {
        fallbackTried = true;
        this._destroyDash();
        this._loadViaNative(
          url,
          null,
          startTime,
          autoPlay,
          videoId,
          roomId,
          subtitleUrl,
          subtitleLabel,
          onEngineReady,
          onError,
        );
        return;
      }
      onError?.({
        code: "dash_error",
        message: "DASH stream error. Check the manifest URL.",
        fatal: true,
        raw: e,
      });
    });
  },

  /* ── Playback controls ──────────────────────────────────────── */
  play() {
    if (!this.video) return;
    this.video
      .play()
      .then(() => {
        this.isPlaying = true;
      })
      .catch(() => {
        this.isPlaying = false;
      });
  },

  pause() {
    if (!this.video) return;
    this.video.pause();
    this.isPlaying = false;
  },

  seek(time) {
    if (!this.video) return;
    const t = Math.max(0, Number(time) || 0);
    this.video.currentTime = t;
  },

  setVolume(vol) {
    if (!this.video) return;
    this.video.volume = Math.max(0, Math.min(1, vol));
    this.video.muted = vol === 0;
  },

  setMuted(muted) {
    if (!this.video) return;
    this.video.muted = muted;
  },

  setSpeed(speed) {
    if (!this.video) return;
    this.video.playbackRate = speed;
    if (this.hlsInstance)
      this.hlsInstance.config && (this.hlsInstance.playbackRate = speed);
  },

  setFullscreen(el) {
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },

  getCurrentTime() {
    return this.video?.currentTime || 0;
  },

  getDuration() {
    return this.video?.duration || 0;
  },

  /* ── Audio / subtitle tracks ────────────────────────────────── */
  getAudioTracks() {
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      return hlsJsEngine
        .getAudioTracks(this.hlsInstance)
        .map((t, i) => ({
          index: i,
          label: t.name || t.lang || `Audio ${i + 1}`,
          lang: t.lang,
        }));
    }
    if (this.playbackEngine === "dash.js" && this.dashInstance) {
      return dashJsEngine
        .getAudioTracks(this.dashInstance)
        .map((t, i) => ({
          index: i,
          label: t.labels?.[0]?.text || t.lang || `Audio ${i + 1}`,
          lang: t.lang,
        }));
    }
    // Native audio tracks
    try {
      const tracks = this.video?.audioTracks;
      if (tracks?.length)
        return Array.from(tracks).map((t, i) => ({
          index: i,
          label: t.label || t.language || `Audio ${i + 1}`,
          lang: t.language,
        }));
    } catch (_) {}
    return [];
  },

  setAudioTrack(index) {
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      hlsJsEngine.setAudioTrack(this.hlsInstance, index);
    } else if (this.playbackEngine === "dash.js" && this.dashInstance) {
      const tracks = dashJsEngine.getAudioTracks(this.dashInstance);
      if (tracks[index])
        dashJsEngine.setAudioTrack(this.dashInstance, tracks[index]);
    }
  },

  getSubtitleTracks() {
    const result = [];
    if (this.externalSubtitleUrl) {
      result.push({
        index: -99,
        label: this.externalSubtitleLabel || "Subtitles",
        external: true,
      });
    }
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      hlsJsEngine.getSubtitleTracks(this.hlsInstance).forEach((t, i) => {
        result.push({
          index: i,
          label: t.name || t.lang || `Sub ${i + 1}`,
          lang: t.lang,
        });
      });
    }
    // Native text tracks
    try {
      Array.from(this.video?.textTracks || []).forEach((t, i) => {
        if (t.kind === "subtitles" || t.kind === "captions") {
          result.push({
            index: i,
            label: t.label || t.language || `Sub ${i + 1}`,
            lang: t.language,
            native: true,
          });
        }
      });
    } catch (_) {}
    return result;
  },

  setSubtitleTrack(index, native = false) {
    if (index === -99) {
      // Toggle external track
      if (this.externalSubtitleUrl)
        this._addExternalSubtitleTrack(
          this.externalSubtitleUrl,
          this.externalSubtitleLabel,
        );
      return;
    }
    if (index === -1) {
      // Disable all
      try {
        Array.from(this.video?.textTracks || []).forEach((t) => {
          t.mode = "hidden";
        });
      } catch (_) {}
      if (this.playbackEngine === "hls.js" && this.hlsInstance)
        hlsJsEngine.setSubtitleTrack(this.hlsInstance, -1);
      return;
    }
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      hlsJsEngine.setSubtitleTrack(this.hlsInstance, index);
    } else if (native) {
      try {
        Array.from(this.video?.textTracks || []).forEach((t, i) => {
          t.mode = i === index ? "showing" : "hidden";
        });
      } catch (_) {}
    } else if (this.playbackEngine === "dash.js" && this.dashInstance) {
      dashJsEngine.setTextTrack(this.dashInstance, index);
    }
  },

  getQualityLevels() {
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      return hlsJsEngine.getLevels(this.hlsInstance).map((l, i) => ({
        index: i,
        label: l.height ? `${l.height}p` : `Level ${i + 1}`,
        height: l.height,
        bitrate: l.bitrate,
      }));
    }
    return [];
  },

  setQualityLevel(index) {
    if (this.playbackEngine === "hls.js" && this.hlsInstance) {
      hlsJsEngine.setLevel(this.hlsInstance, index);
    }
  },
};
