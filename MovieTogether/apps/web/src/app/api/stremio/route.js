import {
  DEFAULT_ADDONS,
  fetchManifest,
  fetchManifests,
  getCatalogs,
  getCatalog,
  getMeta,
  getStreams,
  searchCatalogs,
  validateStreamUrl,
} from "./core.js";

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
        return Response.json({ error: "addon_url and catalog_id are required" }, { status: 400 });
      }
      return Response.json({
        results: await getCatalog({ addonUrl, type, catalogId, genre, skip }),
      });
    }

    if (action === "meta") {
      if (!imdbId) return Response.json({ error: "id is required" }, { status: 400 });
      return Response.json({ metadata: await getMeta({ addonUrl, type, id: imdbId, addonsParam: addons }) });
    }

    if (action === "streams") {
      const streamId = videoId || (type === "series" && season && episode ? `${imdbId}:${season}:${episode}` : imdbId);
      if (!streamId) return Response.json({ error: "id or video_id is required" }, { status: 400 });
      const streams = await getStreams({ type, id: streamId, addonsParam: addons });
      return Response.json({
        streams,
        direct_streams: streams.filter((s) => s.playable),
        total: streams.length,
        playable_total: streams.filter((s) => s.playable).length,
      });
    }

    if (imdbId) {
      const streamId =
        type === "series" && season && episode ? `${imdbId}:${season}:${episode}` : imdbId;
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
