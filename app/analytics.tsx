import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  PieChart as PieIcon, 
  BarChart3, 
  Tag, 
  Calendar, 
  ArrowDownRight,
  Sparkles
} from 'lucide-react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getDB, getCategories, Category, getUserProfile } from '../db/database';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../context/ThemeContext';
import { IconMap } from '../utils/Icons';

type Transaction = {
  id: number;
  title: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  account_id: number;
  due_date?: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'AU$',
  SGD: 'SG$',
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, palette, textPrimary, textSecondary, textMuted, textOnAccent } = useTheme();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState<string>('₱');

  // Reload data on focus
  useFocusEffect(
    useCallback(() => {
      try {
        const db = getDB();
        const cats = getCategories();
        setCategories(cats);

        const profile = getUserProfile();
        setCurrencySymbol(CURRENCY_SYMBOLS[profile.currency] || '₱');

        const txs = db.getAllSync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
        setAllTransactions(txs || []);
      } catch (e) {
        console.warn('Failed to load analytics data:', e);
      }
    }, [])
  );

  // Month Switcher Controls
  const handlePrevMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formattedMonth = useMemo(() => {
    return selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedDate]);

  // Filter transactions for the active selected month
  const currentMonthTransactions = useMemo(() => {
    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();

    return allTransactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }, [allTransactions, selectedDate]);

  // Top Summary Totals (Income, Expenses, Net Savings)
  const summaryTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    currentMonthTransactions.forEach(tx => {
      const amt = Math.abs(tx.amount);
      if (tx.type === 'income' || (tx.type === 'loan' && tx.amount > 0)) {
        income += amt;
      } else if (tx.type === 'expense' || (tx.type === 'loan' && tx.amount < 0)) {
        expense += amt;
      }
    });

    const netSavings = income - expense;
    return { income, expense, netSavings };
  }, [currentMonthTransactions]);

  // Category Expense Breakdown for Donut Chart & Legend
  const expenseBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let totalSpent = 0;

    currentMonthTransactions.forEach(tx => {
      if (tx.type === 'expense' || (tx.type === 'loan' && tx.amount < 0)) {
        const amt = Math.abs(tx.amount);
        totalSpent += amt;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt;
      }
    });

    const list = Object.keys(categoryTotals).map(catName => {
      const amt = categoryTotals[catName];
      const percentage = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
      const catObj = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      const color = catObj ? catObj.color : '#f43f5e';
      const icon = catObj ? catObj.icon : 'tag';

      return {
        category: catName,
        amount: amt,
        percentage,
        color,
        icon,
      };
    }).sort((a, b) => b.amount - a.amount);

    const pieData = list.map(item => ({
      value: item.amount,
      color: item.color,
      text: item.percentage >= 8 ? `${item.percentage.toFixed(0)}%` : '',
      textColor: '#ffffff',
      fontWeight: 'bold',
      textSize: 11,
    }));

    return { list, pieData, totalSpent };
  }, [currentMonthTransactions, categories]);

  // 6-Month Income vs. Expense Comparison Bar Chart
  const sixMonthComparison = useMemo(() => {
    const barData: any[] = [];
    let highestValue = 500;

    // Generate last 6 months ending at selectedDate
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      let monthIncome = 0;
      let monthExpense = 0;

      allTransactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === m && txDate.getFullYear() === y) {
          const amt = Math.abs(tx.amount);
          if (tx.type === 'income' || (tx.type === 'loan' && tx.amount > 0)) {
            monthIncome += amt;
          } else if (tx.type === 'expense' || (tx.type === 'loan' && tx.amount < 0)) {
            monthExpense += amt;
          }
        }
      });

      if (monthIncome > highestValue) highestValue = monthIncome;
      if (monthExpense > highestValue) highestValue = monthExpense;

      // Paired bars: Income (Emerald) & Expense (Rose)
      barData.push({
        value: monthIncome,
        label: monthLabel,
        spacing: 2,
        labelWidth: 26,
        frontColor: '#10b981',
        labelTextStyle: { 
          color: isDark ? '#94a3b8' : '#64748b', 
          fontSize: 10, 
          fontWeight: '600',
          width: 26,
          textAlign: 'center'
        },
      });

      barData.push({
        value: monthExpense,
        spacing: i === 0 ? 6 : 14,
        frontColor: '#f43f5e',
      });
    }

    const roundedMax = Math.ceil((highestValue * 1.25) / 1000) * 1000;

    return {
      barData,
      maxVal: Math.max(roundedMax, 1000),
    };
  }, [allTransactions, selectedDate, isDark]);

  // Top 3 Biggest Spends This Month
  const topSpends = useMemo(() => {
    return currentMonthTransactions
      .filter(tx => tx.type === 'expense' || (tx.type === 'loan' && tx.amount < 0))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 3);
  }, [currentMonthTransactions]);

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      
      {/* Header */}
      <View style={tw`flex-row items-center justify-between px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center`}
        >
          <ArrowLeft color={textSecondary} size={20} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Visual Analytics</Text>
        <View style={tw`w-10 h-10`} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={tw`flex-1 px-5 pt-4`} contentContainerStyle={tw`pb-12`}>
        
        {/* Month Selector Bar */}
        <View style={tw`flex-row items-center justify-between bg-[#F4EFF4] dark:bg-[#49454F] p-2 rounded-2xl mb-5 border border-slate-100 dark:border-slate-800`}>
          <TouchableOpacity 
            onPress={handlePrevMonth}
            style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl items-center justify-center`}
          >
            <ChevronLeft size={20} color={textSecondary} />
          </TouchableOpacity>

          <View style={tw`flex-row items-center`}>
            <Calendar size={16} color={accentColor} style={tw`mr-2`} />
            <Text style={[tw`text-base font-black tracking-tight`, { color: textPrimary }]}>
              {formattedMonth}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={handleNextMonth}
            style={tw`w-10 h-10 bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl items-center justify-center`}
          >
            <ChevronRight size={20} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Top 3 Summary Cards */}
        <View style={tw`flex-row gap-2 mb-5`}>
          
          {/* Income Card */}
          <View style={tw`flex-1 bg-[#F4EFF4] dark:bg-[#49454F] p-3 rounded-2xl border border-slate-100 dark:border-slate-800`}>
            <View style={tw`w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 items-center justify-center mb-1.5`}>
              <TrendingUp size={15} color="#10b981" />
            </View>
            <Text style={[tw`text-[10px] font-bold uppercase tracking-wider`, { color: textMuted }]}>Income</Text>
            <Text 
              style={tw`text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5`} 
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currencySymbol}{summaryTotals.income.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>

          {/* Expenses Card */}
          <View style={tw`flex-1 bg-[#F4EFF4] dark:bg-[#49454F] p-3 rounded-2xl border border-slate-100 dark:border-slate-800`}>
            <View style={tw`w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-500/10 items-center justify-center mb-1.5`}>
              <TrendingDown size={15} color="#f43f5e" />
            </View>
            <Text style={[tw`text-[10px] font-bold uppercase tracking-wider`, { color: textMuted }]}>Expenses</Text>
            <Text 
              style={tw`text-base font-black text-rose-600 dark:text-rose-400 mt-0.5`} 
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currencySymbol}{summaryTotals.expense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>

          {/* Net Savings Card */}
          <View style={[
            tw`flex-1 p-3 rounded-2xl border`,
            summaryTotals.netSavings >= 0 
              ? tw`bg-[#F4EFF4] dark:bg-[#49454F] border-slate-100 dark:border-slate-800`
              : tw`bg-rose-50/50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20`
          ]}>
            <View style={tw`w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-500/10 items-center justify-center mb-1.5`}>
              <Scale size={15} color={accentColor} />
            </View>
            <Text style={[tw`text-[10px] font-bold uppercase tracking-wider`, { color: textMuted }]}>Net Savings</Text>
            <Text 
              style={[
                tw`text-base font-black mt-0.5`,
                summaryTotals.netSavings >= 0 ? { color: textPrimary } : tw`text-rose-600 dark:text-rose-400`
              ]} 
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {summaryTotals.netSavings < 0 ? '-' : ''}{currencySymbol}{Math.abs(summaryTotals.netSavings).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        {/* SECTION 1: Category Expense Breakdown (Donut Chart & Legend) */}
        <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-5 mb-6 border border-slate-100 dark:border-slate-800`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center flex-1 mr-2`}>
              <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-2.5`, { backgroundColor: `${accentColor}15` }]}>
                <PieIcon size={16} color={accentColor} />
              </View>
              <Text style={[tw`text-base font-black`, { color: textPrimary }]} numberOfLines={1}>Expense Breakdown</Text>
            </View>
            <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>{expenseBreakdown.list.length} categories</Text>
          </View>

          {expenseBreakdown.list.length === 0 ? (
            <View style={tw`items-center justify-center py-8`}>
              <PieIcon size={44} color={textMuted} style={tw`opacity-40 mb-2`} />
              <Text style={[tw`text-sm font-bold`, { color: textMuted }]}>No expenses recorded for {formattedMonth}</Text>
            </View>
          ) : (
            <View>
              {/* Donut Chart */}
              <View style={tw`items-center justify-center my-3`}>
                <PieChart
                  data={expenseBreakdown.pieData}
                  donut
                  showText
                  radius={110}
                  innerRadius={70}
                  innerCircleColor={isDark ? '#49454F' : '#F4EFF4'}
                  centerLabelComponent={() => (
                    <View style={tw`items-center justify-center`}>
                      <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>
                        {currencySymbol}{expenseBreakdown.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                      <Text style={[tw`text-[10px] font-bold uppercase tracking-wider mt-0.5`, { color: textMuted }]}>
                        Total Spent
                      </Text>
                    </View>
                  )}
                />
              </View>

              {/* Category Legend List */}
              <View style={tw`mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60`}>
                {expenseBreakdown.list.map((item, idx) => {
                  const IconComponent = IconMap[item.icon] || Tag;
                  return (
                    <View key={item.category} style={tw`flex-row items-center justify-between py-2.5 ${idx !== expenseBreakdown.list.length - 1 ? 'border-b border-slate-200/60 dark:border-slate-700/40' : ''}`}>
                      <View style={tw`flex-row items-center flex-1 mr-2`}>
                        <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-3`, { backgroundColor: `${item.color}20` }]}>
                          <IconComponent size={15} color={item.color} />
                        </View>
                        <View style={tw`flex-1`}>
                          <Text style={[tw`text-sm font-bold`, { color: textPrimary }]} numberOfLines={1}>{item.category}</Text>
                          <Text style={[tw`text-[11px] font-semibold`, { color: textMuted }]}>{item.percentage.toFixed(1)}% of expenses</Text>
                        </View>
                      </View>
                      <Text style={[tw`text-sm font-black`, { color: textPrimary }]}>
                        {currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* SECTION 2: 6-Month Income vs. Expense (Bar Chart) */}
        <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-4 mb-6 border border-slate-100 dark:border-slate-800`}>
          {/* Card Header: Title & Subtitle stacked cleanly */}
          <View style={tw`mb-2`}>
            <View style={tw`flex-row items-center`}>
              <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-2.5`, { backgroundColor: `${accentColor}15` }]}>
                <BarChart3 size={16} color={accentColor} />
              </View>
              <Text style={[tw`text-base font-black`, { color: textPrimary }]}>6-Month Cash Flow</Text>
            </View>
            <Text style={[tw`text-xs mt-1 ml-10.5`, { color: textSecondary }]}>
              Monthly comparisons ending in {formattedMonth}
            </Text>
          </View>

          {/* Dedicated Legend Row */}
          <View style={tw`flex-row items-center justify-end gap-3.5 mb-3`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5`} />
              <Text style={[tw`text-xs font-bold`, { color: textSecondary }]}>Income</Text>
            </View>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5`} />
              <Text style={[tw`text-xs font-bold`, { color: textSecondary }]}>Expense</Text>
            </View>
          </View>

          <View style={tw`items-center justify-center py-2`}>
            <BarChart
              data={sixMonthComparison.barData}
              barWidth={10}
              spacing={14}
              initialSpacing={10}
              endSpacing={8}
              yAxisLabelWidth={30}
              formatYLabel={(val) => {
                const n = parseFloat(val);
                if (isNaN(n) || n === 0) return '0';
                if (n >= 1000) return `${Math.round(n / 1000)}k`;
                return Math.round(n).toString();
              }}
              roundedTop
              roundedBottom
              hideRules={false}
              rulesColor={isDark ? '#374151' : '#E2E8F0'}
              xAxisColor={isDark ? '#4B5563' : '#CBD5E1'}
              yAxisColor={isDark ? '#4B5563' : '#CBD5E1'}
              yAxisTextStyle={{ color: textMuted, fontSize: 9 }}
              noOfSections={4}
              maxValue={sixMonthComparison.maxVal}
              isAnimated
            />
          </View>
        </View>

        {/* SECTION 3: Top 3 Biggest Spends */}
        <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-4 border border-slate-100 dark:border-slate-800`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center flex-1 mr-2`}>
              <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-2.5`, { backgroundColor: `${accentColor}15` }]}>
                <Sparkles size={16} color={accentColor} />
              </View>
              <Text style={[tw`text-base font-black`, { color: textPrimary }]} numberOfLines={1}>Top Spends This Month</Text>
            </View>
            <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>Ranked #1 to #3</Text>
          </View>

          {topSpends.length === 0 ? (
            <Text style={[tw`text-center text-xs py-4`, { color: textMuted }]}>No expense transactions recorded</Text>
          ) : (
            topSpends.map((tx, index) => {
              const catObj = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
              const IconComponent = catObj ? (IconMap[catObj.icon] || Tag) : Tag;
              const catColor = catObj ? catObj.color : '#f43f5e';

              return (
                <View 
                  key={tx.id} 
                  style={tw`flex-row items-center justify-between p-3 bg-[#F3EDF7] dark:bg-[#211F26] rounded-2xl mb-2.5 border border-slate-100 dark:border-slate-800`}
                >
                  <View style={tw`flex-row items-center flex-1 mr-2`}>
                    {/* Rank Pill */}
                    <View style={[tw`w-6 h-6 rounded-full items-center justify-center mr-2.5`, { backgroundColor: accentColor }]}>
                      <Text style={[tw`text-[11px] font-black`, { color: textOnAccent }]}>#{index + 1}</Text>
                    </View>

                    {/* Category Icon */}
                    <View style={[tw`w-9 h-9 rounded-full items-center justify-center mr-3`, { backgroundColor: `${catColor}20` }]}>
                      <IconComponent size={16} color={catColor} />
                    </View>

                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-sm font-bold`, { color: textPrimary }]} numberOfLines={1}>{tx.title}</Text>
                      <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>{tx.category} • {tx.date}</Text>
                    </View>
                  </View>

                  <Text style={tw`text-sm font-black text-rose-600 dark:text-rose-400`}>
                    -{currencySymbol}{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
