const CINEMETA_MANIFEST = "https://cinemeta.strem.io/manifest.json";

const DEFAULT_ADDONS = [
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
    url: "https://nuvio-addon.tenies.site/abckdhfik-34585674/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://nebula.work.gd/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://nebula.work.gd/configured/nuvio%2Cnuvio-2%2Ccloudstream-phisher%2Cstreamrip-plugin%2Cvidlink/1080p%2C720p%2C480p%2C2160p%2C1440p%2C360p%2Cauto%2Cunknown/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
  {
    url: "https://nebula.work.gd/configured/pstream%2Cpstream-plugin%2Cvidsrc%2Ccastle%2Cvixsrc/1080p%2C720p%2C480p%2C2160p%2C1440p%2C360p%2Cauto%2Cunknown/manifest.json",
    sourceType: "stream",
    enabled: true,
  },
];

const REQUEST_TIMEOUT = 12000;
const PSTREAM_TIMEOUT = 9000;
const PSTREAM_FRONTEND_HOST = process.env.PSTREAM_HOST || "https://pstream.net";
const PSTREAM_STREAM_BASES = [
  process.env.PSTREAM_PRIMEWIRE_BASE,
  process.env.PSTREAM_STREAM_BASE,
  PSTREAM_FRONTEND_HOST,
  "https://backend.pstream.net",
].filter(Boolean);

function normalizeManifestUrl(input) {
  if (!input || typeof input !== "string") return null;
  let url = input.trim();
  if (!url) return null;
  if (url.startsWith("stremio://"))
    url = `https://${url.slice("stremio://".length)}`;
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

function addonBaseUrl(manifestUrl) {
  const normalized = normalizeManifestUrl(manifestUrl);
  if (!normalized) return null;
  const parsed = new URL(normalized);
  parsed.pathname = parsed.pathname.replace(/\/manifest\.json$/i, "");
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
}

function buildResourceUrl(manifestUrl, resource, type, id, extra = {}) {
  const base = addonBaseUrl(manifestUrl);
  if (!base || !resource || !type || !id) return null;
  const queryStart = base.indexOf("?");
  const basePath =
    queryStart >= 0 ? base.slice(0, queryStart).replace(/\/+$/, "") : base;
  const baseQuery = queryStart >= 0 ? base.slice(queryStart) : "";
  const safeId = encodeURIComponent(String(id)).replace(/%3A/gi, ":");
  const extraPairs = Object.entries(extra)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    );
  const extraPath = extraPairs.length ? `/${extraPairs.join("&")}` : "";
  return `${basePath}/${resource}/${encodeURIComponent(
    type
  )}/${safeId}${extraPath}.json${baseQuery}`;
}

function timeoutSignal(ms = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url) {
  const ctrl = timeoutSignal();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    ctrl.clear();
  }
}

async function fetchJsonWithTimeout(url, ms = REQUEST_TIMEOUT, init = {}) {
  const ctrl = timeoutSignal(ms);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers || {}) },
      signal: ctrl.signal,
    });
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

function resolveAddonList(addonsParam) {
  const parsed = parseAddonUrls(addonsParam);
  const urls = parsed.length
    ? parsed
    : [...DEFAULT_ADDONS.map((a) => a.url), CINEMETA_MANIFEST];
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

async function fetchManifest(manifestUrl) {
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

async function fetchManifests(addonsParam) {
  const settled = await Promise.allSettled(
    resolveAddonList(addonsParam).map(fetchManifest)
  );
  return settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

function normalizeResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((r) => (typeof r === "string" ? { name: r } : r))
    .filter(Boolean);
}

function resourceSupported(manifest, resource, type, id) {
  return normalizeResources(manifest.resources).some((r) => {
    if (r.name !== resource) return false;
    if (r.type && r.type !== type) return false;
    if (Array.isArray(r.types) && !r.types.includes(type)) return false;
    if (
      Array.isArray(r.idPrefixes) &&
      id &&
      !r.idPrefixes.some((p) => String(id).startsWith(p))
    ) {
      return false;
    }
    return true;
  });
}

function catalogSupportsSearch(catalog) {
  return (
    Array.isArray(catalog.extra) &&
    catalog.extra.some((e) => e?.name === "search")
  );
}

function inferSourceType(manifest) {
  const resources = normalizeResources(manifest.resources).map((r) => r.name);
  if (resources.includes("catalog") || resources.includes("meta"))
    return "stremio";
  if (resources.includes("stream")) return "stream";
  return "self-hosted";
}

function normalizeMeta(meta, addon) {
  if (!meta) return null;
  const year =
    meta.year ||
    meta.releaseInfo ||
    (meta.released ? String(new Date(meta.released).getFullYear()) : "");
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

function streamText(stream = {}) {
  return [
    stream.name,
    stream.title,
    stream.description,
    stream.behaviorHints?.filename,
  ]
    .filter(Boolean)
    .join(" ");
}

function streamUrlType(stream) {
  const url = stream.url || "";
  const text = streamText(stream);
  if (stream.infoHash) return "torrent";
  if (stream.ytId) return "youtube";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  if (/\.mpd(\?|$)/i.test(url)) return "dash";
  if (/\bplay inline \(hls\)|m3u8\b/i.test(text)) return "hls";
  if (/\.(mp4|m4v|webm)(\?|$)/i.test(url)) {
    return "direct";
  }
  if (/\bplay inline \(mp4\)\b/i.test(text)) return "direct";
  return "unknown";
}

function streamMimeType(stream) {
  const url = String(stream?.url || "");
  const type = streamUrlType(stream);
  if (type === "hls") return "application/vnd.apple.mpegurl";
  if (type === "dash") return "application/dash+xml";
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })().toLowerCase();
  if (/\.(mp4|m4v)(?=($|[/?#&]))/i.test(path)) return "video/mp4";
  if (/\.webm(?=($|[/?#&]))/i.test(path)) return "video/webm";
  if (/\bplay inline \(mp4\)\b/i.test(streamText(stream))) return "video/mp4";
  return null;
}

function streamHeaders(stream = {}) {
  const requestHeaders = stream.behaviorHints?.proxyHeaders?.request;
  if (!requestHeaders || typeof requestHeaders !== "object") return {};
  return Object.fromEntries(
    Object.entries(requestHeaders).filter(([, value]) => value != null),
  );
}

function hasUnsupportedBrowserCodec(stream) {
  const text = streamText(stream);
  return /\b(mkv|remux|hevc|h\.?265|x265|truehd|dts|vc-?1|dolby vision|dv\b|10bit|10-bit)\b/i.test(text);
}

function isPlayableStream(stream) {
  const url = String(stream?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  if (stream?.infoHash || stream?.ytId) return false;
  if (stream?.behaviorHints?.notWebReady) return false;
  const type = streamUrlType(stream);
  if (type === "hls" || type === "dash") return true;
  if (type !== "direct") return false;
  if (hasUnsupportedBrowserCodec(stream)) return false;
  return Boolean(streamMimeType(stream));
}

function normalizeStream(stream, addon) {
  const text = streamText(stream);
  const url = stream.url || null;
  const playable = isPlayableStream(stream);
  const headers = streamHeaders(stream);
  return {
    name: stream.name || addon?.name || "Stream",
    title: stream.title || "",
    description:
      stream.description ||
      stream.title ||
      stream.behaviorHints?.filename ||
      "",
    url,
    externalUrl: stream.externalUrl || null,
    ytId: stream.ytId || null,
    infoHash: stream.infoHash || null,
    fileIdx: stream.fileIdx,
    subtitles: stream.subtitles || [],
    behaviorHints: stream.behaviorHints || {},
    quality: extractQuality(text),
    streamType: streamUrlType(stream),
    mimeType: streamMimeType(stream),
    headers,
    playable,
    source: addon?.name || "Addon",
    addonUrl: addon?.url || null,
  };
}

function pstreamQualityLabel(value) {
  const quality = String(value || "").trim();
  if (!quality) return "Unknown";
  if (/^4k$/i.test(quality)) return "4K";
  if (/^\d{3,4}p?$/i.test(quality)) return `${parseInt(quality, 10)}p`;
  return quality;
}

function normalizePStreamStream(stream, index) {
  const url = String(stream?.link || stream?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const typeText = String(stream?.type || "");
  const isHls = typeText.toLowerCase() === "m3u8" || /\.m3u8(\?|$)/i.test(url);
  const isDirect =
    /^(mp4|file)$/i.test(typeText) || /\.(mp4|m4v|webm)(\?|$)/i.test(url);
  if (!isHls && !isDirect) return null;

  const quality = pstreamQualityLabel(stream?.quality);
  const server = stream?.server ? ` - ${stream.server}` : "";
  const headers =
    stream?.headers && typeof stream.headers === "object"
      ? Object.fromEntries(
          Object.entries(stream.headers).filter(([, value]) => value != null)
        )
      : {};
  const textHint = isHls ? "m3u8" : "Play inline (MP4)";
  return normalizeStream(
    {
      name: `P-Stream ${quality}`,
      title: `${quality}${server} ${textHint}`,
      description: `${quality}${server}`,
      url,
      behaviorHints: {
        filename: `p-stream-${index}.${isHls ? "m3u8" : "mp4"}`,
        proxyHeaders: { request: headers },
      },
    },
    { name: "P-Stream", url: "pstream://primewire" }
  );
}

function uniqueStreams(streams) {
  const seen = new Set();
  return streams.filter((stream) => {
    const key = stream?.url || `${stream?.source}:${stream?.name}:${stream?.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getPStreamStreams({ type, id }) {
  const [imdbId, season, episode] = String(id || "").split(":");
  if (!/^tt\d+$/i.test(imdbId)) return [];
  const isSeries = type === "series" && season && episode;
  const path = isSeries
    ? `/tv/${encodeURIComponent(imdbId)}/${encodeURIComponent(
        season
      )}/${encodeURIComponent(episode)}`
    : `/movie/${encodeURIComponent(imdbId)}`;

  for (const base of PSTREAM_STREAM_BASES) {
    const root = String(base).replace(/\/+$/, "");
    const urls = [`${root}${path}`, `${root}/api${path}`, `${root}/api/b${path}`];
    for (const url of urls) {
      try {
        const data = await fetchJsonWithTimeout(url, PSTREAM_TIMEOUT, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        return (Array.isArray(data?.streams) ? data.streams : [])
          .map(normalizePStreamStream)
          .filter((stream) => stream?.playable);
      } catch {}
    }
  }
  return [];
}

async function getCatalogs(addonsParam) {
  const manifests = await fetchManifests(addonsParam);
  return manifests.flatMap(({ addon }) =>
    addon.catalogs.map((catalog) => ({
      ...catalog,
      addon: { name: addon.name, url: addon.url, sourceType: addon.sourceType },
      genres:
        (catalog.extra || []).find((e) => e?.name === "genre")?.options || [],
      searchable: catalogSupportsSearch(catalog),
    }))
  );
}

async function getCatalog({ addonUrl, type, catalogId, genre, skip = 0 }) {
  const { addon, manifest } = await fetchManifest(addonUrl);
  if (!resourceSupported(manifest, "catalog", type)) return [];
  const url = buildResourceUrl(addon.url, "catalog", type, catalogId, {
    genre,
    skip,
  });
  const data = await fetchJson(url);
  return (data.metas || []).map((m) => normalizeMeta(m, addon));
}

async function searchCatalogs({ query, type, addonsParam }) {
  if (!query || query.trim().length < 2) return [];
  const manifests = await fetchManifests(addonsParam);
  const requests = [];
  for (const { addon } of manifests) {
    for (const catalog of addon.catalogs) {
      if (type && catalog.type !== type) continue;
      if (!catalogSupportsSearch(catalog)) continue;
      const url = buildResourceUrl(
        addon.url,
        "catalog",
        catalog.type,
        catalog.id,
        { search: query.trim() }
      );
      requests.push(
        fetchJson(url)
          .then((data) =>
            (data.metas || []).map((m) => normalizeMeta(m, addon))
          )
          .catch(() => [])
      );
    }
  }
  const rows = (await Promise.all(requests)).flat();
  const seen = new Set();
  return rows
    .filter((m) => {
      const key = `${m.type}:${m.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);
}

async function getMeta({ addonUrl, type, id, addonsParam }) {
  const ordered = addonUrl
    ? [addonUrl, ...resolveAddonList(addonsParam)]
    : resolveAddonList(addonsParam);
  const seen = new Set();
  for (const url of ordered) {
    const manifestUrl = normalizeManifestUrl(url);
    if (!manifestUrl || seen.has(manifestUrl)) continue;
    seen.add(manifestUrl);
    try {
      const { addon, manifest } = await fetchManifest(manifestUrl);
      if (!resourceSupported(manifest, "meta", type, id)) continue;
      const data = await fetchJson(
        buildResourceUrl(addon.url, "meta", type, id)
      );
      if (data.meta?.id) return normalizeMeta(data.meta, addon);
    } catch {}
  }
  return null;
}

async function getStreams({ type, id, addonsParam }) {
  const manifests = await fetchManifests(addonsParam);
  const requests = manifests
    .filter(({ manifest }) => resourceSupported(manifest, "stream", type, id))
    .map(({ addon }) =>
      fetchJson(buildResourceUrl(addon.url, "stream", type, id))
        .then((data) =>
          (data.streams || []).map((s) => normalizeStream(s, addon))
        )
        .catch(() => [])
    );
  const [addonStreams, pstreamStreams] = await Promise.all([
    Promise.all(requests).then((rows) => rows.flat()),
    getPStreamStreams({ type, id }),
  ]);
  return uniqueStreams([...pstreamStreams, ...addonStreams])
    .filter((stream) => stream.playable)
    .sort((a, b) => Number(b.playable) - Number(a.playable))
    .slice(0, 80);
}

async function validateStreamUrl(url) {
  try {
    const ctrl = timeoutSignal(5000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    ctrl.clear();
    return { valid: res.ok || res.status === 206, status: res.status };
  } catch {
    return { valid: false };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const type = searchParams.get("type") || "movie";
    const imdbId = searchParams.get("id");
    const videoId = searchParams.get("video_id");
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const validateUrl = searchParams.get("validate_url");
    const query = searchParams.get("query"); // text search
    const addons = searchParams.get("addons");
    const addonUrl = searchParams.get("addon_url");
    const catalogId = searchParams.get("catalog_id");
    const genre = searchParams.get("genre");
    const skip = Number(searchParams.get("skip") || 0);

    if (validateUrl) {
      const result = await validateStreamUrl(validateUrl);
      return Response.json({
        valid: result.valid,
        stream_type: validateUrl.includes(".m3u8") ? "hls" : "direct",
        ...result,
      });
    }

    if (action === "defaults") return Response.json({ addons: DEFAULT_ADDONS });

    if (action === "manifest") {
      const manifest = await fetchManifest(addonUrl);
      return Response.json(manifest);
    }

    if (action === "addons") {
      const manifests = await fetchManifests(addons);
      return Response.json({ addons: manifests.map((m) => m.addon) });
    }

    if (action === "catalogs") {
      return Response.json({ catalogs: await getCatalogs(addons) });
    }

    if (action === "catalog") {
      if (!addonUrl || !catalogId) {
        return Response.json(
          { error: "addon_url and catalog_id are required" },
          { status: 400 }
        );
      }
      return Response.json({
        results: await getCatalog({ addonUrl, type, catalogId, genre, skip }),
      });
    }

    if (action === "meta") {
      if (!imdbId)
        return Response.json({ error: "id is required" }, { status: 400 });
      return Response.json({
        metadata: await getMeta({
          addonUrl,
          type,
          id: imdbId,
          addonsParam: addons,
        }),
      });
    }

    if (action === "streams") {
      const streamId =
        videoId ||
        (type === "series" && season && episode
          ? `${imdbId}:${season}:${episode}`
          : imdbId);
      if (!streamId)
        return Response.json(
          { error: "id or video_id is required" },
          { status: 400 }
        );
      const streams = await getStreams({
        type,
        id: streamId,
        addonsParam: addons,
      });
      return Response.json({
        streams,
        direct_streams: streams.filter((s) => s.playable),
        total: streams.length,
        playable_total: streams.filter((s) => s.playable).length,
      });
    }

    if (imdbId) {
      const streamId =
        type === "series" && season && episode
          ? `${imdbId}:${season}:${episode}`
          : imdbId;
      const [metadata, streams] = await Promise.all([
        getMeta({ addonUrl, type, id: imdbId, addonsParam: addons }),
        getStreams({ type, id: streamId, addonsParam: addons }),
      ]);

      return Response.json({
        metadata,
        streams,
        direct_streams: streams.filter((s) => s.playable),
        total: streams.length,
        imdb_id: imdbId,
        type,
        season: season ? parseInt(season) : null,
        episode: episode ? parseInt(episode) : null,
      });
    }

    if (query) {
      return Response.json({
        results: await searchCatalogs({ query, type, addonsParam: addons }),
      });
    }

    return Response.json(
      { error: "Provide id, query, or validate_url parameter" },
      { status: 400 }
    );
  } catch (e) {
    console.error("GET /api/stremio:", e);
    return Response.json(
      { error: "Failed to fetch content data" },
      { status: 500 }
    );
  }
}
