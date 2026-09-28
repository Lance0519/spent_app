import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Plus, 
  Tag, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Landmark,
  RotateCcw
} from 'lucide-react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getCategories, addCategory, updateCategory, deleteCategory, seedDefaultCategories, Category } from '../db/database';
import { useTheme } from '../context/ThemeContext';
import { IconMap, AVAILABLE_ICONS } from '../utils/Icons';

const AVAILABLE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', 
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', 
  '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#475569', '#334155', '#1e293b'
];

type CategoryType = 'expense' | 'income' | 'loan';
type FilterTab = 'all' | 'expense' | 'income' | 'loan';

export default function CategoriesScreen() {
  const router = useRouter();
  const [colorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent } = useTheme();

  // Data & Filter State
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Modal / Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState('#f43f5e');
  const [type, setType] = useState<CategoryType>('expense');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = () => {
    try {
      setCategories(getCategories());
    } catch (e) {
      console.warn('Failed to load categories:', e);
    }
  };

  // Counts for each tab
  const counts = useMemo(() => {
    return {
      all: categories.length,
      expense: categories.filter(c => c.type === 'expense').length,
      income: categories.filter(c => c.type === 'income').length,
      loan: categories.filter(c => c.type === 'loan').length,
    };
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (activeTab === 'all') return categories;
    return categories.filter(c => c.type === activeTab);
  }, [categories, activeTab]);

  // Open Create Modal
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    const targetType: CategoryType = activeTab === 'all' ? 'expense' : activeTab;
    setType(targetType);
    if (targetType === 'income') {
      setColor('#10b981');
      setIcon('wallet');
    } else if (targetType === 'loan') {
      setColor('#f59e0b');
      setIcon('smartphone');
    } else {
      setColor('#f43f5e');
      setIcon('shopping-cart');
    }
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon || 'tag');
    setColor(cat.color || '#10b981');
    setType((cat.type as CategoryType) || 'expense');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
  };

  // Type change inside form
  const handleTypeChange = (newType: CategoryType) => {
    setType(newType);
    if (!editingId) {
      if (newType === 'income') {
        setColor('#10b981');
        setIcon('wallet');
      } else if (newType === 'loan') {
        setColor('#f59e0b');
        setIcon('smartphone');
      } else {
        setColor('#f43f5e');
        setIcon('shopping-cart');
      }
    }
  };

  // Save / Update Category
  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Required Field', 'Please enter a category name.');
      return;
    }

    // Duplicate Check: Same name & same type (excluding current editing category)
    const isDuplicate = categories.some(
      c => c.name.trim().toLowerCase() === cleanName.toLowerCase() && 
           c.type === type && 
           c.id !== editingId
    );

    if (isDuplicate) {
      Alert.alert(
        'Duplicate Category',
        `A category named "${cleanName}" already exists under ${type === 'expense' ? 'Expenses' : type === 'income' ? 'Income' : 'Loans'}.`
      );
      return;
    }

    try {
      if (editingId) {
        updateCategory(editingId, cleanName, icon, color, type);
      } else {
        addCategory(cleanName, icon, color, type);
        // Automatically switch filter tab to show newly created category if not on 'all'
        if (activeTab !== 'all' && activeTab !== type) {
          setActiveTab(type);
        }
      }
      handleCloseModal();
      loadCategories();
    } catch (e) {
      Alert.alert('Database Error', (e as Error).message);
    }
  };

  // Delete Category
  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"? Past transactions with this category will retain their historical record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            try {
              deleteCategory(cat.id);
              if (editingId === cat.id) {
                handleCloseModal();
              }
              loadCategories();
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          } 
        }
      ]
    );
  };

  // Restore Built-in Default Categories
  const handleRestoreDefaults = () => {
    Alert.alert(
      'Restore Default Categories',
      'This will re-add any missing built-in categories (Groceries, Salary, Loans, etc.). Your custom categories and existing transactions will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restore', 
          onPress: () => {
            try {
              const count = seedDefaultCategories();
              loadCategories();
              if (count > 0) {
                Alert.alert('Categories Restored', `Successfully added ${count} built-in categories.`);
              } else {
                Alert.alert('All Present', 'All default categories are already present in your list.');
              }
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          } 
        }
      ]
    );
  };

  // Icon preview component
  const PreviewIcon = IconMap[icon] || Tag;

  return (
    <SafeAreaView style={tw`flex-1 bg-[#FEF7FF] dark:bg-[#141218]`}>
      
      {/* Top Header */}
      <View style={tw`flex-row items-center justify-between px-6 py-4 bg-[#FEF7FF] dark:bg-[#141218] border-b border-slate-100 dark:border-slate-800`}>
        <View style={tw`flex-row items-center flex-1 mr-3`}>
          <TouchableOpacity onPress={() => router.back()} style={tw`mr-3 p-2 -ml-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
            <ChevronLeft color={textSecondary} size={24} />
          </TouchableOpacity>
          <View>
            <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>Categories</Text>
            <Text style={[tw`text-xs`, { color: textSecondary }]}>
              {counts.all} categories configured
            </Text>
          </View>
        </View>

        {/* Action Header Buttons */}
        <View style={tw`flex-row items-center gap-2`}>
          <TouchableOpacity 
            onPress={handleRestoreDefaults}
            style={tw`p-2.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}
            accessibilityLabel="Restore default categories"
          >
            <RotateCcw size={16} color={textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleOpenAdd}
            style={[tw`flex-row items-center px-4 py-2 rounded-full shadow-sm`, { backgroundColor: accentColor }]}
          >
            <Plus color={textOnAccent} size={18} style={tw`mr-1.5`} />
            <Text style={[tw`font-bold text-xs`, { color: textOnAccent }]}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Type Filter Tabs */}
      <View style={tw`px-6 pt-4 pb-2`}>
        <View style={tw`flex-row bg-[#F4EFF4] dark:bg-[#2B2930] p-1 rounded-2xl`}>
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'expense', label: 'Expenses', count: counts.expense },
            { key: 'income', label: 'Income', count: counts.income },
            { key: 'loan', label: 'Loans', count: counts.loan }
          ].map(tab => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as FilterTab)}
                style={[
                  tw`flex-1 py-2 rounded-xl items-center flex-row justify-center`,
                  isSelected 
                    ? [{ backgroundColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.2, shadowRadius: 4 }]
                    : tw`bg-transparent`
                ]}
              >
                <Text style={[
                  tw`font-bold text-xs`,
                  { color: isSelected ? textOnAccent : textSecondary }
                ]}>
                  {tab.label}
                </Text>
                <View style={[
                  tw`ml-1 px-1.5 py-0.2 rounded-full`,
                  isSelected ? { backgroundColor: 'rgba(255,255,255,0.25)' } : tw`bg-black/5 dark:bg-white/10`
                ]}>
                  <Text style={[
                    tw`text-[10px] font-bold`,
                    { color: isSelected ? textOnAccent : textMuted }
                  ]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Categories List View */}
      <ScrollView showsVerticalScrollIndicator={false} style={tw`flex-1 px-6 pt-2`} contentContainerStyle={tw`pb-20`}>
        {filteredCategories.length === 0 ? (
          <View style={tw`items-center justify-center py-20`}>
            <View style={tw`w-16 h-16 rounded-full bg-[#F3EDF7] dark:bg-[#211F26] items-center justify-center mb-3`}>
              <Tag size={32} color={textMuted} style={tw`opacity-40`} />
            </View>
            <Text style={[tw`text-base font-bold mb-1`, { color: textPrimary }]}>
              No {activeTab !== 'all' ? activeTab : ''} categories yet
            </Text>
            <Text style={[tw`text-xs text-center mb-5`, { color: textSecondary }]}>
              Create custom categories to organize your financial transactions.
            </Text>
            <View style={tw`flex-row items-center gap-3`}>
              <TouchableOpacity
                onPress={handleOpenAdd}
                style={[tw`flex-row items-center px-4 py-2.5 rounded-2xl shadow-sm`, { backgroundColor: accentColor }]}
              >
                <Plus color={textOnAccent} size={16} style={tw`mr-1.5`} />
                <Text style={[tw`font-bold text-xs`, { color: textOnAccent }]}>Add Custom</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRestoreDefaults}
                style={tw`flex-row items-center px-4 py-2.5 rounded-2xl bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200/60 dark:border-slate-700/60`}
              >
                <RotateCcw color={textSecondary} size={16} style={tw`mr-1.5`} />
                <Text style={[tw`font-bold text-xs`, { color: textSecondary }]}>Restore Built-in</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={tw`bg-[#F4EFF4] dark:bg-[#49454F] rounded-3xl p-2 mb-6 border border-slate-100 dark:border-slate-800`}>
            {filteredCategories.map((cat, index) => {
              const IconComp = IconMap[cat.icon] || Tag;
              const isLast = index === filteredCategories.length - 1;

              return (
                <View 
                  key={cat.id} 
                  style={[
                    tw`flex-row items-center justify-between p-3.5`,
                    !isLast && tw`border-b border-slate-200/60 dark:border-slate-700/60`
                  ]}
                >
                  <View style={tw`flex-row items-center flex-1 mr-2`}>
                    {/* Category Icon Badge */}
                    <View style={[
                      tw`w-11 h-11 rounded-2xl items-center justify-center mr-3.5 shadow-sm`, 
                      { backgroundColor: `${cat.color}20` }
                    ]}>
                      <IconComp size={20} color={cat.color} />
                    </View>

                    {/* Category Info */}
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-base font-bold tracking-tight`, { color: textPrimary }]} numberOfLines={1}>
                        {cat.name}
                      </Text>
                      <View style={tw`flex-row items-center mt-1`}>
                        <View style={[
                          tw`px-2 py-0.5 rounded-full flex-row items-center`,
                          cat.type === 'expense' 
                            ? tw`bg-rose-100 dark:bg-rose-500/15`
                            : cat.type === 'income'
                            ? tw`bg-emerald-100 dark:bg-emerald-500/15`
                            : tw`bg-amber-100 dark:bg-amber-500/15`
                        ]}>
                          {cat.type === 'expense' && <TrendingDown size={10} color="#f43f5e" style={tw`mr-1`} />}
                          {cat.type === 'income' && <TrendingUp size={10} color="#10b981" style={tw`mr-1`} />}
                          {cat.type === 'loan' && <Landmark size={10} color="#f59e0b" style={tw`mr-1`} />}
                          <Text style={[
                            tw`text-[10px] font-black uppercase tracking-wider`,
                            cat.type === 'expense' 
                              ? tw`text-rose-600 dark:text-rose-400`
                              : cat.type === 'income'
                              ? tw`text-emerald-600 dark:text-emerald-400`
                              : tw`text-amber-600 dark:text-amber-400`
                          ]}>
                            {cat.type}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={tw`flex-row items-center gap-1.5`}>
                    <TouchableOpacity 
                      onPress={() => handleOpenEdit(cat)} 
                      style={tw`p-2.5 bg-[#F3EDF7] dark:bg-[#211F26] rounded-xl`}
                    >
                      <Edit2 size={16} color={textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(cat)} 
                      style={tw`p-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl`}
                    >
                      <Trash2 size={16} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Slide-Up Modal: Add & Edit Category */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-[#FEF7FF] dark:bg-[#141218] rounded-t-3xl max-h-[90%] p-6`}>
            
            {/* Modal Header */}
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <View>
                <Text style={[tw`text-xl font-black`, { color: textPrimary }]}>
                  {editingId ? 'Edit Category' : 'New Category'}
                </Text>
                <Text style={[tw`text-xs`, { color: textSecondary }]}>
                  {editingId ? 'Update details below' : 'Add custom category for tracking'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseModal} style={tw`p-2 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full`}>
                <X size={18} color={textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              {/* Live Preview Chip */}
              <View style={tw`items-center justify-center my-3`}>
                <View style={[
                  tw`flex-row items-center px-4 py-2.5 rounded-2xl shadow-sm`,
                  { backgroundColor: `${color}18`, borderColor: `${color}40`, borderWidth: 1.5 }
                ]}>
                  <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-2.5`, { backgroundColor: color }]}>
                    <PreviewIcon size={16} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={[tw`font-bold text-sm`, { color: textPrimary }]}>
                      {name.trim() || 'Category Name'}
                    </Text>
                    <Text style={[tw`text-[10px] font-bold uppercase tracking-wider`, { color: color }]}>
                      {type} Preview
                    </Text>
                  </View>
                </View>
              </View>

              {/* Type Switcher */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Category Type
              </Text>
              <View style={tw`flex-row bg-[#F3EDF7] dark:bg-[#211F26] rounded-2xl p-1 mb-4 border border-slate-200/50 dark:border-slate-800`}>
                <TouchableOpacity 
                  onPress={() => handleTypeChange('expense')} 
                  style={[
                    tw`flex-1 py-2.5 rounded-xl items-center flex-row justify-center`,
                    type === 'expense' ? tw`bg-rose-500 shadow-sm` : tw`bg-transparent`
                  ]}
                >
                  <TrendingDown size={14} color={type === 'expense' ? '#fff' : textSecondary} style={tw`mr-1`} />
                  <Text style={[tw`font-bold text-xs`, { color: type === 'expense' ? '#fff' : textSecondary }]}>
                    Expense
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => handleTypeChange('income')} 
                  style={[
                    tw`flex-1 py-2.5 rounded-xl items-center flex-row justify-center`,
                    type === 'income' ? tw`bg-emerald-500 shadow-sm` : tw`bg-transparent`
                  ]}
                >
                  <TrendingUp size={14} color={type === 'income' ? '#fff' : textSecondary} style={tw`mr-1`} />
                  <Text style={[tw`font-bold text-xs`, { color: type === 'income' ? '#fff' : textSecondary }]}>
                    Income
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => handleTypeChange('loan')} 
                  style={[
                    tw`flex-1 py-2.5 rounded-xl items-center flex-row justify-center`,
                    type === 'loan' ? tw`bg-amber-500 shadow-sm` : tw`bg-transparent`
                  ]}
                >
                  <Landmark size={14} color={type === 'loan' ? '#fff' : textSecondary} style={tw`mr-1`} />
                  <Text style={[tw`font-bold text-xs`, { color: type === 'loan' ? '#fff' : textSecondary }]}>
                    Loan
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Category Name Input */}
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Category Name
              </Text>
              <TextInput
                style={[
                  tw`bg-[#F3EDF7] dark:bg-[#211F26] border border-slate-200 dark:border-slate-800 px-4 py-3.5 rounded-2xl text-base font-bold mb-4`,
                  { color: textPrimary }
                ]}
                placeholder={type === 'expense' ? 'e.g. Groceries, Coffee' : type === 'income' ? 'e.g. Salary, Side Hustle' : 'e.g. GLoan, Credit Repayment'}
                value={name}
                onChangeText={setName}
                placeholderTextColor={textMuted}
                autoFocus={false}
              />

              {/* Icon Selector */}
              <View style={tw`flex-row justify-between items-center mb-2`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: textMuted }]}>
                  Choose Icon
                </Text>
                <Text style={[tw`text-xs font-semibold capitalize`, { color: textSecondary }]}>
                  {icon}
                </Text>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={tw`flex-row gap-2.5 py-1 mb-4`}
              >
                {AVAILABLE_ICONS.map(i => {
                  const IconComp = IconMap[i];
                  const isSelected = icon === i;
                  return (
                    <TouchableOpacity 
                      key={i} 
                      onPress={() => setIcon(i)}
                      style={[
                        tw`w-12 h-12 rounded-2xl items-center justify-center border-2`,
                        isSelected 
                          ? [{ borderColor: accentColor, backgroundColor: `${accentColor}18` }] 
                          : tw`border-slate-200/60 dark:border-slate-800 bg-[#F3EDF7] dark:bg-[#211F26]`
                      ]}
                    >
                      <IconComp size={20} color={isSelected ? accentColor : textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Color Selector */}
              <View style={tw`flex-row justify-between items-center mb-2`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: textMuted }]}>
                  Choose Color
                </Text>
                <View style={tw`flex-row items-center`}>
                  <View style={[tw`w-3.5 h-3.5 rounded-full mr-1.5`, { backgroundColor: color }]} />
                  <Text style={[tw`text-xs font-semibold uppercase`, { color: textSecondary }]}>
                    {color}
                  </Text>
                </View>
              </View>

              <View style={tw`flex-row flex-wrap gap-3 mb-6`}>
                {AVAILABLE_COLORS.map(c => {
                  const isSelected = color === c;
                  return (
                    <TouchableOpacity 
                      key={c} 
                      onPress={() => setColor(c)}
                      style={[
                        tw`w-10 h-10 rounded-2xl items-center justify-center border-2`,
                        { 
                          backgroundColor: c, 
                          borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : 'transparent' 
                        }
                      ]}
                    >
                      {isSelected && (
                        <Check size={16} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Actions */}
              <View style={tw`gap-2.5 pb-4`}>
                <TouchableOpacity 
                  onPress={handleSave} 
                  style={[tw`py-4 rounded-2xl items-center shadow-lg`, { backgroundColor: accentColor }]}
                >
                  <Text style={[tw`font-bold text-base`, { color: textOnAccent }]}>
                    {editingId ? 'Save Changes' : 'Create Category'}
                  </Text>
                </TouchableOpacity>

                {editingId && (
                  <TouchableOpacity 
                    onPress={() => {
                      const target = categories.find(c => c.id === editingId);
                      if (target) handleDelete(target);
                    }} 
                    style={tw`py-3.5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl items-center border border-rose-200 dark:border-rose-500/20`}
                  >
                    <Text style={tw`text-rose-500 font-bold text-sm`}>Delete Category</Text>
                  </TouchableOpacity>
                )}
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
