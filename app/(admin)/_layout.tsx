import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { COLORS, SIZE, TYPOGRAPHY } from '@/constants/theme';

export default function AdminTabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, height: SIZE.bottomTabHeight },
      tabBarLabelStyle: { ...TYPOGRAPHY.caption, fontSize: 11 },
    }}>
      <Tabs.Screen name="admin-dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="admin-bsis" options={{ title: 'BSIs', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="admin-inspections" options={{ title: 'Inspections', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="admin-profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
