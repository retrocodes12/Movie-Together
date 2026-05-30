import { Redirect } from "expo-router";
import { useStore } from "@/store";

export default function Index() {
  const user = useStore((s) => s.user);
  const isLoading = useStore((s) => s.isLoading);

  if (isLoading) return null;

  if (!user) {
    return <Redirect href="/(auth)/onboard" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
