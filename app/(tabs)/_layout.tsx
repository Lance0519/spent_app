import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { Tabs } from 'expo-router';
import { Home, List, User, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { setupNotificationHandler, registerForPushNotificationsAsync } from '../../services/NotificationService';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { accentColor, textSecondary } = useTheme();

  useEffect(() => {
    setupNotificationHandler();
    registerForPushNotificationsAsync();
  }, []);

  const bottomMargin = Math.max(insets.bottom, 12);
  const tabHeight = 64;

  const renderTabBarBackground = () => (
    <View style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}>
      <BlurView
        intensity={55}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(35, 32, 44, 0.78)', 'rgba(22, 20, 28, 0.70)']
            : ['rgba(255, 255, 255, 0.85)', 'rgba(244, 239, 248, 0.65)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.01)', 'rgba(0, 0, 0, 0.08)']
            : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: accentColor,
      tabBarInactiveTintColor: textSecondary,
      tabBarBackground: renderTabBarBackground,
      tabBarStyle: {
        position: 'absolute',
        bottom: bottomMargin,
        left: 16,
        right: 16,
        height: tabHeight,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.65)',
        borderTopWidth: 1,
        borderTopColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.75)',
        backgroundColor: 'transparent',
        paddingBottom: 8,
        paddingTop: 8,
        ...Platform.select({
          ios: {
            shadowColor: isDark ? '#000' : '#4A3B52',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.35 : 0.08,
            shadowRadius: 16,
          },
          android: {
            elevation: isDark ? 6 : 4,
          },
          web: {
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.40)'
              : '0 6px 20px rgba(100, 80, 120, 0.10)',
          } as any,
        }),
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: 'bold',
      },
      sceneStyle: { backgroundColor: 'transparent' }
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
