const CINEMETA_MANIFEST = "https://cinemeta.strem.io/manifest.json";

export const DEFAULT_ADDONS = [
  {
    url: "https://aiometadata.viren070.me/stremio/ed602812-df91-4c90-a697-be9b911ebb28/manifest.json",
    sourceType: "stremio",
    enabled: true,
  },
  {
    url: "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://nebula.work.gd/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
];

const REQUEST_TIMEOUT = 12000;

export function normalizeManifestUrl(input) {
  if (!input || typeof input !== "string") return null;
  let url = input.trim();
  if (!url) return null;
  if (url.startsWith("stremio://")) url = `https://${url.slice("stremio://".length)}`;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith("/manifest.json")) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/manifest.json`;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function addonBaseUrl(manifestUrl) {
  const normalized = normalizeManifestUrl(manifestUrl);
  if (!normalized) return null;
  return normalized.replace(/\/manifest\.json(?:\?.*)?$/i, "");
}

export function buildResourceUrl(manifestUrl, resource, type, id, extra = {}) {
  const base = addonBaseUrl(manifestUrl);
  if (!base || !resource || !type || !id) return null;
  const safeId = encodeURIComponent(String(id)).replace(/%3A/gi, ":");
  const extraPairs = Object.entries(extra)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  const extraPath = extraPairs.length ? `/${extraPairs.join("&")}` : "";
  return `${base}/${resource}/${encodeURIComponent(type)}/${safeId}${extraPath}.json`;
}

function timeoutSignal(ms = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url) {
  const ctrl = timeoutSignal();
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    ctrl.clear();
  }
}

function parseAddonUrls(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return String(value).split(",");
}

export function resolveAddonList(addonsParam) {
  const parsed = parseAddonUrls(addonsParam);
  const urls = parsed.length ? parsed : [...DEFAULT_ADDONS.map((a) => a.url), CINEMETA_MANIFEST];
  const seen = new Set();
  return urls
    .map(normalizeManifestUrl)
    .filter(Boolean)
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

export async function fetchManifest(manifestUrl) {
  const url = normalizeManifestUrl(manifestUrl);
  if (!url) throw new Error("Invalid manifest URL");
  const manifest = await fetchJson(url);
  return {
    url,
    manifest,
    addon: {
      url,
      sourceType: inferSourceType(manifest),
      id: manifest.id || url,
      name: manifest.name || "Stremio Addon",
      description: manifest.description || "",
      version: manifest.version || "",
      logo: manifest.logo || manifest.icon || null,
      resources: normalizeResources(manifest.resources),
      catalogs: Array.isArray(manifest.catalogs) ? manifest.catalogs : [],
      types: Array.isArray(manifest.types) ? manifest.types : [],
    },
  };
}

export async function fetchManifests(addonsParam) {
  const settled = await Promise.allSettled(resolveAddonList(addonsParam).map(fetchManifest));
  return settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}

function normalizeResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((r) => (typeof r === "string" ? { name: r } : r)).filter(Boolean);
}

function resourceSupported(manifest, resource, type, id) {
  return normalizeResources(manifest.resources).some((r) => {
    if (r.name !== resource) return false;
    if (r.type && r.type !== type) return false;
    if (Array.isArray(r.types) && !r.types.includes(type)) return false;
    if (Array.isArray(r.idPrefixes) && id && !r.idPrefixes.some((p) => String(id).startsWith(p))) {
      return false;
    }
    return true;
  });
}

function catalogSupportsSearch(catalog) {
  return Array.isArray(catalog.extra) && catalog.extra.some((e) => e?.name === "search");
}

function inferSourceType(manifest) {
  const resources = normalizeResources(manifest.resources).map((r) => r.name);
  if (resources.includes("catalog") || resources.includes("meta")) return "stremio";
  if (resources.includes("stream")) return "stream";
  return "self-hosted";
}

export function normalizeMeta(meta, addon) {
  if (!meta) return null;
  const year = meta.year || meta.releaseInfo || (meta.released ? String(new Date(meta.released).getFullYear()) : "");
  return {
    ...meta,
    id: meta.id,
    type: meta.type,
    name: meta.name,
    year,
    poster: meta.poster || null,
    background: meta.background || meta.poster || null,
    description: meta.description || "",
    imdb_rating: meta.imdbRating || meta.imdb_rating || null,
    genres: meta.genres || [],
    cast: meta.cast || [],
    videos: meta.videos || [],
    addon: addon ? { name: addon.name, url: addon.url } : null,
  };
}

function extractQuality(text = "") {
  if (/2160p|4k/i.test(text)) return "4K";
  if (/1080p/i.test(text)) return "1080p";
  if (/720p/i.test(text)) return "720p";
  if (/480p/i.test(text)) return "480p";
  return "Unknown";
}

function streamUrlType(stream) {
  const url = stream.url || stream.externalUrl || "";
  if (stream.infoHash) return "torrent";
  if (stream.ytId) return "youtube";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  if (/\.mpd(\?|$)/i.test(url)) return "dash";
  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(url)) return "direct";
  if (url) return "web";
  return "unknown";
}

export function normalizeStream(stream, addon) {
  const text = [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean)
    .join(" ");
  const url = stream.url || stream.externalUrl || null;
  return {
    name: stream.name || addon?.name || "Stream",
    title: stream.title || "",
    description: stream.description || stream.title || stream.behaviorHints?.filename || "",
    url,
    externalUrl: stream.externalUrl || null,
    ytId: stream.ytId || null,
    infoHash: stream.infoHash || null,
    fileIdx: stream.fileIdx,
    subtitles: stream.subtitles || [],
    behaviorHints: stream.behaviorHints || {},
    quality: extractQuality(text),
    streamType: streamUrlType(stream),
    playable: Boolean(stream.url && /^https?:\/\//i.test(stream.url)),
    source: addon?.name || "Addon",
    addonUrl: addon?.url || null,
  };
}

export async function getCatalogs(addonsParam) {
  const manifests = await fetchManifests(addonsParam);
  return manifests.flatMap(({ addon }) =>
    addon.catalogs.map((catalog) => ({
      ...catalog,
      addon: { name: addon.name, url: addon.url, sourceType: addon.sourceType },
      genres: (catalog.extra || []).find((e) => e?.name === "genre")?.options || [],
      searchable: catalogSupportsSearch(catalog),
    })),
  );
}

export async function getCatalog({ addonUrl, type, catalogId, genre, skip = 0 }) {
  const { addon, manifest } = await fetchManifest(addonUrl);
  if (!resourceSupported(manifest, "catalog", type)) return [];
  const url = buildResourceUrl(addon.url, "catalog", type, catalogId, { genre, skip });
  const data = await fetchJson(url);
  return (data.metas || []).map((m) => normalizeMeta(m, addon));
}

export async function searchCatalogs({ query, type, addonsParam }) {
  if (!query || query.trim().length < 2) return [];
  const manifests = await fetchManifests(addonsParam);
  const requests = [];
  for (const { addon, manifest } of manifests) {
    for (const catalog of addon.catalogs) {
      if (type && catalog.type !== type) continue;
      if (!catalogSupportsSearch(catalog)) continue;
      const url = buildResourceUrl(addon.url, "catalog", catalog.type, catalog.id, { search: query.trim() });
      requests.push(fetchJson(url).then((data) => (data.metas || []).map((m) => normalizeMeta(m, addon))).catch(() => []));
    }
  }
  const rows = (await Promise.all(requests)).flat();
  const seen = new Set();
  return rows.filter((m) => {
    const key = `${m.type}:${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
}

export async function getMeta({ addonUrl, type, id, addonsParam }) {
  const ordered = addonUrl ? [addonUrl, ...resolveAddonList(addonsParam)] : resolveAddonList(addonsParam);
  const seen = new Set();
  for (const url of ordered) {
    const manifestUrl = normalizeManifestUrl(url);
    if (!manifestUrl || seen.has(manifestUrl)) continue;
    seen.add(manifestUrl);
    try {
      const { addon, manifest } = await fetchManifest(manifestUrl);
      if (!resourceSupported(manifest, "meta", type, id)) continue;
      const data = await fetchJson(buildResourceUrl(addon.url, "meta", type, id));
      if (data.meta?.id) return normalizeMeta(data.meta, addon);
    } catch {}
  }
  return null;
}

export async function getStreams({ type, id, addonsParam }) {
  const manifests = await fetchManifests(addonsParam);
  const requests = manifests
    .filter(({ manifest }) => resourceSupported(manifest, "stream", type, id))
    .map(({ addon }) =>
      fetchJson(buildResourceUrl(addon.url, "stream", type, id))
        .then((data) => (data.streams || []).map((s) => normalizeStream(s, addon)))
        .catch(() => []),
    );
  const streams = (await Promise.all(requests)).flat();
  streams.sort((a, b) => Number(b.playable) - Number(a.playable));
  return streams.slice(0, 80);
}

export async function validateStreamUrl(url) {
  try {
    const ctrl = timeoutSignal(5000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    ctrl.clear();
    return { valid: res.ok || res.status === 206, status: res.status };
  } catch {
    return { valid: false };
  }
}
