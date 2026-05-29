/**
 * subtitleParser.js
 *
 * Parses WebVTT (.vtt) and SRT (.srt) subtitle files into cue objects.
 * Runs entirely client-side — no server dependency.
 *
 * Output format:
 *  Array<{ id: string, startTime: number, endTime: number, text: string }>
 *  where startTime/endTime are in seconds.
 */

/** Convert "HH:MM:SS.mmm" or "HH:MM:SS,mmm" to seconds */
function timeToSeconds(str) {
  if (!str) return 0;
  const clean = str.trim().replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m) * 60 + parseFloat(s);
  }
  return parseFloat(clean);
}

/** Strip HTML/VTT tags from cue text */
function stripTags(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Parse WebVTT format */
function parseVTT(raw) {
  const cues = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  // Skip header
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes("-->")) {
      const [startStr, endStr] = line
        .split("-->")
        .map((s) => s.split(" ")[0].trim());
      const startTime = timeToSeconds(startStr);
      const endTime = timeToSeconds(endStr);

      const textLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }

      const text = stripTags(textLines.join("\n"));
      if (text) {
        cues.push({ id: `cue-${startTime}`, startTime, endTime, text });
      }
    } else {
      i++;
    }
  }

  return cues;
}

/** Parse SRT format */
function parseSRT(raw) {
  const cues = [];
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // First line may be a sequence number
    let timeLine = lines[0];
    let textStart = 1;
    if (/^\d+$/.test(timeLine.trim())) {
      timeLine = lines[1];
      textStart = 2;
    }

    if (!timeLine || !timeLine.includes("-->")) continue;

    const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
    const startTime = timeToSeconds(startStr);
    const endTime = timeToSeconds(endStr);

    const text = stripTags(lines.slice(textStart).join("\n"));
    if (text) {
      cues.push({ id: `cue-${startTime}`, startTime, endTime, text });
    }
  }

  return cues;
}

/** Auto-detect format and parse */
export function parseSubtitles(raw) {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("WEBVTT")) return parseVTT(trimmed);
  return parseSRT(trimmed);
}

/** Fetch and parse a subtitle URL */
export async function fetchAndParseSubtitles(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/plain, text/vtt, */*" },
    });
    if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`);
    const raw = await res.text();
    return parseSubtitles(raw);
  } catch (e) {
    console.warn("subtitleParser fetch error:", e?.message);
    return [];
  }
}

/** Get active cue for a given timestamp */
export function getActiveCue(cues, currentTime) {
  if (!cues || !cues.length) return null;
  for (const cue of cues) {
    if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
      return cue;
    }
  }
  return null;
}
