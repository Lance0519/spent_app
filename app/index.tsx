import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw, { useAppColorScheme } from 'twrnc';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingDown, Target, ShieldCheck } from 'lucide-react-native';
import { FinanceService } from '../services/FinanceService';
import { useAuth } from '../context/AuthContext';
import React, { useEffect } from 'react';

export default function WelcomeScreen() {
  const router = useRouter();
  const { loginUser } = useAuth();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    try {
      const status = FinanceService.getSessionStatus();
      if (status.isLoggedIn && status.hasCompletedOnboarding) {
        router.replace('/(tabs)');
      }
    } catch(e) {}
  }, [router]);

  const handleStart = () => {
    loginUser();
    router.replace('/(tabs)');
  };

  const showLegalNotice = () => {
    Alert.alert(
      'Terms & Privacy Policy',
      'SPENT is a 100% offline-first application. Your financial data, accounts, and transactions are stored locally inside your device application sandbox.\n\nNo personal financial information is ever transmitted to remote cloud servers.'
    );
  };

  return (
    <View style={tw`flex-1 relative`}>
      <LinearGradient
        colors={isDark ? ['#141218', '#211F26', '#141218'] : ['#FEF7FF', '#F3EDF7', '#FEF7FF']}
        style={tw`absolute top-0 left-0 right-0 bottom-0`}
      />
      <SafeAreaView style={tw`flex-1 items-center justify-between px-6 pt-4 pb-6`}>
        
        {/* Top & Hero Section */}
        <View style={tw`flex-1 justify-center items-center w-full`}>
          <View style={[tw`w-48 h-48 rounded-full items-center justify-center mb-6 bg-white dark:bg-[#2B2930] shadow-xl shadow-emerald-500/10`, { elevation: 12 }]}>
            <Image 
              source={require('../assets/logo.png')} 
              style={tw`w-36 h-36`} 
              resizeMode="contain" 
            />
          </View>
          
          <Text style={[tw`text-5xl font-black text-center mb-3 tracking-tight`, { color: isDark ? '#FFFFFF' : '#18181B' }]}>
            SPENT
          </Text>
          
          <Text style={[tw`text-base font-semibold text-center tracking-wide px-4 leading-6 mb-8`, { color: isDark ? '#ECEFF1' : '#475569' }]}>
            Your finances, simplified and amplified.
          </Text>

          {/* 3 Content-Balancing Feature Chips */}
          <View style={tw`flex-col gap-2.5 w-full max-w-xs mb-4`}>
            <View style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800/80 px-4 py-2.5 rounded-2xl`}>
              <View style={tw`w-8 h-8 rounded-full bg-emerald-500/15 items-center justify-center mr-3`}>
                <TrendingDown size={17} color="#00C853" />
              </View>
              <Text style={[tw`text-xs font-bold`, { color: isDark ? '#ECEFF1' : '#1E293B' }]}>
                Expense & Loan Tracking
              </Text>
            </View>

            <View style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800/80 px-4 py-2.5 rounded-2xl`}>
              <View style={tw`w-8 h-8 rounded-full bg-emerald-500/15 items-center justify-center mr-3`}>
                <Target size={17} color="#00C853" />
              </View>
              <Text style={[tw`text-xs font-bold`, { color: isDark ? '#ECEFF1' : '#1E293B' }]}>
                Smart Monthly Budgets & Goals
              </Text>
            </View>

            <View style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800/80 px-4 py-2.5 rounded-2xl`}>
              <View style={tw`w-8 h-8 rounded-full bg-emerald-500/15 items-center justify-center mr-3`}>
                <ShieldCheck size={17} color="#00C853" />
              </View>
              <Text style={[tw`text-xs font-bold`, { color: isDark ? '#ECEFF1' : '#1E293B' }]}>
                Offline-Ready & 100% Private
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Actions & Legal */}
        <View style={tw`w-full flex-col items-center gap-2 max-w-sm pb-2`}>
          {/* Primary CTA: Emerald Pill Button */}
          <TouchableOpacity 
            style={[tw`w-full rounded-full shadow-lg shadow-emerald-500/30 overflow-hidden min-h-[52px]`, { elevation: 8 }]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <LinearGradient 
              colors={['#00C853', '#009624']} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={tw`w-full py-4 items-center justify-center min-h-[52px]`}
            >
              <Text style={tw`text-white font-black text-lg tracking-wider`}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary Navigation */}
          <TouchableOpacity 
            style={tw`w-full py-3 items-center justify-center min-h-[48px]`}
            onPress={handleStart}
            activeOpacity={0.7}
          >
            <Text style={[tw`text-sm font-bold`, { color: isDark ? '#ECEFF1' : '#334155' }]}>
              Already have an account? <Text style={tw`text-[#00C853] font-black`}>Log In</Text>
            </Text>
          </TouchableOpacity>

          {/* Legal Caption */}
          <TouchableOpacity onPress={showLegalNotice} style={tw`px-4 pt-1 min-h-[36px] justify-center`}>
            <Text style={[tw`text-[11px] font-medium text-center`, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              By continuing, you agree to our <Text style={tw`underline`}>Terms</Text> and <Text style={tw`underline`}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}
