import { useCallback, useRef } from "react";
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
import {
  Plus,
  LogIn,
  Film,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const GENRE_PILLS = [
  "Action",
  "Drama",
  "Sci-Fi",
  "Horror",
  "Comedy",
  "Thriller",
];

const FEATURED = [
  { title: "Interstellar", genre: "Sci-Fi", year: 2014, emoji: "🚀" },
  { title: "The Dark Knight", genre: "Action", year: 2008, emoji: "🦇" },
  { title: "Parasite", genre: "Thriller", year: 2019, emoji: "🏚️" },
  { title: "Everything Everywhere", genre: "Drama", year: 2022, emoji: "🥨" },
];

function RoomCard({ room, C, onPress }) {
  const memberCount = parseInt(room.member_count) || 0;
  const isFull = memberCount >= room.max_members;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: C.cardBg,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: C.borderGhost,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: Spacing.md }}>
          <Text
            style={{ ...Typography.cardHeader, color: C.foreground }}
            numberOfLines={1}
          >
            {room.name}
          </Text>
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
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: isFull ? "#FEF2F2" : C.primarySoft,
            borderRadius: Radius.full,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isFull ? C.red : C.green,
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "500",
              fontFamily: "Inter_500Medium",
              color: isFull ? C.red : C.green,
            }}
          >
            {isFull ? "Full" : "Open"}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: Spacing.md,
          flexWrap: "wrap",
        }}
      >
        {room.movie_genre ? (
          <View
            style={{
              backgroundColor: C.canvasMuted,
              borderRadius: Radius.full,
              borderWidth: 1,
              borderColor: C.borderGhost,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
              {room.movie_genre}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: C.canvasMuted,
            borderRadius: Radius.full,
            borderWidth: 1,
            borderColor: C.borderGhost,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}
        >
          <Users size={10} color={C.foregroundMuted} />
          <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
            {memberCount}/{room.max_members}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: C.canvasMuted,
            borderRadius: Radius.full,
            borderWidth: 1,
            borderColor: C.borderGhost,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}
        >
          <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
            @{room.host_username || "unknown"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const user = useStore((s) => s.user);
  const C = getTheme(colorScheme);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
  });

  const rooms = data?.rooms || [];

  const handleJoinRoom = (room) => {
    router.push(`/(tabs)/rooms/${room.id}`);
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: Spacing.xl,
            paddingTop: Spacing.xl,
            paddingBottom: Spacing.lg,
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
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                Welcome back,
              </Text>
              <Text
                style={{
                  ...Typography.hero,
                  color: C.foreground,
                  fontSize: 22,
                }}
              >
                {user?.display_name || "Watcher"} 👋
              </Text>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: Radius.full,
                backgroundColor: C.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: C.borderGhost,
              }}
            >
              <Text style={{ fontSize: 20 }}>{user?.avatar_url || "🎬"}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View
          style={{ paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl }}
        >
          <View style={{ flexDirection: "row", gap: Spacing.md }}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/rooms/create")}
              style={{
                flex: 1,
                backgroundColor: C.primary,
                borderRadius: Radius.md,
                padding: Spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "600",
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Create Room
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/rooms/join")}
              style={{
                flex: 1,
                backgroundColor: C.cardBg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                padding: Spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <LogIn size={18} color={C.primary} />
              <Text
                style={{
                  color: C.primary,
                  fontWeight: "600",
                  fontSize: 14,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Join Room
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Movies */}
        <View style={{ marginBottom: Spacing.xl }}>
          <View
            style={{ paddingHorizontal: Spacing.xl, marginBottom: Spacing.md }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={14} color={C.primary} />
              <Text style={{ ...Typography.label, color: C.foregroundMuted }}>
                Popular this week
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
          >
            {FEATURED.map((movie) => (
              <TouchableOpacity
                key={movie.title}
                onPress={() => router.push("/(tabs)/rooms/create")}
                activeOpacity={0.8}
                style={{
                  width: 140,
                  backgroundColor: C.canvasMuted,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: C.borderGhost,
                  padding: Spacing.md,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: Radius.sm,
                    backgroundColor: C.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{movie.emoji}</Text>
                </View>
                <Text
                  style={{ ...Typography.label, color: C.foreground }}
                  numberOfLines={2}
                >
                  {movie.title}
                </Text>
                <Text
                  style={{
                    ...Typography.meta,
                    color: C.foregroundMuted,
                    marginTop: 2,
                  }}
                >
                  {movie.genre} · {movie.year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Live Rooms */}
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.md,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: C.green,
                }}
              />
              <Text
                style={{ ...Typography.sectionHeader, color: C.foreground }}
              >
                Live Rooms
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/rooms")}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text style={{ ...Typography.meta, color: C.primary }}>
                See all
              </Text>
              <ChevronRight size={12} color={C.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator
              color={C.primary}
              style={{ marginTop: Spacing.xl }}
            />
          ) : rooms.length === 0 ? (
            <View
              style={{
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                padding: Spacing.xl,
                alignItems: "center",
              }}
            >
              <Film size={32} color={C.foregroundMuted} />
              <Text
                style={{
                  ...Typography.cardHeader,
                  color: C.foreground,
                  marginTop: Spacing.md,
                }}
              >
                No rooms yet
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Be the first to create a watch party!
              </Text>
            </View>
          ) : (
            rooms
              .slice(0, 5)
              .map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  C={C}
                  onPress={() => handleJoinRoom(room)}
                />
              ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
