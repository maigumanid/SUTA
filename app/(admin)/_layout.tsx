import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { COLORS, RADIUS, SHADOWS, SIZE, TYPOGRAPHY } from '@/constants/theme';

export default function AdminTabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.divider, borderTopWidth: 1, height: SIZE.bottomTabHeight, paddingTop: 7, paddingBottom: 7, paddingHorizontal: 6, ...SHADOWS.elevated },
      tabBarItemStyle: { borderRadius: RADIUS.lg },
      tabBarActiveBackgroundColor: COLORS.primarySoft,
      tabBarLabelStyle: { ...TYPOGRAPHY.caption, fontSize: 10, fontWeight: '700' },
    }}>
      <Tabs.Screen name="admin-dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="admin-bsis" options={{ title: 'BSIs', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="admin-inspections" options={{ title: 'Inspections', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="admin-reports" options={{ title: 'Reports', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'document-text' : 'document-text-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="admin-profile" options={{ title: 'Profile', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} /> }} />
    </Tabs>
  );
}
