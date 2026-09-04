import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Wallet, Coffee, Train, ShoppingCart, Tag, Edit2, Trash2 } from 'lucide-react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getCategories, addCategory, updateCategory, deleteCategory, Category } from '../db/database';
import ColorPicker, { Panel3, Preview, HueSlider, Swatches } from 'reanimated-color-picker';
import { IconMap, AVAILABLE_ICONS } from '../utils/Icons';

const AVAILABLE_COLORS = ['#10b981', '#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'];

export default function CategoriesScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState('#10b981');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = () => {
    try {
      setCategories(getCategories());
    } catch (e) {
      console.log(e);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return Alert.alert("Error", "Category name is required.");
    try {
      if (editingId) {
        updateCategory(editingId, name, icon, color, type);
      } else {
        addCategory(name, icon, color, type);
      }
      resetForm();
      loadCategories();
    } catch (e) {
      console.log(e);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setType(cat.type as any);
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === 'web') {
      deleteCategory(id);
      loadCategories();
    } else {
      Alert.alert(
        "Delete Category",
        "Are you sure you want to delete this category?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => {
              deleteCategory(id);
              loadCategories();
            } 
          }
        ]
      );
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setIcon('tag');
    setColor('#10b981');
    setType('expense');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      <View style={tw`flex-row items-center px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <TouchableOpacity onPress={() => router.back()} style={tw`mr-4 p-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
          <ChevronLeft color="#64748b" size={24} />
        </TouchableOpacity>
        <Text style={tw`text-xl font-bold text-slate-800 dark:text-white`}>Manage Categories</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`flex-1`}>
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} style={tw`flex-1 px-6 pt-6`}>
          
          <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] p-6 rounded-3xl shadow-sm shadow-slate-200 dark:shadow-none mb-8 border border-slate-50 dark:border-slate-800`}>
            <Text style={tw`text-lg font-bold text-slate-800 dark:text-white mb-4`}>
              {editingId ? 'Edit Category' : 'New Category'}
            </Text>

            <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl p-1 mb-5`}>
              <TouchableOpacity onPress={() => setType('expense')} style={tw`flex-1 py-2 rounded-lg items-center ${type === 'expense' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}>
                <Text style={tw`font-bold ${type === 'expense' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setType('income')} style={tw`flex-1 py-2 rounded-lg items-center ${type === 'income' ? 'bg-[#ECE6F0] dark:bg-[#2B2930] shadow-sm' : ''}`}>
                <Text style={tw`font-bold ${type === 'income' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>Income</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`bg-[#F3EDF7] dark:bg-[#211F26]/50 border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-2xl text-base font-semibold text-slate-800 dark:text-white mb-5`}
              placeholder="Category Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#64748b"
            />

            <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider`}>Icon</Text>
            <View style={tw`mb-5`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-3 py-1 pr-6`}>
                {AVAILABLE_ICONS.map(i => {
                  const IconComp = IconMap[i];
                  const isSelected = icon === i;
                  return (
                    <TouchableOpacity 
                      key={i} 
                      onPress={() => setIcon(i)}
                      style={tw`w-12 h-12 rounded-full items-center justify-center border-2 ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30' : 'border-slate-100 dark:border-slate-800 bg-[#F3EDF7] dark:bg-[#211F26]'}`}
                    >
                      <IconComp size={20} color={isSelected ? '#3b82f6' : '#94a3b8'} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={tw`text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider`}>Color</Text>
            <View style={tw`w-full mb-6 items-center`}>
              <ColorPicker
                style={{ width: '100%', gap: 16, alignItems: 'center' }}
                value={color}
                onComplete={({ hex }) => setColor(hex)}
              >
                <Preview style={tw`w-full h-10 rounded-xl mb-2`} hideInitialColor />
                <Panel3 style={{ width: 200, height: 200, borderRadius: 100 }} />
                <HueSlider style={{ width: '100%', height: 20, borderRadius: 10 }} />
                <Swatches style={tw`mt-2`} colors={AVAILABLE_COLORS} />
              </ColorPicker>
            </View>

            <View style={tw`flex-row space-x-3 gap-3`}>
              {editingId && (
                <TouchableOpacity onPress={resetForm} style={tw`flex-1 bg-[#F3EDF7] dark:bg-[#211F26] py-4 rounded-2xl items-center`}>
                  <Text style={tw`text-slate-600 dark:text-slate-400 font-bold text-base`}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSave} style={tw`flex-1 bg-blue-600 py-4 rounded-2xl items-center`}>
                <Text style={tw`text-white font-bold text-base`}>{editingId ? 'Update' : 'Add Category'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={tw`text-lg font-bold text-slate-800 dark:text-white mb-4`}>Your Categories</Text>
          
          <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-2 shadow-sm shadow-slate-200 dark:shadow-none mb-12 border border-transparent dark:border-slate-800`}>
            {categories.map((cat, index) => {
              const IconComp = IconMap[cat.icon] || Tag;
              const hex = cat.color.replace('#', '');
              const r = parseInt(hex.substring(0,2), 16) || 0;
              const g = parseInt(hex.substring(2,4), 16) || 0;
              const b = parseInt(hex.substring(4,6), 16) || 0;
              return (
                <View key={cat.id} style={tw`flex-row items-center justify-between p-4 ${index !== categories.length - 1 ? 'border-b border-slate-50 dark:border-slate-800/50' : ''}`}>
                  <View style={tw`flex-row items-center`}>
                    <View style={[tw`w-12 h-12 rounded-full items-center justify-center mr-4`, { backgroundColor: `rgba(${r},${g},${b},0.15)` }]}>
                      <IconComp size={22} color={cat.color} />
                    </View>
                    <View>
                      <Text style={tw`text-base font-bold text-slate-800 dark:text-slate-100`}>{cat.name}</Text>
                      <Text style={tw`text-xs font-semibold uppercase tracking-wide mt-1 ${cat.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{cat.type}</Text>
                    </View>
                  </View>
                  <View style={tw`flex-row gap-2`}>
                    <TouchableOpacity onPress={() => handleEdit(cat)} style={tw`p-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                      <Edit2 size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(cat.id)} style={tw`p-2 bg-rose-50 dark:bg-rose-500/10 rounded-full`}>
                      <Trash2 size={18} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {categories.length === 0 && (
              <Text style={tw`text-center text-slate-500 py-6`}>No categories yet.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
