import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Film,
  Bell,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

function Avatar({ user, size = 44, showOnline = false, C }) {
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
        <Text style={{ fontSize: size * 0.45 }}>
          {user?.avatar_url || "🎬"}
        </Text>
      </View>
      {showOnline && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: user?.is_online ? "#22C55E" : "#9CA3AF",
            borderWidth: 1.5,
            borderColor: C.background,
          }}
        />
      )}
    </View>
  );
}

function FriendCard({ friend, onInvite, onRemove, C }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.borderGhost,
      }}
    >
      <Avatar user={friend} showOnline C={C} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...Typography.label, color: C.foreground }}>
          {friend.display_name}
        </Text>
        <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
          @{friend.username}
        </Text>
        {friend.current_room_name && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <Film size={10} color={C.primary} />
            <Text style={{ ...Typography.meta, color: C.primary }}>
              {friend.current_room_name}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        {friend.current_room_id && (
          <TouchableOpacity
            onPress={() => onInvite(friend)}
            style={{
              backgroundColor: C.primarySoft,
              borderRadius: Radius.sm,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: C.primary,
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
              }}
            >
              Join
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onRemove(friend)}
          style={{ padding: 6 }}
        >
          <X size={16} color={C.foregroundMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RequestCard({ request, onAccept, onReject, C }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.borderGhost,
      }}
    >
      <Avatar user={request} C={C} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...Typography.label, color: C.foreground }}>
          {request.display_name}
        </Text>
        <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
          @{request.username}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <TouchableOpacity
          onPress={() => onAccept(request)}
          style={{
            backgroundColor: C.green + "22",
            borderRadius: Radius.sm,
            padding: 8,
            borderWidth: 1,
            borderColor: C.green,
          }}
        >
          <Check size={16} color={C.green} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onReject(request)}
          style={{
            backgroundColor: C.red + "22",
            borderRadius: Radius.sm,
            padding: 8,
            borderWidth: 1,
            borderColor: C.red,
          }}
        >
          <X size={16} color={C.red} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);
  const queryClient = useQueryClient();

  const [addUsername, setAddUsername] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchTimer = useRef(null);

  const {
    data: friendsData,
    refetch: refetchFriends,
    isRefetching,
  } = useQuery({
    queryKey: ["friends", deviceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/friends?device_id=${deviceId}&status=accepted`,
      );
      if (!res.ok) throw new Error("Failed to load friends");
      return res.json();
    },
  });

  const { data: requestsData, refetch: refetchRequests } = useQuery({
    queryKey: ["friend-requests", deviceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/friends?device_id=${deviceId}&status=pending`,
      );
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  const friends = friendsData?.friends || [];
  const requests = requestsData?.requests || [];

  const handleUsernameChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_.]/g, "");
    setAddUsername(clean);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (clean.length >= 2) {
      searchTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/users/search?q=${encodeURIComponent(clean)}&device_id=${deviceId}&limit=5`,
          );
          const data = await res.json();
          setSearchResults(data.users || []);
        } catch {}
      }, 400);
    } else {
      setSearchResults([]);
    }
  };

  const sendRequest = async () => {
    if (!addUsername.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          target_username: addUsername.trim(),
          action: "send",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error || "Failed to send request");
        return;
      }
      Alert.alert("Sent!", `Friend request sent to @${addUsername.trim()}`);
      setAddUsername("");
      setShowAdd(false);
    } catch {
      Alert.alert("Error", "Network error");
    }
    setSending(false);
  };

  const handleAccept = async (request) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        request_id: request.id,
        action: "accept",
      }),
    });
    refetchFriends();
    refetchRequests();
  };

  const handleReject = async (request) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        request_id: request.id,
        action: "reject",
      }),
    });
    refetchRequests();
  };

  const handleRemove = (friend) => {
    Alert.alert(
      "Remove Friend",
      `Remove ${friend.display_name} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await fetch("/api/friends", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                device_id: deviceId,
                friend_id: friend.friend_id,
                action: "remove",
              }),
            });
            refetchFriends();
          },
        },
      ],
    );
  };

  const handleJoinFriendsRoom = (friend) => {
    if (friend.current_room_id)
      router.push(`/(tabs)/rooms/${friend.current_room_id}`);
  };

  const onlineCount = friends.filter((f) => f.is_online).length;

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{ ...Typography.hero, color: C.foreground, fontSize: 22 }}
            >
              Friends
            </Text>
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
              {onlineCount} online · {friends.length} total
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAdd((v) => !v)}
            style={{
              backgroundColor: C.primary,
              borderRadius: Radius.sm,
              padding: 10,
            }}
          >
            <UserPlus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add friend input */}
        {showAdd && (
          <View
            style={{
              flexDirection: "row",
              gap: Spacing.sm,
              marginTop: Spacing.lg,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: C.borderGhost,
                paddingHorizontal: Spacing.md,
              }}
            >
              <Text
                style={{
                  color: C.foregroundMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                @
              </Text>
              <TextInput
                style={{
                  flex: 1,
                  height: 40,
                  color: C.foreground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                }}
                placeholder="username"
                placeholderTextColor={C.foregroundMuted}
                value={addUsername}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              onPress={sendRequest}
              disabled={sending || !addUsername.trim()}
              style={{
                backgroundColor: C.primary,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.lg,
                justifyContent: "center",
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}
                >
                  Add
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: Spacing.xl,
          paddingBottom: insets.bottom + 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchFriends();
              refetchRequests();
            }}
            tintColor={C.primary}
          />
        }
      >
        {/* Pending requests */}
        {requests.length > 0 && (
          <View style={{ marginBottom: Spacing.xl }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: Spacing.md,
              }}
            >
              <Bell size={14} color={C.primary} />
              <Text
                style={{
                  ...Typography.sectionHeader,
                  color: C.foreground,
                  fontSize: 14,
                }}
              >
                Friend Requests ({requests.length})
              </Text>
            </View>
            <View
              style={{
                backgroundColor: C.cardBg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                paddingHorizontal: Spacing.lg,
              }}
            >
              {requests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  C={C}
                />
              ))}
            </View>
          </View>
        )}

        {/* Friends list */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: Spacing.md,
          }}
        >
          <Users size={14} color={C.primary} />
          <Text
            style={{
              ...Typography.sectionHeader,
              color: C.foreground,
              fontSize: 14,
            }}
          >
            Your Friends
          </Text>
        </View>

        {friends.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingVertical: Spacing.xxl,
              backgroundColor: C.canvasMuted,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
            }}
          >
            <Users size={40} color={C.foregroundMuted} />
            <Text
              style={{
                ...Typography.cardHeader,
                color: C.foreground,
                marginTop: Spacing.md,
              }}
            >
              No friends yet
            </Text>
            <Text
              style={{
                ...Typography.body,
                color: C.foregroundMuted,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Add friends by their username to watch movies together
            </Text>
            <TouchableOpacity
              onPress={() => setShowAdd(true)}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: C.primary,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.sm,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>
                Add a Friend
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              paddingHorizontal: Spacing.lg,
            }}
          >
            {friends.map((friend) => (
              <FriendCard
                key={friend.friend_id}
                friend={friend}
                onInvite={handleJoinFriendsRoom}
                onRemove={handleRemove}
                C={C}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
