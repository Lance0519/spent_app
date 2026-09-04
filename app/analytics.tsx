import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, PieChart, Tag, TrendingUp, TrendingDown } from 'lucide-react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getDB, getCategories, Category } from '../db/database';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';

export default function AnalyticsScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseData, setExpenseData] = useState<{ category: string; amount: number; percentage: number }[]>([]);
  const [incomeData, setIncomeData] = useState<{ category: string; amount: number; percentage: number }[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [])
  );

  const fetchAnalytics = () => {
    try {
      const db = getDB();
      const cats = getCategories();
      setCategories(cats);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // In real sqlite we could query `strftime`, but since we use mock fallback for web, we do it in JS
      const allTxs = db.getAllSync('SELECT * FROM transactions');
      
      let expenses = 0;
      let incomes = 0;
      const expenseMap: Record<string, number> = {};
      const incomeMap: Record<string, number> = {};

      allTxs.forEach((tx: any) => {
        const d = new Date(tx.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          const amt = Math.abs(tx.amount);
          if (tx.type === 'expense') {
            expenses += amt;
            expenseMap[tx.category] = (expenseMap[tx.category] || 0) + amt;
          } else {
            incomes += amt;
            incomeMap[tx.category] = (incomeMap[tx.category] || 0) + amt;
          }
        }
      });

      setTotalExpense(expenses);
      setTotalIncome(incomes);

      const formatData = (map: Record<string, number>, total: number) => {
        return Object.keys(map)
          .map(cat => ({
            category: cat,
            amount: map[cat],
            percentage: total > 0 ? (map[cat] / total) * 100 : 0
          }))
          .sort((a, b) => b.amount - a.amount);
      };

      setExpenseData(formatData(expenseMap, expenses));
      setIncomeData(formatData(incomeMap, incomes));
      
    } catch (e) {
      console.log(e);
    }
  };

  const renderData = activeTab === 'expense' ? expenseData : incomeData;
  const currentTotal = activeTab === 'expense' ? totalExpense : totalIncome;

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      {/* Header */}
      <View style={tw`flex-row items-center justify-between px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <TouchableOpacity onPress={() => router.back()} style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center`}>
          <ArrowLeft color="#64748b" size={20} />
        </TouchableOpacity>
        <Text style={tw`text-xl font-bold text-slate-800 dark:text-white`}>Analytics</Text>
        <View style={tw`w-10 h-10`} />
      </View>

      <ScrollView style={tw`flex-1 px-6 pt-6`}>
        {/* Toggle */}
        <View style={tw`flex-row bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-2xl mb-8`}>
          <TouchableOpacity 
            onPress={() => setActiveTab('expense')}
            style={tw`flex-1 py-3 items-center rounded-xl flex-row justify-center ${activeTab === 'expense' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
          >
            <TrendingDown size={18} color={activeTab === 'expense' ? '#f43f5e' : '#94a3b8'} style={tw`mr-2`} />
            <Text style={tw`font-bold ${activeTab === 'expense' ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('income')}
            style={tw`flex-1 py-3 items-center rounded-xl flex-row justify-center ${activeTab === 'income' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}
          >
            <TrendingUp size={18} color={activeTab === 'income' ? '#10b981' : '#94a3b8'} style={tw`mr-2`} />
            <Text style={tw`font-bold ${activeTab === 'income' ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Income</Text>
          </TouchableOpacity>
        </View>

        {/* Total Summary */}
        <View style={tw`items-center mb-10`}>
          <Text style={tw`text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2`}>
            Total {activeTab === 'expense' ? 'Spent' : 'Earned'} This Month
          </Text>
          <Text style={tw`text-5xl font-black ${activeTab === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
            ₱{currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </Text>
        </View>

        <Text style={tw`text-lg font-bold text-slate-800 dark:text-white mb-4`}>Category Breakdown</Text>
        
        {renderData.length === 0 ? (
          <View style={tw`items-center justify-center py-10 bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl border border-slate-100 dark:border-slate-800`}>
            <PieChart size={48} color="#e2e8f0" style={tw`dark:opacity-20`} />
            <Text style={tw`text-slate-400 dark:text-slate-500 font-bold mt-4`}>No data for this month</Text>
          </View>
        ) : (
          <View>
            <View style={tw`items-center justify-center mb-10 mt-2`}>
              <GiftedPieChart
                data={renderData.map((item) => {
                  const catObj = categories.find(c => c.name === item.category);
                  const color = catObj ? catObj.color : (activeTab === 'expense' ? '#f43f5e' : '#10b981');
                  return {
                    value: item.amount,
                    color: color,
                    text: `${item.percentage.toFixed(0)}%`,
                    textColor: 'white',
                    fontWeight: 'bold',
                  };
                })}
                donut
                showText
                radius={120}
                innerRadius={75}
                innerCircleColor={colorScheme === 'dark' ? '#141218' : '#FEF7FF'}
                centerLabelComponent={() => {
                  return (
                    <View style={tw`items-center justify-center`}>
                      <Text style={tw`text-2xl font-black ${activeTab === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        ₱{currentTotal.toLocaleString(undefined, {minimumFractionDigits: 0})}
                      </Text>
                      <Text style={tw`text-xs font-bold text-slate-400 uppercase mt-1`}>Total</Text>
                    </View>
                  );
                }}
              />
            </View>

            <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-4 shadow-sm shadow-slate-200 dark:shadow-none border border-slate-50 dark:border-slate-800 mb-8`}>
              {renderData.map((item, index) => {
              const catObj = categories.find(c => c.name === item.category);
              const color = catObj ? catObj.color : (activeTab === 'expense' ? '#f43f5e' : '#10b981');
              
              return (
                <View key={item.category} style={tw`mb-5 ${index === renderData.length - 1 ? 'mb-1' : ''}`}>
                  <View style={tw`flex-row justify-between items-center mb-2`}>
                    <View style={tw`flex-row items-center`}>
                      <View style={[tw`w-3 h-3 rounded-full mr-2`, { backgroundColor: color }]} />
                      <Text style={tw`text-base font-bold text-slate-700 dark:text-slate-100`}>{item.category}</Text>
                    </View>
                    <View style={tw`items-end`}>
                      <Text style={tw`text-base font-black text-slate-800 dark:text-white`}>₱{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
                      <Text style={tw`text-xs font-bold text-slate-400`}>{item.percentage.toFixed(1)}%</Text>
                    </View>
                  </View>
                  
                  <View style={tw`h-3 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full overflow-hidden`}>
                    <View style={[tw`h-full rounded-full`, { backgroundColor: color, width: `${item.percentage}%` }]} />
                  </View>
                </View>
              );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
