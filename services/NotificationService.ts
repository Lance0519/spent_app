import { Alert, Platform } from 'react-native';

export const setupNotificationHandler = () => {
  // Fallback: expo-notifications removed from Android Expo Go SDK 53+
  // We will simulate notifications using UI alerts where possible.
  console.log('Notification handler initialized (Fallback mode).');
};

export const registerForPushNotificationsAsync = async () => {
  console.log('Push notifications disabled in Expo Go Android SDK 53+. Using fallback mode.');
  return null;
};

export const scheduleDailyReminder = async (enabled: boolean) => {
  if (enabled) {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Reminders Enabled (Simulated)', 
        'Since you are using Expo Go on SDK 53+, background push notifications are disabled. However, in a full production build, you would receive a daily reminder at 8:00 PM.'
      );
    }
  }
};

export const checkAndTriggerBudgetWarning = async (category: string, spent: number, limit: number) => {
  if (limit <= 0) return;
  
  const percentage = spent / limit;
  
  if (percentage >= 1) {
    if (Platform.OS !== 'web') {
      Alert.alert(
        `Budget Exceeded: ${category}`,
        `You have spent ₱${spent.toLocaleString()} and exceeded your ₱${limit.toLocaleString()} limit for ${category}.`
      );
    } else {
      window.alert(`Budget Exceeded: ${category}\nYou have spent ₱${spent} and exceeded your ₱${limit} limit.`);
    }
  } else if (percentage >= 0.90) {
    if (Platform.OS !== 'web') {
      Alert.alert(
        `Budget Warning: ${category}`,
        `You have used ${(percentage * 100).toFixed(0)}% of your ₱${limit.toLocaleString()} limit for ${category}.`
      );
    } else {
      window.alert(`Budget Warning: ${category}\nYou have used ${(percentage * 100).toFixed(0)}% of your limit.`);
    }
  }
};
