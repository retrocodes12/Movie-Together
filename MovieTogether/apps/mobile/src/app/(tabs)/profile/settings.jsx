import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  Moon,
  Bell,
  Shield,
  Info,
  Mail,
  ChevronRight,
  ExternalLink,
  Trash2,
  Volume2,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

function SectionHeader({ title, C }) {
  return (
    <Text
      style={{
        ...Typography.meta,
        color: C.foregroundMuted,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.sm,
        letterSpacing: 0.5,
      }}
    >
      {title}
    </Text>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  value,
  onToggle,
  onPress,
  isSwitch,
  danger,
  C,
  last,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.borderGhost,
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
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...Typography.label,
            fontSize: 14,
            color: danger ? "#DC2626" : C.foreground,
          }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginTop: 1,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {isSwitch && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: C.borderGhost, true: C.primary }}
          thumbColor="#fff"
        />
      )}
      {!isSwitch && onPress && !danger && (
        <ChevronRight size={16} color={C.foregroundMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const C = getTheme(colorScheme);

  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [autoJoin, setAutoJoin] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/onboard");
          },
        },
      ],
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Nav */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={C.foreground} />
        </TouchableOpacity>
        <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <SectionHeader title="APPEARANCE" C={C} />
        <View
          style={{
            backgroundColor: C.cardBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            marginHorizontal: Spacing.lg,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon={Moon}
            label="Dark Mode"
            description={
              colorScheme === "dark"
                ? "Following system theme (dark)"
                : "Following system theme (light)"
            }
            value={colorScheme === "dark"}
            isSwitch
            onToggle={() => {}}
            C={C}
            last
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" C={C} />
        <View
          style={{
            backgroundColor: C.cardBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            marginHorizontal: Spacing.lg,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon={Bell}
            label="Push Notifications"
            description="Room invites and activity alerts"
            value={notifications}
            isSwitch
            onToggle={setNotifications}
            C={C}
          />
          <SettingRow
            icon={Volume2}
            label="Sound Effects"
            description="Play sounds for chat messages"
            value={soundEffects}
            isSwitch
            onToggle={setSoundEffects}
            C={C}
            last
          />
        </View>

        {/* Playback */}
        <SectionHeader title="PLAYBACK" C={C} />
        <View
          style={{
            backgroundColor: C.cardBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            marginHorizontal: Spacing.lg,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon={Shield}
            label="Auto-join Public Rooms"
            description="Join rooms you're invited to automatically"
            value={autoJoin}
            isSwitch
            onToggle={setAutoJoin}
            C={C}
            last
          />
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" C={C} />
        <View
          style={{
            backgroundColor: C.cardBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            marginHorizontal: Spacing.lg,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon={Info}
            label="Version"
            description="MovieTogether"
            value="1.0.0"
            C={C}
            onPress={() => {}}
          />
          <SettingRow
            icon={Mail}
            label="Contact Support"
            description="Get help with MovieTogether"
            onPress={() => Linking.openURL("mailto:support@movietogether.app")}
            C={C}
          />
          <SettingRow
            icon={ExternalLink}
            label="Privacy Policy"
            onPress={() => Linking.openURL("https://movietogether.app/privacy")}
            C={C}
            last
          />
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" C={C} />
        <View
          style={{
            backgroundColor: C.cardBg,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            marginHorizontal: Spacing.lg,
            overflow: "hidden",
          }}
        >
          <SettingRow
            icon={Trash2}
            label="Delete Account"
            description="Permanently remove your account"
            danger
            onPress={handleDeleteAccount}
            C={C}
            last
          />
        </View>

        {/* Account Info */}
        <View
          style={{
            margin: Spacing.lg,
            padding: Spacing.lg,
            backgroundColor: C.canvasMuted,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
          }}
        >
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: 4,
            }}
          >
            Signed in as
          </Text>
          <Text style={{ ...Typography.label, color: C.foreground }}>
            {user?.display_name}
          </Text>
          <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
            @{user?.username}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
