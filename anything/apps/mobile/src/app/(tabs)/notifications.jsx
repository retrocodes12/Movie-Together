import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  UserPlus,
  Film,
  Vote,
  MessageSquare,
  Star,
  Check,
  Trash2,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const TYPE_CONFIG = {
  friend_request: { Icon: UserPlus, color: "#3B82F6" },
  friend_accepted: { Icon: UserPlus, color: "#22C55E" },
  room_invite: { Icon: Film, color: "#8B5CF6" },
  vote: { Icon: Vote, color: "#F59E0B" },
  discussion: { Icon: MessageSquare, color: "#EC4899" },
  review_like: { Icon: Star, color: "#EF4444" },
  system: { Icon: Bell, color: "#6B7280" },
};

function NotificationItem({ notif, onRead, onAction, C }) {
  const { Icon, color } = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const timeAgo = getTimeAgo(notif.created_at);
  const data = notif.data || {};

  const handlePress = () => {
    if (!notif.read) onRead(notif.id);
    if (notif.type === "room_invite" && data.room_id)
      onAction("join_room", data);
    if (notif.type === "friend_request") onAction("view_friends", data);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: notif.read ? C.background : C.primarySoft,
        borderBottomWidth: 1,
        borderBottomColor: C.borderGhost,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: color + "22",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: color + "44",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ ...Typography.label, color: C.foreground, fontSize: 14 }}
          numberOfLines={2}
        >
          {notif.title}
        </Text>
        {notif.body ? (
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {notif.body}
          </Text>
        ) : null}
        <Text
          style={{ ...Typography.meta, color: C.foregroundMuted, marginTop: 4 }}
        >
          {timeAgo}
        </Text>
      </View>
      {!notif.read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: C.primary,
            marginTop: 6,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

function getTimeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);
  const queryClient = useQueryClient();

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["notifications", deviceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/notifications?device_id=${deviceId}&limit=50`,
      );
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  const markRead = async (notifId) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, notification_id: notifId }),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications", deviceId] });
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, mark_all: true }),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications", deviceId] });
  };

  const clearRead = async () => {
    await fetch(`/api/notifications?device_id=${deviceId}`, {
      method: "DELETE",
    });
    queryClient.invalidateQueries({ queryKey: ["notifications", deviceId] });
  };

  const handleAction = (action, data) => {
    if (action === "join_room" && data.room_id) {
      router.push(`/(tabs)/rooms/${data.room_id}`);
    } else if (action === "view_friends") {
      router.push("/(tabs)/friends");
    }
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ ...Typography.hero, color: C.foreground, fontSize: 22 }}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View
              style={{
                backgroundColor: C.primary,
                borderRadius: Radius.full,
                minWidth: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: C.primarySoft,
                borderRadius: Radius.sm,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Check size={12} color={C.primary} />
              <Text
                style={{
                  color: C.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                }}
              >
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clearRead} style={{ padding: 6 }}>
            <Trash2 size={18} color={C.foregroundMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
          />
        }
      >
        {notifications.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingVertical: 60,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: C.canvasMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Spacing.lg,
                borderWidth: 1,
                borderColor: C.borderGhost,
              }}
            >
              <Bell size={28} color={C.foregroundMuted} />
            </View>
            <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
              All caught up!
            </Text>
            <Text
              style={{
                ...Typography.body,
                color: C.foregroundMuted,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Friend requests, room invites, and activity will appear here.
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: C.cardBg,
              borderBottomWidth: 1,
              borderBottomColor: C.borderGhost,
            }}
          >
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                onRead={markRead}
                onAction={handleAction}
                C={C}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
