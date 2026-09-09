import React, { useRef, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Modal, Keyboard } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { 
  Tag, Check, Calendar, Clock, Wallet, CreditCard, 
  Smartphone, Building2, Delete, Plus, ChevronLeft, ChevronRight, X, Camera
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import tw, { useAppColorScheme } from 'twrnc';
import { FinanceService, Account, Category } from '../services/FinanceService';
import { IconMap } from '../utils/Icons';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { ReceiptCameraScanner } from './ReceiptCameraScanner';
import { ReceiptBreakdownList } from './ReceiptBreakdownList';
import { ReceiptItem, ParsedReceipt, generateFormattedNotes } from '../utils/ReceiptParser';

export type TransactionData = {
  id: number;
  title: string;
  amount: number;
  date: string;
  type: string;
  category: string;
  account_id: number;
  due_date?: string | null;
  notes?: string | null;
};

export interface TransactionBottomSheetRef {
  openAdd: (initialType?: 'expense' | 'income' | 'loan') => void;
  openEdit: (tx: TransactionData) => void;
  openScanner: () => void;
  close: () => void;
}

interface Props {
  onSuccess?: () => void;
}

export const TransactionBottomSheet = forwardRef<TransactionBottomSheetRef, Props>(({ onSuccess }, ref) => {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['92%'], []);
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent, currencySymbol } = useTheme();

  // Form State
  const [amount, setAmount] = useState('0');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'loan'>('expense');
  const [loanDirection, setLoanDirection] = useState<'borrowed' | 'repaid'>('borrowed');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString());
  const [loanDueDate, setLoanDueDate] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [breakdownItems, setBreakdownItems] = useState<ReceiptItem[]>([]);

  // App data caches
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Modals
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadData = () => {
    try {
      const cats = FinanceService.getCategories();
      setCategories(cats);
      const accs = FinanceService.getAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (e) {
      console.warn('Failed to load form metadata:', e);
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
    setBreakdownItems([]);
  };

  const handleScanSuccess = (parsed: ParsedReceipt) => {
    if (parsed.merchant) {
      setTitle(parsed.merchant);
    }
    if (parsed.totalAmount > 0) {
      setAmount(parsed.totalAmount.toFixed(2));
    }
    if (parsed.date) {
      try {
        setSelectedDate(new Date(parsed.date).toISOString());
      } catch {
        setSelectedDate(new Date().toISOString());
      }
    }
    setType('expense');
    if (parsed.items && parsed.items.length > 0) {
      setBreakdownItems(parsed.items);
    }

    // Auto-match category based on merchant name
    if (parsed.merchant) {
      const lower = parsed.merchant.toLowerCase();
      const expenseCats = categories.filter(c => c.type === 'expense');
      const matched = expenseCats.find(c => {
        const catLower = c.name.toLowerCase();
        if (lower.includes(catLower)) return true;
        if (catLower === 'groceries' && (lower.includes('mart') || lower.includes('super') || lower.includes('market') || lower.includes('puregold') || lower.includes('sm') || lower.includes('robinsons') || lower.includes('savemore'))) return true;
        if (catLower === 'food' && (lower.includes('restaurant') || lower.includes('jollibee') || lower.includes('mcdonald') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('starbucks') || lower.includes('bakery') || lower.includes('kfc') || lower.includes('chowking') || lower.includes('dunkin'))) return true;
        if (catLower === 'utilities' && (lower.includes('meralco') || lower.includes('electric') || lower.includes('water') || lower.includes('maynilad') || lower.includes('manila water') || lower.includes('telecom') || lower.includes('pldt') || lower.includes('globe') || lower.includes('smart'))) return true;
        if (catLower === 'transport' && (lower.includes('grab') || lower.includes('shell') || lower.includes('petron') || lower.includes('caltex') || lower.includes('gas') || lower.includes('fuel'))) return true;
        return false;
      });
      if (matched) {
        setSelectedCategory(matched.name);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    openAdd: (initialType = 'expense') => {
      loadData();
      resetForm();
      setType(initialType);
      const avail = FinanceService.getCategories().filter(c => c.type === initialType);
      if (avail.length > 0) setSelectedCategory(avail[0].name);
      const accs = FinanceService.getAccounts();
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
      bottomSheetRef.current?.expand();
    },
    openEdit: (tx: TransactionData) => {
      loadData();
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
      setSelectedAccountId(tx.account_id || 1);
      setSelectedDate(tx.date || new Date().toISOString());
      try {
        const splits = FinanceService.getSplitTransactions(tx.id);
        if (splits && splits.length > 0) {
          setBreakdownItems(splits.map((s, idx) => ({
            id: `item_${s.id || idx}`,
            description: s.category || '',
            price: s.amount,
          })));
        } else {
          setBreakdownItems([]);
        }
      } catch {
        setBreakdownItems([]);
      }
      bottomSheetRef.current?.expand();
    },
    openScanner: () => {
      loadData();
      resetForm();
      setType('expense');
      const avail = FinanceService.getCategories().filter(c => c.type === 'expense');
      if (avail.length > 0) setSelectedCategory(avail[0].name);
      const accs = FinanceService.getAccounts();
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
      bottomSheetRef.current?.expand();
      setShowScanner(true);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

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

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleKeyPress = (key: string) => {
    triggerHaptic();
    if (key === 'del') {
      setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    } else if (key === 'C') {
      setAmount('0');
    } else if (key === '=') {
      const res = evaluateMath(amount);
      setAmount(res.toString());
    } else if (key === '+' || key === '-') {
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
      setAmount(prev => (prev === '0' ? key : prev + key));
    }
  };

  const handleTypeChange = (newType: 'expense' | 'income' | 'loan') => {
    triggerHaptic();
    setType(newType);
    const avail = categories.filter(c => c.type === newType);
    if (avail.length > 0) {
      setSelectedCategory(avail[0].name);
    } else {
      setSelectedCategory('');
    }
  };

  const handleSave = () => {
    triggerHaptic();
    const finalAmount = evaluateMath(amount);
    if (finalAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    try {
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

      const finalNotes = breakdownItems.length > 0
        ? generateFormattedNotes(
            txTitle,
            txDate ? txDate.split('T')[0] : null,
            finalAmount,
            breakdownItems,
            currencySymbol
          )
        : null;

      const splitPayload = breakdownItems.length > 0
        ? breakdownItems.map(item => ({ description: item.description, price: item.price }))
        : undefined;

      if (selectedTxId) {
        FinanceService.updateTransaction(
          selectedTxId,
          txTitle,
          signedAmount,
          type,
          catName,
          txDate,
          targetAccountId,
          dueDate,
          finalNotes,
          splitPayload
        );
      } else {
        FinanceService.addTransaction(
          txTitle,
          signedAmount,
          type,
          catName,
          txDate,
          targetAccountId,
          dueDate,
          finalNotes,
          splitPayload
        );
      }

      bottomSheetRef.current?.close();
      resetForm();
      onSuccess?.();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save transaction.');
    }
  };

  const handleDelete = () => {
    if (!selectedTxId) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            FinanceService.deleteTransaction(selectedTxId);
            bottomSheetRef.current?.close();
            resetForm();
            onSuccess?.();
          },
        },
      ]
    );
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

  const activeCategories = categories.filter(c => c.type === type);
  const currentMathResult = amount.includes('+') || amount.includes('-') ? evaluateMath(amount) : null;

  // Calendar Day Generator
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = (isDueDate = false) => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={tw`w-10 h-10`} />);
    }
    for (let day = 1; day <= daysCount; day++) {
      const currentDayDate = new Date(year, month, day);
      const isSelected = isDueDate
        ? loanDueDate && new Date(loanDueDate).toDateString() === currentDayDate.toDateString()
        : new Date(selectedDate).toDateString() === currentDayDate.toDateString();

      days.push(
        <TouchableOpacity
          key={`day-${day}`}
          onPress={() => {
            triggerHaptic();
            if (isDueDate) {
              setLoanDueDate(currentDayDate.toISOString());
              setShowDueDatePicker(false);
            } else {
              setSelectedDate(currentDayDate.toISOString());
              setShowDatePicker(false);
            }
          }}
          style={[
            tw`w-10 h-10 rounded-full items-center justify-center my-0.5 min-h-[40px] min-w-[40px]`,
            isSelected ? [{ backgroundColor: accentColor }] : tw`bg-transparent`,
          ]}
        >
          <Text style={[tw`text-xs font-bold`, isSelected ? { color: textOnAccent } : { color: textPrimary }]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-5 border border-slate-100 dark:border-slate-800`}>
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <Text style={[tw`text-base font-black`, { color: textPrimary }]}>{monthName}</Text>
          <View style={tw`flex-row items-center gap-2`}>
            <TouchableOpacity
              onPress={() => setCalendarViewDate(new Date(year, month - 1, 1))}
              style={tw`w-9 h-9 rounded-full bg-[#F3EDF7] dark:bg-[#2B2930] items-center justify-center min-h-[48px] min-w-[48px]`}
            >
              <ChevronLeft size={18} color={textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCalendarViewDate(new Date(year, month + 1, 1))}
              style={tw`w-9 h-9 rounded-full bg-[#F3EDF7] dark:bg-[#2B2930] items-center justify-center min-h-[48px] min-w-[48px]`}
            >
              <ChevronRight size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekday headers */}
        <View style={tw`flex-row justify-between mb-2`}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
            <View key={idx} style={tw`w-10 items-center`}>
              <Text style={[tw`text-[11px] font-bold`, { color: textMuted }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Days Grid */}
        <View style={tw`flex-row flex-wrap justify-between`}>
          {days}
        </View>

        <TouchableOpacity
          onPress={() => {
            if (isDueDate) setShowDueDatePicker(false);
            else setShowDatePicker(false);
          }}
          style={tw`mt-4 py-3 rounded-xl items-center bg-[#F3EDF7] dark:bg-[#2B2930] min-h-[48px] justify-center`}
        >
          <Text style={[tw`font-bold text-sm`, { color: textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        backdropComponent={props => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetScrollView contentContainerStyle={tw`px-6 pt-2 pb-10`} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Header Row: Segmented Control & Scan Receipt Button */}
          <View style={tw`flex-row items-center justify-between mb-3 gap-2`}>
            <View style={tw`flex-1 flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-2xl p-1`}>
              {(['expense', 'income', 'loan'] as const).map(tabType => (
                <TouchableOpacity
                  key={tabType}
                  onPress={() => handleTypeChange(tabType)}
                  style={[
                    tw`flex-1 py-2.5 rounded-xl items-center min-h-[44px] justify-center`,
                    type === tabType ? tw`bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm` : null,
                  ]}
                >
                  <Text
                    style={[
                      tw`font-bold text-sm capitalize`,
                      type === tabType
                        ? tabType === 'expense'
                          ? tw`text-rose-500`
                          : tabType === 'income'
                          ? tw`text-emerald-500`
                          : tw`text-amber-500`
                        : { color: textMuted },
                    ]}
                  >
                    {tabType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowScanner(true)}
              style={[
                tw`flex-row items-center px-3.5 py-2 rounded-2xl border min-h-[44px] justify-center`,
                { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}35` },
              ]}
              accessibilityLabel="Scan receipt"
            >
              <Camera size={17} color={accentColor} style={tw`mr-1.5`} />
              <Text style={[tw`font-bold text-xs`, { color: accentColor }]}>Scan</Text>
            </TouchableOpacity>
          </View>

          {/* If Loan: Direction selector */}
          {type === 'loan' && (
            <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl p-1 mb-2.5`}>
              <TouchableOpacity
                onPress={() => setLoanDirection('borrowed')}
                style={[
                  tw`flex-1 py-2 rounded-lg items-center min-h-[40px] justify-center`,
                  loanDirection === 'borrowed' ? tw`bg-amber-500 shadow-sm` : null,
                ]}
              >
                <Text style={[tw`font-bold text-xs`, loanDirection === 'borrowed' ? tw`text-white` : { color: textMuted }]}>
                  + Borrowed (Inflow)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLoanDirection('repaid')}
                style={[
                  tw`flex-1 py-2 rounded-lg items-center min-h-[40px] justify-center`,
                  loanDirection === 'repaid' ? tw`bg-amber-500 shadow-sm` : null,
                ]}
              >
                <Text style={[tw`font-bold text-xs`, loanDirection === 'repaid' ? tw`text-white` : { color: textMuted }]}>
                  - Repayment / Lent
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Amount Display */}
          <View style={tw`items-center justify-center my-1.5`}>
            {currentMathResult !== null && (
              <Text style={[tw`text-xs font-bold mb-1`, { color: accentColor }]}>
                = {currencySymbol}{currentMathResult.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
            <View style={tw`flex-row items-center justify-center`}>
              <Text style={[tw`text-3xl font-black mr-1.5`, { color: textMuted }]}>{currencySymbol}</Text>
              <Text style={[tw`text-5xl font-black tracking-tight`, { color: textPrimary }]} numberOfLines={1}>
                {amount}
              </Text>
            </View>
          </View>

          {/* Date Chips Row */}
          <View style={tw`flex-row items-center gap-2 mb-2.5`}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-full min-h-[40px]`}
            >
              <Calendar size={14} color="#64748b" style={tw`mr-1.5`} />
              <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>{formatDateLabel(selectedDate)}</Text>
            </TouchableOpacity>

            {type === 'loan' && (
              <TouchableOpacity
                onPress={() => setShowDueDatePicker(true)}
                style={tw`flex-row items-center bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3.5 py-2 rounded-full min-h-[40px]`}
              >
                <Clock size={14} color="#f59e0b" style={tw`mr-1.5`} />
                <Text style={tw`text-xs font-bold text-amber-700 dark:text-amber-400`}>
                  {loanDueDate ? `Due: ${formatDateLabel(loanDueDate)}` : 'Set Due Date'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Account Selector */}
          <View style={tw`mb-2`}>
            <Text style={[tw`text-[11px] font-bold mb-1 uppercase tracking-wider`, { color: textMuted }]}>
              Account / Payment Method
            </Text>
            <GestureScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pr-4`}>
              {accounts.map(acc => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedAccountId(acc.id);
                    }}
                    style={[
                      tw`flex-row items-center border px-3 py-2 rounded-xl min-h-[44px]`,
                      isSelected
                        ? [{ backgroundColor: accentColor, borderColor: accentColor }]
                        : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-200 dark:border-slate-800`,
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

          {/* Category Chips */}
          <View style={tw`mb-2.5`}>
            <Text style={[tw`text-[11px] font-bold mb-1 uppercase tracking-wider`, { color: textMuted }]}>
              Category
            </Text>
            <GestureScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pr-6`}>
              {activeCategories.map(cat => {
                const IconComp = IconMap[cat.icon] || Tag;
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedCategory(cat.name);
                    }}
                    style={[
                      tw`flex-row items-center border px-3.5 py-2 rounded-full min-h-[42px]`,
                      isSelected
                        ? { backgroundColor: cat.color, borderColor: cat.color }
                        : { backgroundColor: isDark ? '#211F26' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
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
                  tw`flex-row items-center border border-dashed px-3 py-2 rounded-full min-h-[42px]`,
                  { borderColor: accentColor, backgroundColor: `${accentColor}12` },
                ]}
              >
                <Plus size={14} color={accentColor} style={tw`mr-1`} />
                <Text style={[tw`font-bold text-xs`, { color: accentColor }]}>Add</Text>
              </TouchableOpacity>
            </GestureScrollView>
          </View>

          {/* Note Input */}
          <TextInput
            style={[
              tw`bg-[#F3EDF7] dark:bg-[#211F26]/60 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-xl text-sm font-semibold mb-2 min-h-[48px]`,
              { color: textPrimary },
            ]}
            placeholderTextColor="#64748b"
            placeholder="Note / Description (e.g. Lunch with friends)"
            value={title}
            onChangeText={setTitle}
          />

          {/* Itemized Receipt Breakdown */}
          <ReceiptBreakdownList
            items={breakdownItems}
            onUpdateItems={setBreakdownItems}
            billTotal={evaluateMath(amount)}
          />

          {/* Keypad & Save */}
          {!isKeyboardVisible ? (
            <View style={tw`mt-auto gap-2`}>
              {[
                ['1', '2', '3', '+'],
                ['4', '5', '6', '-'],
                ['7', '8', '9', 'del'],
                ['.', '0', '=', 'C'],
              ].map((row, i) => (
                <View key={i} style={tw`flex-row justify-between gap-2`}>
                  {row.map(key => {
                    const isOp = key === '+' || key === '-' || key === '=';
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleKeyPress(key)}
                        style={[
                          tw`flex-1 h-12 rounded-2xl items-center justify-center border min-h-[48px]`,
                          isOp
                            ? [{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}35` }]
                            : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`,
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
                    onPress={handleDelete}
                    style={tw`flex-1 bg-rose-50 dark:bg-rose-500/10 py-3.5 rounded-xl items-center border border-rose-200 dark:border-rose-500/20 min-h-[48px] justify-center`}
                  >
                    <Text style={tw`text-rose-500 font-bold text-sm`}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  style={[
                    tw`flex-2 py-3.5 rounded-xl items-center shadow-md min-h-[48px] justify-center`,
                    { backgroundColor: accentColor },
                  ]}
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
                style={[tw`w-full py-3.5 rounded-xl items-center shadow-md min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Done Typing</Text>
              </TouchableOpacity>
            </View>
          )}

        </BottomSheetScrollView>
      </BottomSheet>

      {/* Interactive Calendar Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          {renderCalendar(false)}
        </View>
      </Modal>

      {/* Interactive Loan Due Date Modal */}
      <Modal visible={showDueDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          {renderCalendar(true)}
        </View>
      </Modal>

      {/* Offline Receipt Camera & OCR Scanner Modal */}
      <ReceiptCameraScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
});
