import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;
let isWebFallback = false;

const mockDb = {
  categories: [
    { id: 1, name: 'Salary', icon: 'wallet', color: '#10b981', type: 'income' },
    { id: 2, name: 'Food', icon: 'coffee', color: '#f97316', type: 'expense' },
    { id: 3, name: 'Transport', icon: 'train', color: '#3b82f6', type: 'expense' },
    { id: 4, name: 'Shopping', icon: 'shopping-cart', color: '#8b5cf6', type: 'expense' }
  ],
  accounts: [
    { id: 1, name: 'Cash', type: 'cash', balance: 0, currency: 'PHP' },
    { id: 2, name: 'Main Bank', type: 'bank', balance: 0, currency: 'PHP' }
  ],
  transactions: []
};

export const getDB = (): SQLite.SQLiteDatabase | any => {
  if (Platform.OS === 'web' || isWebFallback) {
    try {
      if (!db) {
        db = SQLite.openDatabaseSync('finance_manager.db');
        initDatabase(db);
      }
      return db;
    } catch (e) {
      console.warn("SQLite WASM failed to load on web (likely missing CORS headers). Falling back to mock DB.");
      isWebFallback = true;
      return createMockDB();
    }
  }

  if (!db) {
    db = SQLite.openDatabaseSync('finance_manager.db');
    initDatabase(db);
  }
  return db;
};

const createMockDB = () => {
  return {
    execSync: () => {},
    runSync: (query: string, params: any[]) => {
      if (query.includes('INSERT INTO transactions')) {
        const tx = { id: Date.now(), title: params[0], amount: params[1], type: params[2], date: params[3], category: params[4], account_id: params[5] };
        mockDb.transactions.unshift(tx);
      } else if (query.includes('UPDATE accounts')) {
        const acc = mockDb.accounts.find(a => a.id === params[1]);
        if (acc) acc.balance += params[0];
      } else if (query.includes('INSERT INTO categories')) {
        mockDb.categories.push({ id: Date.now(), name: params[0], icon: params[1], color: params[2], type: params[3] });
      } else if (query.includes('UPDATE categories')) {
        const cat = mockDb.categories.find(c => c.id === params[4]);
        if (cat) { cat.name = params[0]; cat.icon = params[1]; cat.color = params[2]; cat.type = params[3]; }
      } else if (query.includes('DELETE FROM categories')) {
        mockDb.categories = mockDb.categories.filter(c => c.id !== params[0]);
      }
    },
    getFirstSync: (query: string) => {
      if (query.includes('SUM(balance)')) {
        return { balance: mockDb.accounts.reduce((sum, a) => sum + a.balance, 0) };
      }
      if (query.includes('COUNT(*)')) {
        if (query.includes('accounts')) return { count: mockDb.accounts.length };
        if (query.includes('transactions')) return { count: mockDb.transactions.length };
        if (query.includes('categories')) return { count: mockDb.categories.length };
      }
      return null;
    },
    getAllSync: (query: string) => {
      if (query.includes('transactions')) {
        return [...mockDb.transactions];
      }
      if (query.includes('categories')) {
        return [...mockDb.categories];
      }
      return [];
    }
  };
};

const initDatabase = (database: SQLite.SQLiteDatabase) => {
  if (isWebFallback) return;
  database.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'PHP'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT,
      account_id INTEGER NOT NULL,
      to_account_id INTEGER,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS split_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly'
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      deadline TEXT
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      due_date TEXT,
      is_completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      biometrics_enabled INTEGER DEFAULT 0
    );
  `);

  try {
    // Safely add column if the table already existed before this update
    database.runSync("ALTER TABLE user_profile ADD COLUMN biometrics_enabled INTEGER DEFAULT 0");
  } catch(e) {}

  const userCount = database.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM user_profile`);
  if (userCount && userCount.count === 0) {
    database.runSync(`INSERT INTO user_profile (id, name, email, biometrics_enabled) VALUES (1, ?, ?, 0)`, ['John Doe', 'john.doe@example.com']);
  }

  const accountsCount = database.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM accounts`);
  if (accountsCount && accountsCount.count === 0) {
    database.runSync(`INSERT INTO accounts (name, type, balance) VALUES (?, ?, ?)`, ['Cash', 'cash', 0]);
    database.runSync(`INSERT INTO accounts (name, type, balance) VALUES (?, ?, ?)`, ['Main Bank', 'bank', 0]);
  }

  const catCount = database.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM categories`);
  if (catCount && catCount.count === 0) {
    database.runSync(`INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)`, ['Salary', 'wallet', '#10b981', 'income']);
    database.runSync(`INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)`, ['Food', 'coffee', '#f97316', 'expense']);
    database.runSync(`INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)`, ['Transport', 'train', '#3b82f6', 'expense']);
    database.runSync(`INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)`, ['Shopping', 'shopping-cart', '#8b5cf6', 'expense']);
  }
};

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: string;
};

// --- USER PROFILE API ---
export type UserProfile = {
  name: string;
  email: string;
  biometrics_enabled: number;
};

export const getUserProfile = (): UserProfile => {
  const db = getDB();
  try {
    const row = db.getFirstSync<{name: string, email: string, biometrics_enabled: number}>('SELECT name, email, biometrics_enabled FROM user_profile WHERE id = 1');
    return row || { name: 'John Doe', email: 'john.doe@example.com', biometrics_enabled: 0 };
  } catch (e) {
    // Graceful recovery during hot reloads when the table wasn't created yet
    return { name: 'John Doe', email: 'john.doe@example.com', biometrics_enabled: 0 };
  }
};

export const updateUserProfile = (name: string, email: string) => {
  const db = getDB();
  db.runSync(
    'INSERT INTO user_profile (id, name, email, biometrics_enabled) VALUES (1, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email', 
    [name || 'User', email || '']
  );
};

export const updateBiometricsEnabled = (enabled: boolean) => {
  const db = getDB();
  db.runSync(
    'INSERT INTO user_profile (id, name, email, biometrics_enabled) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET biometrics_enabled=excluded.biometrics_enabled', 
    ['John Doe', 'john.doe@example.com', enabled ? 1 : 0]
  );
};

// Categories CRUD API
export const getCategories = (): Category[] => {
  const db = getDB();
  return db.getAllSync('SELECT * FROM categories ORDER BY name ASC');
};

export const addCategory = (name: string, icon: string, color: string, type: string) => {
  const db = getDB();
  db.runSync(`INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)`, [name, icon, color, type]);
};

export const updateCategory = (id: number, name: string, icon: string, color: string, type: string) => {
  const db = getDB();
  db.runSync(`UPDATE categories SET name = ?, icon = ?, color = ?, type = ? WHERE id = ?`, [name, icon, color, type, id]);
};

export const deleteCategory = (id: number) => {
  const db = getDB();
  db.runSync(`DELETE FROM categories WHERE id = ?`, [id]);
};

// --- TRANSACTIONS CRUD ---
export const deleteTransaction = (id: number) => {
  const db = getDB();
  const tx = db.getFirstSync<{ amount: number; account_id: number; type: string }>(
    `SELECT amount, account_id, type FROM transactions WHERE id = ?`, 
    [id]
  );
  
  if (tx) {
    // Reverse the transaction impact on the account balance
    // If expense (amount < 0), subtracting it adds it back to balance
    // If income (amount > 0), subtracting it removes it from balance
    db.runSync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [tx.amount, tx.account_id]);
    db.runSync(`DELETE FROM transactions WHERE id = ?`, [id]);
  }
};

export const updateTransaction = (id: number, title: string, amount: number, type: string, category: string, date: string) => {
  const db = getDB();
  const oldTx = db.getFirstSync<{ amount: number; account_id: number }>(
    `SELECT amount, account_id FROM transactions WHERE id = ?`, 
    [id]
  );

  if (oldTx) {
    const numAmount = amount * (type === 'expense' ? -1 : 1);
    const difference = numAmount - oldTx.amount;
    
    // Apply the difference to the account balance
    db.runSync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [difference, oldTx.account_id]);
    
    // Update transaction
    db.runSync(
      `UPDATE transactions SET title = ?, amount = ?, type = ?, category = ?, date = ? WHERE id = ?`,
      [title, numAmount, type, category, date, id]
    );
  }
};

// --- REMINDERS API ---
export type Reminder = {
  id: number;
  title: string;
  due_date: string | null;
  is_completed: number;
};

export const getReminders = (): Reminder[] => {
  const db = getDB();
  return db.getAllSync('SELECT * FROM reminders ORDER BY is_completed ASC, due_date ASC');
};

export const addReminder = (title: string, due_date: string | null) => {
  const db = getDB();
  db.runSync(`INSERT INTO reminders (title, due_date) VALUES (?, ?)`, [title, due_date]);
};

export const toggleReminder = (id: number, is_completed: number) => {
  const db = getDB();
  db.runSync(`UPDATE reminders SET is_completed = ? WHERE id = ?`, [is_completed, id]);
};

export const deleteReminder = (id: number) => {
  const db = getDB();
  db.runSync(`DELETE FROM reminders WHERE id = ?`, [id]);
};

// --- BUDGETS API ---
export type Budget = {
  id: number;
  category: string;
  amount: number;
  period: string;
};

export const getBudgets = (): Budget[] => {
  const dbInstance = getDB();
  return dbInstance.getAllSync('SELECT * FROM budgets');
};

export const saveBudget = (category: string, amount: number): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET amount=excluded.amount',
    [category, amount]
  );
};

// --- GOALS API ---
export type Goal = {
  id: number;
  title: string;
  target_amount: number;
  current_amount: number;
  color: string;
  icon: string;
  deadline?: string;
};

export const getGoals = (): Goal[] => {
  const dbInstance = getDB();
  return dbInstance.getAllSync('SELECT * FROM goals');
};

export const addGoal = (title: string, target_amount: number, color: string, icon: string, deadline?: string): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'INSERT INTO goals (title, target_amount, color, icon, deadline) VALUES (?, ?, ?, ?, ?)',
    [title, target_amount, color, icon, deadline || null]
  );
};

export const addToGoal = (id: number, amount: number): void => {
  const dbInstance = getDB();
  dbInstance.runSync('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?', [amount, id]);
};

export const exportBackupJSON = (): string => {
  const dbInstance = getDB();
  
  const safeGet = (query: string) => {
    try { return dbInstance.getAllSync(query); } 
    catch (e) { return []; }
  };

  const backup = {
    version: 1,
    timestamp: new Date().toISOString(),
    data: {
      accounts: safeGet('SELECT * FROM accounts'),
      categories: safeGet('SELECT * FROM categories'),
      transactions: safeGet('SELECT * FROM transactions'),
      splitTransactions: safeGet('SELECT * FROM split_transactions'),
      budgets: safeGet('SELECT * FROM budgets'),
      goals: safeGet('SELECT * FROM goals')
    }
  };
  return JSON.stringify(backup);
};

export const importBackupJSON = (jsonString: string): void => {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.data) throw new Error("Invalid backup format");
    
    const { accounts, categories, transactions, splitTransactions, budgets, goals } = backup.data;
    
    const dbInstance = getDB();
    dbInstance.execSync('PRAGMA foreign_keys = OFF;');
    
    // Clear existing data
    dbInstance.runSync('DELETE FROM split_transactions');
    dbInstance.runSync('DELETE FROM transactions');
    dbInstance.runSync('DELETE FROM categories');
    dbInstance.runSync('DELETE FROM accounts');
    dbInstance.runSync('DELETE FROM budgets');
    dbInstance.runSync('DELETE FROM goals');
    
    // Restore Accounts
    if (accounts && Array.isArray(accounts)) {
      accounts.forEach((acc: any) => {
        dbInstance.runSync(
          'INSERT INTO accounts (id, name, type, balance, currency) VALUES (?, ?, ?, ?, ?)',
          [acc.id, acc.name, acc.type, acc.balance, acc.currency]
        );
      });
    }
    
    // Restore Categories
    if (categories && Array.isArray(categories)) {
      categories.forEach((cat: any) => {
        dbInstance.runSync(
          'INSERT INTO categories (id, name, icon, color, type) VALUES (?, ?, ?, ?, ?)',
          [cat.id, cat.name, cat.icon, cat.color, cat.type]
        );
      });
    }
    
    // Restore Transactions
    if (transactions && Array.isArray(transactions)) {
      transactions.forEach((tx: any) => {
        const accId = tx.account_id || tx.accountId || 1; // Fallback to Cash account if missing
        const toAccId = tx.to_account_id || tx.toAccountId || null;
        dbInstance.runSync(
          'INSERT INTO transactions (id, account_id, to_account_id, title, amount, type, date, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [tx.id, accId, toAccId, tx.title, tx.amount, tx.type, tx.date, tx.category]
        );
      });
    }
    
    // Restore Split Transactions
    if (splitTransactions && Array.isArray(splitTransactions)) {
      splitTransactions.forEach((stx: any) => {
        const tId = stx.transaction_id || stx.transactionId;
        if (!tId) return; // Skip malformed split transactions missing their parent ID
        dbInstance.runSync(
          'INSERT INTO split_transactions (id, transaction_id, category, amount) VALUES (?, ?, ?, ?)',
          [stx.id, tId, stx.category, stx.amount || 0]
        );
      });
    }

    // Restore Budgets
    if (budgets && Array.isArray(budgets)) {
      budgets.forEach((b: any) => {
        dbInstance.runSync(
          'INSERT INTO budgets (id, category, amount, period) VALUES (?, ?, ?, ?)',
          [b.id, b.category, b.amount, b.period]
        );
      });
    }

    // Restore Goals
    if (goals && Array.isArray(goals)) {
      goals.forEach((g: any) => {
        dbInstance.runSync(
          'INSERT INTO goals (id, title, target_amount, current_amount, color, icon, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [g.id, g.title, g.target_amount, g.current_amount, g.color, g.icon, g.deadline]
        );
      });
    }

    // Re-enable foreign keys
    dbInstance.execSync('PRAGMA foreign_keys = ON;');
  } catch (error) {
    console.error("Failed to import backup:", error);
    throw error;
  }
};

export const seedMockDataIfNeeded = () => {
  // Purposefully leaving this empty to prevent pre-built balances and transactions 
  // from appearing when the user wipes data or starts fresh.
};
