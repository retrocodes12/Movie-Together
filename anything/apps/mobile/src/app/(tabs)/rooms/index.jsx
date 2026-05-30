import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useQuery } from "@tanstack/react-query";
import { Plus, LogIn, Film, Users, Search } from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const STATUS_FILTERS = [
  { key: "all", label: "All Rooms" },
  { key: "waiting", label: "Waiting" },
  { key: "playing", label: "Playing" },
];

function RoomListItem({ room, C, onPress }) {
  const memberCount = parseInt(room.member_count) || 0;
  const isFull = memberCount >= room.max_members;
  const isPlaying = room.status === "playing";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: C.cardBg,
        borderWidth: 1,
        borderColor: C.borderGhost,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderRadius: Radius.md,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: Radius.sm,
            backgroundColor: C.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.borderGhost,
            flexShrink: 0,
          }}
        >
          <Film size={20} color={C.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                ...Typography.cardHeader,
                color: C.foreground,
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {room.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: isPlaying
                  ? "#FEF3C7"
                  : isFull
                    ? "#FEF2F2"
                    : C.primarySoft,
                borderRadius: Radius.full,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: isPlaying
                    ? "#D97706"
                    : isFull
                      ? C.red
                      : C.green,
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  fontFamily: "Inter_600SemiBold",
                  color: isPlaying ? "#D97706" : isFull ? C.red : C.green,
                }}
              >
                {isPlaying ? "Live" : isFull ? "Full" : "Open"}
              </Text>
            </View>
          </View>

          <Text
            style={{
              ...Typography.body,
              color: C.foregroundMuted,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {room.movie_title}
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Users size={11} color={C.foregroundMuted} />
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                {memberCount}/{room.max_members}
              </Text>
            </View>
            {room.movie_genre ? (
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                · {room.movie_genre}
              </Text>
            ) : null}
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
              · @{room.host_username}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const C = getTheme(colorScheme);

  const [activeFilter, setActiveFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const rooms = (data?.rooms || []).filter((r) => {
    if (activeFilter === "all") return true;
    return r.status === activeFilter;
  });

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
            marginBottom: Spacing.lg,
          }}
        >
          <Text
            style={{ ...Typography.hero, color: C.foreground, fontSize: 22 }}
          >
            Rooms
          </Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/rooms/join")}
              style={{
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: C.borderGhost,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <LogIn size={15} color={C.primary} />
              <Text style={{ ...Typography.label, color: C.primary }}>
                Join
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/rooms/create")}
              style={{
                backgroundColor: C.primary,
                borderRadius: Radius.sm,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Plus size={15} color="#fff" />
              <Text style={{ ...Typography.label, color: "#fff" }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={{ flexDirection: "row", gap: 0 }}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={{
                paddingBottom: 12,
                paddingHorizontal: 4,
                marginRight: Spacing.lg,
                borderBottomWidth: 2,
                borderBottomColor:
                  activeFilter === f.key ? C.primary : "transparent",
                marginBottom: -1,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily:
                    activeFilter === f.key
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                  fontWeight: activeFilter === f.key ? "600" : "400",
                  color:
                    activeFilter === f.key ? C.foreground : C.foregroundMuted,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.xl,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator
            color={C.primary}
            style={{ marginTop: Spacing.xxl }}
          />
        ) : rooms.length === 0 ? (
          <View
            style={{
              backgroundColor: C.canvasMuted,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              padding: Spacing.xxl,
              alignItems: "center",
              marginTop: Spacing.xl,
            }}
          >
            <Film size={40} color={C.foregroundMuted} />
            <Text
              style={{
                ...Typography.cardHeader,
                color: C.foreground,
                marginTop: Spacing.md,
              }}
            >
              No rooms found
            </Text>
            <Text
              style={{
                ...Typography.body,
                color: C.foregroundMuted,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {activeFilter !== "all"
                ? "Try a different filter."
                : "Create a room to start watching!"}
            </Text>
          </View>
        ) : (
          rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              C={C}
              onPress={() => router.push(`/(tabs)/rooms/${room.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
