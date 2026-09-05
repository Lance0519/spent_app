import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw, { useAppColorScheme } from 'twrnc';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserProfile } from '../db/database';
import React, { useEffect } from 'react';

export default function WelcomeScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    try {
      const p = getUserProfile();
      // If the default 'U' was changed, or if biometrics are enabled, we know they're returning
      if (p.biometrics_enabled === 1 || p.name !== 'John Doe') {
        router.replace('/(tabs)');
      }
    } catch(e) {}
  }, []);

  return (
    <View style={tw`flex-1 relative`}>
      <LinearGradient
        colors={isDark ? ['#141218', '#2B2930', '#141218'] : ['#FEF7FF', '#F3EDF7', '#FEF7FF']}
        style={tw`absolute top-0 left-0 right-0 bottom-0`}
      />
      <SafeAreaView style={tw`flex-1 items-center justify-center p-6`}>
        <View style={tw`flex-1 justify-center items-center`}>
          <View style={[tw`w-56 h-56 rounded-full items-center justify-center mb-8 bg-white dark:bg-[#2B2930] shadow-xl shadow-blue-500/10`, { elevation: 15 }]}>
            <Image 
              source={require('../assets/logo.png')} 
              style={tw`w-40 h-40`} 
              resizeMode="contain" 
            />
          </View>
          <Text style={tw`text-5xl font-black text-slate-900 dark:text-white text-center mb-3 tracking-tighter`}>SPENT</Text>
          <Text style={tw`text-lg font-bold text-slate-500 dark:text-slate-400 text-center tracking-wide px-4`}>Your finances, simplified and amplified.</Text>
        </View>

        <View style={tw`w-full flex-col gap-4 mt-8 pb-10`}>
          <TouchableOpacity 
            style={[tw`w-full rounded-full shadow-2xl shadow-blue-500/40 overflow-hidden`, { elevation: 12 }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <LinearGradient 
              colors={['#3b82f6', '#4f46e5']} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={tw`w-full py-5 items-center justify-center`}
            >
              <Text style={tw`text-white font-black text-lg tracking-wider`}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
