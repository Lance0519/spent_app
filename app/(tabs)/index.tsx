import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform, Keyboard, Modal } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { 
  Plus, Wallet, Coffee, Train, ShoppingCart, Delete, Tag, Eye, EyeOff, 
  Target, PieChart, Download, List, Check, Calendar, Clock, CreditCard, 
  Smartphone, Building2, HelpCircle, ArrowDownLeft, ArrowUpRight, X
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { 
  getDB, 
  getCategories, 
  Category, 
  exportBackupJSON, 
  deleteTransaction, 
  updateTransaction,
  getAccounts,
  Account
} from '../../db/database';
import { checkAndTriggerBudgetWarning } from '../../services/NotificationService';
import { IconMap } from '../../utils/Icons';
import { useTheme } from '../../context/ThemeContext';

type Transaction = {
  id: number;
  title: string;
  amount: number;
  date: string;
  type: string;
  category: string;
  account_id: number;
  due_date?: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['92%'], []);
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, palette, textPrimary, textSecondary, textMuted, textOnAccent } = useTheme();
  
  // Transaction Form State
  const [amount, setAmount] = useState('0');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'loan'>('expense');
  const [loanDirection, setLoanDirection] = useState<'borrowed' | 'repaid'>('borrowed');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString());
  const [loanDueDate, setLoanDueDate] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  
  // Date Picker Modals
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');
  
  // Keyboard State (to avoid overlapping custom keypad)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // App Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    try {
      const db = getDB();
      const txs = (db.getAllSync('SELECT * FROM transactions ORDER BY date DESC LIMIT 20') as any) as Transaction[];
      setTransactions(txs);
      
      const acc = db.getFirstSync('SELECT SUM(balance) as balance FROM accounts') as { balance: number } | null;
      setBalance(acc?.balance || 0);
      
      const cats = getCategories();
      setCategories(cats);

      const accs = getAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }

      let ex = 0;
      let inc = 0;
      const now = new Date();
      txs.forEach((t: Transaction) => {
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

  // Safe arithmetic evaluator for basic keypad math (+, -)
  const evaluateMath = (expr: string): number => {
    try {
      const clean = expr.replace(/[^0-9.+-]/g, '');
      if (!clean) return 0;
      const parts = clean.match(/([+-]?[0-9.]+)/g);
      if (!parts) return 0;
      const res = parts.reduce((acc, part) => acc + (parseFloat(part) || 0), 0);
      return isNaN(res) ? 0 : Math.round(res * 100) / 100;
    } catch {
      return parseFloat(expr) || 0;
    }
  };

  const handleAddTransaction = () => {
    const finalAmount = evaluateMath(amount);
    if (finalAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than 0.");
      return;
    }

    try {
      const db = getDB();
      const catName = selectedCategory || title || (type === 'loan' ? 'Loan' : type === 'income' ? 'Salary' : 'Other');
      const txTitle = title.trim() || catName;
      const targetAccountId = selectedAccountId || (accounts[0]?.id || 1);
      
      let signedAmount = finalAmount;
      if (type === 'expense') {
        signedAmount = -Math.abs(finalAmount);
      } else if (type === 'income') {
        signedAmount = Math.abs(finalAmount);
      } else if (type === 'loan') {
        signedAmount = loanDirection === 'borrowed' ? Math.abs(finalAmount) : -Math.abs(finalAmount);
      }

      const txDate = selectedDate || new Date().toISOString();
      const dueDate = type === 'loan' ? loanDueDate : null;

      if (selectedTxId) {
        updateTransaction(selectedTxId, txTitle, signedAmount, type, catName, txDate, targetAccountId, dueDate);
      } else {
        db.runSync(
          `INSERT INTO transactions (title, amount, type, date, category, account_id, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [txTitle, signedAmount, type, txDate, catName, targetAccountId, dueDate]
        );
        
        db.runSync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?`,
          [signedAmount, targetAccountId]
        );
        
        if (type === 'expense') {
          const budget = db.getFirstSync('SELECT amount FROM budgets WHERE category = ?', [catName]) as { amount: number } | null;
          if (budget) {
            const now = new Date();
            const allCatTxs = (db.getAllSync('SELECT amount, date FROM transactions WHERE type = "expense" AND category = ?', [catName]) as any) as { amount: number; date: string }[];
            let totalSpent = 0;
            allCatTxs.forEach((tx: { amount: number; date: string }) => {
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
      resetForm();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save transaction.");
    }
  };

  const handleDeleteTransaction = () => {
    if (selectedTxId) {
      Alert.alert(
        "Delete Transaction",
        "Are you sure you want to delete this transaction?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteTransaction(selectedTxId);
              fetchData();
              bottomSheetRef.current?.close();
              resetForm();
            }
          }
        ]
      );
    }
  };

  const resetForm = () => {
    setAmount('0');
    setTitle('');
    setSelectedCategory('');
    setSelectedTxId(null);
    setSelectedDate(new Date().toISOString());
    setLoanDueDate(null);
    setLoanDirection('borrowed');
  };

  const openAddModal = () => {
    resetForm();
    setType('expense');
    const expenseCats = categories.filter(c => c.type === 'expense');
    if (expenseCats.length > 0) setSelectedCategory(expenseCats[0].name);
    if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
    bottomSheetRef.current?.expand();
  };

  const openEditModal = (tx: Transaction) => {
    setSelectedTxId(tx.id);
    setTitle(tx.title);
    setAmount(Math.abs(tx.amount).toString());
    const txType = (tx.type === 'loan' ? 'loan' : tx.type === 'income' ? 'income' : 'expense') as 'expense' | 'income' | 'loan';
    setType(txType);
    if (txType === 'loan') {
      setLoanDirection(tx.amount >= 0 ? 'borrowed' : 'repaid');
      setLoanDueDate(tx.due_date || null);
    }
    setSelectedCategory(tx.category || '');
    setSelectedAccountId(tx.account_id || accounts[0]?.id || 1);
    setSelectedDate(tx.date || new Date().toISOString());
    bottomSheetRef.current?.expand();
  };

  const handleTypeChange = (newType: 'expense' | 'income' | 'loan') => {
    setType(newType);
    const available = categories.filter(c => c.type === newType);
    if (available.length > 0) {
      setSelectedCategory(available[0].name);
    } else {
      setSelectedCategory('');
    }
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setAmount(prev => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
    } else if (key === 'C') {
      setAmount('0');
    } else if (key === '=') {
      const res = evaluateMath(amount);
      setAmount(res.toString());
    } else if (key === '+' || key === '-') {
      // If ends with an operator, replace it
      if (amount.endsWith('+') || amount.endsWith('-')) {
        setAmount(prev => prev.slice(0, -1) + key);
      } else {
        setAmount(prev => prev + key);
      }
    } else if (key === '.') {
      const parts = amount.split(/[+-]/);
      const currentNum = parts[parts.length - 1];
      if (!currentNum.includes('.')) {
        setAmount(prev => prev + '.');
      }
    } else {
      setAmount(prev => prev === '0' ? key : prev + key);
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

  const activeCategories = categories.filter(c => c.type === type);
  const currentMathResult = (amount.includes('+') || amount.includes('-')) ? evaluateMath(amount) : null;

  return (
    <View style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218] relative`}>
      <LinearGradient
        colors={isDark ? ['#141218', '#2B2930'] : [palette.dark, palette.light]}
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
            <Text style={[tw`text-xs font-bold`, { color: textSecondary }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={tw`flex-1 px-6 pb-6`}>
        <Text style={[tw`text-lg font-black mb-3`, { color: textPrimary }]}>Recent Transactions</Text>
        <View style={tw`flex-1 bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-4 shadow-sm shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden`}>
          <FlashList
            data={transactions}
            renderItem={({ item }) => {
              const catObj = categories.find(c => c.name === item.category);
              const catColor = catObj ? catObj.color : (item.type === 'income' ? '#10b981' : item.type === 'loan' ? '#f59e0b' : '#f43f5e');
              const IconComp = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
              const isIncome = item.type === 'income' || (item.type === 'loan' && item.amount > 0);
              const isLoan = item.type === 'loan';

              return (
                <TouchableOpacity onPress={() => openEditModal(item)} style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-50 dark:border-slate-800/50`}>
                  <View style={tw`flex-row items-center flex-1 mr-2`}>
                    <View style={tw`w-10 h-10 rounded-full items-center justify-center mr-3 bg-[#F3EDF7] dark:bg-[#211F26]`}>
                      <IconComp size={20} color={catColor} />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-base font-bold`, { color: textPrimary }]} numberOfLines={1}>{item.title}</Text>
                      <View style={tw`flex-row items-center gap-1.5 mt-0.5`}>
                        <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>{item.category}</Text>
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
                  <Text style={[tw`text-base font-black`, isIncome ? tw`text-emerald-500` : { color: textPrimary }]}>
                    {isIncome ? '+' : '-'}₱{Math.abs(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[tw`absolute bottom-6 right-6 w-16 h-16 rounded-full shadow-xl`, { elevation: 10, shadowColor: accentColor }]}
        onPress={openAddModal}
      >
        <LinearGradient colors={[palette.light, palette.dark]} style={tw`w-full h-full rounded-full items-center justify-center`}>
          <Plus color="#fff" size={28} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Transaction Entry Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-6`}>
          
          {/* 3-Way Segmented Control: Expense | Income | Loan */}
          <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-2xl p-1 mb-4`}>
            <TouchableOpacity 
              onPress={() => handleTypeChange('expense')} 
              style={tw`flex-1 py-2.5 rounded-xl items-center ${type === 'expense' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'expense' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTypeChange('income')} 
              style={tw`flex-1 py-2.5 rounded-xl items-center ${type === 'income' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'income' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTypeChange('loan')} 
              style={tw`flex-1 py-2.5 rounded-xl items-center ${type === 'loan' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'loan' ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>Loan</Text>
            </TouchableOpacity>
          </View>

          {/* If Loan, Direction Selector (Borrowed vs Repaid) */}
          {type === 'loan' && (
            <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl p-1 mb-3`}>
              <TouchableOpacity 
                onPress={() => setLoanDirection('borrowed')} 
                style={tw`flex-1 py-1.5 rounded-lg items-center ${loanDirection === 'borrowed' ? 'bg-amber-500 shadow-sm' : ''}`}
              >
                <Text style={tw`font-bold text-xs ${loanDirection === 'borrowed' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  + Borrowed (Inflow)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setLoanDirection('repaid')} 
                style={tw`flex-1 py-1.5 rounded-lg items-center ${loanDirection === 'repaid' ? 'bg-amber-500 shadow-sm' : ''}`}
              >
                <Text style={tw`font-bold text-xs ${loanDirection === 'repaid' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  - Repayment / Lent
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Balanced Amount & Currency Display with Live Formula Preview */}
          <View style={tw`items-center justify-center my-2`}>
            {currentMathResult !== null && (
              <Text style={[tw`text-xs font-bold mb-1`, { color: accentColor }]}>
                = ₱{currentMathResult.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            )}
            <View style={tw`flex-row items-center justify-center`}>
              <Text style={[tw`text-3xl font-black mr-1.5`, { color: textMuted }]}>₱</Text>
              <Text style={[tw`text-5xl font-black tracking-tight`, { color: textPrimary }]} numberOfLines={1}>
                {amount}
              </Text>
            </View>
          </View>

          {/* Date Selector & Loan Due Date Chips Row */}
          <View style={tw`flex-row items-center gap-2 mb-3`}>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full`}
            >
              <Calendar size={14} color="#64748b" style={tw`mr-1.5`} />
              <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                {formatDateLabel(selectedDate)}
              </Text>
            </TouchableOpacity>

            {type === 'loan' && (
              <TouchableOpacity 
                onPress={() => setShowDueDatePicker(true)}
                style={tw`flex-row items-center bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 rounded-full`}
              >
                <Clock size={14} color="#f59e0b" style={tw`mr-1.5`} />
                <Text style={tw`text-xs font-bold text-amber-700 dark:text-amber-400`}>
                  {loanDueDate ? `Due: ${formatDateLabel(loanDueDate)}` : 'Set Due Date'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment Account Selector */}
          <View style={tw`mb-2`}>
            <Text style={[tw`text-[11px] font-bold mb-1 uppercase tracking-wider`, { color: textMuted }]}>Account / Payment Method</Text>
            <GestureScrollView 
              horizontal 
              nestedScrollEnabled={true} 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={tw`flex-row gap-2 pr-4`}
            >
              {accounts.map(acc => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={[
                      tw`flex-row items-center border px-3 py-1.5 rounded-xl`,
                      isSelected 
                        ? [{ backgroundColor: accentColor, borderColor: accentColor }] 
                        : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-200 dark:border-slate-800`
                    ]}
                  >
                    {acc.type === 'cash' ? <Wallet size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'ewallet' ? <Smartphone size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'credit' ? <CreditCard size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     <Building2 size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} />}
                    <Text style={[tw`font-bold text-xs`, { color: isSelected ? textOnAccent : textSecondary }]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </GestureScrollView>
          </View>

          {/* Categories Selector with Smooth Horizontal Scrolling Fix */}
          <View style={tw`mb-3`}>
            <Text style={[tw`text-[11px] font-bold mb-1 uppercase tracking-wider`, { color: textMuted }]}>Category</Text>
            <GestureScrollView 
              horizontal 
              nestedScrollEnabled={true} 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={tw`flex-row gap-2 pr-6`}
            >
              {activeCategories.map((cat) => {
                const IconComp = IconMap[cat.icon] || Tag;
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setSelectedCategory(cat.name)} 
                    style={[
                      tw`flex-row items-center border px-3.5 py-1.5 rounded-full`,
                      isSelected 
                        ? { backgroundColor: cat.color, borderColor: cat.color } 
                        : { backgroundColor: isDark ? '#211F26' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }
                    ]}
                  >
                    {isSelected ? (
                      <Check size={14} color="#fff" style={tw`mr-1.5`} />
                    ) : (
                      <IconComp size={14} color={cat.color} style={tw`mr-1.5`} />
                    )}
                    <Text style={[tw`font-bold text-xs`, { color: isSelected ? '#fff' : textSecondary }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity 
                onPress={() => {
                  bottomSheetRef.current?.close();
                  router.push('/categories');
                }} 
                style={[
                  tw`flex-row items-center border border-dashed px-3 py-1.5 rounded-full`,
                  { borderColor: accentColor, backgroundColor: `${accentColor}12` }
                ]}
              >
                <Plus size={14} color={accentColor} style={tw`mr-1`} />
                <Text style={[tw`font-bold text-xs`, { color: accentColor }]}>Add</Text>
              </TouchableOpacity>
            </GestureScrollView>
          </View>

          {/* Note Input */}
          <TextInput 
            style={[tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-semibold mb-2`, { color: textPrimary }]} 
            placeholderTextColor="#64748b" 
            placeholder="Note / Description (e.g. Lunch with friends)" 
            value={title} 
            onChangeText={setTitle} 
          />

          {/* Collapsible Keypad / Actions Area (Smoothly collapses when typing note) */}
          {!isKeyboardVisible ? (
            <View style={tw`mt-auto gap-2`}>
              {[
                ['1', '2', '3', '+'],
                ['4', '5', '6', '-'],
                ['7', '8', '9', 'del'],
                ['.', '0', '=', 'C']
              ].map((row, i) => (
                <View key={i} style={tw`flex-row justify-between gap-2`}>
                  {row.map((key) => {
                    const isOp = key === '+' || key === '-' || key === '=';
                    return (
                      <TouchableOpacity 
                        key={key} 
                        onPress={() => handleKeyPress(key)} 
                        style={[
                          tw`flex-1 h-13 rounded-2xl items-center justify-center border`,
                          isOp 
                            ? [{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}35` }] 
                            : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`
                        ]}
                      >
                        {key === 'del' ? (
                          <Delete color="#94a3b8" size={20} />
                        ) : (
                          <Text style={[tw`text-xl font-bold`, isOp ? { color: accentColor } : { color: textPrimary }]}>
                            {key}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={tw`flex-row gap-2 mt-1`}>
                {selectedTxId && (
                  <TouchableOpacity 
                    onPress={handleDeleteTransaction} 
                    style={tw`flex-1 bg-rose-50 dark:bg-rose-500/10 py-3.5 rounded-xl items-center border border-rose-200 dark:border-rose-500/20`}
                  >
                    <Text style={tw`text-rose-500 font-bold text-sm`}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={handleAddTransaction} 
                  style={[tw`flex-2 py-3.5 rounded-xl items-center shadow-md`, { backgroundColor: accentColor }]}
                >
                  <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>
                    {selectedTxId ? 'Save Changes' : 'Save Transaction'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={tw`mt-auto pt-2`}>
              <TouchableOpacity 
                onPress={() => Keyboard.dismiss()} 
                style={[tw`w-full py-3.5 rounded-xl items-center shadow-md`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Done Typing</Text>
              </TouchableOpacity>
            </View>
          )}

        </BottomSheetView>
      </BottomSheet>

      {/* Quick Transaction Date Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-6 border border-slate-100 dark:border-slate-800`}>
            <Text style={[tw`text-lg font-bold mb-4`, { color: textPrimary }]}>Select Transaction Date</Text>
            
            <View style={tw`gap-2 mb-4`}>
              <TouchableOpacity 
                onPress={() => { setSelectedDate(new Date().toISOString()); setShowDatePicker(false); }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => { 
                  const d = new Date(); 
                  d.setDate(d.getDate() - 1); 
                  setSelectedDate(d.toISOString()); 
                  setShowDatePicker(false); 
                }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>Yesterday</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => { 
                  const d = new Date(); 
                  d.setDate(d.getDate() - 2); 
                  setSelectedDate(d.toISOString()); 
                  setShowDatePicker(false); 
                }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>2 Days Ago</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={[tw`bg-[#F3EDF7] dark:bg-[#2B2930] p-3.5 rounded-xl font-semibold mb-4`, { color: textPrimary }]}
              placeholder="Or enter YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={customDateInput}
              onChangeText={setCustomDateInput}
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={tw`flex-1 p-3 rounded-xl items-center`}>
                <Text style={[tw`font-bold`, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  if (customDateInput) {
                    const parsed = new Date(customDateInput);
                    if (!isNaN(parsed.getTime())) {
                      setSelectedDate(parsed.toISOString());
                    }
                  }
                  setShowDatePicker(false);
                  setCustomDateInput('');
                }} 
                style={[tw`flex-1 p-3 rounded-xl items-center shadow-sm`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold`, { color: textOnAccent }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick Loan Due Date Modal */}
      <Modal visible={showDueDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-6 border border-slate-100 dark:border-slate-800`}>
            <Text style={[tw`text-lg font-bold mb-2`, { color: textPrimary }]}>Loan Repayment Due Date</Text>
            <Text style={[tw`text-xs mb-4`, { color: textMuted }]}>Set when this loan is scheduled to be paid.</Text>
            
            <View style={tw`gap-2 mb-4`}>
              <TouchableOpacity 
                onPress={() => { 
                  const d = new Date(); 
                  d.setDate(d.getDate() + 7); 
                  setLoanDueDate(d.toISOString()); 
                  setShowDueDatePicker(false); 
                }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>In 1 Week</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => { 
                  const d = new Date(); 
                  d.setDate(d.getDate() + 15); 
                  setLoanDueDate(d.toISOString()); 
                  setShowDueDatePicker(false); 
                }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>In 15 Days (Next Payday)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => { 
                  const d = new Date(); 
                  d.setDate(d.getDate() + 30); 
                  setLoanDueDate(d.toISOString()); 
                  setShowDueDatePicker(false); 
                }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={[tw`font-bold`, { color: textPrimary }]}>In 30 Days (Next Month)</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={[tw`bg-[#F3EDF7] dark:bg-[#2B2930] p-3.5 rounded-xl font-semibold mb-4`, { color: textPrimary }]}
              placeholder="Or enter YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={customDateInput}
              onChangeText={setCustomDateInput}
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity onPress={() => setShowDueDatePicker(false)} style={tw`flex-1 p-3 rounded-xl items-center`}>
                <Text style={[tw`font-bold`, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  if (customDateInput) {
                    const parsed = new Date(customDateInput);
                    if (!isNaN(parsed.getTime())) {
                      setLoanDueDate(parsed.toISOString());
                    }
                  }
                  setShowDueDatePicker(false);
                  setCustomDateInput('');
                }} 
                style={tw`flex-1 bg-amber-500 p-3 rounded-xl items-center`}
              >
                <Text style={tw`text-white font-bold`}>Save Due Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
