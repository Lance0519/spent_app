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
    <View style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]} pointerEvents="none">
      {Platform.OS !== 'android' ? (
        <BlurView
          intensity={85}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(24, 21, 33, 0.95)', 'rgba(16, 14, 22, 0.92)']
            : ['rgba(255, 255, 255, 0.96)', 'rgba(248, 250, 252, 0.92)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'rgba(0, 0, 0, 0.0)']
            : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.40 }}
        style={StyleSheet.absoluteFill}
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
        borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.12)',
        borderTopWidth: 1,
        borderTopColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.16)',
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
