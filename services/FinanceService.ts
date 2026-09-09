import {
  getDB,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  transferFunds,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getSplitTransactions,
  getMonthlySummary,
  getBudgets,
  saveBudget,
  updateBudget,
  deleteBudget,
  getGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
  getReminders,
  addReminder,
  toggleReminder,
  deleteReminder,
  getUserProfile,
  updateUserProfile,
  updateBiometricsEnabled,
  getSessionStatus,
  startUserSession,
  terminateUserSession,
  completeOnboarding,
  exportBackupJSON,
  importBackupJSON,
  exportTransactionsCSV,
  Account,
  Category,
  Budget,
  Goal,
  Reminder,
  UserProfile,
  MonthlySummary
} from '../db/database';

export const FinanceService = {
  // Accounts
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  transferFunds,

  // Categories
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,

  // Transactions
  getTransactions: (options?: { limit?: number; type?: string; category?: string; search?: string }) => {
    const db = getDB();
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (options?.type && options.type !== 'all') {
      query += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }
    if (options?.search && options.search.trim()) {
      query += ' AND (LOWER(title) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))';
      params.push(`%${options.search.trim()}%`, `%${options.search.trim()}%`);
    }

    query += ' ORDER BY date DESC';
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    return db.getAllSync(query, params) as any[];
  },
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getSplitTransactions,
  getMonthlySummary,

  // Budgets
  getBudgets,
  saveBudget,
  updateBudget,
  deleteBudget,

  // Goals
  getGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,

  // Reminders
  getReminders,
  addReminder,
  toggleReminder,
  deleteReminder,

  // User Profile & Session
  getUserProfile,
  updateUserProfile,
  updateBiometricsEnabled,
  getSessionStatus,
  startUserSession,
  terminateUserSession,
  completeOnboarding,

  // Portability
  exportBackupJSON,
  importBackupJSON,
  exportTransactionsCSV,
};

export type {
  Account,
  Category,
  Budget,
  Goal,
  Reminder,
  UserProfile,
  MonthlySummary
};
