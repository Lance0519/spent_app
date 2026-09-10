import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { ChevronLeft, Plus, CheckCircle2, Circle, Trash2, Calendar, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { getReminders, addReminder, toggleReminder, deleteReminder, Reminder } from '../db/database';
import { useTheme } from '../context/ThemeContext';

export default function RemindersScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent } = useTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);

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

  const handleOpenAdd = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    bottomSheetRef.current?.snapToIndex(0);
  };

  const handleToggle = (item: Reminder) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    toggleReminder(item.id, item.is_completed ? 0 : 1);
    fetchReminders();
  };

  const handleDelete = (id: number) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    deleteReminder(id);
    fetchReminders();
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    Keyboard.dismiss();
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
      {/* Header */}
      <View style={tw`flex-row items-center justify-between px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={tw`w-11 h-11 items-center justify-center bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft color={textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Reminders</Text>
        <TouchableOpacity 
          onPress={handleOpenAdd} 
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add Reminder"
          accessibilityHint="Opens bottom sheet to create a new reminder"
          style={[tw`w-11 h-11 items-center justify-center rounded-full`, { backgroundColor: `${accentColor}18` }]}
        >
          <Plus color={accentColor} size={22} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={tw`flex-1 px-6 pt-6`}>
        {reminders.length === 0 ? (
          <View style={tw`flex-1 items-center justify-center px-4`}>
            <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-4`, { backgroundColor: `${accentColor}12` }]}>
              <Calendar color={accentColor} size={38} />
            </View>
            <Text style={[tw`text-lg font-bold mb-1`, { color: textPrimary }]}>No Reminders Yet</Text>
            <Text style={[tw`text-sm text-center mb-6 max-w-xs`, { color: textSecondary }]}>
              Keep track of upcoming bills, subscriptions, or financial to-dos.
            </Text>
            <TouchableOpacity
              onPress={handleOpenAdd}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add your first reminder"
              style={[tw`flex-row items-center px-6 py-3.5 rounded-2xl shadow-sm min-h-[48px]`, { backgroundColor: accentColor }]}
            >
              <Plus color={textOnAccent} size={18} style={tw`mr-2`} />
              <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Add Reminder</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-12`}>
            {pendingReminders.length > 0 && (
              <View style={tw`mb-6`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3`, { color: textSecondary }]}>Pending</Text>
                {pendingReminders.map(item => (
                  <View 
                    key={item.id} 
                    style={tw`flex-row items-center justify-between bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-3 shadow-sm border border-slate-100 dark:border-slate-800`}
                  >
                    <TouchableOpacity 
                      style={tw`flex-row items-center flex-1 min-h-[44px]`} 
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.7}
                    >
                      <Circle color={textSecondary} size={22} style={tw`mr-4`} />
                      <View style={tw`flex-1`}>
                        <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>{item.title}</Text>
                        {item.due_date && <Text style={tw`text-xs font-semibold text-rose-500 dark:text-rose-400 mt-1`}>Due: {item.due_date}</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(item.id)} 
                      style={tw`w-9 h-9 items-center justify-center bg-rose-50 dark:bg-rose-500/10 rounded-full ml-3`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Delete reminder"
                    >
                      <Trash2 color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {completedReminders.length > 0 && (
              <View style={tw`mb-8`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3`, { color: textMuted }]}>Completed</Text>
                {completedReminders.map(item => (
                  <View 
                    key={item.id} 
                    style={tw`flex-row items-center justify-between bg-[#F3EDF7] dark:bg-[#211F26]/60 p-4 rounded-2xl mb-3 border border-slate-200/60 dark:border-slate-800 opacity-70`}
                  >
                    <TouchableOpacity 
                      style={tw`flex-row items-center flex-1 min-h-[44px]`} 
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.7}
                    >
                      <CheckCircle2 color={accentColor} size={22} style={tw`mr-4`} />
                      <View style={tw`flex-1`}>
                        <Text style={[tw`text-base font-bold line-through`, { color: textMuted }]}>{item.title}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(item.id)} 
                      style={tw`w-9 h-9 items-center justify-center bg-[#ECE6F0] dark:bg-[#2B2930] rounded-full ml-3`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Delete reminder"
                    >
                      <Trash2 color={textSecondary} size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Add Reminder Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        activeOffsetX={[-999, 999]}
        activeOffsetY={[-5, 5]}
        keyboardBehavior="interactive"
        android_keyboardInputMode="adjustResize"
        keyboardBlurBehavior="restore"
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
            pressBehavior="close"
          />
        )}
        backgroundStyle={{
          backgroundColor: isDark ? '#141218' : '#FEF7FF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? '#334155' : '#cbd5e1',
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={tw`px-6 pt-2 pb-10`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={tw`flex-row items-center justify-between mb-5`}>
            <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>New Reminder</Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                bottomSheetRef.current?.close();
              }}
              style={tw`p-2 rounded-full bg-[#F3EDF7] dark:bg-[#211F26] min-w-[36px] min-h-[36px] items-center justify-center`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <X color={textSecondary} size={18} />
            </TouchableOpacity>
          </View>
          
          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>Title</Text>
          <TextInput
            style={[
              tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-base font-semibold mb-5 min-h-[48px]`,
              { color: textPrimary }
            ]}
            placeholder="e.g. Pay Electricity Bill"
            placeholderTextColor={textMuted}
            value={newTitle}
            onChangeText={setNewTitle}
            returnKeyType="next"
          />
          
          <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>Due Date (Optional)</Text>
          <TextInput
            style={[
              tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-base font-semibold mb-6 min-h-[48px]`,
              { color: textPrimary }
            ]}
            placeholder="e.g. Oct 15 or Next Friday"
            placeholderTextColor={textMuted}
            value={newDate}
            onChangeText={setNewDate}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          
          <TouchableOpacity 
            onPress={handleAdd} 
            activeOpacity={0.8}
            disabled={!newTitle.trim()}
            style={[
              tw`w-full py-4 rounded-2xl items-center shadow-md min-h-[48px] justify-center`,
              { backgroundColor: accentColor },
              !newTitle.trim() && tw`opacity-50`
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save reminder"
          >
            <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>Save Reminder</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
