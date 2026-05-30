import { Stack } from "expo-router";
import { useStore } from "@/store";
import { getTheme } from "@/utils/theme";

export default function ProfileLayout() {
  const colorScheme = useStore((s) => s.colorScheme);
  const C = getTheme(colorScheme);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
