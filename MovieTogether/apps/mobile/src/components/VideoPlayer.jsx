/**
 * VideoPlayer.jsx
 *
 * Production video player for MovieTogether.
 *
 * Features:
 *  - HLS, DASH, MP4 via expo-video (AVPlayer on iOS, ExoPlayer on Android)
 *  - Custom controls overlay (play/pause/seek/skip/fullscreen/settings)
 *  - Progress bar with live drag seeking
 *  - Subtitle overlay (WebVTT / SRT parsed client-side)
 *  - Audio track selector
 *  - Buffer + loading indicators
 *  - Error recovery with retry
 *  - Host/guest mode — guests see the player but cannot operate controls
 *  - Integrates with useVideoSync bridge
 */

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertCircle,
  Music,
} from "lucide-react-native";
import { fetchAndParseSubtitles, getActiveCue } from "@/utils/subtitleParser";
import { useVideoSync } from "@/utils/useVideoSync";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SubtitleOverlay({ cue }) {
  if (!cue) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 64,
        left: 16,
        right: 16,
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.75)",
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          maxWidth: "90%",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 15,
            fontFamily: "Inter_400Regular",
            textAlign: "center",
            lineHeight: 22,
            textShadowColor: "rgba(0,0,0,0.8)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          }}
        >
          {cue.text}
        </Text>
      </View>
    </View>
  );
}

function SettingsModal({
  visible,
  onClose,
  subtitleUrl,
  onSubtitleChange,
  speed,
  onSpeedChange,
  audioTracks,
  selectedAudioTrack,
  onAudioTrackChange,
}) {
  const [localUrl, setLocalUrl] = useState(subtitleUrl || "");
  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: "#1A1A2E",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 24,
                paddingBottom: 40,
                maxHeight: "80%",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Playback Settings
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>Done</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Speed */}
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "Inter_500Medium",
                    marginBottom: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  PLAYBACK SPEED
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 24,
                  }}
                >
                  {SPEEDS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => onSpeedChange(s)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor:
                          speed === s ? "#2563EB" : "transparent",
                        borderColor: speed === s ? "#2563EB" : "#374151",
                      }}
                    >
                      <Text
                        style={{
                          color: speed === s ? "#fff" : "#9CA3AF",
                          fontFamily: "Inter_500Medium",
                          fontSize: 13,
                        }}
                      >
                        {s === 1.0 ? "Normal" : `${s}×`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Audio Tracks */}
                {audioTracks && audioTracks.length > 1 && (
                  <>
                    <Text
                      style={{
                        color: "#9CA3AF",
                        fontSize: 12,
                        fontFamily: "Inter_500Medium",
                        marginBottom: 10,
                        letterSpacing: 0.5,
                      }}
                    >
                      AUDIO TRACK
                    </Text>
                    <View style={{ gap: 6, marginBottom: 24 }}>
                      {audioTracks.map((track, idx) => (
                        <TouchableOpacity
                          key={track.id || idx}
                          onPress={() => onAudioTrackChange(track)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            padding: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            backgroundColor:
                              selectedAudioTrack?.id === track.id
                                ? "rgba(37,99,235,0.15)"
                                : "transparent",
                            borderColor:
                              selectedAudioTrack?.id === track.id
                                ? "#2563EB"
                                : "#374151",
                          }}
                        >
                          <Music
                            size={14}
                            color={
                              selectedAudioTrack?.id === track.id
                                ? "#3B82F6"
                                : "#9CA3AF"
                            }
                          />
                          <Text
                            style={{
                              color: "#fff",
                              fontFamily: "Inter_400Regular",
                              fontSize: 14,
                            }}
                          >
                            {track.label ||
                              track.language ||
                              `Track ${idx + 1}`}
                          </Text>
                          {selectedAudioTrack?.id === track.id && (
                            <View
                              style={{
                                marginLeft: "auto",
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: "#3B82F6",
                              }}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Subtitles */}
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 12,
                    fontFamily: "Inter_500Medium",
                    marginBottom: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  SUBTITLES (WebVTT / SRT URL)
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#0F172A",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#374151",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: localUrl ? "#fff" : "#4B5563",
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                      }}
                      onPress={() => {}}
                    >
                      {localUrl || "Paste subtitle URL..."}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onSubtitleChange(localUrl)}
                    style={{
                      backgroundColor: "#2563EB",
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13,
                      }}
                    >
                      Load
                    </Text>
                  </TouchableOpacity>
                </View>
                {localUrl ? (
                  <TouchableOpacity
                    onPress={() => {
                      setLocalUrl("");
                      onSubtitleChange("");
                    }}
                  >
                    <Text
                      style={{
                        color: "#EF4444",
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                      }}
                    >
                      Clear subtitles
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Main VideoPlayer ────────────────────────────────────────────────────────

export default function VideoPlayer({
  contentUrl,
  contentHeaders,
  isHost,
  playbackState, // authoritative from roomSync
  onPlay,
  onPause,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onChangeContent,
  style,
}) {
  const insets = useSafeAreaInsets();
  const videoViewRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressBarWidth = useRef(SCREEN_W);
  const controlsTimer = useRef(null);

  // ── Player setup ──────────────────────────────────────────────────────────

  const contentSource = useMemo(
    () =>
      contentUrl
        ? {
            uri: contentUrl,
            ...(contentHeaders ? { headers: contentHeaders } : {}),
          }
        : null,
    [contentUrl, contentHeaders],
  );

  const player = useVideoPlayer(
    contentSource,
    (p) => {
      p.playbackRate = playbackState?.speed || 1.0;
      p.allowsExternalPlayback = true;
    },
  );

  // ── Player events ─────────────────────────────────────────────────────────

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime ?? 0,
  });

  const duration = player.duration || 0;
  const isBuffering = status === "loading";
  const hasError = status === "error";
  const isReady = status === "readyToPlay";

  // ── UI state ──────────────────────────────────────────────────────────────

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [speed, setSpeed] = useState(playbackState?.speed || 1.0);
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // ── Sync bridge ───────────────────────────────────────────────────────────

  const videoSync = useVideoSync({
    player,
    playbackState,
    isHost,
    onPlay,
    onPause,
    onSeek,
    onSkipForward,
    onSkipBackward,
    onChangeContent,
  });

  // ── Controls auto-hide ────────────────────────────────────────────────────

  const scheduleHideControls = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying && !isSeeking && !showSettings) {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }
    }, 3500);
  }, [isPlaying, isSeeking, showSettings, controlsOpacity]);

  const showControlsNow = useCallback(() => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    scheduleHideControls();
  }, [controlsOpacity, scheduleHideControls]);

  useEffect(() => {
    if (isPlaying) scheduleHideControls();
    else showControlsNow();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [isPlaying]);

  // ── Error recovery ────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "error") {
      const msg = player.error?.message || "Playback failed";
      setErrorMsg(msg);
      // Auto-retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1500;
        setTimeout(() => {
          try {
            if (contentSource) player.replace(contentSource);
            setRetryCount((c) => c + 1);
          } catch {}
        }, delay);
      }
    } else if (status === "readyToPlay") {
      setRetryCount(0);
      setErrorMsg("");
    }
  }, [status]);

  // ── Audio tracks ──────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const tracks = player.availableAudioTracks ?? [];
      setAudioTracks(tracks);
      if (tracks.length > 0 && !selectedAudioTrack) {
        setSelectedAudioTrack(tracks[0]);
      }
    } catch {}
  }, [isReady]);

  const handleAudioTrackChange = useCallback(
    (track) => {
      setSelectedAudioTrack(track);
      try {
        player.audioTrack = track;
      } catch {}
      setShowSettings(false);
    },
    [player],
  );

  // ── Subtitles ─────────────────────────────────────────────────────────────

  const handleSubtitleChange = useCallback(async (url) => {
    setSubtitleUrl(url);
    if (!url) {
      setSubtitleCues([]);
      return;
    }
    const cues = await fetchAndParseSubtitles(url);
    setSubtitleCues(cues);
  }, []);

  const activeCue = useMemo(
    () => getActiveCue(subtitleCues, currentTime),
    [subtitleCues, currentTime],
  );

  // ── Speed ─────────────────────────────────────────────────────────────────

  const handleSpeedChange = useCallback(
    (s) => {
      setSpeed(s);
      try {
        player.playbackRate = s;
      } catch {}
      setShowSettings(false);
    },
    [player],
  );

  // ── Mute ──────────────────────────────────────────────────────────────────

  const handleMuteToggle = useCallback(() => {
    try {
      const next = !isMuted;
      player.muted = next;
      setIsMuted(next);
    } catch {}
  }, [player, isMuted]);

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const handleFullscreenToggle = useCallback(async () => {
    try {
      if (isFullscreen) {
        await videoViewRef.current?.exitFullscreen();
      } else {
        await videoViewRef.current?.enterFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  }, [isFullscreen]);

  // ── Progress bar drag ─────────────────────────────────────────────────────

  const getPositionFromTouch = (e) => {
    const x = e.nativeEvent.locationX;
    const ratio = clamp(x / progressBarWidth.current, 0, 1);
    return ratio * duration;
  };

  const handleProgressResponderGrant = (e) => {
    if (!isHost) return;
    setIsSeeking(true);
    showControlsNow();
    const pos = getPositionFromTouch(e);
    setSeekPosition(pos);
  };

  const handleProgressResponderMove = (e) => {
    if (!isHost || !isSeeking) return;
    const pos = getPositionFromTouch(e);
    setSeekPosition(pos);
    // Optimistic visual — sync to player when released
    try {
      player.currentTime = pos;
    } catch {}
  };

  const handleProgressResponderRelease = (e) => {
    if (!isHost) return;
    const pos = getPositionFromTouch(e);
    setIsSeeking(false);
    videoSync.handleSeek(pos);
    scheduleHideControls();
  };

  // ── Retry handler ─────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setErrorMsg("");
    try {
      if (contentSource) player.replace(contentSource);
    } catch {}
  }, [player, contentSource]);

  // ── Content URL change ────────────────────────────────────────────────────

  useEffect(() => {
    if (!contentUrl) return;
    try {
      if (contentSource) player.replace(contentSource);
    } catch {}
  }, [contentUrl, contentSource]);

  // ── Render progress ───────────────────────────────────────────────────────

  const progress =
    duration > 0
      ? clamp((isSeeking ? seekPosition : currentTime) / duration, 0, 1)
      : 0;

  const displayTime = isSeeking ? seekPosition : currentTime;

  // ── No content state ──────────────────────────────────────────────────────

  if (!contentUrl) {
    return (
      <View
        style={[
          {
            backgroundColor: "#0A0A0A",
            aspectRatio: 16 / 9,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <Text style={{ fontSize: 40 }}>🎬</Text>
        <Text
          style={{
            color: "#6B7280",
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            marginTop: 8,
          }}
        >
          No stream URL set
        </Text>
        {isHost && (
          <Text
            style={{
              color: "#4B5563",
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              marginTop: 4,
              textAlign: "center",
              paddingHorizontal: 24,
            }}
          >
            Tap the ⚙️ icon in the room info to add a stream URL
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        { backgroundColor: "#000", aspectRatio: 16 / 9, position: "relative" },
        style,
      ]}
    >
      {/* ── Video surface ─────────────────────────────────────── */}
      <VideoView
        ref={videoViewRef}
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen
        allowsPictureInPicture={Platform.OS === "ios"}
        onFullscreenEnter={() => setIsFullscreen(true)}
        onFullscreenExit={() => setIsFullscreen(false)}
      />

      {/* ── Touch layer — show/hide controls ─────────────────── */}
      <TouchableWithoutFeedback onPress={showControlsNow}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 52, // leave controls area untouched
          }}
        />
      </TouchableWithoutFeedback>

      {/* ── Loading overlay ───────────────────────────────────── */}
      {isBuffering && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text
            style={{
              color: "#9CA3AF",
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Buffering…
          </Text>
        </View>
      )}

      {/* ── Error overlay ─────────────────────────────────────── */}
      {hasError && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
            padding: 24,
          }}
        >
          <AlertCircle size={36} color="#EF4444" />
          <Text
            style={{
              color: "#fff",
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Playback Error
          </Text>
          <Text
            style={{
              color: "#9CA3AF",
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {errorMsg || "Could not load the video stream."}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#2563EB",
              borderRadius: 8,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <RefreshCw size={14} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
              }}
            >
              {retryCount < 3 ? "Retry" : "Try Again"}
            </Text>
          </TouchableOpacity>
          {retryCount >= 3 && (
            <Text
              style={{
                color: "#4B5563",
                fontSize: 11,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Check that the stream URL is accessible and in HLS, DASH, or MP4
              format.
            </Text>
          )}
        </View>
      )}

      {/* ── Subtitle overlay ──────────────────────────────────── */}
      <SubtitleOverlay cue={activeCue} />

      {/* ── Controls overlay ──────────────────────────────────── */}
      <Animated.View
        style={{
          position: "absolute",
          inset: 0,
          opacity: controlsOpacity,
          pointerEvents: showControls ? "box-none" : "none",
        }}
      >
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            padding: 12,
            gap: 12,
          }}
        >
          <TouchableOpacity onPress={handleMuteToggle} hitSlop={8}>
            {isMuted ? (
              <VolumeX size={20} color="#fff" />
            ) : (
              <Volume2 size={20} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={8}>
            <Settings size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Center controls */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
          }}
        >
          {/* Skip back */}
          <TouchableOpacity
            onPress={() => {
              showControlsNow();
              if (isHost) videoSync.handleSkipBackward();
            }}
            hitSlop={12}
            style={{ opacity: isHost ? 1 : 0.35 }}
          >
            <View style={{ alignItems: "center" }}>
              <SkipBack size={28} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontSize: 9,
                  fontFamily: "Inter_500Medium",
                  marginTop: 2,
                }}
              >
                10s
              </Text>
            </View>
          </TouchableOpacity>

          {/* Play / Pause */}
          {!isBuffering && (
            <TouchableOpacity
              onPress={() => {
                showControlsNow();
                if (!isHost) return;
                if (isPlaying) videoSync.handlePause();
                else videoSync.handlePlay();
              }}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isHost
                  ? "rgba(37,99,235,0.9)"
                  : "rgba(55,65,81,0.7)",
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={isHost ? 0.8 : 1}
            >
              {isPlaying ? (
                <Pause size={28} color="#fff" />
              ) : (
                <Play size={28} color="#fff" />
              )}
            </TouchableOpacity>
          )}

          {/* Skip forward */}
          <TouchableOpacity
            onPress={() => {
              showControlsNow();
              if (isHost) videoSync.handleSkipForward();
            }}
            hitSlop={12}
            style={{ opacity: isHost ? 1 : 0.35 }}
          >
            <View style={{ alignItems: "center" }}>
              <SkipForward size={28} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontSize: 9,
                  fontFamily: "Inter_500Medium",
                  marginTop: 2,
                }}
              >
                10s
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom bar — progress + time + fullscreen */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {/* Seek mode indicator */}
          {isSeeking && (
            <View style={{ alignItems: "center", marginBottom: 4 }}>
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 18,
                }}
              >
                {formatTime(seekPosition)}
              </Text>
            </View>
          )}

          {/* Progress bar */}
          <View
            ref={progressBarRef}
            onLayout={(e) => {
              progressBarWidth.current = e.nativeEvent.layout.width;
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleProgressResponderGrant}
            onResponderMove={handleProgressResponderMove}
            onResponderRelease={handleProgressResponderRelease}
            style={{
              height: 20,
              justifyContent: "center",
              paddingVertical: 8,
              marginBottom: 4,
            }}
          >
            {/* Track */}
            <View
              style={{
                height: isSeeking ? 5 : 3,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.25)",
                overflow: "hidden",
              }}
            >
              {/* Buffered (simulated) */}
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  right: 0,
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />
              {/* Played */}
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progress * 100}%`,
                  backgroundColor: "#3B82F6",
                }}
              />
            </View>
            {/* Thumb */}
            <View
              style={{
                position: "absolute",
                left: `${progress * 100}%`,
                top: "50%",
                marginLeft: -7,
                marginTop: -7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: isSeeking ? "#fff" : "#3B82F6",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 2,
                opacity: isHost ? 1 : 0,
              }}
            />
          </View>

          {/* Time row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "Inter_400Regular",
                fontSize: 11,
              }}
            >
              {formatTime(displayTime)}
              {duration > 0 && (
                <Text style={{ color: "#6B7280" }}>
                  {" "}
                  / {formatTime(duration)}
                </Text>
              )}
            </Text>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              {/* Speed badge */}
              {speed !== 1.0 && (
                <TouchableOpacity onPress={() => setShowSettings(true)}>
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.15)",
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 11,
                      }}
                    >
                      {speed}×
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {/* Subtitle button */}
              {subtitleCues.length > 0 && (
                <TouchableOpacity
                  onPress={() =>
                    handleSubtitleChange(subtitleUrl ? "" : subtitleUrl)
                  }
                  hitSlop={8}
                >
                  <Subtitles
                    size={18}
                    color={subtitleCues.length > 0 ? "#3B82F6" : "#9CA3AF"}
                  />
                </TouchableOpacity>
              )}
              {/* Fullscreen */}
              <TouchableOpacity onPress={handleFullscreenToggle} hitSlop={8}>
                {isFullscreen ? (
                  <Minimize size={18} color="#fff" />
                ) : (
                  <Maximize size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {!isHost && (
            <Text
              style={{
                color: "rgba(255,255,255,0.35)",
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Host controls playback
            </Text>
          )}
        </View>
      </Animated.View>

      {/* ── Settings modal ────────────────────────────────────── */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        subtitleUrl={subtitleUrl}
        onSubtitleChange={handleSubtitleChange}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        audioTracks={audioTracks}
        selectedAudioTrack={selectedAudioTrack}
        onAudioTrackChange={handleAudioTrackChange}
      />
    </View>
  );
}
