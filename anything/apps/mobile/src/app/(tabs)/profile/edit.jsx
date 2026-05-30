import { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Check } from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const AVATAR_OPTIONS = [
  "🎬",
  "🍿",
  "🎭",
  "🎥",
  "📽️",
  "🎞️",
  "🌟",
  "🎤",
  "🎪",
  "🎨",
  "🧩",
  "🏆",
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const user = useStore((s) => s.user);
  const deviceId = useStore((s) => s.deviceId);
  const setUser = useStore((s) => s.setUser);
  const C = getTheme(colorScheme);

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [selectedEmoji, setSelectedEmoji] = useState(user?.avatar_url || "🎬");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      errs.displayName = "Name must be at least 2 characters";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: selectedEmoji,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error || "Could not update profile");
        return;
      }
      await setUser(data.user);
      router.back();
    } catch (e) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.borderGhost,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: C.foreground,
    fontFamily: "Inter_400Regular",
  };

  const labelStyle = {
    ...Typography.label,
    color: C.foregroundMuted,
    marginBottom: 6,
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
          justifyContent: "space-between",
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: C.borderGhost,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={22} color={C.foreground} />
        </TouchableOpacity>
        <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
          Edit Profile
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <Text
              style={{
                color: C.primary,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.xl,
            paddingBottom: insets.bottom + 100,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={{ alignItems: "center", marginBottom: Spacing.xl }}>
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
              <Text style={{ fontSize: 42 }}>{selectedEmoji}</Text>
            </View>
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
              Select an avatar below
            </Text>
          </View>

          {/* Avatar Picker */}
          <Text style={{ ...labelStyle, marginBottom: Spacing.sm }}>
            Avatar
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: Spacing.sm,
              marginBottom: Spacing.xl,
            }}
          >
            {AVATAR_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setSelectedEmoji(emoji)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: Radius.md,
                  borderWidth: 2,
                  borderColor:
                    selectedEmoji === emoji ? C.primary : C.borderGhost,
                  backgroundColor:
                    selectedEmoji === emoji ? C.primarySoft : C.canvasMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
                {selectedEmoji === emoji && (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: C.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Display Name */}
          <Text style={labelStyle}>Display Name *</Text>
          <TextInput
            style={[
              inputStyle,
              errors.displayName && { borderColor: C.red },
              { marginBottom: Spacing.sm },
            ]}
            placeholder="Your full name"
            placeholderTextColor={C.foregroundMuted}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={80}
          />
          {errors.displayName && (
            <Text
              style={{
                color: C.red,
                fontSize: 11,
                marginBottom: Spacing.md,
                fontFamily: "Inter_400Regular",
              }}
            >
              {errors.displayName}
            </Text>
          )}

          {/* Username (read-only) */}
          <Text style={{ ...labelStyle, marginTop: Spacing.md }}>Username</Text>
          <View
            style={[
              inputStyle,
              { backgroundColor: C.canvasMuted, marginBottom: Spacing.md },
            ]}
          >
            <Text
              style={{
                color: C.foregroundMuted,
                fontSize: 14,
                fontFamily: "Inter_400Regular",
              }}
            >
              @{user?.username}
            </Text>
          </View>
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: Spacing.lg,
            }}
          >
            Usernames cannot be changed after account creation.
          </Text>

          {/* Bio */}
          <Text style={labelStyle}>Bio</Text>
          <TextInput
            style={[
              inputStyle,
              {
                height: 90,
                textAlignVertical: "top",
                marginBottom: Spacing.md,
              },
            ]}
            placeholder="Tell others what you're into..."
            placeholderTextColor={C.foregroundMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={200}
          />
          <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>
            {bio.length}/200
          </Text>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{
              backgroundColor: C.primary,
              borderRadius: Radius.sm,
              padding: Spacing.md,
              alignItems: "center",
              marginTop: Spacing.xl,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Check size={18} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Save Changes
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
