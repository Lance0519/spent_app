import { Stack, ErrorBoundary } from 'expo-router';
export { ErrorBoundary };
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View, TouchableOpacity, Platform, BackHandler, Modal } from 'react-native';
import tw, { useDeviceContext, useAppColorScheme } from 'twrnc';
import { Shield, LogOut } from 'lucide-react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { CustomThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

import { AmbientBackground } from '../components/AmbientBackground';
import { GlassView } from '../components/GlassView';

function RootNavigation() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textOnAccent } = useTheme();
  const { isLocked, authChecked, unlockApp, exitSession, exitApp } = useAuth();

  // On Android, pressing hardware back button on the lock screen exits the app
  useEffect(() => {
    if (!isLocked) return;
    const backAction = () => {
      if (Platform.OS === 'android') {
        BackHandler.exitApp();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isLocked]);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#141218' : '#FEF7FF' }
        }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>

        <Modal visible={!authChecked || isLocked} animationType="fade" transparent={false}>
          <AmbientBackground style={tw`items-center justify-center p-6`}>
            <GlassView 
              intensity={60} 
              borderRadius={32}
              style={tw`w-full max-w-sm p-8 items-center`}
            >
              <View style={[tw`w-22 h-22 rounded-full items-center justify-center mb-5`, { backgroundColor: `${accentColor}20`, borderWidth: 1, borderColor: `${accentColor}40` }]}>
                <Shield size={40} color={accentColor} />
              </View>
              <Text style={[tw`text-2xl font-black mb-2 text-center`, { color: textPrimary }]}>SPENT is Locked</Text>
              <Text style={[tw`text-center mb-7 text-sm font-medium leading-5`, { color: textSecondary }]}>
                Biometric authentication or device passcode is required to access your financial data securely.
              </Text>
              
              <TouchableOpacity 
                onPress={() => unlockApp()} 
                style={[tw`px-8 py-3.5 rounded-2xl shadow-lg w-full items-center mb-3 min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Unlock SPENT</Text>
              </TouchableOpacity>

              {Platform.OS === 'android' ? (
                <TouchableOpacity 
                  onPress={exitApp} 
                  style={tw`flex-row items-center justify-center py-3 px-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 w-full min-h-[44px] bg-rose-50/50 dark:bg-rose-500/10`}
                >
                  <LogOut size={16} color="#ef4444" style={tw`mr-2`} />
                  <Text style={tw`text-rose-500 font-bold text-sm`}>Exit App</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  onPress={exitSession} 
                  style={tw`flex-row items-center justify-center py-3 px-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 w-full min-h-[44px] bg-rose-50/50 dark:bg-rose-500/10`}
                >
                  <LogOut size={16} color="#ef4444" style={tw`mr-2`} />
                  <Text style={tw`text-rose-500 font-bold text-sm`}>Log Out Session</Text>
                </TouchableOpacity>
              )}
            </GlassView>
          </AmbientBackground>
        </Modal>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useDeviceContext(tw);

  return (
    <CustomThemeProvider>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </CustomThemeProvider>
  );
}
