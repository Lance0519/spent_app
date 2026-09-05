import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform, Switch, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Settings, Bell, CircleHelp, Shield, ChevronRight, DownloadCloud, UploadCloud, Moon, Sun, FileText, Edit2, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw, { useAppColorScheme } from 'twrnc';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { exportBackupJSON, importBackupJSON, getDB, getUserProfile, updateUserProfile, updateBiometricsEnabled } from '../../db/database';
import { scheduleDailyReminder } from '../../services/NotificationService';

export default function AccountScreen() {
  const router = useRouter();
  const [colorScheme, toggleColorScheme, setColorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [profile, setProfile] = useState({ name: 'Loading...', email: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  React.useEffect(() => {
    try {
      const p = getUserProfile();
      setProfile(p);
      setEditName(p.name);
      setEditEmail(p.email);
      setBiometricsEnabled(p.biometrics_enabled === 1);
    } catch(e) {}
  }, []);

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    updateUserProfile(editName, editEmail);
    setProfile({ name: editName, email: editEmail });
    setIsEditingProfile(false);
  };

  const toggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    await scheduleDailyReminder(val);
    if (val) {
      Alert.alert('Reminders Enabled', 'You will be reminded to log your expenses every day at 8:00 PM.');
    }
  };

  const toggleBiometrics = async (val: boolean) => {
    if (val) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Supported', 'Your device does not support or has not set up biometric authentication.');
        return;
      }
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to enable App Lock' });
      if (auth.success) {
        setBiometricsEnabled(true);
        updateBiometricsEnabled(true);
        Alert.alert('App Lock Enabled', 'Biometric authentication is now required to open the app or perform sensitive actions.');
      }
    } else {
      setBiometricsEnabled(false);
      updateBiometricsEnabled(false);
    }
  };

  const handleWipeData = () => {
    Alert.alert(
      'Wipe All Data',
      'This will permanently delete ALL transactions, categories, and budgets. This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Wipe Data', 
          style: 'destructive',
          onPress: async () => {
             const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to wipe data' });
             if (auth.success || !biometricsEnabled) {
               try {
                 const db = getDB();
                 db.execSync('DELETE FROM transactions; DELETE FROM categories; DELETE FROM budgets; UPDATE accounts SET balance = 0;');
                 Alert.alert('Success', 'All data has been permanently wiped and balances reset to 0.');
               } catch (e) {
                 Alert.alert('Error', (e as Error).message);
               }
             }
          }
        }
      ]
    );
  };

  const handleExport = async () => {
    try {
      const jsonStr = exportBackupJSON();

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spent_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Export Successful', 'Your backup has been downloaded to your computer.');
        return;
      }

      const fileUri = FileSystem.documentDirectory + 'spent_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(fileUri, {
            dialogTitle: 'Export Backup',
            mimeType: 'application/json'
          });
        } catch (shareErr) {
          await Clipboard.setStringAsync(jsonStr);
          Alert.alert('Copied to Clipboard!', 'The share menu failed to open. We copied your raw backup data directly to your clipboard. You can paste it into your Notes app or an Email to save it safely.');
        }
      } else {
        await Clipboard.setStringAsync(jsonStr);
        Alert.alert('Copied to Clipboard!', 'Sharing is unavailable on this device. We copied your raw backup data directly to your clipboard. You can paste it into your Notes app to save it safely.');
      }
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  };

    const handleImport = async () => {
    try {
      if (Platform.OS === 'web') {
        window.alert('Data import requires a physical device.');
        return;
      }

      // Use '*/*' because Android file picker often fails to recognize .json MIME types
      const result = await DocumentPicker.getDocumentAsync({ 
        type: '*/*', 
        copyToCacheDirectory: true 
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        
        Alert.alert(
          'Restore Data',
          'This will overwrite all current data. Are you sure?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Restore', 
              style: 'destructive',
              onPress: async () => {
                try {
                  const response = await fetch(fileUri);
                  const jsonStr = await response.text();
                  importBackupJSON(jsonStr);
                  Alert.alert('Success', 'Data restored successfully! Please restart the app to refresh data.');
                } catch (err) {
                  Alert.alert('Import Failed', 'The selected file is invalid or corrupted. ' + (err as Error).message);
                }
              }
            }
          ]
        );
      }
    } catch (e) {
      Alert.alert('Import Failed', (e as Error).message);
    }
  };

  return (
    <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tw`pt-16 pb-8 items-center rounded-b-3xl shadow-lg`}
      >
        <View style={tw`w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-4 border-2 border-white/40`}>
          <Text style={tw`text-3xl font-black text-white`}>{profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}</Text>
        </View>
        
        {isEditingProfile ? (
          <View style={tw`w-full px-8 items-center`}>
            <TextInput 
              style={tw`bg-white/20 text-white font-bold text-lg px-4 py-2 rounded-xl mb-2 w-full text-center`}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Name"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            <TextInput 
              style={tw`bg-white/20 text-white font-medium text-sm px-4 py-2 rounded-xl mb-3 w-full text-center`}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Your Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            <TouchableOpacity onPress={handleSaveProfile} style={tw`flex-row items-center bg-white/25 px-6 py-2 rounded-full border border-white/50`}>
              <Check size={16} color="#fff" style={tw`mr-2`} />
              <Text style={tw`text-white font-bold`}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={tw`flex-row items-center mb-1`}>
              <Text style={tw`text-2xl font-black text-white tracking-tight`}>{profile.name}</Text>
              <TouchableOpacity onPress={() => setIsEditingProfile(true)} style={tw`ml-2 bg-white/20 p-1.5 rounded-full`}>
                <Edit2 size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={tw`text-sm font-medium text-blue-100`}>{profile.email}</Text>
          </>
        )}
      </LinearGradient>

      <ScrollView style={tw`flex-1 px-6 pt-8`}>
        <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider ml-1`}>Account Settings</Text>
        
        <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-2 shadow-sm shadow-slate-200 dark:shadow-none mb-6 border border-transparent dark:border-slate-800`}>
          <TouchableOpacity onPress={() => router.push('/categories')} style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                <Settings color="#64748b" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Manage Categories</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>
          
          <View style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                <Bell color="#64748b" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Daily Reminders</Text>
            </View>
            <Switch 
              value={remindersEnabled} 
              onValueChange={toggleReminders} 
              trackColor={{ false: '#64748b', true: '#3b82f6' }}
              thumbColor={'#fff'}
            />
          </View>
          
          <View style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                {isDark ? <Moon color="#64748b" size={20} /> : <Sun color="#64748b" size={20} />}
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Dark Mode</Text>
            </View>
            <Switch 
              value={isDark} 
              onValueChange={(val) => setColorScheme(val ? 'dark' : 'light')} 
              trackColor={{ false: '#64748b', true: '#3b82f6' }}
              thumbColor={'#fff'}
            />
          </View>

          <View style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                <Shield color="#64748b" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Biometric Security</Text>
            </View>
            <Switch 
              value={biometricsEnabled} 
              onValueChange={toggleBiometrics} 
              trackColor={{ false: '#64748b', true: '#3b82f6' }}
              thumbColor={'#fff'}
            />
          </View>

          <TouchableOpacity onPress={handleWipeData} style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-full items-center justify-center mr-4`}>
                <Shield color="#f43f5e" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-rose-500 dark:text-rose-400`}>Wipe All Data</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleExport} style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mr-4`}>
                <DownloadCloud color="#3b82f6" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Backup Data (Export)</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleImport} style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-full items-center justify-center mr-4`}>
                <UploadCloud color="#10b981" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Restore Data (Import)</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => Linking.openURL('mailto:justinelance0067@gmail.com?subject=SPENT%20App%20Support')}
            style={tw`flex-row items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800/50`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                <CircleHelp color="#64748b" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Help & Support</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                'Data Privacy & Terms',
                'Your data privacy is our highest priority.\n\nAll financial transactions, categories, budgets, and security parameters are strictly stored LOCALLY on your physical device via an encrypted SQLite database.\n\nWe do not collect, transmit, or store your personal data on any remote servers. You have absolute control over your information and can export, import, or permanently wipe your data at any time.'
              );
            }}
            style={tw`flex-row items-center justify-between p-4`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-4`}>
                <FileText color="#64748b" size={20} />
              </View>
              <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>Terms & Data Privacy</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={tw`flex-row items-center justify-center py-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl mb-12 border border-rose-100 dark:border-rose-500/20`}
          onPress={() => router.replace('/')}
        >
          <LogOut color="#ef4444" size={20} />
          <Text style={tw`text-rose-500 dark:text-rose-400 font-bold ml-2 text-base`}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
