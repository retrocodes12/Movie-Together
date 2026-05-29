/**
 * GET /api/stremio?type=movie|series&id=tt...&season=&episode=
 *
 * Stremio Add-on Protocol proxy.
 * Fetches stream metadata from public Stremio-compatible add-ons.
 * Does NOT host content — only proxies stream URLs from third-party add-ons.
 *
 * Supported sources:
 *  - IMDB IDs (tt...)
 *  - Direct stream URL validation
 *  - OpenSubtitles metadata
 */

// Public Stremio-compatible add-on endpoints (community add-ons)
const ADDON_BASES = [
  "https://torrentio.strem.fun", // community aggregator
  "https://cinemeta.strem.io", // official metadata
];

const CINEMETA_BASE = "https://cinemeta.strem.io";

/** Validate a stream URL is reachable (HEAD request with timeout) */
async function validateStreamUrl(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    return {
      valid: res.ok || res.status === 206,
      status: res.status,
      headers: Object.fromEntries([...res.headers.entries()]),
    };
  } catch {
    return { valid: false };
  }
}

/** Extract metadata from IMDB ID via Cinemeta */
async function fetchMetadata(type, imdbId) {
  try {
    const url = `${CINEMETA_BASE}/meta/${type}/${imdbId}.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.meta || null;
  } catch {
    return null;
  }
}

/** Fetch streams from Torrentio for a given IMDB id */
async function fetchStreams(type, imdbId, season, episode) {
  try {
    const streamId =
      type === "series" && season && episode
        ? `${imdbId}:${season}:${episode}`
        : imdbId;

    const url = `${ADDON_BASES[0]}/stream/${type}/${streamId}.json`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.streams || []).slice(0, 10).map((s) => ({
      name: s.name || s.title || "Stream",
      description: s.description || s.behaviorHints?.filename || "",
      url: s.url || null,
      infoHash: s.infoHash || null,
      quality: extractQuality(s.name || s.description || ""),
      source: "torrentio",
      fileIdx: s.fileIdx,
    }));
  } catch {
    return [];
  }
}

function extractQuality(text) {
  if (/4K|2160p/i.test(text)) return "4K";
  if (/1080p/i.test(text)) return "1080p";
  if (/720p/i.test(text)) return "720p";
  if (/480p/i.test(text)) return "480p";
  return "Unknown";
}

/** Detect content type from URL */
function detectStreamType(url) {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";
  if (lower.match(/\.(mp4|mkv|avi|mov|webm)(\?|$)/)) return "direct";
  return "unknown";
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "movie";
    const imdbId = searchParams.get("id");
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const validateUrl = searchParams.get("validate_url");
    const query = searchParams.get("query"); // text search

    // ── Validate a specific stream URL ────────────────────────────
    if (validateUrl) {
      const result = await validateStreamUrl(validateUrl);
      return Response.json({
        valid: result.valid,
        stream_type: detectStreamType(validateUrl),
        ...result,
      });
    }

    // ── IMDB ID lookup ────────────────────────────────────────────
    if (imdbId) {
      const [metadata, streams] = await Promise.all([
        fetchMetadata(type, imdbId),
        fetchStreams(type, imdbId, season, episode),
      ]);

      // Filter out magnet links / infoHash-only entries (no direct URL)
      const directStreams = streams.filter(
        (s) => s.url && !s.url.startsWith("magnet:"),
      );

      return Response.json({
        metadata,
        streams: directStreams,
        total: directStreams.length,
        imdb_id: imdbId,
        type,
        season: season ? parseInt(season) : null,
        episode: episode ? parseInt(episode) : null,
      });
    }

    // ── Search by title (Cinemeta search) ─────────────────────────
    if (query) {
      try {
        const searchUrl = `${CINEMETA_BASE}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
        const res = await fetch(searchUrl, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return Response.json({ results: [] });
        const data = await res.json();
        const results = (data.metas || []).slice(0, 20).map((m) => ({
          id: m.id,
          type: m.type,
          name: m.name,
          year: m.year,
          poster: m.poster,
          description: m.description,
          imdb_rating: m.imdbRating,
          genres: m.genres,
        }));
        return Response.json({ results });
      } catch {
        return Response.json({ results: [] });
      }
    }

    return Response.json(
      { error: "Provide id, query, or validate_url parameter" },
      { status: 400 },
    );
  } catch (e) {
    console.error("GET /api/stremio:", e);
    return Response.json(
      { error: "Failed to fetch content data" },
      { status: 500 },
    );
  }
}
