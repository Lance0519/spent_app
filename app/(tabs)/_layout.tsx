import React, { useEffect } from 'react';
import tw, { useAppColorScheme } from 'twrnc';
import { Tabs } from 'expo-router';
import { Home, List, User, Target } from 'lucide-react-native';
import { setupNotificationHandler, registerForPushNotificationsAsync } from '../../services/NotificationService';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textSecondary } = useTheme();

  useEffect(() => {
    setupNotificationHandler();
    registerForPushNotificationsAsync();
  }, []);

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: accentColor,
      tabBarInactiveTintColor: textSecondary,
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
