import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SIZE,
  TYPOGRAPHY,
} from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,

        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.divider,
          borderTopWidth: 1,
          height: SIZE.bottomTabHeight,
          paddingTop: 7,
          paddingBottom: 7,
          paddingHorizontal: 6,
          ...SHADOWS.elevated,
        },
        tabBarItemStyle: { borderRadius: RADIUS.lg },
        tabBarActiveBackgroundColor: COLORS.primarySoft,

        tabBarLabelStyle: {
          ...TYPOGRAPHY.caption,
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="establishments"
        options={{
          title: 'Places',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'business' : 'business-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'cloud-upload' : 'cloud-upload-outline'} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'document-text' : 'document-text-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
