import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { 
  Plus, Eye, EyeOff, Target, PieChart, Download, List, Clock, Tag, Receipt 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { FinanceService, Category, Account } from '../../services/FinanceService';
import { IconMap } from '../../utils/Icons';
import { useTheme } from '../../context/ThemeContext';
import { TransactionBottomSheet, TransactionBottomSheetRef, TransactionData } from '../../components/TransactionBottomSheet';

export default function Dashboard() {
  const router = useRouter();
  const bottomSheetRef = useRef<TransactionBottomSheetRef>(null);
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, palette, textPrimary, textSecondary, textMuted, formatCurrency } = useTheme();

  // App Data State
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [balance, setBalance] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    try {
      // Recent transactions for the list
      const txs = FinanceService.getTransactions({ limit: 20 }) as TransactionData[];
      setTransactions(txs);

      // Accounts & total balance
      const accounts = FinanceService.getAccounts();
      const totalBal = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
      setBalance(totalBal);

      // Categories
      const cats = FinanceService.getCategories();
      setCategories(cats);

      // Accurate SQL aggregation bypassing LIMIT 20!
      const summary = FinanceService.getMonthlySummary();
      setTotalMonthlyExpenses(summary.totalExpense);
      setTotalMonthlyIncome(summary.totalIncome);
    } catch (e) {
      console.warn('Dashboard fetchData failed:', e);
    }
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Date';
    }
  };

  const handleExportData = async () => {
    try {
      const jsonStr = FinanceService.exportBackupJSON();
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
        return;
      }
      const fileUri = FileSystem.documentDirectory + 'spent_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { dialogTitle: 'Export Backup', mimeType: 'application/json' });
      } else {
        await Clipboard.setStringAsync(jsonStr);
        Alert.alert('Copied to Clipboard!', 'Backup data copied.');
      }
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    }
  };

  return (
    <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218] relative`}>
      {/* Header Gradient Card */}
      <LinearGradient
        colors={isDark ? ['#141218', '#211F26'] : [palette.dark, palette.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tw`pt-14 pb-7 px-6 rounded-b-3xl overflow-hidden border-b border-slate-800/40`}
      >
        <View style={tw`flex-row justify-between items-center mb-5`}>
          <View>
            <View style={tw`flex-row items-center mb-1`}>
              <Text style={tw`text-blue-100 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mr-2`}>
                Total Balance
              </Text>
              <TouchableOpacity 
                onPress={() => setShowBalance(!showBalance)}
                style={tw`min-h-[32px] min-w-[32px] items-center justify-center`}
              >
                {showBalance ? <Eye color={isDark ? '#94a3b8' : '#bfdbfe'} size={16} /> : <EyeOff color={isDark ? '#94a3b8' : '#bfdbfe'} size={16} />}
              </TouchableOpacity>
            </View>
            <Text style={tw`text-white text-4xl font-black tracking-tight`}>
              {showBalance ? formatCurrency(balance) : '••••••••'}
            </Text>
          </View>
        </View>

        {/* Monthly Income & Expense Cards */}
        <View style={tw`flex-row justify-between gap-3`}>
          <View style={tw`flex-row items-center bg-emerald-500/20 border border-emerald-400/20 px-4 py-3 rounded-2xl flex-1`}>
            <View>
              <Text style={tw`text-emerald-100 dark:text-emerald-400 text-xs font-semibold`}>This Month Income</Text>
              <Text style={tw`text-white font-black text-sm mt-0.5`}>
                {showBalance ? formatCurrency(totalMonthlyIncome) : '••••••'}
              </Text>
            </View>
          </View>

          <View style={tw`flex-row items-center bg-rose-500/20 border border-rose-400/20 px-4 py-3 rounded-2xl flex-1`}>
            <View>
              <Text style={tw`text-rose-100 dark:text-rose-400 text-xs font-semibold`}>This Month Expenses</Text>
              <Text style={tw`text-white font-black text-sm mt-0.5`}>
                {showBalance ? formatCurrency(totalMonthlyExpenses) : '••••••'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions Row (48px Touch Targets) */}
      <View style={tw`flex-row justify-between px-8 py-5 bg-[#FEF7FF] dark:bg-[#141218]`}>
        {[
          { icon: Target, label: 'Budget', color: '#8b5cf6', action: () => router.push('/budgets') },
          { icon: PieChart, label: 'Analytics', color: '#10b981', action: () => router.push('/analytics') },
          { icon: List, label: 'Reminders', color: '#f59e0b', action: () => router.push('/reminders') },
          { icon: Download, label: 'Export', color: '#06b6d4', action: handleExportData },
        ].map((item, i) => (
          <TouchableOpacity 
            key={i} 
            style={tw`items-center min-h-[48px] justify-center`} 
            onPress={item.action}
            activeOpacity={0.7}
          >
            <View style={tw`w-13 h-13 bg-[#F4EFF4] dark:bg-[#211F26] rounded-full items-center justify-center mb-1.5 border border-slate-100 dark:border-slate-800 shadow-sm`}>
              <item.icon size={22} color={item.color} />
            </View>
            <Text style={[tw`text-xs font-bold`, { color: textSecondary }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Transactions List with Empty State */}
      <View style={tw`flex-1 px-6 pb-6`}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={[tw`text-lg font-black`, { color: textPrimary }]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')} style={tw`min-h-[32px] justify-center`}>
            <Text style={[tw`text-xs font-bold`, { color: accentColor }]}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-1 bg-[#F4EFF4] dark:bg-[#211F26] rounded-3xl p-3 border border-slate-100 dark:border-slate-800 overflow-hidden`}>
          <FlashList
            data={transactions}
            estimatedItemSize={76}
            ListEmptyComponent={() => (
              <View style={tw`items-center justify-center py-14 px-4`}>
                <View style={tw`w-14 h-14 rounded-full bg-[#F3EDF7] dark:bg-[#2B2930] items-center justify-center mb-3`}>
                  <List size={26} color={textMuted} />
                </View>
                <Text style={[tw`font-bold text-base mb-1`, { color: textPrimary }]}>No transactions yet</Text>
                <Text style={[tw`text-xs text-center max-w-xs leading-5`, { color: textMuted }]}>
                  Tap the + button below to log an expense, income, or loan.
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const catObj = categories.find(c => c.name === item.category);
              const catColor = catObj ? catObj.color : (item.type === 'income' ? '#10b981' : item.type === 'loan' ? '#f59e0b' : '#f43f5e');
              const IconComp = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
              const isIncome = item.type === 'income' || (item.type === 'loan' && item.amount > 0);
              const isLoan = item.type === 'loan';
              const isTransfer = item.type === 'transfer';

              return (
                <TouchableOpacity 
                  onPress={() => bottomSheetRef.current?.openEdit(item)} 
                  style={tw`flex-row items-center justify-between py-3 px-2 border-b border-slate-100/80 dark:border-slate-800/50 min-h-[56px]`}
                  activeOpacity={0.7}
                >
                  <View style={tw`flex-row items-center flex-1 mr-2`}>
                    <View style={[tw`w-10 h-10 rounded-full items-center justify-center mr-3`, { backgroundColor: `${catColor}15` }]}>
                      <IconComp size={18} color={catColor} />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-sm font-bold`, { color: textPrimary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={tw`flex-row items-center gap-1.5 mt-0.5`}>
                        <Text style={[tw`text-[11px] font-semibold`, { color: textMuted }]}>
                          {item.category} • {formatDateLabel(item.date)}
                        </Text>
                        {item.notes ? (
                          <View style={[tw`px-1.5 py-0.5 rounded-md flex-row items-center`, { backgroundColor: `${accentColor}18` }]}>
                            <Receipt size={10} color={accentColor} style={tw`mr-0.5`} />
                            <Text style={[tw`text-[10px] font-bold`, { color: accentColor }]}>Receipt</Text>
                          </View>
                        ) : null}
                        {isLoan && item.due_date && (
                          <View style={tw`bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full flex-row items-center`}>
                            <Clock size={10} color="#f59e0b" style={tw`mr-1`} />
                            <Text style={tw`text-[10px] font-bold text-amber-600 dark:text-amber-400`}>
                              Due {formatDateLabel(item.due_date)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text 
                    style={[
                      tw`text-sm font-black`,
                      isTransfer 
                        ? { color: textSecondary }
                        : isIncome 
                        ? tw`text-emerald-500` 
                        : { color: textPrimary }
                    ]}
                  >
                    {isTransfer ? '' : isIncome ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={[tw`absolute bottom-6 right-6 w-16 h-16 rounded-full shadow-xl min-h-[48px] min-w-[48px]`, { elevation: 10, shadowColor: accentColor }]}
        onPress={() => bottomSheetRef.current?.openAdd('expense')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[palette.light, palette.dark]} style={tw`w-full h-full rounded-full items-center justify-center`}>
          <Plus color="#fff" size={28} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Shared Transaction Entry Bottom Sheet */}
      <TransactionBottomSheet ref={bottomSheetRef} onSuccess={fetchData} />
    </View>
  );
}
