import { Tabs } from "expo-router";
import { Home, Film, User, Users, Bell } from "lucide-react-native";
import { View, Text } from "react-native";
import { useStore } from "@/store";
import { getTheme } from "@/utils/theme";
import { useQuery } from "@tanstack/react-query";

function BadgeIcon({ Icon, color, size, count }) {
  return (
    <View style={{ position: "relative" }}>
      <Icon color={color} size={size} />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -6,
            backgroundColor: "#EF4444",
            borderRadius: 8,
            minWidth: 14,
            height: 14,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 2,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 8,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            {count > 9 ? "9+" : count}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count", deviceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/notifications?device_id=${deviceId}&unread_only=true&limit=1`,
      );
      if (!res.ok) return { unread_count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!deviceId,
  });

  const { data: requestsData } = useQuery({
    queryKey: ["friend-requests-count", deviceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/friends?device_id=${deviceId}&status=pending`,
      );
      if (!res.ok) return { requests: [] };
      return res.json();
    },
    refetchInterval: 60000,
    enabled: !!deviceId,
  });

  const notifCount = notifData?.unread_count || 0;
  const friendRequestCount = requestsData?.requests?.length || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: C.tabBarBorder,
          paddingTop: 4,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.foregroundMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: "Rooms",
          tabBarIcon: ({ color }) => <Film color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) => (
            <BadgeIcon
              Icon={Users}
              color={color}
              size={22}
              count={friendRequestCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => (
            <BadgeIcon Icon={Bell} color={color} size={22} count={notifCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
