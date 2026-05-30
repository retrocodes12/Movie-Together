import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Film,
  Users,
  Edit3,
  Award,
  Clock,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

function StatCard({ icon: Icon, value, label, C }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvasMuted,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: C.borderGhost,
        padding: Spacing.md,
        alignItems: "center",
      }}
    >
      <Icon size={20} color={C.primary} />
      <Text
        style={{
          ...Typography.hero,
          color: C.foreground,
          fontSize: 22,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          ...Typography.meta,
          color: C.foregroundMuted,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MenuItem({ icon: Icon, label, value, danger, onPress, C }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: Radius.sm,
          backgroundColor: danger ? "#FEF2F2" : C.canvasMuted,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: C.borderGhost,
        }}
      >
        <Icon size={16} color={danger ? "#DC2626" : C.foregroundMuted} />
      </View>
      <Text
        style={{
          flex: 1,
          ...Typography.label,
          fontSize: 14,
          color: danger ? "#DC2626" : C.foreground,
        }}
      >
        {label}
      </Text>
      {value && (
        <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
          {value}
        </Text>
      )}
      {!danger && <ChevronRight size={16} color={C.foregroundMuted} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const user = useStore((s) => s.user);
  const deviceId = useStore((s) => s.deviceId);
  const logout = useStore((s) => s.logout);
  const syncUser = useStore((s) => s.syncUser);
  const C = getTheme(colorScheme);

  const [refreshing, setRefreshing] = useState(false);

  const { data: profileData, refetch } = useQuery({
    queryKey: ["profile", deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/profile?device_id=${deviceId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!deviceId,
  });

  const profile = profileData?.user || user;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), syncUser()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "You'll need to set up your profile again to use MovieTogether.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/onboard");
          },
        },
      ],
    );
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

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
        <Text style={{ ...Typography.hero, color: C.foreground, fontSize: 22 }}>
          Profile
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile/settings")}
          style={{
            width: 38,
            height: 38,
            borderRadius: Radius.sm,
            backgroundColor: C.canvasMuted,
            borderWidth: 1,
            borderColor: C.borderGhost,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Settings size={18} color={C.foregroundMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        {/* Profile Card */}
        <View style={{ padding: Spacing.xl }}>
          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              padding: Spacing.xl,
              alignItems: "center",
            }}
          >
            {/* Avatar */}
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
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ fontSize: 40 }}>
                {profile?.avatar_url || "🎬"}
              </Text>
            </View>

            <Text
              style={{ ...Typography.hero, color: C.foreground, fontSize: 20 }}
            >
              {profile?.display_name || "Anonymous"}
            </Text>
            <Text
              style={{
                ...Typography.meta,
                color: C.foregroundMuted,
                marginTop: 2,
              }}
            >
              @{profile?.username || "—"}
            </Text>

            {profile?.bio ? (
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  textAlign: "center",
                  marginTop: 8,
                  lineHeight: 20,
                }}
              >
                {profile.bio}
              </Text>
            ) : null}

            {/* Member Since */}
            <View
              style={{
                marginTop: Spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.full,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: C.borderGhost,
              }}
            >
              <Clock size={11} color={C.foregroundMuted} />
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
                Member since {memberSince}
              </Text>
            </View>

            {/* Edit Profile */}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile/edit")}
              style={{
                marginTop: Spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: C.primarySoft,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.sm,
              }}
              activeOpacity={0.8}
            >
              <Edit3 size={14} color={C.primary} />
              <Text
                style={{
                  color: C.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View
            style={{
              flexDirection: "row",
              gap: Spacing.md,
              marginTop: Spacing.lg,
            }}
          >
            <StatCard
              icon={Film}
              value={profile?.rooms_hosted || 0}
              label="Rooms Hosted"
              C={C}
            />
            <StatCard
              icon={Users}
              value={profile?.rooms_joined || 0}
              label="Rooms Joined"
              C={C}
            />
            <StatCard
              icon={Award}
              value={
                (profile?.rooms_hosted || 0) + (profile?.rooms_joined || 0)
              }
              label="Total Sessions"
              C={C}
            />
          </View>
        </View>

        {/* Menu Sections */}
        <View style={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}>
          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              overflow: "hidden",
            }}
          >
            <MenuItem
              icon={Settings}
              label="Settings"
              C={C}
              onPress={() => router.push("/(tabs)/profile/settings")}
            />
            <View
              style={{
                height: 1,
                backgroundColor: C.borderGhost,
                marginLeft: Spacing.lg + 36 + Spacing.md,
              }}
            />
            <MenuItem
              icon={Film}
              label="My Rooms"
              C={C}
              onPress={() => router.push("/(tabs)/rooms")}
            />
          </View>

          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              overflow: "hidden",
              marginTop: Spacing.sm,
            }}
          >
            <MenuItem
              icon={LogOut}
              label="Sign Out"
              danger
              C={C}
              onPress={handleLogout}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
