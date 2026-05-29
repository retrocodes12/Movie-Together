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
import { Film, User, AtSign, Sparkles } from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const AVATAR_OPTIONS = ["🎬", "🍿", "🎭", "🎥", "📽️", "🎞️", "🌟", "🎤"];

export default function OnboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const setUser = useStore((s) => s.setUser);
  const C = getTheme(colorScheme);

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🎬");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    const errs = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      errs.displayName = "Name must be at least 2 characters";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    const u = username.trim().toLowerCase();
    if (!u || u.length < 3)
      errs.username = "Username must be at least 3 characters";
    else if (!/^[a-z0-9_]+$/.test(u))
      errs.username = "Only letters, numbers, and underscores";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          avatar_url: selectedEmoji,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error || "Could not create profile");
        if (data.error?.includes("Username")) setStep(2);
        return;
      }
      await setUser(data.user);
      router.replace("/(tabs)/home");
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
    padding: Spacing.md,
    fontSize: 15,
    color: C.foreground,
    fontFamily: "Inter_400Regular",
    marginTop: Spacing.sm,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: "500",
    color: C.foregroundMuted,
    fontFamily: "Inter_500Medium",
    marginTop: Spacing.lg,
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: Spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View
            style={{
              alignItems: "center",
              marginTop: Spacing.xxl,
              marginBottom: Spacing.xxl,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: Radius.md,
                backgroundColor: C.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Spacing.md,
              }}
            >
              <Film size={32} color="#fff" />
            </View>
            <Text
              style={{
                ...Typography.hero,
                color: C.foreground,
                textAlign: "center",
              }}
            >
              MovieTogether
            </Text>
            <Text
              style={{
                ...Typography.body,
                color: C.foregroundMuted,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Watch movies with friends, anywhere.
            </Text>
          </View>

          {/* Step Indicator */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: Spacing.xl,
              justifyContent: "center",
            }}
          >
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: Radius.full,
                  backgroundColor: s <= step ? C.primary : C.borderGhost,
                  maxWidth: 80,
                }}
              />
            ))}
          </View>

          {/* Step 1: Display Name */}
          {step === 1 && (
            <View>
              <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                What's your name?
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  marginTop: 4,
                }}
              >
                This is how other watchers will see you.
              </Text>
              <Text style={labelStyle}>Display Name</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. Alex Chen"
                  placeholderTextColor={C.foregroundMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={50}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                />
              </View>
              {errors.displayName && (
                <Text
                  style={{
                    color: C.red,
                    fontSize: 12,
                    marginTop: 4,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {errors.displayName}
                </Text>
              )}
            </View>
          )}

          {/* Step 2: Username */}
          {step === 2 && (
            <View>
              <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                Choose a username
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  marginTop: 4,
                }}
              >
                Your unique handle across MovieTogether.
              </Text>
              <Text style={labelStyle}>Username</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    ...inputStyle,
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AtSign size={16} color={C.foregroundMuted} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: C.foreground,
                      fontSize: 15,
                      fontFamily: "Inter_400Regular",
                    }}
                    placeholder="yourhandle"
                    placeholderTextColor={C.foregroundMuted}
                    value={username}
                    onChangeText={(t) =>
                      setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    maxLength={30}
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={handleNext}
                  />
                </View>
              </View>
              {errors.username && (
                <Text
                  style={{
                    color: C.red,
                    fontSize: 12,
                    marginTop: 4,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {errors.username}
                </Text>
              )}
            </View>
          )}

          {/* Step 3: Avatar */}
          {step === 3 && (
            <View>
              <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                Pick your avatar
              </Text>
              <Text
                style={{
                  ...Typography.body,
                  color: C.foregroundMuted,
                  marginTop: 4,
                }}
              >
                Express yourself in the watch party.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: Spacing.lg,
                }}
              >
                {AVATAR_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => setSelectedEmoji(emoji)}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: Radius.md,
                      borderWidth: 2,
                      borderColor:
                        selectedEmoji === emoji ? C.primary : C.borderGhost,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        selectedEmoji === emoji ? C.primarySoft : C.canvasMuted,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <View
                style={{
                  marginTop: Spacing.xl,
                  padding: Spacing.lg,
                  backgroundColor: C.canvasMuted,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: C.borderGhost,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.md,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: Radius.full,
                    backgroundColor: C.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{selectedEmoji}</Text>
                </View>
                <View>
                  <Text
                    style={{ ...Typography.cardHeader, color: C.foreground }}
                  >
                    {displayName}
                  </Text>
                  <Text
                    style={{ ...Typography.meta, color: C.foregroundMuted }}
                  >
                    @{username}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Spacer */}
          <View style={{ flex: 1, minHeight: Spacing.xxl }} />

          {/* Buttons */}
          <View
            style={{
              gap: Spacing.sm,
              paddingBottom: insets.bottom + Spacing.lg,
            }}
          >
            {step < 3 ? (
              <TouchableOpacity
                onPress={handleNext}
                style={{
                  backgroundColor: C.primary,
                  borderRadius: Radius.sm,
                  padding: Spacing.md,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleCreate}
                disabled={loading}
                style={{
                  backgroundColor: C.primary,
                  borderRadius: Radius.sm,
                  padding: Spacing.md,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Sparkles size={18} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "600",
                        fontSize: 15,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      Start Watching
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {step > 1 && (
              <TouchableOpacity
                onPress={() => setStep(step - 1)}
                style={{ padding: Spacing.sm, alignItems: "center" }}
              >
                <Text style={{ ...Typography.body, color: C.foregroundMuted }}>
                  Back
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
