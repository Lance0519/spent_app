import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { Target, Trophy, Plus, Wallet, Coffee, Train, ShoppingCart, Tag, Edit2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { getDB, getCategories, Category, Budget, Goal, getBudgets, getGoals, saveBudget, addGoal } from '../../db/database';

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
  
  // Budget Form
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('0');
  
  // Goal Form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('0');

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
      // Simplified: fetch all expenses this month
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

  const handleSaveBudget = () => {
    if (!budgetCat) return Alert.alert("Error", "Select a category");
    saveBudget(budgetCat, parseFloat(budgetAmount));
    fetchData();
    budgetSheetRef.current?.close();
    setBudgetCat('');
    setBudgetAmount('0');
  };

  const handleSaveGoal = () => {
    if (!goalTitle) return Alert.alert("Error", "Enter a title");
    addGoal(goalTitle, parseFloat(goalTarget), '#3b82f6', 'wallet');
    fetchData();
    goalSheetRef.current?.close();
    setGoalTitle('');
    setGoalTarget('0');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <View style={tw`px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800 flex-row justify-between items-center`}>
        <Text style={tw`text-2xl font-bold text-slate-800 dark:text-white`}>Planning</Text>
        <TouchableOpacity 
          onPress={() => activeTab === 'budgets' ? budgetSheetRef.current?.expand() : goalSheetRef.current?.expand()} 
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

      <ScrollView style={tw`flex-1 px-6`}>
        {activeTab === 'budgets' && (
          <View style={tw`pb-24`}>
            {budgets.length === 0 ? (
              <View style={tw`items-center justify-center mt-20`}>
                <Target size={64} color="#e2e8f0" style={tw`dark:opacity-20`} />
                <Text style={tw`text-lg font-bold text-slate-400 dark:text-slate-500 mt-4`}>No budgets set</Text>
              </View>
            ) : (
              budgets.map(budget => {
                const catObj = categories.find(c => c.name === budget.category);
                const IconComp = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
                const spent = spentTotals[budget.category] || 0;
                const progress = Math.min((spent / budget.amount) * 100, 100);
                const isWarning = progress > 85;
                
                return (
                  <View key={budget.id} style={tw`bg-[#F4EFF4] dark:bg-[#49454F] p-5 rounded-3xl shadow-sm shadow-slate-200 dark:shadow-none mb-4 border border-slate-50 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-4`}>
                      <View style={tw`flex-row items-center`}>
                        <View style={[tw`w-10 h-10 rounded-full items-center justify-center mr-3`, { backgroundColor: catObj ? `${catObj.color}20` : '#f1f5f9' }]}>
                          <IconComp size={18} color={catObj ? catObj.color : '#64748b'} />
                        </View>
                        <View>
                          <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{budget.category}</Text>
                          <Text style={tw`text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide`}>Monthly</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => { setBudgetCat(budget.category); setBudgetAmount(budget.amount.toString()); budgetSheetRef.current?.expand(); }}>
                        <Edit2 size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={tw`flex-row justify-between items-end mb-2`}>
                      <Text style={tw`text-3xl font-black ${isWarning ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                        ₱{spent.toLocaleString()}
                      </Text>
                      <Text style={tw`text-sm font-bold text-slate-400 dark:text-slate-500 mb-1`}>of ₱{budget.amount.toLocaleString()}</Text>
                    </View>
                    
                    <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full overflow-hidden`}>
                      <View style={[tw`h-full rounded-full ${isWarning ? 'bg-rose-500' : (catObj?.color ? `bg-[${catObj.color}]` : 'bg-blue-500')}`, { width: `${progress}%` }]} />
                    </View>
                    {isWarning && <Text style={tw`text-xs font-bold text-rose-500 mt-2`}>Approaching limit!</Text>}
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
              </View>
            ) : (
              goals.map(goal => {
                const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                return (
                  <View key={goal.id} style={tw`bg-[#F4EFF4] dark:bg-[#49454F] p-5 rounded-3xl shadow-sm shadow-slate-200 dark:shadow-none mb-4 border border-slate-50 dark:border-slate-800`}>
                    <View style={tw`flex-row justify-between items-center mb-4`}>
                      <Text style={tw`text-lg font-bold text-slate-800 dark:text-slate-100`}>{goal.title}</Text>
                      <View style={tw`bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 rounded-full`}>
                        <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>{progress.toFixed(0)}%</Text>
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
      </ScrollView>

      {/* Budget Bottom Sheet */}
      <BottomSheet ref={budgetSheetRef} index={-1} snapPoints={['60%']} enablePanDownToClose backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}>
        <BottomSheetView style={tw`flex-1 px-6 pt-2 pb-8`}>
          <Text style={tw`text-xl font-bold text-slate-800 dark:text-white mb-6`}>Set Category Budget</Text>
          
          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-6 max-h-12`} contentContainerStyle={tw`gap-2`}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                onPress={() => setBudgetCat(cat.name)} 
                style={[tw`flex-row items-center border px-4 py-2 rounded-full h-10`, budgetCat === cat.name ? { backgroundColor: cat.color, borderColor: cat.color } : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}
              >
                <Text style={[tw`font-bold`, { color: budgetCat === cat.name ? '#fff' : '#64748b' }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Monthly Limit (₱)</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-xl font-black text-slate-800 dark:text-white mb-6`}
            placeholder="0.00"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
          />
          
          <TouchableOpacity onPress={handleSaveBudget} style={tw`w-full bg-blue-600 py-4 rounded-2xl items-center mt-auto`}>
            <Text style={tw`text-white font-bold text-lg`}>Save Budget</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Goal Bottom Sheet */}
      <BottomSheet ref={goalSheetRef} index={-1} snapPoints={['60%']} enablePanDownToClose backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}>
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
