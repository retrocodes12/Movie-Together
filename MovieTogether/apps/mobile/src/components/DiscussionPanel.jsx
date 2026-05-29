/**
 * DiscussionPanel — MovieTogether's signature feature.
 *
 * Tap to pause the room and open discussion.
 * Silence detection auto-resumes playback.
 * Shows speaking indicators for all participants.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  MessageSquare,
  Mic,
  MicOff,
  Play,
  X,
  Volume2,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const SPEAKING_TIMEOUT = 3000; // ms before auto-marking as silent
const POLL_INTERVAL = 3000;

export default function DiscussionPanel({ roomId, visible, onClose, isHost }) {
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);

  const [discussion, setDiscussion] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const speakingTimer = useRef(null);
  const pollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when speaking
  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isSpeaking]);

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/discussion?device_id=${deviceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setDiscussion(data.discussion);
      setSpeakers(data.active_speakers || []);
    } catch {}
  }, [roomId, deviceId]);

  useEffect(() => {
    if (!visible) return;
    fetchState();
    pollRef.current = setInterval(fetchState, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [visible, fetchState]);

  const sendAction = useCallback(
    async (action, extras = {}) => {
      try {
        await fetch(`/api/rooms/${roomId}/discussion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, action, ...extras }),
        });
        fetchState();
      } catch {}
    },
    [roomId, deviceId, fetchState],
  );

  const startDiscussion = async () => {
    setLoading(true);
    await sendAction("start", { auto_resume: true, silence_timeout: 10 });
    setLoading(false);
  };

  const endDiscussion = async () => {
    setLoading(true);
    await sendAction("end");
    setLoading(false);
  };

  const handleSpeakPress = useCallback(() => {
    if (!discussion) return;
    setIsSpeaking(true);
    sendAction("speaking");
    if (speakingTimer.current) clearTimeout(speakingTimer.current);
    speakingTimer.current = setTimeout(() => {
      setIsSpeaking(false);
      sendAction("silence");
    }, SPEAKING_TIMEOUT);
  }, [discussion, sendAction]);

  const handleSpeakRelease = useCallback(() => {
    if (!pushToTalk) return;
    if (speakingTimer.current) clearTimeout(speakingTimer.current);
    setIsSpeaking(false);
    sendAction("silence");
  }, [pushToTalk, sendAction]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: C.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: Spacing.xl,
            paddingBottom: 40,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: C.borderGhost,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: Spacing.xl,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.xl,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MessageSquare size={18} color={C.primary} />
              <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                Discussion Mode
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={C.foregroundMuted} />
            </TouchableOpacity>
          </View>

          {!discussion ? (
            /* Not in discussion — prompt to start */
            <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: C.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: C.primary,
                  marginBottom: Spacing.lg,
                }}
              >
                <MessageSquare size={36} color={C.primary} />
              </View>
              <Text
                style={{
                  ...Typography.cardHeader,
                  color: C.foreground,
                  textAlign: "center",
                }}
              >
                Start a Discussion
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  textAlign: "center",
                  marginTop: 6,
                  marginBottom: Spacing.xl,
                  lineHeight: 20,
                }}
              >
                Pauses the movie for everyone. Playback auto-resumes after 10
                seconds of silence.
              </Text>
              <TouchableOpacity
                onPress={startDiscussion}
                disabled={loading}
                style={{
                  backgroundColor: C.primary,
                  borderRadius: Radius.md,
                  paddingHorizontal: 32,
                  paddingVertical: Spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MessageSquare size={18} color="#fff" />
                )}
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                  }}
                >
                  Start Discussion
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Active discussion */
            <View style={{ alignItems: "center" }}>
              {/* Active speakers */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginBottom: Spacing.xl,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {speakers.length === 0 ? (
                  <Text
                    style={{ ...Typography.meta, color: C.foregroundMuted }}
                  >
                    No one speaking yet…
                  </Text>
                ) : (
                  speakers.map((s) => (
                    <View
                      key={s.user_id}
                      style={{ alignItems: "center", gap: 4 }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: C.primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2.5,
                          borderColor: C.green,
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>
                          {s.avatar_url || "🎬"}
                        </Text>
                      </View>
                      <Text
                        style={{
                          ...Typography.meta,
                          color: C.foreground,
                          fontSize: 10,
                        }}
                      >
                        {s.display_name?.split(" ")[0]}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {[1, 2, 3].map((i) => (
                          <View
                            key={i}
                            style={{
                              width: 3,
                              height: 4 + i * 3,
                              backgroundColor: C.green,
                              borderRadius: 1.5,
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Push-to-talk / speaking button */}
              <Animated.View
                style={{
                  transform: [{ scale: isSpeaking ? pulseAnim : 1 }],
                  marginBottom: Spacing.lg,
                }}
              >
                <TouchableOpacity
                  onPressIn={handleSpeakPress}
                  onPressOut={handleSpeakRelease}
                  onPress={!pushToTalk ? handleSpeakPress : undefined}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: isSpeaking ? C.green : C.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: isSpeaking ? C.green : C.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                  activeOpacity={0.9}
                >
                  {isSpeaking ? (
                    <Volume2 size={40} color="#fff" />
                  ) : (
                    <Mic size={40} color="#fff" />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Text
                style={{
                  ...Typography.meta,
                  color: C.foregroundMuted,
                  marginBottom: Spacing.lg,
                }}
              >
                {isSpeaking ? "🟢 Speaking..." : "Tap to speak"}
              </Text>

              {/* PTT toggle */}
              <TouchableOpacity
                onPress={() => setPushToTalk((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: C.canvasMuted,
                  borderRadius: Radius.full,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: C.borderGhost,
                  marginBottom: Spacing.lg,
                }}
              >
                <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                  {pushToTalk ? "🔴 Hold to talk" : "🟢 Tap to talk"}
                </Text>
              </TouchableOpacity>

              {/* Status */}
              <View
                style={{
                  backgroundColor: "#FEF3C7",
                  borderRadius: Radius.sm,
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: Spacing.sm,
                  borderWidth: 1,
                  borderColor: "#FCD34D",
                  marginBottom: Spacing.xl,
                }}
              >
                <Text
                  style={{
                    color: "#92400E",
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  🎬 Movie paused · Auto-resumes after 10s of silence
                </Text>
              </View>

              {/* End discussion */}
              {isHost && (
                <TouchableOpacity
                  onPress={endDiscussion}
                  disabled={loading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: C.red + "22",
                    borderRadius: Radius.sm,
                    paddingHorizontal: Spacing.xl,
                    paddingVertical: Spacing.sm,
                    borderWidth: 1,
                    borderColor: C.red,
                  }}
                >
                  <Play size={14} color={C.red} />
                  <Text
                    style={{
                      color: C.red,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    End & Resume
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
