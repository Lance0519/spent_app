import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Trash2, Plus, Edit2, Check, ShoppingBag } from 'lucide-react-native';
import tw from 'twrnc';
import { ReceiptItem } from '../utils/ReceiptParser';
import { useTheme } from '../context/ThemeContext';

interface Props {
  items: ReceiptItem[];
  onUpdateItems: (items: ReceiptItem[]) => void;
  billTotal?: number;
}

export const ReceiptBreakdownList: React.FC<Props> = ({
  items,
  onUpdateItems,
  billTotal,
}) => {
  const { accentColor, textPrimary, textSecondary, textMuted, textOnAccent, currencySymbol } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Single Source of Truth: Dynamically derive total price using reduce
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [items]);

  const targetTotal = billTotal !== undefined ? billTotal : itemsTotal;
  const isSumMatching = Math.abs(itemsTotal - targetTotal) < 0.05;

  const handleStartEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditDesc(item.description);
    setEditPrice(item.price.toFixed(2));
  };

  /**
   * Immutable update handler using map:
   * Returns a new array with the target item updated, triggering a React state update.
   */
  const handleSaveEdit = (id: string) => {
    if (!editDesc.trim()) {
      Alert.alert('Invalid Item', 'Item description cannot be empty.');
      return;
    }
    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid numeric price.');
      return;
    }

    // Immutable update using .map()
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, description: editDesc.trim(), price: parsedPrice };
      }
      return item;
    });

    onUpdateItems(updated);
    setEditingId(null);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    onUpdateItems(updated);
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: 'New Item',
      price: 0.00,
    };
    const updated = [...items, newItem];
    onUpdateItems(updated);
    handleStartEdit(newItem);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={tw`mt-4 mb-4 bg-[#F4EFF4] dark:bg-[#211F26] rounded-2xl p-4 border border-slate-200 dark:border-slate-800`}>
      {/* Header */}
      <View style={tw`flex-row items-center justify-between mb-3 pb-2.5 border-b border-slate-200 dark:border-slate-800`}>
        <View style={tw`flex-row items-center`}>
          <View style={[tw`w-7 h-7 rounded-full items-center justify-center mr-2`, { backgroundColor: `${accentColor}20` }]}>
            <ShoppingBag size={14} color={accentColor} />
          </View>
          <Text style={[tw`text-sm font-black`, { color: textPrimary }]}>
            Itemized Breakdown ({items.length})
          </Text>
        </View>

        <TouchableOpacity 
          onPress={handleAddItem}
          style={[tw`flex-row items-center px-2.5 py-1 rounded-full`, { backgroundColor: `${accentColor}20` }]}
        >
          <Plus size={13} color={accentColor} style={tw`mr-1`} />
          <Text style={[tw`text-xs font-bold`, { color: accentColor }]}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Item List */}
      <View style={tw`gap-2`}>
        {items.map((item, index) => {
          const isEditing = editingId === item.id;

          if (isEditing) {
            return (
              <View 
                key={item.id} 
                style={tw`p-3 bg-white dark:bg-[#2B2930] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm`}
              >
                <Text style={[tw`text-[11px] font-bold uppercase mb-1`, { color: textMuted }]}>
                  Edit Item #{index + 1}
                </Text>
                <View style={tw`flex-row gap-2 mb-2`}>
                  <TextInput
                    style={[
                      tw`flex-2 bg-[#F3EDF7] dark:bg-[#211F26] px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800`,
                      { color: textPrimary }
                    ]}
                    value={editDesc}
                    onChangeText={setEditDesc}
                    placeholder="Item description"
                    placeholderTextColor={textMuted}
                  />
                  <TextInput
                    style={[
                      tw`flex-1 bg-[#F3EDF7] dark:bg-[#211F26] px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800`,
                      { color: textPrimary }
                    ]}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="0.00"
                    placeholderTextColor={textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={tw`flex-row justify-end gap-2`}>
                  <TouchableOpacity 
                    onPress={() => setEditingId(null)}
                    style={tw`px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800`}
                  >
                    <Text style={[tw`text-xs font-bold`, { color: textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleSaveEdit(item.id)}
                    style={[tw`flex-row items-center px-3 py-1.5 rounded-lg`, { backgroundColor: accentColor }]}
                  >
                    <Check size={12} color={textOnAccent} style={tw`mr-1`} />
                    <Text style={[tw`text-xs font-bold`, { color: textOnAccent }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          return (
            <View
              key={item.id}
              style={tw`flex-row items-center justify-between p-2.5 bg-white dark:bg-[#2B2930] rounded-xl border border-slate-100 dark:border-slate-800/80`}
            >
              <View style={tw`flex-1 mr-2`}>
                <Text style={[tw`text-xs font-bold`, { color: textPrimary }]} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>

              <View style={tw`flex-row items-center gap-2`}>
                <Text style={[tw`text-xs font-black mr-1`, { color: textPrimary }]}>
                  {currencySymbol}{item.price.toFixed(2)}
                </Text>

                <TouchableOpacity 
                  onPress={() => handleStartEdit(item)}
                  style={tw`w-7 h-7 bg-[#F3EDF7] dark:bg-[#211F26] rounded-full items-center justify-center`}
                >
                  <Edit2 size={12} color={textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => handleDeleteItem(item.id)}
                  style={tw`w-7 h-7 bg-rose-50 dark:bg-rose-500/10 rounded-full items-center justify-center`}
                >
                  <Trash2 size={12} color="#f43f5e" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Comparison & Real-Time Total Footer */}
      <View style={tw`mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex-row items-center justify-between`}>
        <View>
          <Text style={[tw`text-[11px] font-semibold`, { color: textMuted }]}>
            Breakdown Total: <Text style={[tw`font-bold`, { color: textPrimary }]}>{currencySymbol}{itemsTotal.toFixed(2)}</Text>
          </Text>
        </View>

        <View style={[
          tw`px-2 py-0.5 rounded-md`,
          isSumMatching ? tw`bg-emerald-50 dark:bg-emerald-500/10` : tw`bg-amber-50 dark:bg-amber-500/10`
        ]}>
          <Text style={[
            tw`text-[11px] font-bold`,
            isSumMatching ? tw`text-emerald-600 dark:text-emerald-400` : tw`text-amber-600 dark:text-amber-400`
          ]}>
            {isSumMatching ? 'Live Total Synced' : `Diff: ${currencySymbol}${Math.abs(itemsTotal - targetTotal).toFixed(2)}`}
          </Text>
        </View>
      </View>
    </View>
  );
};
