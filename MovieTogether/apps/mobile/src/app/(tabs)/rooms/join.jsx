import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Hash, Ticket, ArrowRight } from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

export default function JoinRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError("Please enter a valid invite code");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Find room by invite code
      const searchRes = await fetch(`/api/rooms?invite_code=${trimmed}`);
      if (!searchRes.ok) throw new Error("Failed to search rooms");
      const searchData = await searchRes.json();
      const room = (searchData.rooms || []).find(
        (r) => r.invite_code === trimmed,
      );

      if (!room) {
        setError(
          "No room found with that invite code. Check the code and try again.",
        );
        return;
      }

      // Join the room
      const joinRes = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, invite_code: trimmed }),
      });
      const joinData = await joinRes.json();

      if (!joinRes.ok) {
        setError(joinData.error || "Could not join the room");
        return;
      }

      router.replace(`/(tabs)/rooms/${room.id}`);
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
          Join a Room
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{ flex: 1, padding: Spacing.xl, justifyContent: "center" }}
        >
          {/* Icon */}
          <View style={{ alignItems: "center", marginBottom: Spacing.xxl }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: Radius.md,
                backgroundColor: C.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: C.borderGhost,
                marginBottom: Spacing.lg,
              }}
            >
              <Ticket size={36} color={C.primary} />
            </View>
            <Text
              style={{
                ...Typography.hero,
                color: C.foreground,
                fontSize: 22,
                textAlign: "center",
              }}
            >
              Enter Invite Code
            </Text>
            <Text
              style={{
                ...Typography.body,
                color: C.foregroundMuted,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Ask the room host for their 6-character invite code.
            </Text>
          </View>

          {/* Code Input */}
          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: error ? C.red : C.borderGhost,
              padding: Spacing.xl,
              marginBottom: Spacing.md,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
              }}
            >
              <Hash size={20} color={C.primary} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 28,
                  fontFamily: "Inter_600SemiBold",
                  color: C.foreground,
                  letterSpacing: 6,
                  textAlign: "center",
                }}
                placeholder="A1B2C3"
                placeholderTextColor={C.borderGhost}
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                  setError("");
                }}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="join"
                onSubmitEditing={handleJoin}
              />
            </View>
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: "#FEF2F2",
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: "#FCA5A5",
                padding: Spacing.md,
                marginBottom: Spacing.md,
              }}
            >
              <Text
                style={{
                  color: C.red,
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleJoin}
            disabled={loading || code.length < 4}
            style={{
              backgroundColor: code.length >= 4 ? C.primary : C.borderGhost,
              borderRadius: Radius.sm,
              padding: Spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Join Room
                </Text>
                <ArrowRight size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View
            style={{
              marginTop: Spacing.xxl,
              padding: Spacing.lg,
              backgroundColor: C.canvasMuted,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
            }}
          >
            <Text
              style={{
                ...Typography.label,
                color: C.foregroundMuted,
                marginBottom: 6,
              }}
            >
              How to get a code
            </Text>
            <Text
              style={{
                ...Typography.meta,
                color: C.foregroundMuted,
                lineHeight: 18,
              }}
            >
              - Ask the room host to share their invite code{"\n"}- Find it on
              the room details screen{"\n"}- Browse public rooms in the Rooms
              tab
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
