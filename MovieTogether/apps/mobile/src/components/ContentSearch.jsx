/**
 * ContentSearch — Stremio-compatible content picker.
 * Search movies/TV, view metadata, and send streams to the room.
 */
import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  Search,
  Film,
  Tv,
  X,
  Play,
  Link,
  Star,
  ChevronRight,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

export default function ContentSearch({ visible, onClose, onSelectStream }) {
  const colorScheme = useStore((s) => s.colorScheme);
  const C = getTheme(colorScheme);

  const [query, setQuery] = useState("");
  const [contentType, setContentType] = useState("movie");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [showDirectUrl, setShowDirectUrl] = useState(false);
  const searchTimer = useRef(null);

  const doSearch = useCallback(async (q, type) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stremio?query=${encodeURIComponent(q)}&type=${type}`,
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (text) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(text, contentType), 500);
  };

  const handleSelectContent = async (item) => {
    setSelected(item);
    setStreamLoading(true);
    setStreams([]);
    try {
      const url = `/api/stremio?id=${item.id}&type=${item.type || contentType}`;
      const res = await fetch(url);
      const data = await res.json();
      setStreams(data.streams || []);
    } catch {}
    setStreamLoading(false);
  };

  const handleUseStream = (stream) => {
    if (!stream.url) {
      Alert.alert(
        "No direct URL",
        "This stream requires a torrent client. Please paste a direct HLS/MP4 URL instead.",
      );
      return;
    }
    onSelectStream(stream.url, selected);
    onClose();
  };

  const handleDirectUrl = async () => {
    if (!directUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stremio?validate_url=${encodeURIComponent(directUrl.trim())}`,
      );
      const data = await res.json();
      if (!data.valid) {
        Alert.alert(
          "Invalid URL",
          "Could not reach that URL. Check the address and try again.",
        );
      } else {
        onSelectStream(directUrl.trim(), selected || { name: "Custom Stream" });
        onClose();
      }
    } catch {
      // Still allow it if validation fails due to CORS
      onSelectStream(directUrl.trim(), selected);
      onClose();
    }
    setLoading(false);
  };

  const reset = () => {
    setSelected(null);
    setStreams([]);
    setResults([]);
    setQuery("");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: Spacing.xl,
            paddingTop: 60,
            paddingBottom: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: C.borderGhost,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {selected && (
              <TouchableOpacity onPress={reset} hitSlop={8}>
                <ChevronRight
                  size={20}
                  color={C.foreground}
                  style={{ transform: [{ rotate: "180deg" }] }}
                />
              </TouchableOpacity>
            )}
            <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
              {selected ? selected.name : "Find Content"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={C.foreground} />
          </TouchableOpacity>
        </View>

        {!selected ? (
          /* Search view */
          <View style={{ flex: 1 }}>
            {/* Type toggle */}
            <View
              style={{
                flexDirection: "row",
                margin: Spacing.xl,
                gap: Spacing.sm,
              }}
            >
              {[
                { key: "movie", label: "Movies", Icon: Film },
                { key: "series", label: "TV Shows", Icon: Tv },
              ].map(({ key, label, Icon }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setContentType(key);
                    doSearch(query, key);
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: Spacing.sm,
                    borderRadius: Radius.sm,
                    backgroundColor:
                      contentType === key ? C.primary : C.canvasMuted,
                    borderWidth: 1,
                    borderColor:
                      contentType === key ? C.primary : C.borderGhost,
                  }}
                >
                  <Icon
                    size={14}
                    color={contentType === key ? "#fff" : C.foregroundMuted}
                  />
                  <Text
                    style={{
                      color: contentType === key ? "#fff" : C.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginHorizontal: Spacing.xl,
                marginBottom: Spacing.lg,
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                paddingHorizontal: Spacing.md,
              }}
            >
              <Search size={16} color={C.foregroundMuted} />
              <TextInput
                style={{
                  flex: 1,
                  height: 44,
                  color: C.foreground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                }}
                placeholder={`Search ${contentType === "movie" ? "movies" : "TV shows"}...`}
                placeholderTextColor={C.foregroundMuted}
                value={query}
                onChangeText={handleQueryChange}
                autoFocus
              />
              {loading && <ActivityIndicator size="small" color={C.primary} />}
            </View>

            {/* Direct URL option */}
            <TouchableOpacity
              onPress={() => setShowDirectUrl((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginHorizontal: Spacing.xl,
                marginBottom: Spacing.lg,
                padding: Spacing.md,
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
              }}
            >
              <Link size={16} color={C.primary} />
              <Text
                style={{ ...Typography.label, color: C.foreground, flex: 1 }}
              >
                Use direct stream URL
              </Text>
              <ChevronRight
                size={14}
                color={C.foregroundMuted}
                style={
                  showDirectUrl ? { transform: [{ rotate: "90deg" }] } : {}
                }
              />
            </TouchableOpacity>

            {showDirectUrl && (
              <View
                style={{
                  marginHorizontal: Spacing.xl,
                  marginBottom: Spacing.lg,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: C.inputBg,
                    borderRadius: Radius.sm,
                    borderWidth: 1,
                    borderColor: C.borderGhost,
                    paddingHorizontal: Spacing.md,
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      height: 44,
                      color: C.foreground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                    }}
                    placeholder="https://example.com/video.m3u8"
                    placeholderTextColor={C.foregroundMuted}
                    value={directUrl}
                    onChangeText={setDirectUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
                <TouchableOpacity
                  onPress={handleDirectUrl}
                  disabled={!directUrl.trim() || loading}
                  style={{
                    marginTop: Spacing.sm,
                    backgroundColor: C.primary,
                    borderRadius: Radius.sm,
                    padding: Spacing.sm,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                    }}
                  >
                    {loading ? "Validating…" : "Use This URL"}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    ...Typography.meta,
                    color: C.foregroundMuted,
                    marginTop: 6,
                  }}
                >
                  Supports HLS (.m3u8), DASH (.mpd), and direct video files
                </Text>
              </View>
            )}

            {/* Results */}
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
            >
              {results.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleSelectContent(item)}
                  style={{
                    flexDirection: "row",
                    gap: Spacing.md,
                    paddingVertical: Spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: C.borderGhost,
                  }}
                >
                  {item.poster ? (
                    <Image
                      source={{ uri: item.poster }}
                      style={{
                        width: 52,
                        height: 75,
                        borderRadius: Radius.sm,
                        backgroundColor: C.canvasMuted,
                      }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 52,
                        height: 75,
                        borderRadius: Radius.sm,
                        backgroundColor: C.canvasMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Film size={20} color={C.foregroundMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...Typography.cardHeader,
                        color: C.foreground,
                        fontSize: 14,
                      }}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {item.year && (
                        <Text
                          style={{
                            ...Typography.meta,
                            color: C.foregroundMuted,
                          }}
                        >
                          {item.year}
                        </Text>
                      )}
                      {item.imdb_rating && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Star size={10} color="#F59E0B" fill="#F59E0B" />
                          <Text
                            style={{
                              ...Typography.meta,
                              color: C.foregroundMuted,
                            }}
                          >
                            {item.imdb_rating}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        ...Typography.meta,
                        color: C.foregroundMuted,
                        marginTop: 4,
                      }}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {!loading && query.length > 1 && results.length === 0 && (
                <Text
                  style={{
                    ...Typography.body,
                    color: C.foregroundMuted,
                    textAlign: "center",
                    paddingVertical: Spacing.xxl,
                  }}
                >
                  No results found for "{query}"
                </Text>
              )}
            </ScrollView>
          </View>
        ) : (
          /* Stream picker view */
          <View style={{ flex: 1 }}>
            {/* Content info */}
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.md,
                padding: Spacing.xl,
                borderBottomWidth: 1,
                borderBottomColor: C.borderGhost,
              }}
            >
              {selected.poster ? (
                <Image
                  source={{ uri: selected.poster }}
                  style={{ width: 52, height: 75, borderRadius: Radius.sm }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 52,
                    height: 75,
                    borderRadius: Radius.sm,
                    backgroundColor: C.canvasMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Film size={24} color={C.foregroundMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                  {selected.name}
                </Text>
                {selected.year && (
                  <Text
                    style={{ ...Typography.meta, color: C.foregroundMuted }}
                  >
                    {selected.year}
                  </Text>
                )}
                <Text
                  style={{
                    ...Typography.meta,
                    color: C.foregroundMuted,
                    marginTop: 4,
                  }}
                >
                  IMDB: {selected.id}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
              <Text
                style={{
                  ...Typography.meta,
                  color: C.foregroundMuted,
                  marginBottom: Spacing.md,
                }}
              >
                {streamLoading
                  ? "Finding streams…"
                  : `${streams.length} streams found`}
              </Text>

              {streamLoading && (
                <ActivityIndicator
                  color={C.primary}
                  style={{ marginTop: Spacing.xl }}
                />
              )}

              {streams.map((stream, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleUseStream(stream)}
                  style={{
                    backgroundColor: C.cardBg,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: C.borderGhost,
                    padding: Spacing.lg,
                    marginBottom: Spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: Radius.sm,
                      backgroundColor: C.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Play size={16} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ ...Typography.label, color: C.foreground }}
                      numberOfLines={1}
                    >
                      {stream.name}
                    </Text>
                    <Text
                      style={{
                        ...Typography.meta,
                        color: C.foregroundMuted,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {stream.quality} · {stream.description || stream.source}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor:
                        stream.quality === "4K" ? "#7C3AED22" : C.primarySoft,
                      borderRadius: Radius.full,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Inter_600SemiBold",
                        color: stream.quality === "4K" ? "#7C3AED" : C.primary,
                      }}
                    >
                      {stream.quality}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {!streamLoading && streams.length === 0 && (
                <View
                  style={{ alignItems: "center", paddingVertical: Spacing.xxl }}
                >
                  <Film size={40} color={C.foregroundMuted} />
                  <Text
                    style={{
                      ...Typography.cardHeader,
                      color: C.foreground,
                      marginTop: Spacing.md,
                    }}
                  >
                    No direct streams found
                  </Text>
                  <Text
                    style={{
                      ...Typography.body,
                      color: C.foregroundMuted,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Try pasting a direct URL using the link option on the
                    previous screen.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
