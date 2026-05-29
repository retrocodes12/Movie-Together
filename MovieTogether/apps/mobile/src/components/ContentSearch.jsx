/**
 * ContentSearch — Stremio-compatible discovery, metadata, addon, and stream picker.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Search,
  Film,
  Tv,
  X,
  Play,
  Link,
  Star,
  ChevronRight,
  Plus,
  Trash2,
  Settings,
  Flame,
  Clock,
  Grid3X3,
  RefreshCw,
  Users,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const ADDON_STORAGE_KEY = "movietogether.stremio.addons.v1";

const DEFAULT_ADDONS = [
  {
    url: "https://aiometadata.viren070.me/stremio/ed602812-df91-4c90-a697-be9b911ebb28/manifest.json",
    name: "AIOMetadata",
    sourceType: "stremio",
    enabled: true,
  },
  {
    url: "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json",
    name: "HdHub",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json",
    name: "WebStreamrMBG",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://nebula.work.gd/manifest.json",
    name: "NebulaStreams",
    sourceType: "stream",
    enabled: true,
  },
];

function addonParam(addons) {
  return encodeURIComponent(JSON.stringify(addons.filter((a) => a.enabled).map((a) => a.url)));
}

async function api(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function yearOf(item) {
  return item?.year || item?.releaseInfo || (item?.released ? new Date(item.released).getFullYear() : "");
}

function pickHomeCatalogs(catalogs, type) {
  const typed = catalogs.filter((c) => c.type === type);
  const wanted = [
    { key: "trending", Icon: Flame, match: /trend/i },
    { key: "popular", Icon: Star, match: /popular|top/i },
    { key: "recent", Icon: Clock, match: /new|release|premiere|latest/i },
  ];
  const picked = wanted
    .map((w) => {
      const catalog = typed.find((c) => w.match.test(`${c.name} ${c.id}`));
      return catalog ? { ...w, catalog } : null;
    })
    .filter(Boolean);
  for (const catalog of typed.filter((c) => c.showInHome !== false)) {
    if (picked.length >= 4) break;
    if (!picked.some((p) => p.catalog.id === catalog.id && p.catalog.addon.url === catalog.addon.url)) {
      picked.push({ key: catalog.name, Icon: Grid3X3, catalog });
    }
  }
  return picked;
}

function AddonBadge({ label, C }) {
  return (
    <View
      style={{
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: C.borderGhost,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ ...Typography.meta, color: C.foregroundMuted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function PosterRow({ item, C, onPress }) {
  const rating = item.imdb_rating || item.imdbRating;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 118,
        marginRight: Spacing.md,
      }}
      activeOpacity={0.82}
    >
      {item.poster ? (
        <Image
          source={{ uri: item.poster }}
          style={{
            width: 118,
            height: 172,
            borderRadius: Radius.sm,
            backgroundColor: C.canvasMuted,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 118,
            height: 172,
            borderRadius: Radius.sm,
            backgroundColor: C.canvasMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Film size={26} color={C.foregroundMuted} />
        </View>
      )}
      <Text
        style={{ ...Typography.label, color: C.foreground, marginTop: 7, fontSize: 12 }}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
        {!!yearOf(item) && <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>{yearOf(item)}</Text>}
        {!!rating && (
          <>
            <Star size={10} color="#F59E0B" fill="#F59E0B" />
            <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>{rating}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ResultRow({ item, C, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
          style={{ width: 54, height: 78, borderRadius: Radius.sm, backgroundColor: C.canvasMuted }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 54,
            height: 78,
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
        <Text style={{ ...Typography.cardHeader, color: C.foreground, fontSize: 14 }} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {!!yearOf(item) && <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>{yearOf(item)}</Text>}
          {!!item.imdb_rating && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Star size={10} color="#F59E0B" fill="#F59E0B" />
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>{item.imdb_rating}</Text>
            </View>
          )}
          {!!item.addon?.name && <AddonBadge label={item.addon.name} C={C} />}
        </View>
        <Text style={{ ...Typography.meta, color: C.foregroundMuted, marginTop: 4 }} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ContentSearch({ visible, onClose, onSelectStream }) {
  const colorScheme = useStore((s) => s.colorScheme);
  const C = getTheme(colorScheme);

  const [query, setQuery] = useState("");
  const [contentType, setContentType] = useState("movie");
  const [activeView, setActiveView] = useState("discover");
  const [addons, setAddons] = useState(DEFAULT_ADDONS);
  const [catalogs, setCatalogs] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [catalogGenre, setCatalogGenre] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [streams, setStreams] = useState([]);
  const [directUrl, setDirectUrl] = useState("");
  const [newAddonUrl, setNewAddonUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const searchTimer = useRef(null);

  const enabledAddonParam = useMemo(() => addonParam(addons), [addons]);

  const saveAddons = useCallback(async (next) => {
    setAddons(next);
    await AsyncStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const loadAddonManifests = useCallback(
    async (source = addons) => {
      try {
        const data = await api(`/api/stremio?action=addons&addons=${addonParam(source)}`);
        const byUrl = new Map(data.addons.map((a) => [a.url, a]));
        const merged = source.map((a) => ({ ...a, ...(byUrl.get(a.url) || {}) }));
        setAddons(merged);
        await AsyncStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
    },
    [addons],
  );

  const loadCatalogs = useCallback(async () => {
    try {
      const data = await api(`/api/stremio?action=catalogs&addons=${enabledAddonParam}`);
      setCatalogs(data.catalogs || []);
    } catch {
      setCatalogs([]);
    }
  }, [enabledAddonParam]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const stored = await AsyncStorage.getItem(ADDON_STORAGE_KEY);
      const initial = stored ? JSON.parse(stored) : DEFAULT_ADDONS;
      setAddons(initial);
      await loadAddonManifests(initial);
    })().catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (visible) loadCatalogs();
  }, [visible, loadCatalogs]);

  const loadHome = useCallback(async () => {
    const picked = pickHomeCatalogs(catalogs, contentType);
    if (!picked.length) {
      setSections([]);
      return;
    }
    setLoading(true);
    try {
      const loaded = await Promise.all(
        picked.map(async (section) => {
          const url =
            `/api/stremio?action=catalog&type=${section.catalog.type}` +
            `&catalog_id=${encodeURIComponent(section.catalog.id)}` +
            `&addon_url=${encodeURIComponent(section.catalog.addon.url)}` +
            `&skip=0&addons=${enabledAddonParam}`;
          const data = await api(url).catch(() => ({ results: [] }));
          return { ...section, items: (data.results || []).slice(0, 20) };
        }),
      );
      setSections(loaded.filter((s) => s.items.length));
    } finally {
      setLoading(false);
    }
  }, [catalogs, contentType, enabledAddonParam]);

  useEffect(() => {
    if (visible && activeView === "discover" && !selectedCatalog) loadHome();
  }, [visible, activeView, selectedCatalog, loadHome]);

  const doSearch = useCallback(
    async (q, type) => {
      if (!q || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await api(
          `/api/stremio?query=${encodeURIComponent(q)}&type=${type}&addons=${enabledAddonParam}`,
        );
        setResults(data.results || []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    },
    [enabledAddonParam],
  );

  const handleQueryChange = (text) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(text, contentType), 450);
  };

  const openCatalog = async (catalog, genre = "") => {
    setSelectedCatalog(catalog);
    setCatalogGenre(genre);
    setLoading(true);
    try {
      const data = await api(
        `/api/stremio?action=catalog&type=${catalog.type}&catalog_id=${encodeURIComponent(catalog.id)}` +
          `&addon_url=${encodeURIComponent(catalog.addon.url)}&genre=${encodeURIComponent(genre)}&skip=0&addons=${enabledAddonParam}`,
      );
      setCatalogResults(data.results || []);
    } catch {
      setCatalogResults([]);
    }
    setLoading(false);
  };

  const loadStreamsFor = useCallback(
    async (item, video = null) => {
      const id = video?.id || item?.id;
      if (!id) return;
      setStreamLoading(true);
      setStreams([]);
      try {
        const data = await api(
          `/api/stremio?action=streams&type=${item.type || contentType}&video_id=${encodeURIComponent(id)}` +
            `&id=${encodeURIComponent(item.id)}&addons=${enabledAddonParam}`,
        );
        setStreams(data.streams || []);
      } catch {
        setStreams([]);
      }
      setStreamLoading(false);
    },
    [contentType, enabledAddonParam],
  );

  const handleSelectContent = async (item) => {
    setSelected(item);
    setMetadata(item);
    setSelectedVideo(null);
    setStreams([]);
    setLoading(true);
    try {
      const data = await api(
        `/api/stremio?action=meta&type=${item.type || contentType}&id=${encodeURIComponent(item.id)}` +
          `${item.addon?.url ? `&addon_url=${encodeURIComponent(item.addon.url)}` : ""}&addons=${enabledAddonParam}`,
      );
      const meta = data.metadata || item;
      setMetadata(meta);
      const firstVideo = meta.videos?.[0] || null;
      setSelectedVideo(firstVideo);
      await loadStreamsFor(meta, firstVideo);
    } catch {
      await loadStreamsFor(item);
    }
    setLoading(false);
  };

  const handleUseStream = (stream) => {
    if (!stream.playable || !stream.url) {
      Alert.alert(
        "Stream not directly playable",
        "This source returned a torrent, external page, or stream requiring proxy headers. Pick a direct HLS/MP4 stream or paste a direct URL.",
      );
      return;
    }
    const meta = {
      ...(metadata || selected),
      selected_video: selectedVideo,
      selected_stream: {
        source: stream.source,
        quality: stream.quality,
        streamType: stream.streamType,
        requestHeaders: stream.requestHeaders || null,
        subtitles: stream.subtitles || [],
      },
    };
    onSelectStream(stream.url, meta);
    onClose();
  };

  const handleDirectUrl = async () => {
    const url = directUrl.trim();
    if (!url) return;
    setLoading(true);
    try {
      const data = await api(`/api/stremio?validate_url=${encodeURIComponent(url)}`);
      if (!data.valid) {
        Alert.alert("URL not reachable", "The server could not validate that URL. It may still fail in the player.");
      }
    } catch {}
    onSelectStream(url, selected || { name: "Custom Stream" });
    setLoading(false);
    onClose();
  };

  const addAddon = async () => {
    const url = newAddonUrl.trim();
    if (!url) return;
    setLoading(true);
    try {
      const data = await api(`/api/stremio?action=manifest&addon_url=${encodeURIComponent(url)}`);
      const next = [
        ...addons.filter((a) => a.url !== data.addon.url),
        { ...data.addon, enabled: true },
      ];
      await saveAddons(next);
      setNewAddonUrl("");
      await loadCatalogs();
    } catch (e) {
      Alert.alert("Addon failed", e.message || "Could not load manifest.json");
    }
    setLoading(false);
  };

  const toggleAddon = async (url) => {
    await saveAddons(addons.map((a) => (a.url === url ? { ...a, enabled: !a.enabled } : a)));
  };

  const removeAddon = async (url) => {
    await saveAddons(addons.filter((a) => a.url !== url));
  };

  const reset = () => {
    if (selected) {
      setSelected(null);
      setMetadata(null);
      setSelectedVideo(null);
      setStreams([]);
      return;
    }
    if (selectedCatalog) {
      setSelectedCatalog(null);
      setCatalogResults([]);
      return;
    }
    setResults([]);
    setQuery("");
  };

  const renderTypeToggle = () => (
    <View style={{ flexDirection: "row", margin: Spacing.xl, gap: Spacing.sm }}>
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
            backgroundColor: contentType === key ? C.primary : C.canvasMuted,
            borderWidth: 1,
            borderColor: contentType === key ? C.primary : C.borderGhost,
          }}
        >
          <Icon size={14} color={contentType === key ? "#fff" : C.foregroundMuted} />
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
  );

  const renderTabs = () => (
    <View style={{ flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.md }}>
      {[
        { key: "discover", label: "Discover", Icon: Flame },
        { key: "search", label: "Search", Icon: Search },
        { key: "addons", label: "Addons", Icon: Settings },
      ].map(({ key, label, Icon }) => {
        const active = activeView === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              setActiveView(key);
              setSelectedCatalog(null);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingVertical: 8,
              borderRadius: Radius.sm,
              backgroundColor: active ? C.foreground : C.canvasMuted,
            }}
          >
            <Icon size={13} color={active ? C.background : C.foregroundMuted} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
                color: active ? C.background : C.foreground,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderDiscover = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
      {selectedCatalog ? (
        <View style={{ paddingHorizontal: Spacing.xl }}>
          <Text style={{ ...Typography.cardHeader, color: C.foreground }}>{selectedCatalog.name}</Text>
          {!!selectedCatalog.genres?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: Spacing.md }}>
              {["", ...selectedCatalog.genres].slice(0, 24).map((genre) => (
                <TouchableOpacity
                  key={genre || "all"}
                  onPress={() => openCatalog(selectedCatalog, genre)}
                  style={{
                    marginRight: 8,
                    borderRadius: Radius.full,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: catalogGenre === genre ? C.primary : C.canvasMuted,
                  }}
                >
                  <Text
                    style={{
                      color: catalogGenre === genre ? "#fff" : C.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {genre || "All"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {loading && <ActivityIndicator color={C.primary} style={{ marginVertical: Spacing.lg }} />}
          {catalogResults.map((item) => (
            <ResultRow key={`${item.type}:${item.id}`} item={item} C={C} onPress={() => handleSelectContent(item)} />
          ))}
        </View>
      ) : (
        <>
          {loading && <ActivityIndicator color={C.primary} style={{ marginTop: Spacing.lg }} />}
          {sections.map(({ key, Icon, catalog, items }) => (
            <View key={`${catalog.addon.url}:${catalog.type}:${catalog.id}`} style={{ marginBottom: Spacing.xl }}>
              <TouchableOpacity
                onPress={() => openCatalog(catalog)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: Spacing.xl,
                  marginBottom: Spacing.md,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon size={16} color={C.primary} />
                  <Text style={{ ...Typography.cardHeader, color: C.foreground, fontSize: 15 }}>
                    {catalog.name}
                  </Text>
                </View>
                <ChevronRight size={16} color={C.foregroundMuted} />
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: Spacing.xl }}>
                {items.map((item) => (
                  <PosterRow
                    key={`${key}:${item.type}:${item.id}`}
                    item={item}
                    C={C}
                    onPress={() => handleSelectContent(item)}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
          {!loading && sections.length === 0 && (
            <Text style={{ ...Typography.body, color: C.foregroundMuted, textAlign: "center", padding: Spacing.xxl }}>
              No catalogs available from enabled addons.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={{ flex: 1 }}>
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
          style={{ flex: 1, height: 44, color: C.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}
          placeholder={`Search ${contentType === "movie" ? "movies" : "TV shows"}...`}
          placeholderTextColor={C.foregroundMuted}
          value={query}
          onChangeText={handleQueryChange}
          autoFocus={activeView === "search"}
        />
        {loading && <ActivityIndicator size="small" color={C.primary} />}
      </View>

      <View style={{ marginHorizontal: Spacing.xl, marginBottom: Spacing.lg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: C.canvasMuted,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            paddingHorizontal: Spacing.md,
          }}
        >
          <Link size={16} color={C.primary} />
          <TextInput
            style={{ flex: 1, height: 44, color: C.foreground, fontFamily: "Inter_400Regular", fontSize: 13 }}
            placeholder="Paste direct HLS/MP4 URL"
            placeholderTextColor={C.foregroundMuted}
            value={directUrl}
            onChangeText={setDirectUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity onPress={handleDirectUrl} disabled={!directUrl.trim()}>
            <Play size={18} color={directUrl.trim() ? C.primary : C.foregroundMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl }}>
        {results.map((item) => (
          <ResultRow key={`${item.type}:${item.id}`} item={item} C={C} onPress={() => handleSelectContent(item)} />
        ))}
        {!loading && query.length > 1 && results.length === 0 && (
          <Text style={{ ...Typography.body, color: C.foregroundMuted, textAlign: "center", paddingVertical: Spacing.xxl }}>
            No results found for "{query}"
          </Text>
        )}
      </ScrollView>
    </View>
  );

  const renderAddons = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: C.canvasMuted,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: C.borderGhost,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.md,
        }}
      >
        <Plus size={16} color={C.primary} />
        <TextInput
          style={{ flex: 1, height: 44, color: C.foreground, fontFamily: "Inter_400Regular", fontSize: 13 }}
          placeholder="https://addon.example/manifest.json"
          placeholderTextColor={C.foregroundMuted}
          value={newAddonUrl}
          onChangeText={setNewAddonUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity onPress={addAddon} disabled={!newAddonUrl.trim() || loading}>
          <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => loadAddonManifests()}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.lg }}
      >
        <RefreshCw size={14} color={C.foregroundMuted} />
        <Text style={{ ...Typography.meta, color: C.foregroundMuted }}>Refresh manifests</Text>
      </TouchableOpacity>

      {addons.map((addon) => (
        <View
          key={addon.url}
          style={{
            padding: Spacing.md,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: C.borderGhost,
            backgroundColor: C.cardBg,
            marginBottom: Spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
            <TouchableOpacity
              onPress={() => toggleAddon(addon.url)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: addon.enabled ? C.primary : C.borderGhost,
                backgroundColor: addon.enabled ? C.primary : "transparent",
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.label, color: C.foreground }} numberOfLines={1}>
                {addon.name || "Stremio Addon"}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <AddonBadge label={addon.sourceType || "stremio"} C={C} />
                <AddonBadge label={`${addon.resources?.length || 0} resources`} C={C} />
                <AddonBadge label={`${addon.catalogs?.length || 0} catalogs`} C={C} />
              </View>
            </View>
            <TouchableOpacity onPress={() => removeAddon(addon.url)}>
              <Trash2 size={17} color={C.red} />
            </TouchableOpacity>
          </View>
          <Text style={{ ...Typography.meta, color: C.foregroundMuted, marginTop: 8 }} numberOfLines={2}>
            {addon.url}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderDetails = () => {
    const meta = metadata || selected;
    const videos = meta?.videos || [];
    const seasons = [...new Set(videos.map((v) => v.season).filter(Boolean))];
    return (
      <View style={{ flex: 1 }}>
        {meta.background && (
          <Image
            source={{ uri: meta.background }}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: 190, opacity: 0.24 }}
            contentFit="cover"
          />
        )}
        <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xxl }}>
          <View style={{ flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg }}>
            {meta.poster ? (
              <Image source={{ uri: meta.poster }} style={{ width: 82, height: 122, borderRadius: Radius.sm }} contentFit="cover" />
            ) : (
              <View style={{ width: 82, height: 122, borderRadius: Radius.sm, backgroundColor: C.canvasMuted }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.cardHeader, color: C.foreground, fontSize: 18 }}>{meta.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {!!yearOf(meta) && <AddonBadge label={String(yearOf(meta))} C={C} />}
                {!!meta.imdb_rating && <AddonBadge label={`IMDb ${meta.imdb_rating}`} C={C} />}
                {!!meta.runtime && <AddonBadge label={meta.runtime} C={C} />}
              </View>
              {!!meta.addon?.name && (
                <Text style={{ ...Typography.meta, color: C.foregroundMuted, marginTop: 8 }}>
                  Metadata: {meta.addon.name}
                </Text>
              )}
            </View>
          </View>

          {!!meta.description && (
            <Text style={{ ...Typography.body, color: C.foreground, lineHeight: 20, marginBottom: Spacing.md }}>
              {meta.description}
            </Text>
          )}

          {!!meta.cast?.length && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.md }}>
              <Users size={14} color={C.foregroundMuted} />
              <Text style={{ ...Typography.meta, color: C.foregroundMuted }} numberOfLines={2}>
                {meta.cast.slice(0, 8).join(", ")}
              </Text>
            </View>
          )}

          {!!seasons.length && (
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={{ ...Typography.label, color: C.foreground, marginBottom: 8 }}>Episodes</Text>
              {seasons.map((season) => (
                <View key={season} style={{ marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.meta, color: C.foregroundMuted, marginBottom: 6 }}>Season {season}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {videos
                      .filter((v) => v.season === season)
                      .map((video) => {
                        const active = selectedVideo?.id === video.id;
                        return (
                          <TouchableOpacity
                            key={video.id}
                            onPress={() => {
                              setSelectedVideo(video);
                              loadStreamsFor(meta, video);
                            }}
                            style={{
                              minWidth: 104,
                              maxWidth: 150,
                              marginRight: 8,
                              padding: 9,
                              borderRadius: Radius.sm,
                              backgroundColor: active ? C.primary : C.canvasMuted,
                            }}
                          >
                            <Text
                              style={{
                                color: active ? "#fff" : C.foreground,
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 12,
                              }}
                              numberOfLines={1}
                            >
                              E{video.episode || "?"}
                            </Text>
                            <Text
                              style={{
                                color: active ? "#fff" : C.foregroundMuted,
                                fontFamily: "Inter_400Regular",
                                fontSize: 11,
                                marginTop: 2,
                              }}
                              numberOfLines={2}
                            >
                              {video.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              ))}
            </View>
          )}

          <Text style={{ ...Typography.label, color: C.foreground, marginBottom: 8 }}>
            {streamLoading ? "Finding streams..." : `${streams.length} streams`}
          </Text>
          {streamLoading && <ActivityIndicator color={C.primary} style={{ marginBottom: Spacing.lg }} />}
          {streams.map((stream, idx) => (
            <TouchableOpacity
              key={`${stream.source}:${idx}:${stream.url || stream.infoHash || stream.externalUrl}`}
              onPress={() => handleUseStream(stream)}
              style={{
                backgroundColor: C.cardBg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: stream.playable ? C.borderGhost : `${C.red}55`,
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
                  backgroundColor: stream.playable ? C.primarySoft : C.canvasMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={16} color={stream.playable ? C.primary : C.foregroundMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.label, color: C.foreground }} numberOfLines={1}>
                  {stream.name}
                </Text>
                <Text style={{ ...Typography.meta, color: C.foregroundMuted, marginTop: 2 }} numberOfLines={2}>
                  {stream.source} · {stream.quality} · {stream.streamType} · {stream.description || stream.title}
                </Text>
              </View>
              <AddonBadge label={stream.playable ? "Play" : stream.streamType} C={C} />
            </TouchableOpacity>
          ))}
          {!streamLoading && streams.length === 0 && (
            <Text style={{ ...Typography.body, color: C.foregroundMuted, textAlign: "center", paddingVertical: Spacing.xl }}>
              No streams found from enabled stream providers.
            </Text>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.background }}>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            {(selected || selectedCatalog) && (
              <TouchableOpacity onPress={reset} hitSlop={8}>
                <ChevronRight size={20} color={C.foreground} style={{ transform: [{ rotate: "180deg" }] }} />
              </TouchableOpacity>
            )}
            <Text style={{ ...Typography.cardHeader, color: C.foreground }} numberOfLines={1}>
              {selected ? metadata?.name || selected.name : selectedCatalog ? selectedCatalog.name : "Discover Content"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={C.foreground} />
          </TouchableOpacity>
        </View>

        {!selected && renderTypeToggle()}
        {!selected && renderTabs()}

        {selected
          ? renderDetails()
          : activeView === "discover"
            ? renderDiscover()
            : activeView === "search"
              ? renderSearch()
              : renderAddons()}
      </View>
    </Modal>
  );
}
