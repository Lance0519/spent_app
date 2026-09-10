import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Platform, 
  Switch, 
  Linking, 
  TextInput, 
  Modal 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  LogOut, 
  Settings, 
  Bell, 
  CircleHelp, 
  Shield, 
  ChevronRight, 
  DownloadCloud, 
  UploadCloud, 
  Moon, 
  Sun, 
  FileText, 
  Edit2, 
  Check, 
  Eye, 
  EyeOff, 
  Wallet, 
  Landmark, 
  Smartphone, 
  CreditCard, 
  ArrowRightLeft, 
  Target, 
  PieChart, 
  List, 
  FileSpreadsheet, 
  Lock, 
  Plus, 
  Trash2, 
  X, 
  Sparkles,
  BookOpen
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw, { useAppColorScheme } from 'twrnc';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  exportBackupJSON, 
  importBackupJSON, 
  getDB, 
  getUserProfile, 
  updateUserProfile, 
  updateBiometricsEnabled,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  transferFunds,
  exportTransactionsCSV,
  Account,
  UserProfile
} from '../../db/database';
import { scheduleDailyReminder } from '../../services/NotificationService';
import { useTheme, ACCENT_PALETTES, AccentPaletteKey } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const SUPPORTED_CURRENCIES = [
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'SG$', name: 'Singapore Dollar' },
];

export default function AccountScreen() {
  const router = useRouter();
  const { lockApp, exitSession } = useAuth();
  const [colorScheme, toggleColorScheme, setColorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { 
    accentKey, 
    accentColor, 
    setAccentColor, 
    palette, 
    textPrimary, 
    textSecondary, 
    textMuted, 
    textOnAccent,
    currency,
    currencySymbol,
    formatCurrency,
    setCurrency
  } = useTheme();

  // Profile & Preferences State
  const [profile, setProfile] = useState<UserProfile>({ 
    name: 'Loading...', 
    email: '', 
    biometrics_enabled: 0,
    accent_color: 'emerald',
    currency: 'PHP',
    hide_balance_default: 0
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showNetWorth, setShowNetWorth] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Accounts & Net Worth State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const totalNetWorth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // Modals state
  const [activeModal, setActiveModal] = useState<'accounts' | 'transfer' | 'currency' | 'faq' | null>(null);

  // Add/Edit Account Form State
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [editingAccId, setEditingAccId] = useState<number | null>(null);

  // Transfer Form State
  const [transferFromId, setTransferFromId] = useState<number | null>(null);
  const [transferToId, setTransferToId] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const reloadData = useCallback(() => {
    try {
      const p = getUserProfile();
      setProfile(p);
      setEditName(p.name);
      setEditEmail(p.email);
      setBiometricsEnabled(p.biometrics_enabled === 1);
      setShowNetWorth(p.hide_balance_default === 0);

      const accs = getAccounts();
      setAccounts(accs);
      if (accs.length >= 2) {
        setTransferFromId(accs[0].id);
        setTransferToId(accs[1].id);
      } else if (accs.length === 1) {
        setTransferFromId(accs[0].id);
      }
    } catch(e) {
      console.warn('Error reloading account data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadData();
    }, [reloadData])
  );

  // Profile Save
  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    updateUserProfile(editName.trim(), editEmail.trim());
    setProfile(prev => ({ ...prev, name: editName.trim(), email: editEmail.trim() }));
    setIsEditingProfile(false);
  };

  // Reminder Toggle
  const toggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    await scheduleDailyReminder(val);
    if (val) {
      Alert.alert('Reminders Enabled', 'You will be reminded to log your expenses every day at 8:00 PM.');
    }
  };

  // Biometrics Toggle
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
        Alert.alert('App Lock Enabled', 'Biometric authentication is now required to open SPENT.');
      }
    } else {
      setBiometricsEnabled(false);
      updateBiometricsEnabled(false);
    }
  };

  // Immediate App Lock
  const handleLockNow = () => {
    lockApp();
  };

  // Toggle Privacy Mode (Default Hide Balances)
  const togglePrivacyMode = (val: boolean) => {
    const hideDefault = val ? 1 : 0;
    updateUserProfile(undefined, undefined, undefined, hideDefault);
    setProfile(prev => ({ ...prev, hide_balance_default: hideDefault }));
    setShowNetWorth(!val);
  };

  // Currency Selection
  const handleSelectCurrency = (currencyCode: string) => {
    setCurrency(currencyCode);
    updateUserProfile(undefined, undefined, currencyCode);
    setProfile(prev => ({ ...prev, currency: currencyCode }));
    setActiveModal(null);
    reloadData();
  };

  // Save / Add Account
  const handleSaveAccount = () => {
    if (!newAccName.trim()) {
      Alert.alert('Error', 'Account name is required.');
      return;
    }
    const bal = parseFloat(newAccBalance) || 0;
    if (editingAccId) {
      updateAccount(editingAccId, newAccName.trim(), newAccType, bal, profile.currency || 'PHP');
    } else {
      addAccount(newAccName.trim(), newAccType, bal, profile.currency || 'PHP');
    }
    setNewAccName('');
    setNewAccBalance('');
    setNewAccType('bank');
    setEditingAccId(null);
    reloadData();
  };

  // Edit Account prep
  const handleStartEditAccount = (acc: Account) => {
    setEditingAccId(acc.id);
    setNewAccName(acc.name);
    setNewAccType(acc.type);
    setNewAccBalance(String(acc.balance));
  };

  // Delete Account
  const handleDeleteAccount = (id: number, name: string) => {
    if (accounts.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one active account.');
      return;
    }
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            deleteAccount(id);
            reloadData();
          } 
        }
      ]
    );
  };

  // Execute Transfer
  const handleExecuteTransfer = () => {
    if (!transferFromId || !transferToId) {
      Alert.alert('Error', 'Please select both source and destination accounts.');
      return;
    }
    if (transferFromId === transferToId) {
      Alert.alert('Error', 'Source and destination accounts must be different.');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid transfer amount.');
      return;
    }

    transferFunds(transferFromId, transferToId, amt, transferNotes);
    setTransferAmount('');
    setTransferNotes('');
    setActiveModal(null);
    reloadData();
    Alert.alert('Success', `Transferred ${formatCurrency(amt)} successfully.`);
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const csvData = exportTransactionsCSV();

      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spent_transactions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('CSV Downloaded', 'Transactions spreadsheet downloaded.');
        return;
      }

      const fileUri = FileSystem.documentDirectory + 'spent_transactions.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export Transactions (CSV)',
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        await Clipboard.setStringAsync(csvData);
        Alert.alert('Copied CSV to Clipboard', 'Sharing unavailable; CSV copied to clipboard.');
      }
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  };

  // JSON Export
  const handleExportJSON = async () => {
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
        Alert.alert('Export Successful', 'Your backup has been downloaded.');
        return;
      }

      const fileUri = FileSystem.documentDirectory + 'spent_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Export Backup',
          mimeType: 'application/json'
        });
      } else {
        await Clipboard.setStringAsync(jsonStr);
        Alert.alert('Copied to Clipboard!', 'Raw backup copied to clipboard.');
      }
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  };

  // JSON Import
  const handleImportJSON = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const jsonStr = event.target?.result as string;
              importBackupJSON(jsonStr);
              reloadData();
              window.alert('Data restored successfully!');
            } catch (err) {
              window.alert('Import Failed: ' + (err as Error).message);
            }
          };
          reader.readAsText(file);
        };
        input.click();
        return;
      }

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
                  reloadData();
                  Alert.alert('Success', 'Data restored successfully!');
                } catch (err) {
                  Alert.alert('Import Failed', 'Selected file is invalid: ' + (err as Error).message);
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

  // Wipe Data
  const handleWipeData = () => {
    Alert.alert(
      'Wipe All Data',
      'This will permanently delete all transactions, budgets, and reminders, and reset account balances to 0. Categories will NOT be deleted. Are you sure?',
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
                db.execSync('DELETE FROM split_transactions; DELETE FROM transactions; DELETE FROM budgets; DELETE FROM reminders; UPDATE accounts SET balance = 0;');
                reloadData();
                Alert.alert('Success', 'Transactions, budgets, and reminders have been wiped and balances reset to 0. Your categories were preserved.');
              } catch (e) {
                Alert.alert('Error', (e as Error).message);
              }
            }
          }
        }
      ]
    );
  };

  const getCurrencySymbol = () => currencySymbol;

  const getAccountIcon = (type: string) => {
    switch(type) {
      case 'cash': return Wallet;
      case 'bank': return Landmark;
      case 'ewallet': return Smartphone;
      case 'credit': return CreditCard;
      default: return Wallet;
    }
  };

  return (
    <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      
      {/* Profile & Net Worth Gradient Header */}
      <LinearGradient
        colors={isDark ? ['#141218', '#2B2930'] : [palette.dark, palette.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tw`pt-14 pb-6 px-6 rounded-b-3xl shadow-lg`}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center flex-1 mr-2`}>
            <View style={tw`w-16 h-16 bg-white/20 rounded-full items-center justify-center border-2 border-white/40 mr-3`}>
              <Text style={tw`text-2xl font-black text-white`}>
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>

            {isEditingProfile ? (
              <View style={tw`flex-1 mr-2`}>
                <TextInput
                  style={tw`bg-white/20 text-white font-bold text-base px-3 py-1.5 rounded-xl mb-1.5`}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Name"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                />
                <TextInput
                  style={tw`bg-white/20 text-white text-xs px-3 py-1 rounded-xl`}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Your Email"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  keyboardType="email-address"
                />
              </View>
            ) : (
              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center`}>
                  <Text style={tw`text-xl font-black text-white tracking-tight mr-1.5`} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setIsEditingProfile(true)} style={tw`bg-white/20 p-1 rounded-full`}>
                    <Edit2 size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={tw`text-xs font-medium text-blue-100 mt-0.5`} numberOfLines={1}>{profile.email}</Text>
              </View>
            )}
          </View>

          {isEditingProfile && (
            <TouchableOpacity onPress={handleSaveProfile} style={tw`bg-white/30 px-3 py-1.5 rounded-full border border-white/60`}>
              <Check size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Live Net Worth Card */}
        <View style={tw`bg-white/15 border border-white/25 rounded-2xl p-4 flex-row items-center justify-between shadow-sm`}>
          <View>
            <View style={tw`flex-row items-center mb-0.5`}>
              <Text style={tw`text-xs font-bold text-blue-100 uppercase tracking-wider mr-1.5`}>Total Net Worth</Text>
              <TouchableOpacity onPress={() => setShowNetWorth(!showNetWorth)}>
                {showNetWorth ? <Eye size={14} color="#bfdbfe" /> : <EyeOff size={14} color="#bfdbfe" />}
              </TouchableOpacity>
            </View>
            <Text style={tw`text-2xl font-black text-white tracking-tight`}>
              {showNetWorth 
                ? formatCurrency(totalNetWorth) 
                : `${currencySymbol}** ***.**`}
            </Text>
          </View>

          <View style={tw`flex-row items-center gap-2`}>
            {/* Currency Pill */}
            <TouchableOpacity 
              onPress={() => setActiveModal('currency')}
              style={tw`bg-white/20 px-2.5 py-1 rounded-full border border-white/40`}
            >
              <Text style={tw`text-xs font-bold text-white uppercase`}>{currency}</Text>
            </TouchableOpacity>

            {/* Accent Palette Indicator */}
            <View style={[tw`w-6 h-6 rounded-full border border-white/60`, { backgroundColor: accentColor }]} />
          </View>
        </View>
      </LinearGradient>

      {/* Main Settings List */}
      <ScrollView showsVerticalScrollIndicator={false} style={tw`flex-1 px-5 pt-5`} contentContainerStyle={tw`pb-12`}>
        
        {/* GROUP 1: Core Financial Tools */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Wallets & Core Assets
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-1 mb-5 border border-slate-100 dark:border-slate-800`}>
          
          {/* Manage Accounts & Wallets */}
          <TouchableOpacity 
            onPress={() => setActiveModal('accounts')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center flex-1`}>
              <View style={tw`w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mr-3`}>
                <Wallet color="#3b82f6" size={18} />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Manage Accounts & Wallets</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>
                  {accounts.length} active ({accounts.map(a => a.name).join(', ')})
                </Text>
              </View>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          {/* Inter-Account Transfer */}
          <TouchableOpacity 
            onPress={() => setActiveModal('transfer')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-emerald-50 dark:bg-emerald-500/10 rounded-full items-center justify-center mr-3`}>
                <ArrowRightLeft color="#10b981" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Transfer Between Accounts</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          {/* Manage Categories */}
          <TouchableOpacity 
            onPress={() => router.push('/categories')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-purple-50 dark:bg-purple-500/10 rounded-full items-center justify-center mr-3`}>
                <Settings color="#a855f7" size={18} />
              </View>
              <View>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Manage Categories</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>Expenses, Incomes & Loans</Text>
              </View>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          {/* Savings Goals */}
          <TouchableOpacity 
            onPress={() => router.push('/budgets')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px]`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-amber-50 dark:bg-amber-500/10 rounded-full items-center justify-center mr-3`}>
                <Target color="#f59e0b" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Budgets & Savings Goals</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* GROUP 2: Insights & Planning */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Reports & Planning
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-1 mb-5 border border-slate-100 dark:border-slate-800`}>
          
          <TouchableOpacity 
            onPress={() => router.push('/analytics')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-teal-50 dark:bg-teal-500/10 rounded-full items-center justify-center mr-3`}>
                <PieChart color="#14b8a6" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Financial Analytics</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/reminders')} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px]`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-orange-50 dark:bg-orange-500/10 rounded-full items-center justify-center mr-3`}>
                <List color="#f97316" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Reminders & Upcoming Bills</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* GROUP 3: Appearance & Accent Palette */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Appearance & Accent
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-3.5 mb-5 border border-slate-100 dark:border-slate-800`}>
          
          {/* Accent Color Palette Picker */}
          <View style={tw`mb-4`}>
            <View style={tw`flex-row justify-between items-center mb-2.5`}>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Accent Color Palette</Text>
              <Text style={[tw`text-xs font-semibold capitalize`, { color: textSecondary }]}>
                {ACCENT_PALETTES[accentKey]?.name}
              </Text>
            </View>

            <View style={tw`flex-row justify-between items-center pt-1 px-1`}>
              {(Object.keys(ACCENT_PALETTES) as AccentPaletteKey[]).map((key) => {
                const pal = ACCENT_PALETTES[key];
                const isSelected = accentKey === key;
                const displayHex = isDark ? pal.dark : pal.light;

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setAccentColor(key)}
                    activeOpacity={0.8}
                    style={[
                      tw`w-11 h-11 rounded-full items-center justify-center border-[2.5px]`,
                      {
                        backgroundColor: displayHex,
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#1E293B') : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Dark Mode */}
          <View style={tw`flex-row items-center justify-between py-2 min-h-[48px] border-t border-slate-100 dark:border-slate-800/60`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center mr-3`}>
                {isDark ? <Moon color="#64748b" size={18} /> : <Sun color="#64748b" size={18} />}
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Dark Mode</Text>
            </View>
            <Switch 
              value={isDark} 
              onValueChange={(val) => setColorScheme(val ? 'dark' : 'light')} 
              trackColor={{ false: '#64748b', true: accentColor }}
              thumbColor={'#fff'}
            />
          </View>

          {/* Base Currency */}
          <TouchableOpacity 
            onPress={() => setActiveModal('currency')}
            style={tw`flex-row items-center justify-between py-2 min-h-[48px] border-t border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center mr-3`}>
                <Text style={[tw`font-black text-sm`, { color: textPrimary }]}>{currencySymbol}</Text>
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Base Currency</Text>
            </View>
            <View style={tw`flex-row items-center`}>
              <Text style={[tw`text-xs font-semibold mr-2`, { color: textSecondary }]}>
                {currency} ({currencySymbol})
              </Text>
              <ChevronRight color={textMuted} size={18} />
            </View>
          </TouchableOpacity>

          {/* Privacy Mode (Default Hide Balances) */}
          <View style={tw`flex-row items-center justify-between py-2 min-h-[48px] border-t border-slate-100 dark:border-slate-800/60`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center mr-3`}>
                <EyeOff color="#64748b" size={18} />
              </View>
              <View>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Privacy Mode</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>Hide balances by default</Text>
              </View>
            </View>
            <Switch 
              value={profile.hide_balance_default === 1} 
              onValueChange={togglePrivacyMode} 
              trackColor={{ false: '#64748b', true: accentColor }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {/* GROUP 4: Security & Notifications */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Security & Notifications
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-1 mb-5 border border-slate-100 dark:border-slate-800`}>
          
          <View style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mr-3`}>
                <Shield color="#3b82f6" size={18} />
              </View>
              <View>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Biometric App Lock</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>Face ID / Fingerprint protection</Text>
              </View>
            </View>
            <Switch 
              value={biometricsEnabled} 
              onValueChange={toggleBiometrics} 
              trackColor={{ false: '#64748b', true: accentColor }}
              thumbColor={'#fff'}
            />
          </View>

          <TouchableOpacity 
            onPress={handleLockNow}
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-amber-50 dark:bg-amber-500/10 rounded-full items-center justify-center mr-3`}>
                <Lock color="#f59e0b" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Lock App Now</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <View style={tw`flex-row items-center justify-between p-3.5 min-h-[48px]`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-emerald-50 dark:bg-emerald-500/10 rounded-full items-center justify-center mr-3`}>
                <Bell color="#10b981" size={18} />
              </View>
              <View>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Daily Expense Reminder</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>Prompt to log at 8:00 PM</Text>
              </View>
            </View>
            <Switch 
              value={remindersEnabled} 
              onValueChange={toggleReminders} 
              trackColor={{ false: '#64748b', true: accentColor }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {/* GROUP 5: Data Vault & Backups */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Data Vault & Export
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-1 mb-5 border border-slate-100 dark:border-slate-800`}>
          
          <TouchableOpacity 
            onPress={handleExportCSV} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-emerald-50 dark:bg-emerald-500/10 rounded-full items-center justify-center mr-3`}>
                <FileSpreadsheet color="#10b981" size={18} />
              </View>
              <View>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Export to CSV (Excel)</Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>Formatted for spreadsheets & tax</Text>
              </View>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleExportJSON} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mr-3`}>
                <DownloadCloud color="#3b82f6" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Backup Data (JSON)</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleImportJSON} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-teal-50 dark:bg-teal-500/10 rounded-full items-center justify-center mr-3`}>
                <UploadCloud color="#14b8a6" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Restore Data (JSON)</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleWipeData} 
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px]`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-rose-50 dark:bg-rose-500/10 rounded-full items-center justify-center mr-3`}>
                <Trash2 color="#f43f5e" size={18} />
              </View>
              <Text style={tw`text-sm font-bold text-rose-500 dark:text-rose-400`}>Wipe All Data</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* GROUP 6: Info, Guide & Support */}
        <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider ml-1`, { color: textMuted }]}>
          Help & Information
        </Text>
        <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-1 mb-6 border border-slate-100 dark:border-slate-800`}>
          
          <TouchableOpacity 
            onPress={() => setActiveModal('faq')}
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center mr-3`}>
                <BookOpen color="#3b82f6" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Feature Guide & FAQ</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => Linking.openURL('mailto:justinelance0067@gmail.com?subject=SPENT%20Support')}
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px] border-b border-slate-100 dark:border-slate-800/60`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-3`}>
                <CircleHelp color="#64748b" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Contact Support</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                'Data Privacy & Security Guarantee',
                'Your financial data is 100% private and offline-first.\n\nAll accounts, transactions, and budgets are strictly stored locally within your device\'s private, sandboxed SQLite storage.\n\nWe do NOT collect, transmit, or monetize your information on remote servers.'
              );
            }}
            style={tw`flex-row items-center justify-between p-3.5 min-h-[48px]`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center mr-3`}>
                <FileText color="#64748b" size={18} />
              </View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Terms & Privacy Guarantee</Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View style={tw`items-center mb-6`}>
          <Text style={[tw`text-xs font-bold`, { color: textMuted }]}>SPENT v1.0.1 (Build 2026.09.09)</Text>
          <Text style={[tw`text-[11px] mt-0.5`, { color: textMuted }]}>Offline-First • Private Sandboxed SQLite</Text>
        </View>

        {/* Log Out / Exit Button */}
        <TouchableOpacity 
          style={tw`flex-row items-center justify-center py-3.5 min-h-[48px] bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-100 dark:border-rose-500/20`}
          onPress={() => exitSession()}
        >
          <LogOut color="#ef4444" size={18} />
          <Text style={tw`text-rose-500 dark:text-rose-400 font-bold ml-2 text-sm`}>
            {Platform.OS === 'android' ? 'Exit App / Log Out Session' : 'Lock / Log Out Session'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ================= MODALS ================= */}

      {/* 1. Accounts & Wallets Management Modal */}
      <Modal visible={activeModal === 'accounts'} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-[#FEF7FF] dark:bg-[#141218] rounded-t-3xl max-h-[85%] p-6`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Manage Accounts</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={tw`p-1.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                <X size={20} color={textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Add / Edit Form */}
              <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-5 border border-slate-100 dark:border-slate-800`}>
                <Text style={[tw`text-sm font-bold mb-2.5`, { color: textPrimary }]}>
                  {editingAccId ? 'Edit Account' : 'Add New Account'}
                </Text>

                <TextInput
                  style={[tw`bg-[#F3EDF7] dark:bg-[#2B2930] px-4 py-3 rounded-xl text-sm font-semibold mb-2.5 min-h-[48px] border border-slate-200 dark:border-slate-800`, { color: textPrimary }]}
                  placeholder="Account Name (e.g. Maya, BPI, PayPal)"
                  placeholderTextColor={textMuted}
                  value={newAccName}
                  onChangeText={setNewAccName}
                />

                {/* Account Type Selector */}
                <View style={tw`flex-row gap-2 mb-2.5`}>
                  {['bank', 'ewallet', 'cash', 'credit'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setNewAccType(t)}
                      style={[
                        tw`flex-1 py-2.5 min-h-[44px] justify-center rounded-xl items-center border`,
                        newAccType === t 
                          ? [{ backgroundColor: accentColor, borderColor: accentColor }]
                          : tw`bg-[#F3EDF7] dark:bg-[#2B2930] border-slate-200 dark:border-slate-800`
                      ]}
                    >
                      <Text style={[tw`text-xs font-bold capitalize`, { color: newAccType === t ? textOnAccent : textSecondary }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[tw`bg-[#F3EDF7] dark:bg-[#2B2930] px-4 py-3 rounded-xl text-sm font-semibold mb-3 min-h-[48px] border border-slate-200 dark:border-slate-800`, { color: textPrimary }]}
                  placeholder="Starting Balance"
                  placeholderTextColor={textMuted}
                  keyboardType="numeric"
                  value={newAccBalance}
                  onChangeText={setNewAccBalance}
                />

                <View style={tw`flex-row gap-2`}>
                  {editingAccId && (
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingAccId(null);
                        setNewAccName('');
                        setNewAccBalance('');
                      }} 
                      style={tw`flex-1 py-3.5 min-h-[48px] justify-center bg-[#F3EDF7] dark:bg-[#2B2930] rounded-xl items-center`}
                    >
                      <Text style={[tw`font-bold text-sm`, { color: textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={handleSaveAccount} 
                    style={[tw`flex-1 py-3.5 min-h-[48px] justify-center rounded-xl items-center shadow-md`, { backgroundColor: accentColor }]}
                  >
                    <Text style={[tw`font-bold text-sm`, { color: textOnAccent }]}>
                      {editingAccId ? 'Update Account' : 'Add Account'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Accounts List */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>Your Accounts</Text>
              {accounts.map(acc => {
                const IconComp = getAccountIcon(acc.type);
                return (
                  <View key={acc.id} style={tw`flex-row items-center justify-between p-3.5 bg-[#F4EFF4] dark:bg-[#211F26] rounded-xl mb-2.5 border border-slate-100 dark:border-slate-800`}>
                    <View style={tw`flex-row items-center flex-1`}>
                      <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center mr-3`}>
                        <IconComp size={18} color={accentColor} />
                      </View>
                      <View style={tw`flex-1`}>
                        <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>{acc.name}</Text>
                        <Text style={[tw`text-xs font-semibold`, { color: textSecondary }]}>
                          {formatCurrency(acc.balance || 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={tw`flex-row gap-2`}>
                      <TouchableOpacity onPress={() => handleStartEditAccount(acc)} style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center`}>
                        <Edit2 size={16} color={textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteAccount(acc.id, acc.name)} style={tw`w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-full items-center justify-center`}>
                        <Trash2 size={16} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2. Inter-Account Transfer Modal */}
      <Modal visible={activeModal === 'transfer'} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-[#FEF7FF] dark:bg-[#141218] rounded-t-3xl p-6 max-h-[80%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Transfer Funds</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={tw`p-1.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                <X size={20} color={textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* From Account */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>From Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-4`}>
                <View style={tw`flex-row gap-2`}>
                  {accounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setTransferFromId(acc.id)}
                      style={[
                        tw`px-4 py-2.5 min-h-[44px] justify-center rounded-xl border`,
                        transferFromId === acc.id 
                          ? [{ backgroundColor: accentColor, borderColor: accentColor }]
                          : tw`bg-[#F4EFF4] dark:bg-[#211F26] border-slate-200 dark:border-slate-800`
                      ]}
                    >
                      <Text style={[tw`text-xs font-bold`, { color: transferFromId === acc.id ? textOnAccent : textSecondary }]}>
                        {acc.name} ({formatCurrency(acc.balance || 0)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* To Account */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>To Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-4`}>
                <View style={tw`flex-row gap-2`}>
                  {accounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setTransferToId(acc.id)}
                      style={[
                        tw`px-4 py-2.5 min-h-[44px] justify-center rounded-xl border`,
                        transferToId === acc.id 
                          ? [{ backgroundColor: accentColor, borderColor: accentColor }]
                          : tw`bg-[#F4EFF4] dark:bg-[#211F26] border-slate-200 dark:border-slate-800`
                      ]}
                    >
                      <Text style={[tw`text-xs font-bold`, { color: transferToId === acc.id ? textOnAccent : textSecondary }]}>
                        {acc.name} ({formatCurrency(acc.balance || 0)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Amount */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-1.5`, { color: textMuted }]}>Amount</Text>
              <TextInput
                style={[tw`bg-[#F4EFF4] dark:bg-[#211F26] px-4 py-3 min-h-[48px] rounded-2xl text-base font-bold mb-3 border border-slate-200 dark:border-slate-800`, { color: textPrimary }]}
                placeholder={`0.00`}
                placeholderTextColor={textMuted}
                keyboardType="numeric"
                value={transferAmount}
                onChangeText={setTransferAmount}
              />

              {/* Notes */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-1.5`, { color: textMuted }]}>Notes (Optional)</Text>
              <TextInput
                style={[tw`bg-[#F4EFF4] dark:bg-[#211F26] px-4 py-3 min-h-[48px] rounded-2xl text-sm font-semibold mb-5 border border-slate-200 dark:border-slate-800`, { color: textPrimary }]}
                placeholder="e.g. Bank to GCash Cash-In"
                placeholderTextColor={textMuted}
                value={transferNotes}
                onChangeText={setTransferNotes}
              />

              <TouchableOpacity 
                onPress={handleExecuteTransfer}
                style={[tw`py-4 min-h-[48px] rounded-2xl items-center justify-center shadow-lg`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Confirm Transfer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. Currency Selector Modal */}
      <Modal visible={activeModal === 'currency'} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-[#FEF7FF] dark:bg-[#141218] rounded-t-3xl p-6 max-h-[75%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Select Base Currency</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={tw`p-1.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                <X size={20} color={textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {SUPPORTED_CURRENCIES.map(curr => {
                const isSelected = profile.currency === curr.code;
                return (
                  <TouchableOpacity
                    key={curr.code}
                    onPress={() => handleSelectCurrency(curr.code)}
                    style={[
                      tw`flex-row items-center justify-between p-4 min-h-[48px] rounded-2xl mb-2.5 border`,
                      isSelected 
                        ? [{ borderColor: accentColor, backgroundColor: `${accentColor}15` }] 
                        : tw`bg-[#F4EFF4] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`
                    ]}
                  >
                    <View style={tw`flex-row items-center`}>
                      <View style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full items-center justify-center mr-3`}>
                        <Text style={[tw`font-black text-base`, { color: textPrimary }]}>{curr.symbol}</Text>
                      </View>
                      <View>
                        <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>{curr.name}</Text>
                        <Text style={[tw`text-xs`, { color: textSecondary }]}>{curr.code}</Text>
                      </View>
                    </View>
                    {isSelected && <Check size={20} color={accentColor} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. Feature Guide & FAQ Modal */}
      <Modal visible={activeModal === 'faq'} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-[#FEF7FF] dark:bg-[#141218] rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>SPENT Feature Guide</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={tw`p-1.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                <X size={20} color={textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
              <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-3 border border-slate-100 dark:border-slate-800`}>
                <View style={tw`flex-row items-center mb-1.5`}>
                  <CreditCard size={18} color={accentColor} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                    Accounts vs. Categories
                  </Text>
                </View>
                <Text style={[tw`text-xs leading-5`, { color: textSecondary }]}>
                  • <Text style={[tw`font-bold`, { color: textPrimary }]}>Accounts</Text> represent where your funds reside (Cash, Main Bank, GCash, SPayLater).{'\n'}
                  • <Text style={[tw`font-bold`, { color: textPrimary }]}>Categories</Text> represent what you spent on (Food, Transport, Bills). Keeping them separate ensures clean bookkeeping and accurate balances.
                </Text>
              </View>

              <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-3 border border-slate-100 dark:border-slate-800`}>
                <View style={tw`flex-row items-center mb-1.5`}>
                  <ArrowRightLeft size={18} color={accentColor} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                    Loan Tracking & Due Dates
                  </Text>
                </View>
                <Text style={[tw`text-xs leading-5`, { color: textSecondary }]}>
                  Log borrowed money as Borrowed (expense flow) or lent money as Lent (income flow). Set repayment due dates to see them highlighted with dedicated badges in the Transactions tab.
                </Text>
              </View>

              <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-3 border border-slate-100 dark:border-slate-800`}>
                <View style={tw`flex-row items-center mb-1.5`}>
                  <Target size={18} color={accentColor} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                    Budgets & Remaining Balances
                  </Text>
                </View>
                <Text style={[tw`text-xs leading-5`, { color: textSecondary }]}>
                  Set monthly spending limits for any expense category. The Budgets tab provides real-time progress bars, remaining balance calculations, and over-budget warnings.
                </Text>
              </View>

              <View style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800`}>
                <View style={tw`flex-row items-center mb-1.5`}>
                  <Lock size={18} color={accentColor} style={tw`mr-2`} />
                  <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                    100% Offline SQLite Architecture
                  </Text>
                </View>
                <Text style={[tw`text-xs leading-5`, { color: textSecondary }]}>
                  SPENT operates completely offline. No tracking scripts, no third-party analytic servers, and zero cloud uploads. Your financial data belongs solely to you.
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setActiveModal(null)}
                style={[tw`py-3.5 min-h-[48px] justify-center rounded-2xl items-center shadow-md`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-sm`, { color: textOnAccent }]}>Got it!</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
