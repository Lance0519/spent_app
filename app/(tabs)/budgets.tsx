import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView as RNScrollView, TextInput, Alert, Platform } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { Target, Trophy, Plus, Tag, Edit2, Trash2, Check, AlertCircle, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { 
  getDB, 
  getCategories, 
  Category, 
  Budget, 
  Goal, 
  getBudgets, 
  getGoals, 
  saveBudget, 
  updateBudget, 
  deleteBudget, 
  addGoal, 
  deleteGoal 
} from '../../db/database';

import { IconMap } from '../../utils/Icons';

export default function BudgetsScreen() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [spentTotals, setSpentTotals] = useState<Record<string, number>>({});
  
  // Bottom Sheet Refs
  const budgetSheetRef = React.useRef<BottomSheet>(null);
  const goalSheetRef = React.useRef<BottomSheet>(null);
  
  // Budget Form State (CRUD)
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  
  // Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    try {
      const cats = getCategories().filter(c => c.type === 'expense');
      setCategories(cats);
      setBudgets(getBudgets());
      setGoals(getGoals());
      
      const db = getDB();
      const now = new Date();
      // Fetch all expenses this month
      const txs = db.getAllSync('SELECT category, amount, date FROM transactions WHERE type = "expense"');
      
      const totals: Record<string, number> = {};
      txs.forEach((tx: any) => {
        const d = new Date(tx.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount);
        }
      });
      setSpentTotals(totals);
    } catch (e) {
      console.log(e);
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
    if (!budgetCat) return Alert.alert("Error", "Please select a category");
    if (isNaN(num) || num <= 0) return Alert.alert("Error", "Please enter a valid monthly limit");

    if (editingBudgetId) {
      updateBudget(editingBudgetId, budgetCat, num, 'monthly');
    } else {
      saveBudget(budgetCat, num, 'monthly');
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
      "Delete Budget",
      "Are you sure you want to delete this category budget?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            deleteBudget(targetId);
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
    if (!goalTitle.trim()) return Alert.alert("Error", "Enter a title for this goal");
    if (isNaN(num) || num <= 0) return Alert.alert("Error", "Enter a valid target amount");
    addGoal(goalTitle.trim(), num, '#3b82f6', 'wallet');
    fetchData();
    goalSheetRef.current?.close();
    setGoalTitle('');
    setGoalTarget('');
  };

  const handleDeleteGoal = (id: number) => {
    Alert.alert(
      "Delete Goal",
      "Are you sure you want to delete this goal?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            deleteGoal(id);
            fetchData();
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <View style={tw`px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800 flex-row justify-between items-center`}>
        <Text style={tw`text-2xl font-bold text-slate-800 dark:text-white`}>Planning</Text>
        <TouchableOpacity 
          onPress={() => activeTab === 'budgets' ? openAddBudget() : goalSheetRef.current?.expand()} 
          style={tw`w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full items-center justify-center`}
        >
          <Plus color="#3b82f6" size={24} />
        </TouchableOpacity>
      </View>

      <View style={tw`flex-row px-6 py-4 gap-4`}>
        <TouchableOpacity 
          onPress={() => setActiveTab('budgets')}
          style={tw`flex-1 py-3 rounded-2xl items-center flex-row justify-center border-2 ${activeTab === 'budgets' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' : 'bg-[#F4EFF4] dark:bg-[#49454F] border-slate-100 dark:border-slate-800'}`}
        >
          <Target size={20} color={activeTab === 'budgets' ? '#3b82f6' : '#94a3b8'} style={tw`mr-2`} />
          <Text style={tw`font-bold ${activeTab === 'budgets' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>Budgets</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setActiveTab('goals')}
          style={tw`flex-1 py-3 rounded-2xl items-center flex-row justify-center border-2 ${activeTab === 'goals' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' : 'bg-[#F4EFF4] dark:bg-[#49454F] border-slate-100 dark:border-slate-800'}`}
        >
          <Trophy size={20} color={activeTab === 'goals' ? '#3b82f6' : '#94a3b8'} style={tw`mr-2`} />
          <Text style={tw`font-bold ${activeTab === 'goals' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>Goals</Text>
        </TouchableOpacity>
      </View>

      <RNScrollView style={tw`flex-1 px-6`} showsVerticalScrollIndicator={false}>
        {activeTab === 'budgets' && (
          <View style={tw`pb-24`}>
            {budgets.length === 0 ? (
              <View style={tw`items-center justify-center mt-20`}>
                <Target size={64} color="#e2e8f0" style={tw`dark:opacity-20`} />
                <Text style={tw`text-lg font-bold text-slate-400 dark:text-slate-500 mt-4`}>No budgets set</Text>
                <TouchableOpacity onPress={openAddBudget} style={tw`mt-4 bg-blue-600 px-6 py-3 rounded-full flex-row items-center`}>
                  <Plus color="#fff" size={18} style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold`}>Create Budget</Text>
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
                  <View key={budget.id} style={tw`bg-[#F4EFF4] dark:bg-[#49454F] p-5 rounded-3xl shadow-sm shadow-slate-200 dark:shadow-none mb-4 border border-slate-50 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                      <View style={tw`flex-row items-center flex-1 mr-2`}>
                        <View style={[tw`w-10 h-10 rounded-full items-center justify-center mr-3`, { backgroundColor: catObj ? `${catObj.color}20` : '#f1f5f9' }]}>
                          <IconComp size={18} color={catObj ? catObj.color : '#64748b'} />
                        </View>
                        <View>
                          <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{budget.category}</Text>
                          <Text style={tw`text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide`}>Monthly Limit</Text>
                        </View>
                      </View>
                      
                      <View style={tw`flex-row items-center gap-1`}>
                        <TouchableOpacity 
                          onPress={() => openEditBudget(budget)} 
                          style={tw`p-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}
                        >
                          <Edit2 size={16} color="#94a3b8" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleDeleteBudget(budget.id)} 
                          style={tw`p-2 bg-rose-50 dark:bg-rose-500/10 rounded-full`}
                        >
                          <Trash2 size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={tw`flex-row justify-between items-end mb-2`}>
                      <View>
                        <Text style={tw`text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5`}>Spent</Text>
                        <Text style={tw`text-2xl font-black ${isOver ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                          ₱{spent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </Text>
                      </View>
                      <View style={tw`items-end`}>
                        <Text style={tw`text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5`}>Limit</Text>
                        <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-300`}>
                          ₱{budget.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full overflow-hidden mb-2`}>
                      <View 
                        style={[
                          tw`h-full rounded-full`, 
                          { 
                            width: `${progress}%`,
                            backgroundColor: isOver ? '#ef4444' : isWarning ? '#f59e0b' : (catObj?.color || '#3b82f6')
                          }
                        ]} 
                      />
                    </View>

                    <View style={tw`flex-row justify-between items-center`}>
                      {isOver ? (
                        <Text style={tw`text-xs font-bold text-rose-500 flex-row items-center`}>
                          ⚠️ Exceeded limit by ₱{Math.abs(remaining).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </Text>
                      ) : isWarning ? (
                        <Text style={tw`text-xs font-bold text-amber-500`}>
                          ⚡ ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} remaining (Near limit)
                        </Text>
                      ) : (
                        <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>
                          ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} remaining
                        </Text>
                      )}
                      <Text style={tw`text-xs font-semibold text-slate-400`}>{progress.toFixed(0)}%</Text>
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
              <View style={tw`items-center justify-center mt-20`}>
                <Trophy size={64} color="#e2e8f0" style={tw`dark:opacity-20`} />
                <Text style={tw`text-lg font-bold text-slate-400 dark:text-slate-500 mt-4`}>No goals set</Text>
                <TouchableOpacity onPress={() => goalSheetRef.current?.expand()} style={tw`mt-4 bg-blue-600 px-6 py-3 rounded-full flex-row items-center`}>
                  <Plus color="#fff" size={18} style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold`}>Create Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map(goal => {
                const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                return (
                  <View key={goal.id} style={tw`bg-[#F4EFF4] dark:bg-[#49454F] p-5 rounded-3xl shadow-sm shadow-slate-200 dark:shadow-none mb-4 border border-slate-50 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-4`}>
                      <Text style={tw`text-lg font-bold text-slate-800 dark:text-slate-100`}>{goal.title}</Text>
                      <View style={tw`flex-row items-center gap-2`}>
                        <View style={tw`bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 rounded-full`}>
                          <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>{progress.toFixed(0)}%</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)} style={tw`p-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-full`}>
                          <Trash2 size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={tw`flex-row justify-between items-end mb-2`}>
                      <Text style={tw`text-2xl font-black text-slate-800 dark:text-white`}>₱{goal.current_amount.toLocaleString()}</Text>
                      <Text style={tw`text-sm font-bold text-slate-400 dark:text-slate-500 mb-1`}>/ ₱{goal.target_amount.toLocaleString()}</Text>
                    </View>
                    <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full overflow-hidden`}>
                      <View style={[tw`h-full rounded-full bg-emerald-500`, { width: `${progress}%` }]} />
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
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} 
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <Text style={tw`text-xl font-bold text-slate-800 dark:text-white mb-6`}>
            {editingBudgetId ? 'Edit Category Budget' : 'Set Category Budget'}
          </Text>
          
          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Category</Text>
          <GestureScrollView 
            horizontal 
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false} 
            style={tw`mb-6 max-h-12`} 
            contentContainerStyle={tw`flex-row gap-2 pr-6`}
          >
            {categories.map((cat) => {
              const isSelected = budgetCat === cat.name;
              return (
                <TouchableOpacity 
                  key={cat.id} 
                  onPress={() => setBudgetCat(cat.name)} 
                  style={[
                    tw`flex-row items-center border px-4 py-2 rounded-full h-10`, 
                    isSelected 
                      ? { backgroundColor: cat.color, borderColor: cat.color } 
                      : { backgroundColor: isDark ? '#211F26' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }
                  ]}
                >
                  {isSelected && <Check size={14} color="#fff" style={tw`mr-1.5`} />}
                  <Text style={[tw`font-bold`, { color: isSelected ? '#fff' : (isDark ? '#cbd5e1' : '#64748b') }]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </GestureScrollView>

          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Monthly Limit (₱)</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-xl font-black text-slate-800 dark:text-white mb-6`}
            placeholder="0.00"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
          />
          
          <View style={tw`mt-auto gap-3`}>
            {editingBudgetId && (
              <TouchableOpacity 
                onPress={() => handleDeleteBudget(editingBudgetId)} 
                style={tw`w-full bg-rose-50 dark:bg-rose-500/10 py-4 rounded-2xl items-center border border-rose-200 dark:border-rose-500/20`}
              >
                <Text style={tw`text-rose-500 font-bold text-base`}>Delete Budget</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSaveBudget} style={tw`w-full bg-blue-600 py-4 rounded-2xl items-center`}>
              <Text style={tw`text-white font-bold text-lg`}>
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
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} 
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <Text style={tw`text-xl font-bold text-slate-800 dark:text-white mb-6`}>Create New Goal</Text>
          
          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Goal Name</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-base font-semibold text-slate-800 dark:text-white mb-6`}
            placeholder="e.g. New Laptop, Emergency Fund"
            placeholderTextColor="#64748b"
            value={goalTitle}
            onChangeText={setGoalTitle}
          />

          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Target Amount (₱)</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-xl font-black text-slate-800 dark:text-white mb-6`}
            placeholder="0.00"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={goalTarget}
            onChangeText={setGoalTarget}
          />
          
          <TouchableOpacity onPress={handleSaveGoal} style={tw`w-full bg-blue-600 py-4 rounded-2xl items-center mt-auto`}>
            <Text style={tw`text-white font-bold text-lg`}>Start Saving</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

    </SafeAreaView>
  );
}
