/**
 * Platform detection — adapted from Nuvio platform/index.js
 * Browser-only (no native/WebOS/Tizen in this environment)
 */
export const Platform = {
  getName() {
    const ua = navigator.userAgent || "";
    if (/Tizen/i.test(ua)) return "tizen";
    if (/Web0S|webOS/i.test(ua)) return "webos";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "web";
  },
  isWebOS() {
    return this.getName() === "webos";
  },
  isTizen() {
    return this.getName() === "tizen";
  },
  isMobile() {
    const ua = navigator.userAgent || "";
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  },
  isDesktop() {
    return !this.isMobile();
  },
};
