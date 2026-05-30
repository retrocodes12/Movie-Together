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
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  Film,
  Globe,
  Lock,
  Users,
  Link,
  ChevronDown,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
];
const MAX_MEMBERS_OPTIONS = [2, 4, 6, 8, 10, 15, 20];

export default function CreateRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);

  const [roomName, setRoomName] = useState("");
  const [movieTitle, setMovieTitle] = useState("");
  const [movieDescription, setMovieDescription] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [movieYear, setMovieYear] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [isPublic, setIsPublic] = useState(true);
  const [showGenres, setShowGenres] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!roomName.trim() || roomName.trim().length < 3)
      errs.roomName = "Room name must be at least 3 characters";
    if (!movieTitle.trim()) errs.movieTitle = "Movie title is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          name: roomName.trim(),
          movie_title: movieTitle.trim(),
          movie_description: movieDescription.trim(),
          movie_genre: selectedGenre,
          movie_year: movieYear ? parseInt(movieYear) : null,
          stream_url: streamUrl.trim(),
          max_members: maxMembers,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error || "Could not create room");
        return;
      }
      router.replace(`/(tabs)/rooms/${data.room.id}`);
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

  const fieldStyle = { marginBottom: Spacing.lg };

  return (
    <View
      style={{ flex: 1, backgroundColor: C.background, paddingTop: insets.top }}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Nav Header */}
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
          Create a Room
        </Text>
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
          {/* Section: Room Info */}
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: Spacing.md,
              letterSpacing: 0.5,
            }}
          >
            ROOM DETAILS
          </Text>

          <View style={fieldStyle}>
            <Text style={labelStyle}>Room Name *</Text>
            <TextInput
              style={[inputStyle, errors.roomName && { borderColor: C.red }]}
              placeholder="e.g. Friday Night Cinema"
              placeholderTextColor={C.foregroundMuted}
              value={roomName}
              onChangeText={setRoomName}
              maxLength={80}
            />
            {errors.roomName && (
              <Text
                style={{
                  color: C.red,
                  fontSize: 11,
                  marginTop: 4,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {errors.roomName}
              </Text>
            )}
          </View>

          {/* Section: Movie Info */}
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: Spacing.md,
              marginTop: Spacing.sm,
              letterSpacing: 0.5,
            }}
          >
            MOVIE DETAILS
          </Text>

          <View style={fieldStyle}>
            <Text style={labelStyle}>Movie Title *</Text>
            <TextInput
              style={[inputStyle, errors.movieTitle && { borderColor: C.red }]}
              placeholder="e.g. Interstellar"
              placeholderTextColor={C.foregroundMuted}
              value={movieTitle}
              onChangeText={setMovieTitle}
              maxLength={200}
            />
            {errors.movieTitle && (
              <Text
                style={{
                  color: C.red,
                  fontSize: 11,
                  marginTop: 4,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {errors.movieTitle}
              </Text>
            )}
          </View>

          <View style={fieldStyle}>
            <Text style={labelStyle}>Description</Text>
            <TextInput
              style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
              placeholder="Short description of the movie..."
              placeholderTextColor={C.foregroundMuted}
              value={movieDescription}
              onChangeText={setMovieDescription}
              multiline
              maxLength={500}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: Spacing.md,
              marginBottom: Spacing.lg,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Genre</Text>
              <TouchableOpacity
                onPress={() => setShowGenres(!showGenres)}
                style={[
                  inputStyle,
                  {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedGenre ? C.foreground : C.foregroundMuted,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                  }}
                >
                  {selectedGenre || "Select genre"}
                </Text>
                <ChevronDown size={16} color={C.foregroundMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ width: 90 }}>
              <Text style={labelStyle}>Year</Text>
              <TextInput
                style={inputStyle}
                placeholder="2024"
                placeholderTextColor={C.foregroundMuted}
                value={movieYear}
                onChangeText={setMovieYear}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          {showGenres && (
            <View
              style={{
                backgroundColor: C.cardBg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                marginTop: -Spacing.md,
                marginBottom: Spacing.lg,
                overflow: "hidden",
              }}
            >
              {GENRES.map((g, idx) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => {
                    setSelectedGenre(g);
                    setShowGenres(false);
                  }}
                  style={{
                    padding: Spacing.md,
                    borderBottomWidth: idx < GENRES.length - 1 ? 1 : 0,
                    borderBottomColor: C.borderGhost,
                    backgroundColor:
                      selectedGenre === g ? C.primarySoft : C.cardBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: selectedGenre === g ? C.primary : C.foreground,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={fieldStyle}>
            <Text style={labelStyle}>Stream URL</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  ...inputStyle,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Link size={14} color={C.foregroundMuted} />
                <TextInput
                  style={{
                    flex: 1,
                    color: C.foreground,
                    fontSize: 14,
                    fontFamily: "Inter_400Regular",
                  }}
                  placeholder="https://..."
                  placeholderTextColor={C.foregroundMuted}
                  value={streamUrl}
                  onChangeText={setStreamUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
            <Text
              style={{
                ...Typography.meta,
                color: C.foregroundMuted,
                marginTop: 4,
              }}
            >
              Optional: add a direct video URL for synchronized playback
            </Text>
          </View>

          {/* Section: Room Settings */}
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginBottom: Spacing.md,
              marginTop: Spacing.sm,
              letterSpacing: 0.5,
            }}
          >
            ROOM SETTINGS
          </Text>

          <View
            style={{
              backgroundColor: C.cardBg,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: C.borderGhost,
              marginBottom: Spacing.lg,
              overflow: "hidden",
            }}
          >
            {/* Max Members */}
            <View
              style={{
                padding: Spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: C.borderGhost,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: Spacing.md,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Users size={16} color={C.foregroundMuted} />
                  <Text style={{ ...Typography.label, color: C.foreground }}>
                    Max Members
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: C.primarySoft,
                    borderRadius: Radius.full,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ ...Typography.label, color: C.primary }}>
                    {maxMembers}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {MAX_MEMBERS_OPTIONS.map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setMaxMembers(n)}
                      style={{
                        width: 44,
                        height: 36,
                        borderRadius: Radius.sm,
                        borderWidth: 1,
                        borderColor:
                          maxMembers === n ? C.primary : C.borderGhost,
                        backgroundColor:
                          maxMembers === n ? C.primarySoft : C.canvasMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color:
                            maxMembers === n ? C.primary : C.foregroundMuted,
                          fontFamily: "Inter_500Medium",
                        }}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Public / Private */}
            <View
              style={{
                padding: Spacing.lg,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {isPublic ? (
                  <Globe size={16} color={C.foregroundMuted} />
                ) : (
                  <Lock size={16} color={C.foregroundMuted} />
                )}
                <View>
                  <Text style={{ ...Typography.label, color: C.foreground }}>
                    {isPublic ? "Public Room" : "Private Room"}
                  </Text>
                  <Text
                    style={{ ...Typography.meta, color: C.foregroundMuted }}
                  >
                    {isPublic
                      ? "Anyone can discover and join"
                      : "Invite-only access"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: C.borderGhost, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Create Button */}
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
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Film size={18} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Create Room
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
