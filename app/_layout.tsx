import { Stack, ErrorBoundary } from 'expo-router';
export { ErrorBoundary };
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View, TouchableOpacity, Platform, BackHandler } from 'react-native';
import tw, { useDeviceContext, useAppColorScheme } from 'twrnc';
import { Shield, LogOut } from 'lucide-react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { CustomThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

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

  if (!authChecked || isLocked) {
    return (
      <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218] items-center justify-center p-6`}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[tw`w-24 h-24 rounded-full items-center justify-center mb-6`, { backgroundColor: `${accentColor}20` }]}>
          <Shield size={44} color={accentColor} />
        </View>
        <Text style={[tw`text-2xl font-black mb-2`, { color: textPrimary }]}>SPENT is Locked</Text>
        <Text style={[tw`text-center mb-8 max-w-xs text-sm font-medium`, { color: textSecondary }]}>
          Biometric authentication or device passcode is required to access your financial data securely.
        </Text>
        
        <TouchableOpacity 
          onPress={() => unlockApp()} 
          style={[tw`px-8 py-4 rounded-2xl shadow-lg w-full items-center mb-3 min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
        >
          <Text style={[tw`font-bold text-lg`, { color: textOnAccent }]}>Unlock SPENT</Text>
        </TouchableOpacity>

        {Platform.OS === 'android' ? (
          <TouchableOpacity 
            onPress={exitApp} 
            style={tw`flex-row items-center justify-center py-3.5 px-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 w-full min-h-[48px] bg-rose-50/50 dark:bg-rose-500/10`}
          >
            <LogOut size={16} color="#ef4444" style={tw`mr-2`} />
            <Text style={tw`text-rose-500 font-bold text-sm`}>Exit App</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={exitSession} 
            style={tw`flex-row items-center justify-center py-3.5 px-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 w-full min-h-[48px] bg-rose-50/50 dark:bg-rose-500/10`}
          >
            <LogOut size={16} color="#ef4444" style={tw`mr-2`} />
            <Text style={tw`text-rose-500 font-bold text-sm`}>Log Out Session</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

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
