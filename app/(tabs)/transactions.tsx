import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { 
  ArrowUpRight, ArrowDownRight, ArrowRightLeft, Clock, Search, X, Plus, Inbox, CreditCard, Camera, Receipt
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import tw, { useAppColorScheme } from 'twrnc';
import { FinanceService, Category, Account } from '../../services/FinanceService';
import { IconMap } from '../../utils/Icons';
import { useTheme } from '../../context/ThemeContext';
import { TransactionBottomSheet, TransactionBottomSheetRef, TransactionData } from '../../components/TransactionBottomSheet';
import { AmbientBackground } from '../../components/AmbientBackground';
import { GlassView } from '../../components/GlassView';

export default function TransactionsScreen() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, palette, textPrimary, textSecondary, textMuted, textOnAccent, formatCurrency } = useTheme();
  
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'loan'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allData, setAllData] = useState<TransactionData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const bottomSheetRef = useRef<TransactionBottomSheetRef>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [filter, searchQuery])
  );

  const fetchData = () => {
    try {
      const txs = FinanceService.getTransactions({
        type: filter === 'all' ? undefined : filter,
        search: searchQuery
      }) as TransactionData[];
      setAllData(txs);
      setCategories(FinanceService.getCategories());
      setAccounts(FinanceService.getAccounts());
    } catch (e) {
      console.warn('Transactions fetchData error:', e);
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

  const renderItem = ({ item }: { item: TransactionData }) => {
    const isIncome = item.type === 'income' || (item.type === 'loan' && item.amount > 0);
    const isLoan = item.type === 'loan';
    const isTransfer = item.type === 'transfer';
    
    return (
      <TouchableOpacity 
        onPress={() => bottomSheetRef.current?.openEdit(item)} 
        style={tw`flex-row items-center justify-between py-3.5 px-2 border-b border-slate-100/80 dark:border-slate-800/50 min-h-[56px]`}
        activeOpacity={0.7}
      >
        <View style={tw`flex-row items-center flex-1 mr-2`}>
          <View style={[
            tw`w-11 h-11 rounded-full items-center justify-center mr-3.5`,
            isTransfer
              ? tw`bg-blue-100 dark:bg-blue-500/10`
              : isLoan 
              ? tw`bg-amber-100 dark:bg-amber-500/10` 
              : isIncome 
              ? tw`bg-emerald-100 dark:bg-emerald-500/10` 
              : tw`bg-rose-100 dark:bg-rose-500/10`
          ]}>
            {isTransfer ? (
              <ArrowRightLeft color="#3b82f6" size={19} />
            ) : isLoan ? (
              <CreditCard color="#f59e0b" size={19} />
            ) : isIncome ? (
              <ArrowDownRight color="#10b981" size={20} />
            ) : (
              <ArrowUpRight color="#f43f5e" size={20} />
            )}
          </View>

          <View style={tw`flex-1`}>
            <Text style={[tw`text-sm font-bold`, { color: textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={tw`flex-row items-center gap-1.5 mt-0.5`}>
              <Text style={[tw`text-[11px] font-semibold`, { color: textMuted }]}>
                {new Date(item.date).toLocaleDateString()} • {item.category}
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

        <Text style={[
          tw`text-sm font-black tracking-tight`,
          isTransfer
            ? { color: textSecondary }
            : isIncome 
            ? tw`text-emerald-500 dark:text-emerald-400` 
            : { color: textPrimary }
        ]}>
          {isTransfer ? '' : isIncome ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <AmbientBackground style={tw`flex-1 relative`}>
      <SafeAreaView style={tw`flex-1 relative`} edges={['top']}>
        {/* Top Header & Search */}
        <View style={tw`px-6 pt-4 pb-3 border-b border-white/20 dark:border-white/5`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={[tw`text-3xl font-black tracking-tight`, { color: textPrimary }]}>
              Transactions
            </Text>
            <TouchableOpacity
              onPress={() => bottomSheetRef.current?.openScanner()}
              style={[
                tw`flex-row items-center px-3.5 py-2 rounded-2xl border min-h-[40px]`,
                { 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.65)', 
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.70)' 
                }
              ]}
              accessibilityLabel="Scan Receipt"
            >
              <Camera size={16} color={accentColor} style={tw`mr-1.5`} />
              <Text style={[tw`text-xs font-bold`, { color: accentColor }]}>Scan</Text>
            </TouchableOpacity>
          </View>

          {/* Real-time Search Input with GlassView Control */}
          <GlassView 
            level="control" 
            borderRadius={20} 
            style={tw`mb-4`}
            contentStyle={tw`flex-row items-center px-3.5 py-2.5 min-h-[48px]`}
          >
            <Search size={18} color={textMuted} style={tw`mr-2.5`} />
            <TextInput
              style={[tw`flex-1 text-sm font-semibold`, { color: textPrimary }]}
              placeholder="Search by note, description, or category..."
              placeholderTextColor={textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={tw`p-1 min-h-[32px] justify-center`}>
                <X size={16} color={textMuted} />
              </TouchableOpacity>
            )}
          </GlassView>

          {/* Filter Chips with Frosted Glass Styling */}
          <View style={tw`flex-row gap-2`}>
            {(['all', 'income', 'expense', 'loan'] as const).map(f => {
              const isSelected = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    tw`px-4 py-2 rounded-full min-h-[38px] justify-center border`,
                    isSelected
                      ? [{ backgroundColor: accentColor, borderColor: `${accentColor}80` }]
                      : {
                          backgroundColor: isDark ? 'rgba(36, 32, 48, 0.70)' : 'rgba(255, 255, 255, 0.85)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.65)'
                        }
                  ]}
                >
                  <Text style={[tw`font-bold capitalize text-xs tracking-wide`, { color: isSelected ? textOnAccent : textPrimary }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Transaction List with Empty State */}
        <View style={tw`flex-1 px-6 pt-3`}>
          <FlashList
            data={allData}
            estimatedItemSize={76}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={tw`pb-32 pt-1`}
            ListEmptyComponent={() => (
              <View style={tw`items-center justify-center py-20 px-4`}>
                <View style={tw`w-16 h-16 rounded-full bg-white/20 dark:bg-white/5 items-center justify-center mb-4 border border-white/20 dark:border-white/10`}>
                  <Inbox size={28} color={textMuted} />
                </View>
                <Text style={[tw`font-bold text-base mb-1`, { color: textPrimary }]}>
                  {searchQuery ? 'No matching transactions' : 'No transactions found'}
                </Text>
                <Text style={[tw`text-xs text-center max-w-xs leading-5`, { color: textMuted }]}>
                  {searchQuery 
                    ? `No transactions matched "${searchQuery}". Try another keyword.`
                    : 'Start tracking your spending by adding your first transaction below.'}
                </Text>
              </View>
            )}
          />
        </View>

        {/* Floating Action Button (FAB) floating above frosted tab bar */}
        <TouchableOpacity
          style={[
            tw`absolute bottom-24 right-6 w-15 h-15 rounded-full shadow-2xl min-h-[48px] min-w-[48px] border-2 border-white/50 dark:border-white/20`, 
            { elevation: 12, shadowColor: accentColor }
          ]}
          onPress={() => bottomSheetRef.current?.openAdd(filter === 'income' ? 'income' : filter === 'loan' ? 'loan' : 'expense')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[palette.light, palette.dark]} style={tw`w-full h-full rounded-full items-center justify-center`}>
            <Plus color="#fff" size={26} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Shared Transaction Entry Bottom Sheet */}
        <TransactionBottomSheet ref={bottomSheetRef} onSuccess={fetchData} />
      </SafeAreaView>
    </AmbientBackground>
  );
}
