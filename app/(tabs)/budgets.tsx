import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView as RNScrollView, TextInput, Alert, Modal } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { 
  Target, Trophy, Plus, Tag, Edit2, Trash2, Check, AlertCircle, 
  Wallet, Landmark, Smartphone, CreditCard, X 
} from 'lucide-react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { FinanceService, Category, Budget, Goal, Account } from '../../services/FinanceService';
import { IconMap } from '../../utils/Icons';
import { useTheme } from '../../context/ThemeContext';

export default function BudgetsScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent, currencySymbol, formatCurrency } = useTheme();
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [spentTotals, setSpentTotals] = useState<Record<string, number>>({});
  
  // Bottom Sheet Refs
  const budgetSheetRef = useRef<BottomSheet>(null);
  const goalSheetRef = useRef<BottomSheet>(null);
  
  // Budget Form State
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  
  // Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  // Deposit Modal State
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [depositAccountId, setDepositAccountId] = useState<number>(1);
  const [depositAmount, setDepositAmount] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    try {
      const cats = FinanceService.getCategories().filter(c => c.type === 'expense');
      setCategories(cats);
      setBudgets(FinanceService.getBudgets());
      setGoals(FinanceService.getGoals());
      
      const accs = FinanceService.getAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !depositAccountId) {
        setDepositAccountId(accs[0].id);
      }
      
      // Fetch only expenses for the current month in SQL
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      const txs = FinanceService.getTransactions({ type: 'expense' });
      
      const totals: Record<string, number> = {};
      txs.forEach((tx: any) => {
        if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
          totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount);
        }
      });
      setSpentTotals(totals);
    } catch (e) {
      console.warn('Budgets fetchData failed:', e);
    }
  };

  const openAddBudget = () => {
    setEditingBudgetId(null);
    const firstCat = categories.length > 0 ? categories[0].name : '';
    setBudgetCat(firstCat);
    setBudgetAmount('');
    budgetSheetRef.current?.expand();
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudgetId(budget.id);
    setBudgetCat(budget.category);
    setBudgetAmount(budget.amount.toString());
    budgetSheetRef.current?.expand();
  };

  const handleSaveBudget = () => {
    const num = parseFloat(budgetAmount.replace(/[^0-9.-]+/g, ''));
    if (!budgetCat) return Alert.alert('Error', 'Please select a category');
    if (isNaN(num) || num <= 0) return Alert.alert('Error', 'Please enter a valid monthly limit');

    if (editingBudgetId) {
      FinanceService.updateBudget(editingBudgetId, budgetCat, num, 'monthly');
    } else {
      FinanceService.saveBudget(budgetCat, num, 'monthly');
    }
    fetchData();
    budgetSheetRef.current?.close();
    setEditingBudgetId(null);
    setBudgetCat('');
    setBudgetAmount('');
  };

  const handleDeleteBudget = (id?: number) => {
    const targetId = id || editingBudgetId;
    if (!targetId) return;

    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this category budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            FinanceService.deleteBudget(targetId);
            fetchData();
            if (editingBudgetId) {
              budgetSheetRef.current?.close();
              setEditingBudgetId(null);
            }
          } 
        }
      ]
    );
  };

  const handleSaveGoal = () => {
    const num = parseFloat(goalTarget.replace(/[^0-9.-]+/g, ''));
    if (!goalTitle.trim()) return Alert.alert('Error', 'Enter a title for this goal');
    if (isNaN(num) || num <= 0) return Alert.alert('Error', 'Enter a valid target amount');
    FinanceService.addGoal(goalTitle.trim(), num, '#3b82f6', 'wallet');
    fetchData();
    goalSheetRef.current?.close();
    setGoalTitle('');
    setGoalTarget('');
  };

  const handleDeleteGoal = (id: number) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            FinanceService.deleteGoal(id);
            fetchData();
          } 
        }
      ]
    );
  };

  const openDepositModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setDepositAmount('');
    if (accounts.length > 0) {
      setDepositAccountId(accounts[0].id);
    }
    setDepositModalVisible(true);
  };

  const handleExecuteDeposit = () => {
    if (!selectedGoal) return;
    const num = parseFloat(depositAmount.replace(/[^0-9.-]+/g, ''));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }

    const sourceAcc = accounts.find(a => a.id === depositAccountId);
    if (!sourceAcc) {
      Alert.alert('Account Required', 'Please select a funding account.');
      return;
    }

    try {
      FinanceService.contributeToGoal(selectedGoal.id, depositAccountId, num);
      setDepositModalVisible(false);
      setDepositAmount('');
      fetchData();
      Alert.alert('Deposit Saved', `Successfully added ${formatCurrency(num)} towards "${selectedGoal.title}".`);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`} edges={['top']}>
      {/* Top Header */}
      <View style={tw`px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800 flex-row justify-between items-center`}>
        <Text style={[tw`text-2xl font-black`, { color: textPrimary }]}>Planning</Text>
        <TouchableOpacity 
          onPress={() => (activeTab === 'budgets' ? openAddBudget() : goalSheetRef.current?.expand())} 
          style={[tw`w-11 h-11 rounded-full items-center justify-center min-h-[48px] min-w-[48px]`, { backgroundColor: `${accentColor}15` }]}
          activeOpacity={0.7}
        >
          <Plus color={accentColor} size={24} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={tw`flex-row px-6 py-4 gap-3`}>
        <TouchableOpacity 
          onPress={() => setActiveTab('budgets')}
          style={[
            tw`flex-1 py-3 rounded-2xl items-center flex-row justify-center border-2 min-h-[48px]`,
            activeTab === 'budgets' 
              ? [{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }] 
              : tw`bg-[#F4EFF4] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`
          ]}
        >
          <Target size={18} color={activeTab === 'budgets' ? accentColor : textMuted} style={tw`mr-2`} />
          <Text style={[tw`font-bold text-sm`, { color: activeTab === 'budgets' ? accentColor : textSecondary }]}>Budgets</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setActiveTab('goals')}
          style={[
            tw`flex-1 py-3 rounded-2xl items-center flex-row justify-center border-2 min-h-[48px]`,
            activeTab === 'goals' 
              ? [{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }] 
              : tw`bg-[#F4EFF4] dark:bg-[#211F26] border-slate-100 dark:border-slate-800`
          ]}
        >
          <Trophy size={18} color={activeTab === 'goals' ? accentColor : textMuted} style={tw`mr-2`} />
          <Text style={[tw`font-bold text-sm`, { color: activeTab === 'goals' ? accentColor : textSecondary }]}>Savings Goals</Text>
        </TouchableOpacity>
      </View>

      <RNScrollView style={tw`flex-1 px-6`} showsVerticalScrollIndicator={false}>
        {activeTab === 'budgets' && (
          <View style={tw`pb-24`}>
            {budgets.length === 0 ? (
              <View style={tw`items-center justify-center mt-16`}>
                <Target size={60} color={textMuted} style={tw`opacity-30 mb-3`} />
                <Text style={[tw`text-lg font-bold mb-1`, { color: textMuted }]}>No budgets set</Text>
                <Text style={[tw`text-xs text-center max-w-xs mb-4`, { color: textSecondary }]}>
                  Keep your expenses on track by establishing monthly spending limits.
                </Text>
                <TouchableOpacity onPress={openAddBudget} style={[tw`px-6 py-3.5 rounded-full flex-row items-center shadow-md min-h-[48px]`, { backgroundColor: accentColor }]}>
                  <Plus color={textOnAccent} size={18} style={tw`mr-2`} />
                  <Text style={[tw`font-bold text-sm`, { color: textOnAccent }]}>Create Budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgets.map(budget => {
                const catObj = categories.find(c => c.name === budget.category);
                const IconComp = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
                const spent = spentTotals[budget.category] || 0;
                const progress = Math.min((spent / budget.amount) * 100, 100);
                const isOver = spent > budget.amount;
                const isWarning = progress > 85 && !isOver;
                const remaining = budget.amount - spent;
                
                return (
                  <View key={budget.id} style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-5 rounded-3xl shadow-sm mb-4 border border-slate-100 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                      <View style={tw`flex-row items-center flex-1 mr-2`}>
                        <View style={[tw`w-10 h-10 rounded-full items-center justify-center mr-3`, { backgroundColor: catObj ? `${catObj.color}20` : '#f1f5f9' }]}>
                          <IconComp size={18} color={catObj ? catObj.color : '#64748b'} />
                        </View>
                        <View>
                          <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>{budget.category}</Text>
                          <Text style={[tw`text-xs font-semibold uppercase tracking-wide`, { color: textMuted }]}>Monthly Limit</Text>
                        </View>
                      </View>
                      
                      <View style={tw`flex-row items-center gap-1`}>
                        <TouchableOpacity 
                          onPress={() => openEditBudget(budget)} 
                          style={tw`p-2.5 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full min-h-[40px] min-w-[40px] items-center justify-center`}
                        >
                          <Edit2 size={16} color={textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleDeleteBudget(budget.id)} 
                          style={tw`p-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-full min-h-[40px] min-w-[40px] items-center justify-center`}
                        >
                          <Trash2 size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={tw`flex-row justify-between items-end mb-2`}>
                      <View>
                        <Text style={[tw`text-xs font-semibold mb-0.5`, { color: textSecondary }]}>Spent</Text>
                        <Text style={[tw`text-2xl font-black`, isOver ? tw`text-rose-500` : { color: textPrimary }]}>
                          {formatCurrency(spent)}
                        </Text>
                      </View>
                      <View style={tw`items-end`}>
                        <Text style={[tw`text-xs font-semibold mb-0.5`, { color: textSecondary }]}>Limit</Text>
                        <Text style={[tw`text-sm font-bold`, { color: textSecondary }]}>
                          {formatCurrency(budget.amount)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full overflow-hidden mb-2`}>
                      <View 
                        style={[
                          tw`h-full rounded-full`, 
                          { 
                            width: `${progress}%`,
                            backgroundColor: isOver ? '#ef4444' : isWarning ? '#f59e0b' : (catObj?.color || accentColor)
                          }
                        ]} 
                      />
                    </View>

                    <View style={tw`flex-row justify-between items-center`}>
                      {isOver ? (
                        <View style={tw`flex-row items-center`}>
                          <AlertCircle size={13} color="#ef4444" style={tw`mr-1`} />
                          <Text style={tw`text-xs font-bold text-rose-500`}>
                            Exceeded limit by {formatCurrency(Math.abs(remaining))}
                          </Text>
                        </View>
                      ) : isWarning ? (
                        <View style={tw`flex-row items-center`}>
                          <AlertCircle size={13} color="#f59e0b" style={tw`mr-1`} />
                          <Text style={tw`text-xs font-bold text-amber-500`}>
                            {formatCurrency(remaining)} remaining (Near limit)
                          </Text>
                        </View>
                      ) : (
                        <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>
                          {formatCurrency(remaining)} remaining
                        </Text>
                      )}
                      <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>{progress.toFixed(0)}%</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'goals' && (
          <View style={tw`pb-24`}>
            {goals.length === 0 ? (
              <View style={tw`items-center justify-center mt-16`}>
                <Trophy size={60} color={textMuted} style={tw`opacity-30 mb-3`} />
                <Text style={[tw`text-lg font-bold mb-1`, { color: textMuted }]}>No goals set</Text>
                <Text style={[tw`text-xs text-center max-w-xs mb-4`, { color: textSecondary }]}>
                  Create target savings for emergencies, gadgets, or travel.
                </Text>
                <TouchableOpacity onPress={() => goalSheetRef.current?.expand()} style={[tw`px-6 py-3.5 rounded-full flex-row items-center shadow-md min-h-[48px]`, { backgroundColor: accentColor }]}>
                  <Plus color={textOnAccent} size={18} style={tw`mr-2`} />
                  <Text style={[tw`font-bold text-sm`, { color: textOnAccent }]}>Create Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map(goal => {
                const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                const remaining = Math.max(goal.target_amount - goal.current_amount, 0);

                return (
                  <View key={goal.id} style={tw`bg-[#F4EFF4] dark:bg-[#211F26] p-5 rounded-3xl shadow-sm mb-4 border border-slate-100 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                      <Text style={[tw`text-lg font-black`, { color: textPrimary }]}>{goal.title}</Text>
                      <View style={tw`flex-row items-center gap-2`}>
                        <View style={tw`bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1 rounded-full`}>
                          <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>{progress.toFixed(0)}%</Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => handleDeleteGoal(goal.id)} 
                          style={tw`p-2 bg-rose-50 dark:bg-rose-500/10 rounded-full min-h-[36px] min-w-[36px] items-center justify-center`}
                        >
                          <Trash2 size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={tw`flex-row justify-between items-end mb-2`}>
                      <Text style={[tw`text-2xl font-black`, { color: textPrimary }]}>{formatCurrency(goal.current_amount)}</Text>
                      <Text style={[tw`text-sm font-bold mb-1`, { color: textSecondary }]}>/ {formatCurrency(goal.target_amount)}</Text>
                    </View>

                    <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#2B2930] rounded-full overflow-hidden mb-3`}>
                      <View style={[tw`h-full rounded-full bg-emerald-500`, { width: `${progress}%` }]} />
                    </View>

                    {/* Deposit / Contribution Action Area */}
                    <View style={tw`flex-row items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/80`}>
                      <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                        {remaining > 0 ? `${formatCurrency(remaining)} remaining` : 'Goal completed! 🎉'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openDepositModal(goal)}
                        style={[tw`flex-row items-center px-4 py-2.5 rounded-xl min-h-[44px] shadow-sm`, { backgroundColor: accentColor }]}
                        activeOpacity={0.8}
                      >
                        <Plus size={15} color={textOnAccent} style={tw`mr-1`} />
                        <Text style={[tw`font-bold text-xs`, { color: textOnAccent }]}>Deposit Funds</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </RNScrollView>

      {/* Budget Bottom Sheet */}
      <BottomSheet 
        ref={budgetSheetRef} 
        index={-1} 
        snapPoints={['65%']} 
        enablePanDownToClose 
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        backdropComponent={props => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} 
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <Text style={[tw`text-xl font-black mb-5`, { color: textPrimary }]}>
            {editingBudgetId ? 'Edit Category Budget' : 'Set Category Budget'}
          </Text>
          
          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>Category</Text>
          <GestureScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} style={tw`mb-5 max-h-12`} contentContainerStyle={tw`flex-row gap-2 pr-6`}>
            {categories.map(cat => {
              const isSelected = budgetCat === cat.name;
              return (
                <TouchableOpacity 
                  key={cat.id} 
                  onPress={() => setBudgetCat(cat.name)} 
                  style={[
                    tw`flex-row items-center border px-4 py-2 rounded-full h-10 min-h-[40px]`, 
                    isSelected 
                      ? { backgroundColor: cat.color, borderColor: cat.color } 
                      : { backgroundColor: isDark ? '#211F26' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }
                  ]}
                >
                  {isSelected && <Check size={14} color="#fff" style={tw`mr-1.5`} />}
                  <Text style={[tw`font-bold text-xs`, { color: isSelected ? '#fff' : textSecondary }]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity 
              onPress={() => {
                budgetSheetRef.current?.close();
                router.push('/categories');
              }} 
              style={[tw`flex-row items-center border border-dashed px-3.5 py-2 rounded-full h-10 min-h-[40px]`, { borderColor: accentColor, backgroundColor: `${accentColor}12` }]}
            >
              <Plus size={14} color={accentColor} style={tw`mr-1.5`} />
              <Text style={[tw`font-bold text-xs`, { color: accentColor }]}>Add</Text>
            </TouchableOpacity>
          </GestureScrollView>

          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
            Monthly Limit ({currencySymbol})
          </Text>
          <TextInput
            style={[tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-100 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-xl font-black mb-6 min-h-[48px]`, { color: textPrimary }]}
            placeholder="0.00"
            placeholderTextColor={textMuted}
            keyboardType="numeric"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
          />
          
          <View style={tw`mt-auto gap-3`}>
            {editingBudgetId && (
              <TouchableOpacity 
                onPress={() => handleDeleteBudget(editingBudgetId)} 
                style={tw`w-full bg-rose-50 dark:bg-rose-500/10 py-4 rounded-2xl items-center border border-rose-200 dark:border-rose-500/20 min-h-[48px] justify-center`}
              >
                <Text style={tw`text-rose-500 font-bold text-base`}>Delete Budget</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSaveBudget} style={[tw`w-full py-4 rounded-2xl items-center shadow-md min-h-[48px] justify-center`, { backgroundColor: accentColor }]}>
              <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>
                {editingBudgetId ? 'Update Budget' : 'Save Budget'}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Goal Bottom Sheet */}
      <BottomSheet 
        ref={goalSheetRef} 
        index={-1} 
        snapPoints={['60%']} 
        enablePanDownToClose 
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        backdropComponent={props => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} 
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <Text style={[tw`text-xl font-black mb-5`, { color: textPrimary }]}>Create New Goal</Text>
          
          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>Goal Name</Text>
          <TextInput
            style={[tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-100 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-base font-semibold mb-5 min-h-[48px]`, { color: textPrimary }]}
            placeholder="e.g. New Laptop, Emergency Fund"
            placeholderTextColor={textMuted}
            value={goalTitle}
            onChangeText={setGoalTitle}
          />

          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
            Target Amount ({currencySymbol})
          </Text>
          <TextInput
            style={[tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-100 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-xl font-black mb-6 min-h-[48px]`, { color: textPrimary }]}
            placeholder="0.00"
            placeholderTextColor={textMuted}
            keyboardType="numeric"
            value={goalTarget}
            onChangeText={setGoalTarget}
          />
          
          <TouchableOpacity onPress={handleSaveGoal} style={[tw`w-full py-4 rounded-2xl items-center mt-auto shadow-md min-h-[48px] justify-center`, { backgroundColor: accentColor }]}>
            <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Start Saving</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Goal Deposit Modal */}
      <Modal visible={depositModalVisible} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 items-center justify-center p-6`}>
          <View style={tw`w-full bg-[#FEF7FF] dark:bg-[#211F26] rounded-3xl p-6 border border-slate-100 dark:border-slate-800`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <View>
                <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Deposit Savings</Text>
                <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>
                  Adding funds to &quot;{selectedGoal?.title}&quot;
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)} style={tw`p-1 min-h-[32px] justify-center`}>
                <X size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
              Deposit Amount ({currencySymbol})
            </Text>
            <TextInput
              style={[tw`bg-[#F3EDF7] dark:bg-[#2B2930] border border-slate-200/50 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-2xl font-black mb-4 min-h-[48px]`, { color: textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={textMuted}
              keyboardType="numeric"
              value={depositAmount}
              onChangeText={setDepositAmount}
              autoFocus
            />

            {/* Quick Amount Chips */}
            <View style={tw`flex-row gap-2 mb-4`}>
              {[100, 500, 1000, 5000].map(amt => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setDepositAmount(amt.toString())}
                  style={tw`flex-1 py-2 rounded-xl bg-[#F3EDF7] dark:bg-[#2B2930] items-center border border-slate-200/40 dark:border-slate-800 min-h-[36px] justify-center`}
                >
                  <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>+{currencySymbol}{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
              Source Account
            </Text>
            <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pr-2 mb-6`}>
              {accounts.map(acc => {
                const isSelected = depositAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => setDepositAccountId(acc.id)}
                    style={[
                      tw`flex-row items-center border px-3.5 py-2 rounded-xl min-h-[44px]`,
                      isSelected
                        ? [{ backgroundColor: accentColor, borderColor: accentColor }]
                        : tw`bg-[#F3EDF7] dark:bg-[#2B2930] border-slate-200 dark:border-slate-800`,
                    ]}
                  >
                    {acc.type === 'cash' ? <Wallet size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'ewallet' ? <Smartphone size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     acc.type === 'credit' ? <CreditCard size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} /> :
                     <Landmark size={14} color={isSelected ? textOnAccent : '#64748b'} style={tw`mr-1.5`} />}
                    <View>
                      <Text style={[tw`font-bold text-xs`, { color: isSelected ? textOnAccent : textPrimary }]}>
                        {acc.name}
                      </Text>
                      <Text style={[tw`text-[10px]`, { color: isSelected ? textOnAccent : textMuted }]}>
                        Bal: {formatCurrency(acc.balance)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </GestureScrollView>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setDepositModalVisible(false)}
                style={tw`flex-1 py-3.5 rounded-2xl items-center bg-[#F3EDF7] dark:bg-[#2B2930] min-h-[48px] justify-center`}
              >
                <Text style={[tw`font-bold text-sm`, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExecuteDeposit}
                style={[tw`flex-2 py-3.5 rounded-2xl items-center shadow-md min-h-[48px] justify-center`, { backgroundColor: accentColor }]}
              >
                <Text style={[tw`font-bold text-sm`, { color: textOnAccent }]}>Confirm Deposit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
