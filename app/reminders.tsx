import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Keyboard, 
  Modal, 
  KeyboardAvoidingView, 
  Platform,
  TouchableWithoutFeedback 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, CheckCircle2, Circle, Trash2, Calendar, X, Clock, Edit2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import tw, { useAppColorScheme } from 'twrnc';
import { getReminders, addReminder, updateReminder, toggleReminder, deleteReminder, Reminder } from '../db/database';
import { useTheme } from '../context/ThemeContext';

export default function RemindersScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent } = useTheme();
  
  // Data State
  const [reminders, setReminders] = useState<Reminder[]>([]);
  
  // Modal / Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const fetchReminders = () => {
    try {
      const data = getReminders();
      setReminders(data);
    } catch (e) {
      console.warn('Failed to load reminders:', e);
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
    setEditingReminder(null);
    setTitle('');
    setDueDate('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Reminder) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setEditingReminder(item);
    setTitle(item.title);
    setDueDate(item.due_date || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    Keyboard.dismiss();
    setIsModalOpen(false);
    setEditingReminder(null);
    setTitle('');
    setDueDate('');
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

  const handleSave = () => {
    if (!title.trim()) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    Keyboard.dismiss();
    
    if (editingReminder) {
      updateReminder(editingReminder.id, title.trim(), dueDate.trim() || null);
    } else {
      addReminder(title.trim(), dueDate.trim() || null);
    }
    
    handleCloseModal();
    fetchReminders();
  };

  // Helper date preset chips
  const applyPresetDate = (label: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setDueDate(label);
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
          accessibilityHint="Opens form to create a new reminder"
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
            <Text style={[tw`text-sm text-center mb-6 max-w-xs leading-relaxed`, { color: textSecondary }]}>
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
            {/* Pending Reminders */}
            {pendingReminders.length > 0 && (
              <View style={tw`mb-6`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3`, { color: textSecondary }]}>
                  Pending ({pendingReminders.length})
                </Text>
                {pendingReminders.map(item => (
                  <View 
                    key={item.id} 
                    style={tw`flex-row items-center justify-between bg-[#F4EFF4] dark:bg-[#211F26] p-4 rounded-2xl mb-3 shadow-sm border border-slate-100 dark:border-slate-800`}
                  >
                    <TouchableOpacity 
                      style={tw`flex-row items-center flex-1 min-h-[44px]`} 
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel={`Mark ${item.title} as completed`}
                    >
                      <Circle color={textSecondary} size={22} style={tw`mr-4`} />
                      <View style={tw`flex-1 mr-2`}>
                        <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>{item.title}</Text>
                        {item.due_date && (
                          <View style={tw`flex-row items-center mt-1`}>
                            <Clock size={12} color="#f43f5e" style={tw`mr-1`} />
                            <Text style={tw`text-xs font-semibold text-rose-500 dark:text-rose-400`}>
                              Due: {item.due_date}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    <View style={tw`flex-row items-center gap-1`}>
                      <TouchableOpacity 
                        onPress={() => handleOpenEdit(item)}
                        style={tw`w-9 h-9 items-center justify-center bg-slate-200/60 dark:bg-slate-800 rounded-full`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Edit reminder"
                      >
                        <Edit2 color={textSecondary} size={15} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleDelete(item.id)} 
                        style={tw`w-9 h-9 items-center justify-center bg-rose-50 dark:bg-rose-500/10 rounded-full`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Delete reminder"
                      >
                        <Trash2 color="#ef4444" size={15} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Completed Reminders */}
            {completedReminders.length > 0 && (
              <View style={tw`mb-8`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3`, { color: textMuted }]}>
                  Completed ({completedReminders.length})
                </Text>
                {completedReminders.map(item => (
                  <View 
                    key={item.id} 
                    style={tw`flex-row items-center justify-between bg-[#F3EDF7] dark:bg-[#211F26]/60 p-4 rounded-2xl mb-3 border border-slate-200/60 dark:border-slate-800 opacity-70`}
                  >
                    <TouchableOpacity 
                      style={tw`flex-row items-center flex-1 min-h-[44px]`} 
                      onPress={() => handleToggle(item)}
                      activeOpacity={0.7}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true }}
                      accessibilityLabel={`Mark ${item.title} as pending`}
                    >
                      <CheckCircle2 color={accentColor} size={22} style={tw`mr-4`} />
                      <View style={tw`flex-1 mr-2`}>
                        <Text style={[tw`text-base font-bold line-through`, { color: textMuted }]}>{item.title}</Text>
                        {item.due_date && (
                          <Text style={[tw`text-xs mt-0.5 line-through`, { color: textMuted }]}>
                            Due: {item.due_date}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDelete(item.id)} 
                      style={tw`w-9 h-9 items-center justify-center bg-[#ECE6F0] dark:bg-[#2B2930] rounded-full`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Delete reminder"
                    >
                      <Trash2 color={textSecondary} size={15} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Slide-Up Native Modal for Add / Edit Reminder */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={tw`flex-1 bg-black/50 justify-end`}
        >
          {/* Backdrop dismiss area */}
          <TouchableWithoutFeedback onPress={handleCloseModal}>
            <View style={tw`flex-1`} />
          </TouchableWithoutFeedback>

          <View 
            style={[
              tw`rounded-t-3xl max-h-[85%] px-6 pt-3 pb-8 border-t border-slate-200/60 dark:border-slate-800 shadow-2xl`,
              { backgroundColor: isDark ? '#141218' : '#FEF7FF' }
            ]}
          >
            {/* Sheet Drag Indicator */}
            <View style={tw`items-center py-2 mb-2`}>
              <View style={[tw`w-12 h-1.5 rounded-full`, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            </View>

            {/* Modal Header */}
            <View style={tw`flex-row items-center justify-between mb-5`}>
              <View>
                <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>
                  {editingReminder ? 'Edit Reminder' : 'New Reminder'}
                </Text>
                <Text style={[tw`text-xs mt-0.5`, { color: textSecondary }]}>
                  {editingReminder ? 'Update reminder details' : 'Set a reminder for your upcoming expense'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={tw`p-2 rounded-full bg-[#F3EDF7] dark:bg-[#211F26] min-w-[36px] min-h-[36px] items-center justify-center`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
              >
                <X color={textSecondary} size={18} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={tw`pb-4`}
            >
              {/* Title Input */}
              <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
                Reminder Title *
              </Text>
              <TextInput
                style={[
                  tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-base font-semibold mb-5 min-h-[48px]`,
                  { color: textPrimary }
                ]}
                placeholder="e.g. Pay Electricity Bill, Netflix Renewal"
                placeholderTextColor={textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus={true}
                returnKeyType="next"
              />
              
              {/* Due Date Input */}
              <Text style={[tw`text-xs font-bold mb-2 uppercase tracking-wider`, { color: textSecondary }]}>
                Due Date (Optional)
              </Text>
              <TextInput
                style={[
                  tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-800 px-5 py-3.5 rounded-2xl text-base font-semibold mb-3 min-h-[48px]`,
                  { color: textPrimary }
                ]}
                placeholder="e.g. Oct 15, Tomorrow, or End of Month"
                placeholderTextColor={textMuted}
                value={dueDate}
                onChangeText={setDueDate}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {/* Quick Preset Chips */}
              <View style={tw`flex-row flex-wrap gap-2 mb-6`}>
                {['Today', 'Tomorrow', 'This Friday', 'End of Month'].map(preset => {
                  const isSelected = dueDate === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => applyPresetDate(preset)}
                      style={[
                        tw`px-3 py-1.5 rounded-xl border min-h-[32px] justify-center`,
                        isSelected 
                          ? [{ backgroundColor: `${accentColor}20`, borderColor: accentColor }]
                          : tw`bg-[#F3EDF7] dark:bg-[#211F26] border-slate-200/60 dark:border-slate-800`
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text 
                        style={[
                          tw`text-xs font-bold`,
                          isSelected ? { color: accentColor } : { color: textSecondary }
                        ]}
                      >
                        +{preset}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {dueDate ? (
                  <TouchableOpacity
                    onPress={() => setDueDate('')}
                    style={tw`px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 min-h-[32px] justify-center`}
                    activeOpacity={0.7}
                  >
                    <Text style={tw`text-xs font-bold text-rose-500`}>Clear Date</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              
              {/* Save Button */}
              <TouchableOpacity 
                onPress={handleSave} 
                activeOpacity={0.8}
                disabled={!title.trim()}
                style={[
                  tw`w-full py-4 rounded-2xl items-center shadow-md min-h-[48px] justify-center mb-2`,
                  { backgroundColor: accentColor },
                  !title.trim() && tw`opacity-50`
                ]}
                accessibilityRole="button"
                accessibilityLabel={editingReminder ? 'Save changes' : 'Save reminder'}
              >
                <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>
                  {editingReminder ? 'Update Reminder' : 'Save Reminder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
