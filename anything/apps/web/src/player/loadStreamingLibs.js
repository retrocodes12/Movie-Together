/**
 * Dynamic streaming library loader
 * Loads hls.js and dash.js from CDN on demand.
 * Adapted from Nuvio's runtime/loadStreamingLibs.js
 */

const HLS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1.5.11/dist/hls.min.js";
const DASH_CDN = "https://cdn.dashjs.org/latest/dash.all.min.js";

let hlsLoading = null;
let dashLoading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadHlsJs() {
  if (globalThis.Hls) return globalThis.Hls;
  if (!hlsLoading) {
    hlsLoading = loadScript(HLS_CDN).then(() => globalThis.Hls);
  }
  return hlsLoading;
}

export async function loadDashJs() {
  if (globalThis.dashjs) return globalThis.dashjs;
  if (!dashLoading) {
    dashLoading = loadScript(DASH_CDN).then(() => globalThis.dashjs);
  }
  return dashLoading;
}

export async function loadStreamingLibs() {
  const [hls, dash] = await Promise.allSettled([loadHlsJs(), loadDashJs()]);
  return {
    hlsLoaded: hls.status === "fulfilled" && Boolean(hls.value),
    dashLoaded: dash.status === "fulfilled" && Boolean(dash.value),
  };
}
