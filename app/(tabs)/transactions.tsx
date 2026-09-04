import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { ArrowUpRight, ArrowDownRight, Delete, Tag } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { getDB, deleteTransaction, updateTransaction, getCategories, Category } from '../../db/database';

type Transaction = {
  id: number;
  title: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
};

export default function TransactionsScreen() {
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [allData, setAllData] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Edit State
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [amount, setAmount] = useState('0');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    try {
      const db = getDB();
      const txs = db.getAllSync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
      setAllData(txs);
      setCategories(getCategories());
    } catch (e) {
      console.log(e);
    }
  };

  const openEditModal = (tx: Transaction) => {
    setSelectedTxId(tx.id);
    setTitle(tx.title);
    setAmount(Math.abs(tx.amount).toString());
    setType(tx.type as 'expense' | 'income');
    bottomSheetRef.current?.expand();
  };

  const handleUpdate = () => {
    if (!selectedTxId) return;
    const numAmount = parseFloat(amount.replace(/[^0-9.-]+/g,""));
    if (isNaN(numAmount) || numAmount === 0) return;
    updateTransaction(selectedTxId, title || 'Custom Entry', numAmount, type, title || 'Other', new Date().toISOString());
    fetchData();
    bottomSheetRef.current?.close();
  };

  const handleDelete = () => {
    if (!selectedTxId) return;
    deleteTransaction(selectedTxId);
    fetchData();
    bottomSheetRef.current?.close();
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

  const filteredData = allData.filter(t => filter === 'all' || t.type === filter);

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity onPress={() => openEditModal(item)} style={tw`flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800/50`}>
      <View style={tw`flex-row items-center`}>
        <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-4 ${item.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-rose-100 dark:bg-rose-500/10'}`}>
          {item.type === 'income' ? (
            <ArrowDownRight color="#10b981" size={22} />
          ) : (
            <ArrowUpRight color="#f43f5e" size={22} />
          )}
        </View>
        <View>
          <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{item.title}</Text>
          <Text style={tw`text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5`}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={tw`text-lg font-black tracking-tight ${item.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
        {item.type === 'income' ? '+' : ''}₱{Math.abs(item.amount).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <View style={tw`px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800`}>
        <Text style={tw`text-3xl font-black text-slate-900 dark:text-white mb-6`}>Transactions</Text>
        <View style={tw`flex-row space-x-2 gap-2`}>
          {['all', 'income', 'expense'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              style={tw`px-5 py-2.5 rounded-full ${filter === f ? 'bg-blue-600 shadow-md shadow-blue-500/30 dark:shadow-none' : 'bg-[#F3EDF7] dark:bg-[#211F26]'}`}
            >
              <Text style={tw`font-bold capitalize text-sm tracking-wide ${filter === f ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`}>
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
          estimatedItemSize={76}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tw`pb-8`}
        />
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['85%']}
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
              const hex = cat.color.replace('#', '');
              const r = parseInt(hex.substring(0,2), 16) || 0;
              const g = parseInt(hex.substring(2,4), 16) || 0;
              const b = parseInt(hex.substring(4,6), 16) || 0;
              return (
                <TouchableOpacity key={cat.id} onPress={() => setTitle(cat.name)} style={[tw`flex-row items-center border px-4 py-2 rounded-full h-10`, { backgroundColor: `rgba(${r},${g},${b},0.1)`, borderColor: `rgba(${r},${g},${b},0.3)` }]}>
                  <Tag size={16} color={cat.color} style={tw`mr-2`} />
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
            <TouchableOpacity onPress={handleDelete} style={tw`w-full bg-rose-50 dark:bg-rose-500/10 py-4 rounded-xl items-center mt-2 border border-rose-100 dark:border-rose-500/20`}>
              <Text style={tw`text-rose-500 font-bold text-lg`}>Delete Transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUpdate} style={tw`w-full bg-blue-600 py-4 rounded-xl items-center mt-4`}>
              <Text style={tw`text-white font-bold text-lg`}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}
