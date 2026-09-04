import React, { useRef, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Plus, Wallet, Coffee, Train, ShoppingCart, Delete, Tag, Icon as LucideIcon, Eye, EyeOff, ArrowRightLeft, Target, PieChart, Download, List, Moon, Sun } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getDB, getCategories, Category, exportBackupJSON, deleteTransaction, updateTransaction } from '../../db/database';
import { checkAndTriggerBudgetWarning } from '../../services/NotificationService';

type Transaction = {
  id: number;
  title: string;
  amount: number;
  date: string;
  type: string;
  category: string;
};

import { IconMap } from '../../utils/Icons';

export default function Dashboard() {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [colorScheme, toggleColorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  
  const [amount, setAmount] = useState('0');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense'|'income'>('expense');
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);

  const MONTHLY_BUDGET = 5000;

  useFocusEffect(
    useCallback(() => {
      try {
        fetchData();
      } catch (error) {
        console.log('Database init error on web?', error);
      }
    }, [])
  );

  const fetchData = () => {
    try {
      const db = getDB();
      const txs = db.getAllSync<Transaction>('SELECT * FROM transactions ORDER BY date DESC LIMIT 15');
      setTransactions(txs);
      
      const acc = db.getFirstSync<{ balance: number }>('SELECT SUM(balance) as balance FROM accounts');
      setBalance(acc?.balance || 0);
      
      const cats = getCategories();
      setCategories(cats);

      let ex = 0;
      let inc = 0;
      const now = new Date();
      txs.forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          if (t.type === 'expense') ex += Math.abs(t.amount);
          if (t.type === 'income') inc += Math.abs(t.amount);
        }
      });
      setTotalMonthlyExpenses(ex);
      setTotalMonthlyIncome(inc);
    } catch (e) {
      console.log(e);
    }
  };

  const handleAddTransaction = () => {
    const numAmount = parseFloat(amount.replace(/[^0-9.-]+/g,""));
    if (isNaN(numAmount) || numAmount === 0) return;

    try {
      const db = getDB();
      const date = new Date().toISOString();
      const accountId = 1; // Cash account fallback
      
      if (selectedTxId) {
        updateTransaction(selectedTxId, title || 'Custom Entry', numAmount, type, title || 'Other', date);
      } else {
        db.runSync(
          `INSERT INTO transactions (title, amount, type, date, category, account_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [title || 'Custom Entry', numAmount * (type === 'expense' ? -1 : 1), type, date, title || 'Other', accountId]
        );
        
        db.runSync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?`,
          [numAmount * (type === 'expense' ? -1 : 1), accountId]
        );
        
        if (type === 'expense') {
          const catName = title || 'Other';
          const budget = db.getFirstSync<{amount: number}>('SELECT amount FROM budgets WHERE category = ?', [catName]);
          if (budget) {
            const now = new Date();
            const allCatTxs = db.getAllSync<{amount: number, date: string}>('SELECT amount, date FROM transactions WHERE type = "expense" AND category = ?', [catName]);
            
            let totalSpent = 0;
            allCatTxs.forEach(tx => {
              const d = new Date(tx.date);
              if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                totalSpent += Math.abs(tx.amount);
              }
            });
            checkAndTriggerBudgetWarning(catName, totalSpent, budget.amount);
          }
        }
      }

      fetchData();
      bottomSheetRef.current?.close();
      setAmount('0');
      setTitle('');
      setSelectedTxId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTransaction = () => {
    if (selectedTxId) {
      deleteTransaction(selectedTxId);
      fetchData();
      bottomSheetRef.current?.close();
      setAmount('0');
      setTitle('');
      setSelectedTxId(null);
    }
  };

  const openEditModal = (tx: Transaction) => {
    setSelectedTxId(tx.id);
    setTitle(tx.title);
    setAmount(Math.abs(tx.amount).toString());
    setType(tx.type as 'expense' | 'income');
    bottomSheetRef.current?.expand();
  };

  const openAddModal = () => {
    setSelectedTxId(null);
    setAmount('0');
    setTitle('');
    setType('expense');
    bottomSheetRef.current?.expand();
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + '.');
    } else {
      setAmount(prev => prev === '0' ? key : prev + key);
    }
  };

  const handleExportData = async () => {
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
      <LinearGradient
        colors={isDark ? ['#141218', '#2B2930'] : ['#1e40af', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tw`pt-14 pb-8 px-6 rounded-b-3xl overflow-hidden border-b border-slate-800/50`}
      >
        <View style={tw`flex-row justify-between items-center mb-6`}>
          <View>
            <View style={tw`flex-row items-center mb-1`}>
              <Text style={tw`text-blue-100 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mr-2`}>Total Balance</Text>
              <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye color={isDark ? "#94a3b8" : "#bfdbfe"} size={16} /> : <EyeOff color={isDark ? "#94a3b8" : "#bfdbfe"} size={16} />}
              </TouchableOpacity>
            </View>
            <Text style={tw`text-white text-4xl font-black tracking-tight`}>
              {showBalance ? `₱${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '₱** ***.**'}
            </Text>
          </View>
        </View>
        
        <View style={tw`flex-row justify-between`}>
          <View style={tw`flex-row items-center bg-emerald-500/20 border border-emerald-400/20 px-4 py-3 rounded-2xl flex-1 mr-2`}>
            <View><Text style={tw`text-emerald-100 dark:text-emerald-400 text-xs font-semibold`}>Income</Text><Text style={tw`text-white font-black text-sm`}>{showBalance ? `₱${totalMonthlyIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '₱***.**'}</Text></View>
          </View>
          <View style={tw`flex-row items-center bg-rose-500/20 border border-rose-400/20 px-4 py-3 rounded-2xl flex-1 ml-2`}>
            <View><Text style={tw`text-rose-100 dark:text-rose-400 text-xs font-semibold`}>Expenses</Text><Text style={tw`text-white font-black text-sm`}>{showBalance ? `₱${totalMonthlyExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '₱***.**'}</Text></View>
          </View>
        </View>
      </LinearGradient>

      <View style={tw`flex-row justify-between px-8 py-5 bg-[#FEF7FF] dark:bg-[#141218]`}>
        {[
          { icon: Target, label: 'Budget', color: '#8b5cf6', action: () => router.push('/budgets') },
          { icon: PieChart, label: 'Analytics', color: '#10b981', action: () => router.push('/analytics') },
          { icon: List, label: 'Reminders', color: '#f59e0b', action: () => router.push('/reminders') },
          { icon: Download, label: 'Export', color: '#06b6d4', action: handleExportData }
        ].map((action, i) => (
          <TouchableOpacity key={i} style={tw`items-center`} onPress={action.action}>
            <View style={tw`w-14 h-14 bg-[#F4EFF4] dark:bg-[#49454F] rounded-full items-center justify-center shadow-sm shadow-slate-200 dark:shadow-none mb-2 border border-slate-100 dark:border-slate-800`}>
              <action.icon size={24} color={action.color} />
            </View>
            <Text style={tw`text-xs font-bold text-slate-600 dark:text-slate-400`}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={tw`flex-1 px-6 pb-6`}>
        <Text style={tw`text-lg font-black text-slate-800 dark:text-white mb-3`}>Recent Transactions</Text>
        <View style={tw`flex-1 bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-4 shadow-sm shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden`}>
          <FlashList
            data={transactions}
            renderItem={({ item }) => {
              const catObj = categories.find(c => c.name === item.category);
              const catColor = catObj ? catObj.color : (item.type === 'income' ? '#10b981' : '#f43f5e');
              const IconComp = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
              return (
                <TouchableOpacity onPress={() => openEditModal(item)} style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-50 dark:border-slate-800/50`}>
                  <View style={tw`flex-row items-center`}>
                    <View style={tw`w-10 h-10 rounded-full items-center justify-center mr-4 bg-[#F3EDF7] dark:bg-[#211F26]`}>
                      <IconComp size={20} color={catColor} />
                    </View>
                    <View>
                      <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{item.title}</Text>
                      <Text style={tw`text-xs font-semibold text-slate-400 dark:text-slate-500`}>{item.category}</Text>
                    </View>
                  </View>
                  <Text style={tw`text-base font-black ${item.type === 'income' ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}>
                    {item.type === 'income' ? '+' : ''}₱{Math.abs(item.amount).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              );
            }}
            estimatedItemSize={60}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[tw`absolute bottom-6 right-6 w-16 h-16 rounded-full shadow-xl shadow-blue-500/30`, { elevation: 10 }]}
        onPress={openAddModal}
      >
        <LinearGradient colors={['#3b82f6', '#4f46e5']} style={tw`w-full h-full rounded-full items-center justify-center`}>
          <Plus color="#fff" size={28} />
        </LinearGradient>
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl p-1 mb-6`}>
            <TouchableOpacity onPress={() => setType('expense')} style={tw`flex-1 py-2 rounded-lg items-center ${type === 'expense' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}><Text style={tw`font-bold ${type === 'expense' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>Expense</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setType('income')} style={tw`flex-1 py-2 rounded-lg items-center ${type === 'income' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}><Text style={tw`font-bold ${type === 'income' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>Income</Text></TouchableOpacity>
          </View>
          <View style={tw`flex-row justify-center items-end mb-6`}>
            <Text style={tw`text-3xl font-bold text-slate-400 dark:text-slate-500 mb-2 mr-1`}>₱</Text>
            <Text style={tw`text-6xl font-black text-slate-800 dark:text-white`}>{amount}</Text>
          </View>
          <TextInput style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-base font-semibold text-slate-800 dark:text-white mb-4`} placeholderTextColor="#64748b" placeholder="What was this for?" value={title} onChangeText={setTitle} />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-4 max-h-12`} contentContainerStyle={tw`gap-2`}>
            {categories.filter(c => c.type === type).map((cat) => {
              const IconComp = IconMap[cat.icon] || Tag;
              const hex = cat.color.replace('#', '');
              const r = parseInt(hex.substring(0,2), 16) || 0;
              const g = parseInt(hex.substring(2,4), 16) || 0;
              const b = parseInt(hex.substring(4,6), 16) || 0;
              return (
                <TouchableOpacity 
                  key={cat.id} 
                  onPress={() => setTitle(cat.name)} 
                  style={[tw`flex-row items-center border px-4 py-2 rounded-full h-10`, { backgroundColor: `rgba(${r},${g},${b},0.1)`, borderColor: `rgba(${r},${g},${b},0.3)` }]}
                >
                  <IconComp size={16} color={cat.color} style={tw`mr-2`} />
                  <Text style={[tw`font-bold`, { color: cat.color }]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={tw`mt-auto gap-2`}>
            {[['1','2','3'], ['4','5','6'], ['7','8','9'], ['.','0','del']].map((row, i) => (
              <View key={i} style={tw`flex-row justify-between gap-2`}>
                {row.map((key) => (
                  <TouchableOpacity key={key} onPress={() => handleKeyPress(key)} style={tw`flex-1 bg-[#F3EDF7] dark:bg-[#211F26] h-16 rounded-2xl items-center justify-center border border-slate-100 dark:border-slate-700`}>
                    {key === 'del' ? <Delete color="#94a3b8" size={24} /> : <Text style={tw`text-2xl font-semibold text-slate-700 dark:text-slate-200`}>{key}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {selectedTxId && (
              <TouchableOpacity onPress={handleDeleteTransaction} style={tw`w-full bg-rose-50 dark:bg-rose-500/10 py-4 rounded-xl items-center mt-2 border border-rose-100 dark:border-rose-500/20`}>
                <Text style={tw`text-rose-500 font-bold text-lg`}>Delete Transaction</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleAddTransaction} style={tw`w-full bg-blue-600 py-4 rounded-xl items-center mt-4`}>
              <Text style={tw`text-white font-bold text-lg`}>{selectedTxId ? 'Save Changes' : 'Save Transaction'}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
