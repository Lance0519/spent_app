import React, { useEffect } from 'react';
import tw, { useAppColorScheme } from 'twrnc';
import { Tabs } from 'expo-router';
import { Home, List, User, Target } from 'lucide-react-native';
import { setupNotificationHandler, registerForPushNotificationsAsync } from '../../services/NotificationService';

export default function TabLayout() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    setupNotificationHandler();
    registerForPushNotificationsAsync();
  }, []);

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: isDark ? '#60a5fa' : '#2563eb',
      tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
      tabBarStyle: tw`bg-[#FEF7FF] dark:bg-[#141218] border-t border-[#F4EFF4] dark:border-[#49454F] h-[60px] pb-2 pt-2`,
      sceneStyle: { backgroundColor: isDark ? '#141218' : '#FEF7FF' }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
