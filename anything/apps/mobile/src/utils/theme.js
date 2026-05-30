export const LightColors = {
  background: "#FFFFFF",
  canvasMuted: "#F9FAFB",
  foreground: "#111827",
  foregroundMuted: "#6B7280",
  borderGhost: "#E5E7EB",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  orange: "#EA580C",
  green: "#16A34A",
  red: "#DC2626",
  cardBg: "#FFFFFF",
  inputBg: "#FFFFFF",
  tabBarBg: "#FFFFFF",
  tabBarBorder: "#E5E7EB",
};

export const DarkColors = {
  background: "#0F172A",
  canvasMuted: "#1E293B",
  foreground: "#F9FAFB",
  foregroundMuted: "#94A3B8",
  borderGhost: "#334155",
  primary: "#3B82F6",
  primarySoft: "#1D3461",
  orange: "#FB923C",
  green: "#4ADE80",
  red: "#F87171",
  cardBg: "#1E293B",
  inputBg: "#1E293B",
  tabBarBg: "#0F172A",
  tabBarBorder: "#334155",
};

export function getTheme(colorScheme) {
  return colorScheme === "dark" ? DarkColors : LightColors;
}

export const Typography = {
  hero: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.5,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Inter_400Regular",
  },
  meta: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
