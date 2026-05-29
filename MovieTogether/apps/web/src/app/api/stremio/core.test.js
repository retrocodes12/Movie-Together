import { describe, expect, it } from "vitest";
import {
  addonBaseUrl,
  buildResourceUrl,
  normalizeManifestUrl,
  normalizeStream,
  resolveAddonList,
} from "./core.js";

describe("stremio core", () => {
  it("normalizes manifest urls", () => {
    expect(normalizeManifestUrl("stremio://example.test/manifest.json")).toBe(
      "https://example.test/manifest.json",
    );
    expect(normalizeManifestUrl("example.test/addon")).toBe(
      "https://example.test/addon/manifest.json",
    );
    expect(addonBaseUrl("https://example.test/a/manifest.json")).toBe(
      "https://example.test/a",
    );
  });

  it("builds Stremio resource urls with extra args", () => {
    expect(
      buildResourceUrl("https://addon.test/x/manifest.json", "catalog", "movie", "tmdb.top", {
        search: "dune part",
        skip: 20,
      }),
    ).toBe("https://addon.test/x/catalog/movie/tmdb.top/search=dune%20part&skip=20.json");

    expect(
      buildResourceUrl("https://addon.test/manifest.json", "stream", "series", "tt0108778:1:1"),
    ).toBe("https://addon.test/stream/series/tt0108778:1:1.json");
  });

  it("dedupes configured addon urls", () => {
    const list = resolveAddonList(JSON.stringify(["https://cinemeta.strem.io/manifest.json"]));
    expect(list.filter((u) => u === "https://cinemeta.strem.io/manifest.json")).toHaveLength(1);
  });

  it("classifies playable direct streams", () => {
    const stream = normalizeStream(
      { name: "1080p", url: "https://cdn.test/movie.m3u8" },
      { name: "Test", url: "https://addon.test/manifest.json" },
    );
    expect(stream.playable).toBe(true);
    expect(stream.streamType).toBe("hls");
    expect(stream.quality).toBe("1080p");
  });
});
