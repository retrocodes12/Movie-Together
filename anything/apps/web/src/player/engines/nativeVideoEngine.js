/**
 * Native Video Engine — direct port from NuvioMedia/NuvioWeb
 */
export const nativeVideoEngine = {
  name: "native",

  canPlay(videoElement, mimeType) {
    if (!videoElement || !mimeType) return false;
    try {
      const result = String(
        videoElement.canPlayType(String(mimeType)),
      ).toLowerCase();
      return result === "probably" || result === "maybe";
    } catch (_) {
      return false;
    }
  },

  shouldDeclareMimeType(mimeType) {
    const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
    return (
      mime === "video/mp4" ||
      mime === "video/webm" ||
      mime === "video/ogg" ||
      mime === "audio/mpeg" ||
      mime === "audio/aac" ||
      mime === "application/vnd.apple.mpegurl" ||
      mime === "application/x-mpegurl"
    );
  },

  load(videoElement, url, mimeType = null) {
    if (!videoElement) return false;
    videoElement.removeAttribute("src");
    Array.from(videoElement.querySelectorAll("source")).forEach((n) =>
      n.remove(),
    );
    if (mimeType && this.shouldDeclareMimeType(mimeType)) {
      const source = document.createElement("source");
      source.src = url;
      source.type = mimeType;
      videoElement.appendChild(source);
    } else {
      videoElement.src = url;
    }
    videoElement.load();
    return true;
  },
};
