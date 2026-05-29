/**
 * Active Watch Room — real expo-video player + room sync.
 * Server is the authoritative source of truth.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  MessageCircle,
  Share2,
  Copy,
  Send,
  Crown,
  LogOut,
  Film,
  Info,
  MessageSquare,
  BarChart2,
  Search,
} from "lucide-react-native";
import { useStore } from "@/store";
import { useRoomSync } from "@/utils/useRoomSync";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";
import VideoPlayer from "@/components/VideoPlayer";
import ReactionsOverlay, {
  REACTION_EMOJIS,
} from "@/components/ReactionsOverlay";
import VotingPanel from "@/components/VotingPanel";
import DiscussionPanel from "@/components/DiscussionPanel";
import ContentSearch from "@/components/ContentSearch";

// ── Helper components ───────────────────────────────────────────────────────

function MemberAvatar({ member, size = 36, C }) {
  return (
    <View style={{ position: "relative" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: C.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: C.borderGhost,
        }}
      >
        <Text style={{ fontSize: size * 0.48 }}>
          {member?.avatar_url || "🎬"}
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size * 0.14,
          backgroundColor: member?.is_online ? "#22C55E" : "#9CA3AF",
          borderWidth: 1.5,
          borderColor: C.background,
        }}
      />
    </View>
  );
}

function ChatBubble({ msg, isMe, C }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {!isMe && (
        <Text
          style={{
            ...Typography.meta,
            color: C.foregroundMuted,
            marginBottom: 2,
          }}
        >
          {msg.display_name}
        </Text>
      )}
      <View
        style={{
          alignSelf: isMe ? "flex-end" : "flex-start",
          backgroundColor: isMe ? C.primary : C.canvasMuted,
          borderRadius: Radius.md,
          borderBottomRightRadius: isMe ? Radius.xs : Radius.md,
          borderBottomLeftRadius: isMe ? Radius.md : Radius.xs,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          maxWidth: "80%",
          borderWidth: 1,
          borderColor: isMe ? C.primary : C.borderGhost,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: isMe ? "#fff" : C.foreground,
            fontFamily: "Inter_400Regular",
            lineHeight: 18,
          }}
        >
          {msg.message}
        </Text>
      </View>
      <Text
        style={{
          ...Typography.meta,
          color: C.foregroundMuted,
          alignSelf: isMe ? "flex-end" : "flex-start",
          marginTop: 2,
        }}
      >
        {time}
      </Text>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function WatchRoomScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const user = useStore((s) => s.user);
  const C = getTheme(colorScheme);

  const [activeTab, setActiveTab] = useState("chat");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [lastMsgId, setLastMsgId] = useState(null);
  // New overlay state
  const [showVoting, setShowVoting] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showContentSearch, setShowContentSearch] = useState(false);
  const [reactionSending, setReactionSending] = useState(null);
  const reactionsRef = useRef(null);
  const chatRef = useRef(null);
  const msgPollRef = useRef(null);
  const watchStartRef = useRef(Date.now());

  // ── Initial room fetch ────────────────────────────────────────────────────
  const { data: roomData, isLoading } = useQuery({
    queryKey: ["room", id],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${id}`);
      if (!res.ok) throw new Error("Failed to fetch room");
      return res.json();
    },
  });
  const initialRoom = roomData?.room;

  // ── Auto-join ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialRoom || !deviceId) return;
    const isMember = initialRoom.members?.some((m) => m.user_id === user?.id);
    if (!isMember) {
      fetch(`/api/rooms/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      }).catch(console.error);
    }
  }, [initialRoom?.id]);

  // ── Room sync ─────────────────────────────────────────────────────────────
  const sync = useRoomSync({
    roomId: id,
    deviceId,
    userId: user?.id,
    initialRoom,
  });
  const room = sync.room || initialRoom;
  const members = sync.members?.length
    ? sync.members
    : initialRoom?.members || [];
  const isHost = sync.isHost;
  const onlineCount = sync.onlineCount;
  const ended = room?.status === "ended";

  // Active content URL — set by host via CHANGE_CONTENT, falls back to room stream_url
  const contentUrl =
    sync.playbackState?.content_url || room?.stream_url || null;

  // ── Chat polling ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (after = null) => {
      try {
        const url = after
          ? `/api/rooms/${id}/messages?after=${after}&limit=50`
          : `/api/rooms/${id}/messages?limit=50`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const newMsgs = data.messages || [];
        if (newMsgs.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...prev, ...newMsgs.filter((m) => !ids.has(m.id))];
          });
          setLastMsgId(newMsgs[newMsgs.length - 1].id);
        }
      } catch (e) {
        console.error("fetchMessages error:", e);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchMessages();
    msgPollRef.current = setInterval(() => {
      setLastMsgId((curr) => {
        fetchMessages(curr);
        return curr;
      });
    }, 4000);
    return () => clearInterval(msgPollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (msg) => {
      const res = await fetch(`/api/rooms/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, message: msg }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return ids.has(data.message.id) ? prev : [...prev, data.message];
      });
      setLastMsgId(data.message.id);
      setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  const handleSend = () => {
    const msg = messageText.trim();
    if (!msg) return;
    setMessageText("");
    sendMessage.mutate(msg);
  };

  const sendReaction = useCallback(
    async (emoji) => {
      if (reactionSending) return;
      setReactionSending(emoji);
      // Trigger local flying animation immediately
      reactionsRef.current?.trigger(emoji);
      try {
        await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, room_id: id, emoji }),
        });
      } catch {}
      setTimeout(() => setReactionSending(null), 1000);
    },
    [reactionSending, deviceId, id],
  );

  // ── Leave / end ───────────────────────────────────────────────────────────
  const handleLeave = () => {
    Alert.alert(
      isHost ? "End Room?" : "Leave Room?",
      isHost
        ? "Ending will close the session for everyone."
        : "You can rejoin with the invite code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isHost ? "End Room" : "Leave",
          style: "destructive",
          onPress: async () => {
            // Log watch history
            const watchDuration = Math.floor(
              (Date.now() - watchStartRef.current) / 1000,
            );
            if (room && watchDuration > 30) {
              fetch("/api/watchhistory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  device_id: deviceId,
                  room_id: id,
                  movie_key: room.stream_url || `room_${id}`,
                  movie_title: room.movie_title,
                  movie_genre: room.movie_genre,
                  movie_year: room.movie_year,
                  watch_duration: watchDuration,
                }),
              }).catch(() => {});
            }
            sync.disconnectFromRoom?.();
            await fetch(`/api/rooms/${id}/leave`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ device_id: deviceId }),
            }).catch(() => {});
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            router.replace("/(tabs)/rooms");
          },
        },
      ],
    );
  };

  // Share with invite link
  const handleShare = async () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || "";
    const inviteLink = baseUrl ? `${baseUrl}/join/${room?.invite_code}` : null;
    const msg = inviteLink
      ? `Join my MovieTogether room "${room?.name}"!\n🎬 ${room?.movie_title}\n\nLink: ${inviteLink}\nCode: ${room?.invite_code}`
      : `Join my MovieTogether room "${room?.name}"!\n🎬 ${room?.movie_title}\n\nInvite code: ${room?.invite_code}`;
    try {
      await Share.share({ message: msg, url: inviteLink || undefined });
    } catch {}
  };

  const handleContentSelected = useCallback(
    async (url, meta) => {
      if (sync.changeContent) await sync.changeContent(url, meta).catch(() => {});
      if (meta?.name) {
        fetch("/api/watchhistory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            room_id: id,
            movie_key: meta.id || url,
            movie_title: meta.name,
            watch_duration: 0,
          }),
        }).catch(() => {});
      }
    },
    [sync, deviceId, id],
  );

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={C.primary} size="large" />
        <Text
          style={{
            ...Typography.meta,
            color: C.foregroundMuted,
            marginTop: Spacing.md,
          }}
        >
          Loading room…
        </Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.background,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        <Film size={48} color={C.foregroundMuted} />
        <Text
          style={{
            ...Typography.cardHeader,
            color: C.foreground,
            marginTop: Spacing.lg,
          }}
        >
          Room not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: Spacing.lg }}
        >
          <Text style={{ color: C.primary, fontFamily: "Inter_500Medium" }}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const TABS = [
    { key: "chat", label: "Chat", Icon: MessageCircle },
    { key: "members", label: `Members (${members.length})`, Icon: Users },
    { key: "info", label: "Info", Icon: Info },
  ];

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style="light" />

      {/* ── Header ───────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.md,
            flex: 1,
          }}
        >
          <TouchableOpacity onPress={handleLeave} hitSlop={8}>
            <ArrowLeft size={22} color={C.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{ ...Typography.cardHeader, color: C.foreground }}
              numberOfLines={1}
            >
              {room.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 1,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: onlineCount > 0 ? C.green : "#6B7280",
                }}
              />
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                {onlineCount} online
              </Text>
            </View>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={handleShare}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: C.canvasMuted,
              borderRadius: Radius.full,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: C.borderGhost,
            }}
          >
            <Copy size={12} color={C.foregroundMuted} />
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
              {room.invite_code}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLeave}>
            <LogOut size={20} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Video Player ────────────────────────────────────────────────────── */}
      {ended ? (
        <View
          style={{
            backgroundColor: "#0A0A0A",
            paddingVertical: Spacing.xxl,
            alignItems: "center",
          }}
        >
          <Film size={40} color="#444" />
          <Text
            style={{
              color: "#888",
              fontFamily: "Inter_500Medium",
              marginTop: 8,
              fontSize: 14,
            }}
          >
            Room has ended
          </Text>
        </View>
      ) : (
        <VideoPlayer
          contentUrl={contentUrl}
          isHost={isHost}
          playbackState={sync.playbackState}
          onPlay={sync.play}
          onPause={sync.pause}
          onSeek={sync.seek}
          onSkipForward={sync.skipForward}
          onSkipBackward={sync.skipBackward}
          onChangeContent={sync.changeContent}
        />
      )}

      {/* Room Toolbar */}
      {!ended && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: C.canvasMuted,
            borderBottomWidth: 1,
            borderBottomColor: C.borderGhost,
          }}
        >
          {[
            {
              label: "Discuss",
              Icon: MessageSquare,
              onPress: () => setShowDiscussion(true),
            },
            {
              label: "Vote",
              Icon: BarChart2,
              onPress: () => setShowVoting(true),
            },
            {
              label: "Content",
              Icon: Search,
              onPress: () => setShowContentSearch(true),
            },
            { label: "Invite", Icon: Share2, onPress: handleShare },
          ].map(({ label, Icon, onPress }) => (
            <TouchableOpacity
              key={label}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                gap: 3,
              }}
              activeOpacity={0.7}
            >
              <Icon size={15} color={C.foregroundMuted} />
              <Text
                style={{
                  fontSize: 9,
                  color: C.foregroundMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 5,
                borderBottomWidth: 2,
                borderBottomColor: active ? C.primary : "transparent",
                marginBottom: -1,
              }}
            >
              <Icon size={13} color={active ? C.primary : C.foregroundMuted} />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                  color: active ? C.foreground : C.foregroundMuted,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Chat ─────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 200}
        >
          <ScrollView
            ref={chatRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: Spacing.md,
            }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: Spacing.xxl }}>
                <MessageCircle size={32} color={C.foregroundMuted} />
                <Text
                  style={{
                    ...Typography.body,
                    color: C.foregroundMuted,
                    marginTop: Spacing.sm,
                  }}
                >
                  No messages yet. Say hi! 👋
                </Text>
              </View>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  isMe={msg.user_id === user?.id}
                  C={C}
                />
              ))
            )}
          </ScrollView>

          {!ended && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: C.borderGhost,
                backgroundColor: C.background,
                paddingBottom: insets.bottom + Spacing.sm,
              }}
            >
              {/* ── Emoji reactions bar — horizontal row above message input ── */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  alignItems: "center",
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: C.borderGhost,
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => sendReaction(emoji)}
                    disabled={reactionSending !== null}
                    activeOpacity={0.6}
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      opacity: reactionSending === emoji ? 0.4 : 1,
                      transform:
                        reactionSending === emoji
                          ? [{ scale: 0.82 }]
                          : [{ scale: 1 }],
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Message input row ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sm,
                  paddingHorizontal: Spacing.lg,
                  paddingTop: Spacing.sm,
                  paddingBottom: Spacing.sm,
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: C.canvasMuted,
                    borderRadius: Radius.full,
                    paddingHorizontal: Spacing.lg,
                    paddingVertical: Platform.OS === "ios" ? 10 : 8,
                    fontSize: 14,
                    color: C.foreground,
                    fontFamily: "Inter_400Regular",
                    borderWidth: 1,
                    borderColor: C.borderGhost,
                  }}
                  placeholder="Message the room..."
                  placeholderTextColor={C.foregroundMuted}
                  value={messageText}
                  onChangeText={setMessageText}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!messageText.trim() || sendMessage.isPending}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: messageText.trim()
                      ? C.primary
                      : C.borderGhost,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {sendMessage.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Send size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* ── Members ───────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + 80,
          }}
        >
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: Spacing.md,
            }}
          >
            {onlineCount} online · {members.length} total
          </Text>
          {members.map((member) => {
            const isOnline =
              sync.presenceMap[member.user_id]?.is_online ?? member.is_online;
            return (
              <View
                key={member.user_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.md,
                  paddingVertical: Spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: C.borderGhost,
                }}
              >
                <MemberAvatar
                  member={{ ...member, is_online: isOnline }}
                  C={C}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...Typography.label, color: C.foreground }}>
                    {member.display_name}
                  </Text>
                  <Text
                    style={{ ...Typography.meta, color: C.foregroundMuted }}
                  >
                    @{member.username} · {isOnline ? "Online" : "Offline"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {room.host_id === member.user_id && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "#FEF3C7",
                        borderRadius: Radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Crown size={10} color="#D97706" />
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#D97706",
                          fontFamily: "Inter_600SemiBold",
                        }}
                      >
                        Host
                      </Text>
                    </View>
                  )}
                  {member.user_id === user?.id &&
                    room.host_id !== member.user_id && (
                      <View
                        style={{
                          backgroundColor: C.primarySoft,
                          borderRadius: Radius.full,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            color: C.primary,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        >
                          You
                        </Text>
                      </View>
                    )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Info ──────────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + 80,
          }}
        >
          {/* Details table */}
          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              overflow: "hidden",
              marginBottom: Spacing.lg,
            }}
          >
            {[
              { label: "Room", value: room.name },
              { label: "Movie", value: room.movie_title },
              { label: "Genre", value: room.movie_genre || "—" },
              { label: "Year", value: room.movie_year?.toString() || "—" },
              { label: "Host", value: `@${room.host_username}` },
              {
                label: "Playback",
                value: sync.playbackState?.status || room.status,
              },
              {
                label: "Stream",
                value: contentUrl ? "✓ URL configured" : "Not set",
              },
              {
                label: "Capacity",
                value: `${members.length}/${room.max_members}`,
              },
              {
                label: "Visibility",
                value: room.is_public ? "🌐 Public" : "🔒 Private",
              },
              { label: "Connection", value: sync.connectionStatus },
            ].map(({ label, value }, idx, arr) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: Spacing.md,
                  borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                  borderBottomColor: C.borderGhost,
                }}
              >
                <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                  {label}
                </Text>
                <Text
                  style={{
                    ...Typography.label,
                    color: C.foreground,
                    textAlign: "right",
                    flex: 1,
                    marginLeft: 16,
                  }}
                  numberOfLines={1}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>

          {/* Invite code */}
          <View
            style={{
              backgroundColor: C.primarySoft,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              padding: Spacing.lg,
              alignItems: "center",
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              style={{
                ...Typography.meta,
                color: C.primary,
                marginBottom: Spacing.sm,
              }}
            >
              Invite Code
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontFamily: "Inter_600SemiBold",
                color: C.primary,
                letterSpacing: 6,
              }}
            >
              {room.invite_code}
            </Text>
            <Text
              style={{
                ...Typography.meta,
                color: C.foregroundMuted,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              Share the code or send a direct invite link
            </Text>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                marginTop: Spacing.md,
                backgroundColor: C.primary,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Share2 size={14} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                Share Invite
              </Text>
            </TouchableOpacity>
          </View>

          {/* Synopsis */}
          {room.movie_description ? (
            <View
              style={{
                backgroundColor: C.cardBg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                padding: Spacing.lg,
              }}
            >
              <Text
                style={{
                  ...Typography.label,
                  color: C.foregroundMuted,
                  marginBottom: Spacing.sm,
                }}
              >
                Synopsis
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foreground,
                  lineHeight: 20,
                }}
              >
                {room.movie_description}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── Overlay modals ──────────────────────────────────────── */}
      <VotingPanel
        roomId={id}
        visible={showVoting}
        onClose={() => setShowVoting(false)}
      />
      <DiscussionPanel
        roomId={id}
        visible={showDiscussion}
        onClose={() => setShowDiscussion(false)}
        isHost={isHost}
      />
      <ContentSearch
        visible={showContentSearch}
        onClose={() => setShowContentSearch(false)}
        onSelectStream={handleContentSelected}
      />

      {/* Flying reactions float over the full screen */}
      {!ended && <ReactionsOverlay ref={reactionsRef} roomId={id} visible />}
    </View>
  );
}
