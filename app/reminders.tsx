import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { ChevronLeft, Plus, CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { getReminders, addReminder, toggleReminder, deleteReminder, Reminder } from '../db/database';

export default function RemindersScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  
  const bottomSheetRef = useRef<BottomSheet>(null);

  const fetchReminders = () => {
    try {
      const data = getReminders();
      setReminders(data);
    } catch (e) {
      console.log(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [])
  );

  const handleToggle = (item: Reminder) => {
    toggleReminder(item.id, item.is_completed ? 0 : 1);
    fetchReminders();
  };

  const handleDelete = (id: number) => {
    deleteReminder(id);
    fetchReminders();
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addReminder(newTitle.trim(), newDate.trim() || null);
    setNewTitle('');
    setNewDate('');
    bottomSheetRef.current?.close();
    fetchReminders();
  };

  const pendingReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`} edges={['top']}>
      <View style={tw`flex-row items-center justify-between px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <TouchableOpacity onPress={() => router.back()} style={tw`p-2 -ml-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
          <ChevronLeft color="#64748b" size={24} />
        </TouchableOpacity>
        <Text style={tw`text-xl font-black text-slate-800 dark:text-white`}>Reminders</Text>
        <TouchableOpacity onPress={() => bottomSheetRef.current?.expand()} style={tw`p-2 -mr-2 bg-blue-50 dark:bg-blue-500/10 rounded-full`}>
          <Plus color="#3b82f6" size={24} />
        </TouchableOpacity>
      </View>

      <View style={tw`flex-1 px-6 pt-6`}>
        {reminders.length === 0 ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <Calendar color="#cbd5e1" size={48} style={tw`mb-4 dark:opacity-20`} />
            <Text style={tw`text-lg font-bold text-slate-400 dark:text-slate-500 mb-1`}>No Reminders Yet</Text>
            <Text style={tw`text-sm text-slate-500 dark:text-slate-600 text-center`}>Tap the + button to add upcoming bills or to-dos.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {pendingReminders.length > 0 && (
              <View style={tw`mb-6`}>
                <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3`}>Pending</Text>
                {pendingReminders.map(item => (
                  <View key={item.id} style={tw`flex-row items-center justify-between bg-[#F4EFF4] dark:bg-[#49454F] p-4 rounded-2xl mb-3 shadow-sm shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-slate-800`}>
                    <TouchableOpacity style={tw`flex-row items-center flex-1`} onPress={() => handleToggle(item)}>
                      <Circle color="#94a3b8" size={24} style={tw`mr-4`} />
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{item.title}</Text>
                        {item.due_date && <Text style={tw`text-xs font-semibold text-rose-500 dark:text-rose-400 mt-1`}>Due: {item.due_date}</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={tw`p-2 bg-rose-50 dark:bg-rose-500/10 rounded-full ml-3`}>
                      <Trash2 color="#ef4444" size={18} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {completedReminders.length > 0 && (
              <View style={tw`mb-8`}>
                <Text style={tw`text-sm font-bold text-slate-400 uppercase tracking-wider mb-3`}>Completed</Text>
                {completedReminders.map(item => (
                  <View key={item.id} style={tw`flex-row items-center justify-between bg-[#F3EDF7] dark:bg-[#211F26] p-4 rounded-2xl mb-3 border border-slate-200 dark:border-slate-700 opacity-70`}>
                    <TouchableOpacity style={tw`flex-row items-center flex-1`} onPress={() => handleToggle(item)}>
                      <CheckCircle2 color="#10b981" size={24} style={tw`mr-4`} />
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-base font-bold text-slate-500 dark:text-slate-400 line-through`}>{item.title}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={tw`p-2 bg-[#ECE6F0] dark:bg-[#2B2930] rounded-full ml-3`}>
                      <Trash2 color="#94a3b8" size={18} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />}
        backgroundStyle={{ backgroundColor: isDark ? '#141218' : '#FEF7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#334155' : '#cbd5e1' }}
      >
        <BottomSheetView style={tw`flex-1 px-6 pt-4 pb-8`}>
          <Text style={tw`text-xl font-black text-slate-800 dark:text-white mb-6`}>New Reminder</Text>
          
          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Title</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-2xl text-base font-semibold text-slate-800 dark:text-white mb-5`}
            placeholder="e.g. Pay Electricity Bill"
            placeholderTextColor="#64748b"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          
          <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`}>Due Date (Optional)</Text>
          <TextInput
            style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-2xl text-base font-semibold text-slate-800 dark:text-white mb-6`}
            placeholder="e.g. Oct 15 or Next Friday"
            placeholderTextColor="#64748b"
            value={newDate}
            onChangeText={setNewDate}
          />
          
          <TouchableOpacity onPress={handleAdd} style={tw`w-full bg-blue-600 py-4 rounded-2xl items-center shadow-lg shadow-blue-200 dark:shadow-none`}>
            <Text style={tw`text-white font-bold text-lg`}>Save Reminder</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}
