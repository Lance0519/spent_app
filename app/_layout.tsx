import { Stack, ErrorBoundary } from 'expo-router';
export { ErrorBoundary };
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import tw, { useDeviceContext, useAppColorScheme } from 'twrnc';
import * as LocalAuthentication from 'expo-local-authentication';
import { getUserProfile } from '../db/database';
import { Shield } from 'lucide-react-native';

import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { CustomThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  useDeviceContext(tw);
  const [colorScheme] = useAppColorScheme(tw);
  const [isLocked, setIsLocked] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkLock();
  }, []);

  const checkLock = async () => {
    try {
      const p = getUserProfile();
      if (p.biometrics_enabled === 1) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to open SPENT',
            fallbackLabel: 'Use Passcode'
          });
          if (result.success) {
            setIsLocked(false);
          }
        } else {
          setIsLocked(false); // Unlock if hardware somehow became unavailable
        }
      } else {
        setIsLocked(false); // Unlock if not enabled
      }
    } catch (e) {
      setIsLocked(false); // Failsafe unlock if DB fails to load
    }
    setAuthChecked(true);
  };

  if (!authChecked || isLocked) {
    return (
      <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218] items-center justify-center p-6`}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={tw`w-24 h-24 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mb-6`}>
          <Shield size={40} color="#3b82f6" />
        </View>
        <Text style={[tw`text-2xl font-black mb-2`, { color: colorScheme === 'dark' ? '#FFFFFF' : '#18181B' }]}>SPENT is Locked</Text>
        <Text style={[tw`text-center mb-8`, { color: colorScheme === 'dark' ? '#A1A1AA' : '#71717A' }]}>Biometric authentication is required to access your financial data securely.</Text>
        <TouchableOpacity onPress={checkLock} style={tw`bg-blue-600 px-8 py-4 rounded-2xl shadow-lg shadow-blue-500/30 w-full items-center`}>
          <Text style={tw`text-white font-bold text-lg`}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <CustomThemeProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colorScheme === 'dark' ? '#141218' : '#FEF7FF' }
          }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </GestureHandlerRootView>
      </ThemeProvider>
    </CustomThemeProvider>
  );
}
