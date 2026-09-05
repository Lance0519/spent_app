import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Modal, Keyboard } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { 
  ArrowUpRight, ArrowDownRight, Delete, Tag, Check, Calendar, Clock, 
  Wallet, CreditCard, Smartphone, Building2 
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { 
  getDB, 
  deleteTransaction, 
  updateTransaction, 
  getCategories, 
  Category, 
  getAccounts, 
  Account 
} from '../../db/database';
import { IconMap } from '../../utils/Icons';

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

export default function TransactionsScreen() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'loan'>('all');
  const [allData, setAllData] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Edit Modal State
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [amount, setAmount] = useState('0');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'loan'>('expense');
  const [loanDirection, setLoanDirection] = useState<'borrowed' | 'repaid'>('borrowed');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString());
  const [loanDueDate, setLoanDueDate] = useState<string | null>(null);

  // Date Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');

  // Keyboard Overlap State
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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
      const txs = (db.getAllSync('SELECT * FROM transactions ORDER BY date DESC') as any) as Transaction[];
      setAllData(txs);
      setCategories(getCategories());
      setAccounts(getAccounts());
    } catch (e) {
      console.log(e);
    }
  };

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

  const handleUpdate = () => {
    if (!selectedTxId) return;
    const finalAmount = evaluateMath(amount);
    if (finalAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than 0.");
      return;
    }

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

    updateTransaction(selectedTxId, txTitle, signedAmount, type, catName, txDate, targetAccountId, dueDate);
    fetchData();
    bottomSheetRef.current?.close();
  };

  const handleDelete = () => {
    if (!selectedTxId) return;
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
          } 
        }
      ]
    );
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
      setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (key === 'C') {
      setAmount('0');
    } else if (key === '=') {
      setAmount(evaluateMath(amount).toString());
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

  const filteredData = allData.filter(t => filter === 'all' || t.type === filter);
  const activeCategories = categories.filter(c => c.type === type);
  const currentMathResult = (amount.includes('+') || amount.includes('-')) ? evaluateMath(amount) : null;

  const renderItem = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'income' || (item.type === 'loan' && item.amount > 0);
    const isLoan = item.type === 'loan';
    
    return (
      <TouchableOpacity onPress={() => openEditModal(item)} style={tw`flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800/50`}>
        <View style={tw`flex-row items-center flex-1 mr-2`}>
          <View style={[
            tw`w-12 h-12 rounded-full items-center justify-center mr-4`,
            isLoan 
              ? tw`bg-amber-100 dark:bg-amber-500/10` 
              : isIncome 
                ? tw`bg-emerald-100 dark:bg-emerald-500/10` 
                : tw`bg-rose-100 dark:bg-rose-500/10`
          ]}>
            {isLoan ? (
              <CreditCard color="#f59e0b" size={20} />
            ) : isIncome ? (
              <ArrowDownRight color="#10b981" size={22} />
            ) : (
              <ArrowUpRight color="#f43f5e" size={22} />
            )}
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`} numberOfLines={1}>{item.title}</Text>
            <View style={tw`flex-row items-center gap-1.5 mt-0.5`}>
              <Text style={tw`text-xs font-medium text-slate-500 dark:text-slate-400`}>
                {new Date(item.date).toLocaleDateString()} • {item.category}
              </Text>
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
        <Text style={[
          tw`text-lg font-black tracking-tight`,
          isIncome ? tw`text-emerald-500 dark:text-emerald-400` : tw`text-slate-800 dark:text-slate-100`
        ]}>
          {isIncome ? '+' : '-'}₱{Math.abs(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <View style={tw`px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800`}>
        <Text style={tw`text-3xl font-black text-slate-900 dark:text-white mb-6`}>Transactions</Text>
        <View style={tw`flex-row space-x-2 gap-2`}>
          {['all', 'income', 'expense', 'loan'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              style={tw`px-4 py-2 rounded-full ${filter === f ? 'bg-blue-600 shadow-md shadow-blue-500/30 dark:shadow-none' : 'bg-[#F3EDF7] dark:bg-[#211F26]'}`}
            >
              <Text style={tw`font-bold capitalize text-xs tracking-wide ${filter === f ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={tw`flex-1 px-6 pt-2`}>
        <FlashList
          data={filteredData}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tw`pb-8`}
        />
      </View>

      {/* Edit Transaction Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['92%']}
        enablePanDownToClose
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-6`}>
          
          {/* 3-Way Segmented Control */}
          <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-2xl p-1 mb-4`}>
            <TouchableOpacity 
              onPress={() => handleTypeChange('expense')} 
              style={tw`flex-1 py-2 rounded-xl items-center ${type === 'expense' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'expense' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTypeChange('income')} 
              style={tw`flex-1 py-2 rounded-xl items-center ${type === 'income' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'income' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleTypeChange('loan')} 
              style={tw`flex-1 py-2 rounded-xl items-center ${type === 'loan' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
            >
              <Text style={tw`font-bold text-sm ${type === 'loan' ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>Loan</Text>
            </TouchableOpacity>
          </View>

          {/* If Loan, Direction Selector */}
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

          {/* Balanced Amount & Currency Display */}
          <View style={tw`items-center justify-center my-2`}>
            {currentMathResult !== null && (
              <Text style={tw`text-xs font-bold text-blue-500 mb-1`}>
                = ₱{currentMathResult.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            )}
            <View style={tw`flex-row items-center justify-center`}>
              <Text style={tw`text-3xl font-black text-slate-400 dark:text-slate-500 mr-1.5`}>₱</Text>
              <Text style={tw`text-5xl font-black text-slate-800 dark:text-white tracking-tight`} numberOfLines={1}>
                {amount}
              </Text>
            </View>
          </View>

          {/* Date Chips Row */}
          <View style={tw`flex-row items-center gap-2 mb-3`}>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              style={tw`flex-row items-center bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full`}
            >
              <Calendar size={14} color="#64748b" style={tw`mr-1.5`} />
              <Text style={tw`text-xs font-bold text-slate-700 dark:text-slate-300`}>
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
            <Text style={tw`text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider`}>Account / Payment Method</Text>
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
                        ? tw`bg-blue-600 border-blue-600` 
                        : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-200 dark:border-slate-800`
                    ]}
                  >
                    {acc.type === 'cash' ? <Wallet size={14} color={isSelected ? '#fff' : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'ewallet' ? <Smartphone size={14} color={isSelected ? '#fff' : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'credit' ? <CreditCard size={14} color={isSelected ? '#fff' : '#64748b'} style={tw`mr-1.5`} /> :
                     <Building2 size={14} color={isSelected ? '#fff' : '#64748b'} style={tw`mr-1.5`} />}
                    <Text style={[tw`font-bold text-xs`, isSelected ? tw`text-white` : tw`text-slate-600 dark:text-slate-300`]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </GestureScrollView>
          </View>

          {/* Categories Selector with Smooth Horizontal Scrolling Fix */}
          <View style={tw`mb-3`}>
            <Text style={tw`text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider`}>Category</Text>
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
                    <Text style={[tw`font-bold text-xs`, { color: isSelected ? '#fff' : (isDark ? '#cbd5e1' : '#64748b') }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </GestureScrollView>
          </View>

          {/* Note Input */}
          <TextInput 
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-white mb-2`} 
            placeholderTextColor="#64748b" 
            placeholder="Note / Description" 
            value={title} 
            onChangeText={setTitle} 
          />

          {/* Collapsible Keypad */}
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
                            ? tw`bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30` 
                            : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`
                        ]}
                      >
                        {key === 'del' ? (
                          <Delete color="#94a3b8" size={20} />
                        ) : (
                          <Text style={[tw`text-xl font-bold`, isOp ? tw`text-blue-600 dark:text-blue-400` : tw`text-slate-700 dark:text-slate-200`]}>
                            {key}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={tw`flex-row gap-2 mt-1`}>
                <TouchableOpacity 
                  onPress={handleDelete} 
                  style={tw`flex-1 bg-rose-50 dark:bg-rose-500/10 py-3.5 rounded-xl items-center border border-rose-200 dark:border-rose-500/20`}
                >
                  <Text style={tw`text-rose-500 font-bold text-sm`}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleUpdate} 
                  style={tw`flex-2 bg-blue-600 py-3.5 rounded-xl items-center`}
                >
                  <Text style={tw`text-white font-bold text-base`}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={tw`mt-auto pt-2`}>
              <TouchableOpacity 
                onPress={() => Keyboard.dismiss()} 
                style={tw`w-full bg-blue-600 py-3.5 rounded-xl items-center`}
              >
                <Text style={tw`text-white font-bold text-base`}>Done Typing</Text>
              </TouchableOpacity>
            </View>
          )}

        </BottomSheetView>
      </BottomSheet>

      {/* Date Pickers */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-6 border border-slate-100 dark:border-slate-800`}>
            <Text style={tw`text-lg font-bold text-slate-800 dark:text-white mb-4`}>Select Transaction Date</Text>
            
            <View style={tw`gap-2 mb-4`}>
              <TouchableOpacity 
                onPress={() => { setSelectedDate(new Date().toISOString()); setShowDatePicker(false); }}
                style={tw`p-3.5 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930]`}
              >
                <Text style={tw`font-bold text-slate-800 dark:text-white`}>Today</Text>
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
                <Text style={tw`font-bold text-slate-800 dark:text-white`}>Yesterday</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={tw`bg-[#F3EDF7] dark:bg-[#2B2930] p-3.5 rounded-xl font-semibold text-slate-800 dark:text-white mb-4`}
              placeholder="Or enter YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={customDateInput}
              onChangeText={setCustomDateInput}
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={tw`flex-1 p-3 rounded-xl items-center`}>
                <Text style={tw`font-bold text-slate-500`}>Cancel</Text>
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
                style={tw`flex-1 bg-blue-600 p-3 rounded-xl items-center`}
              >
                <Text style={tw`text-white font-bold`}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Due Date Modal */}
      <Modal visible={showDueDatePicker} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-6 border border-slate-100 dark:border-slate-800`}>
            <Text style={tw`text-lg font-bold text-slate-800 dark:text-white mb-2`}>Loan Repayment Due Date</Text>
            <Text style={tw`text-xs text-slate-500 dark:text-slate-400 mb-4`}>Set when this loan is scheduled to be paid.</Text>
            
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
                <Text style={tw`font-bold text-slate-800 dark:text-white`}>In 1 Week</Text>
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
                <Text style={tw`font-bold text-slate-800 dark:text-white`}>In 15 Days (Next Payday)</Text>
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
                <Text style={tw`font-bold text-slate-800 dark:text-white`}>In 30 Days (Next Month)</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={tw`bg-[#F3EDF7] dark:bg-[#2B2930] p-3.5 rounded-xl font-semibold text-slate-800 dark:text-white mb-4`}
              placeholder="Or enter YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={customDateInput}
              onChangeText={setCustomDateInput}
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity onPress={() => setShowDueDatePicker(false)} style={tw`flex-1 p-3 rounded-xl items-center`}>
                <Text style={tw`font-bold text-slate-500`}>Cancel</Text>
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

    </SafeAreaView>
  );
}
