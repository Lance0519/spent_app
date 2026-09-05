import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;
let isWebFallback = false;

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: string;
};

export const DEFAULT_BUILTIN_CATEGORIES: Omit<Category, 'id'>[] = [
  // Expense categories
  { name: 'Food', icon: 'coffee', color: '#f97316', type: 'expense' },
  { name: 'Groceries', icon: 'shopping-cart', color: '#ea580c', type: 'expense' },
  { name: 'Transport', icon: 'train', color: '#3b82f6', type: 'expense' },
  { name: 'Fuel', icon: 'fuel', color: '#0284c7', type: 'expense' },
  { name: 'Bills & Utilities', icon: 'zap', color: '#ef4444', type: 'expense' },
  { name: 'Housing & Rent', icon: 'home', color: '#8b5cf6', type: 'expense' },
  { name: 'Healthcare', icon: 'heart-pulse', color: '#e11d48', type: 'expense' },
  { name: 'Shopping', icon: 'package', color: '#ec4899', type: 'expense' },
  { name: 'Entertainment', icon: 'gamepad-2', color: '#a855f7', type: 'expense' },
  { name: 'Education', icon: 'graduation-cap', color: '#06b6d4', type: 'expense' },
  { name: 'Travel', icon: 'plane', color: '#0ea5e9', type: 'expense' },
  { name: 'Personal Care', icon: 'scissors', color: '#d946ef', type: 'expense' },
  { name: 'Fitness', icon: 'dumbbell', color: '#10b981', type: 'expense' },
  { name: 'Insurance', icon: 'shield', color: '#64748b', type: 'expense' },
  { name: 'Gifts & Donations', icon: 'gift', color: '#f43f5e', type: 'expense' },

  // Income categories
  { name: 'Salary', icon: 'wallet', color: '#10b981', type: 'income' },
  { name: 'Allowance', icon: 'gift', color: '#06b6d4', type: 'income' },
  { name: 'Freelance', icon: 'laptop', color: '#3b82f6', type: 'income' },
  { name: 'Bonus', icon: 'trending-up', color: '#8b5cf6', type: 'income' },
  { name: 'Business', icon: 'briefcase', color: '#6366f1', type: 'income' },
  { name: 'Investments', icon: 'trending-up', color: '#059669', type: 'income' },
  { name: 'Rental Income', icon: 'home', color: '#14b8a6', type: 'income' },
  { name: 'Other Income', icon: 'dollar-sign', color: '#84cc16', type: 'income' },

  // Loan categories
  { name: 'SPayLater', icon: 'shopping-cart', color: '#f97316', type: 'loan' },
  { name: 'GLoan / Maya', icon: 'smartphone', color: '#06b6d4', type: 'loan' },
  { name: 'Credit Card', icon: 'credit-card', color: '#ec4899', type: 'loan' },
  { name: 'Bank Loan', icon: 'landmark', color: '#3b82f6', type: 'loan' },
  { name: 'Personal Loan', icon: 'briefcase', color: '#8b5cf6', type: 'loan' },
  { name: 'Borrowed', icon: 'piggy-bank', color: '#eab308', type: 'loan' },
  { name: 'Lent', icon: 'dollar-sign', color: '#10b981', type: 'loan' },
  { name: 'Debt Repayment', icon: 'wallet', color: '#22c55e', type: 'loan' },
];

const mockDb = {
  categories: DEFAULT_BUILTIN_CATEGORIES.map((c, idx) => ({ id: idx + 1, ...c })) as Category[],
  accounts: [
    { id: 1, name: 'Cash', type: 'cash', balance: 0, currency: 'PHP' },
    { id: 2, name: 'Main Bank', type: 'bank', balance: 0, currency: 'PHP' },
    { id: 3, name: 'GCash', type: 'ewallet', balance: 0, currency: 'PHP' },
    { id: 4, name: 'SPayLater', type: 'credit', balance: 0, currency: 'PHP' }
  ],
  transactions: [] as any[],
  budgets: [] as any[],
  goals: [] as any[],
  reminders: [] as any[],
  profile: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    biometrics_enabled: 0,
    accent_color: 'emerald',
    currency: 'PHP',
    hide_balance_default: 0
  }
};

export const getDB = (): SQLite.SQLiteDatabase => {
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
      return createMockDB() as unknown as SQLite.SQLiteDatabase;
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
    execSync: (query: string = '') => {
      if (query.includes('DELETE FROM split_transactions') || query.includes('DELETE FROM transactions')) {
        mockDb.transactions = [];
      }
      if (query.includes('DELETE FROM budgets')) {
        mockDb.budgets = [];
      }
      if (query.includes('DELETE FROM goals')) {
        mockDb.goals = [];
      }
      if (query.includes('DELETE FROM reminders')) {
        mockDb.reminders = [];
      }
      if (query.includes('UPDATE accounts SET balance = 0')) {
        mockDb.accounts.forEach(a => { a.balance = 0; });
      }
      // Categories are intentionally preserved during wipe!
    },
    runSync: (query: string, params: any[] = []) => {
      if (query.includes('INSERT INTO transactions')) {
        const tx = { 
          id: Date.now(), 
          title: params[0], 
          amount: params[1], 
          type: params[2], 
          date: params[3], 
          category: params[4], 
          account_id: params[5] || 1,
          due_date: params[6] || null
        };
        mockDb.transactions.unshift(tx);
      } else if (query.includes('UPDATE transactions')) {
        const id = params[params.length - 1];
        const tx = mockDb.transactions.find(t => t.id === id);
        if (tx) {
          tx.title = params[0];
          tx.amount = params[1];
          tx.type = params[2];
          tx.category = params[3];
          tx.date = params[4];
          tx.account_id = params[5] || tx.account_id;
          tx.due_date = params[6] || null;
        }
      } else if (query.includes('DELETE FROM transactions')) {
        mockDb.transactions = mockDb.transactions.filter(t => t.id !== params[0]);
      } else if (query.includes('UPDATE accounts')) {
        const acc = mockDb.accounts.find(a => a.id === params[1]);
        if (acc) acc.balance += params[0];
      } else if (query.includes('INSERT INTO accounts')) {
        mockDb.accounts.push({ id: Date.now(), name: params[0], type: params[1], balance: params[2] || 0, currency: params[3] || 'PHP' });
      } else if (query.includes('INSERT INTO categories')) {
        mockDb.categories.push({ id: Date.now(), name: params[0], icon: params[1], color: params[2], type: params[3] });
      } else if (query.includes('UPDATE categories')) {
        const cat = mockDb.categories.find(c => c.id === params[4]);
        if (cat) { cat.name = params[0]; cat.icon = params[1]; cat.color = params[2]; cat.type = params[3]; }
      } else if (query.includes('DELETE FROM categories')) {
        mockDb.categories = mockDb.categories.filter(c => c.id !== params[0]);
      } else if (query.includes('INSERT INTO budgets')) {
        const existing = mockDb.budgets.find(b => b.category === params[0]);
        if (existing) {
          existing.amount = params[1];
        } else {
          mockDb.budgets.push({ id: Date.now(), category: params[0], amount: params[1], period: 'monthly' });
        }
      } else if (query.includes('UPDATE budgets')) {
        const id = params[params.length - 1];
        const b = mockDb.budgets.find(item => item.id === id);
        if (b) { b.category = params[0]; b.amount = params[1]; b.period = params[2] || 'monthly'; }
      } else if (query.includes('DELETE FROM budgets')) {
        mockDb.budgets = mockDb.budgets.filter(b => b.id !== params[0]);
      } else if (query.includes('INSERT INTO goals')) {
        mockDb.goals.push({ id: Date.now(), title: params[0], target_amount: params[1], current_amount: 0, color: params[2], icon: params[3], deadline: params[4] || null });
      } else if (query.includes('UPDATE goals SET current_amount')) {
        const g = mockDb.goals.find(item => item.id === params[1]);
        if (g) g.current_amount += params[0];
      } else if (query.includes('DELETE FROM goals')) {
        mockDb.goals = mockDb.goals.filter(g => g.id !== params[0]);
      } else if (query.includes('UPDATE user_profile SET accent_color')) {
        mockDb.profile.accent_color = params[0];
      } else if (query.includes('INSERT INTO user_profile') || query.includes('UPDATE user_profile')) {
        mockDb.profile.name = params[0];
        mockDb.profile.email = params[1];
        if (params[2] !== undefined) mockDb.profile.biometrics_enabled = params[2];
        if (params[3] !== undefined) mockDb.profile.accent_color = params[3];
        if (params[4] !== undefined) mockDb.profile.currency = params[4];
        if (params[5] !== undefined) mockDb.profile.hide_balance_default = params[5];
      } else if (query.includes('UPDATE accounts SET name')) {
        const id = params[4];
        const acc = mockDb.accounts.find(a => a.id === id);
        if (acc) { acc.name = params[0]; acc.type = params[1]; acc.balance = params[2]; acc.currency = params[3]; }
      } else if (query.includes('DELETE FROM accounts')) {
        mockDb.accounts = mockDb.accounts.filter(a => a.id !== params[0]);
      }
    },
    getFirstSync: (query: string, params: any[] = []) => {
      if (query.includes('FROM user_profile')) {
        return { ...mockDb.profile };
      }
      if (query.includes('SUM(balance)')) {
        return { balance: mockDb.accounts.reduce((sum, a) => sum + a.balance, 0) };
      }
      if (query.includes('COUNT(*)')) {
        if (query.includes('accounts')) return { count: mockDb.accounts.length };
        if (query.includes('transactions')) return { count: mockDb.transactions.length };
        if (query.includes('categories')) return { count: mockDb.categories.length };
        if (query.includes('user_profile')) return { count: 1 };
      }
      if (query.includes('SELECT * FROM transactions WHERE id = ?') || query.includes('SELECT amount, account_id')) {
        return mockDb.transactions.find(t => t.id === params[0]) || null;
      }
      if (query.includes('SELECT amount FROM budgets WHERE category = ?')) {
        return mockDb.budgets.find(b => b.category === params[0]) || null;
      }
      if (query.includes('SELECT id FROM accounts WHERE LOWER(name) = LOWER(?)')) {
        return mockDb.accounts.find(a => a.name.toLowerCase() === (params[0] || '').toLowerCase()) || null;
      }
      if (query.includes('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)')) {
        return mockDb.categories.find(c => 
          c.name.toLowerCase() === (params[0] || '').toLowerCase() &&
          (params.length < 2 || !params[1] || c.type === params[1])
        ) || null;
      }
      return null;
    },
    getAllSync: (query: string, params: any[] = []) => {
      if (query.includes('transactions')) {
        if (query.includes('category = ?')) {
          return mockDb.transactions.filter(t => t.category === params[0]);
        }
        return [...mockDb.transactions];
      }
      if (query.includes('categories')) {
        return [...mockDb.categories];
      }
      if (query.includes('accounts')) {
        return [...mockDb.accounts];
      }
      if (query.includes('budgets')) {
        return [...mockDb.budgets];
      }
      if (query.includes('goals')) {
        return [...mockDb.goals];
      }
      if (query.includes('reminders')) {
        return [...mockDb.reminders];
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
      due_date TEXT,
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
      biometrics_enabled INTEGER DEFAULT 0,
      accent_color TEXT DEFAULT 'emerald',
      currency TEXT DEFAULT 'PHP',
      hide_balance_default INTEGER DEFAULT 0
    );
  `);

  try {
    // Safely add columns if the tables already existed
    database.runSync("ALTER TABLE user_profile ADD COLUMN biometrics_enabled INTEGER DEFAULT 0");
  } catch(e) {}

  try {
    database.runSync("ALTER TABLE user_profile ADD COLUMN accent_color TEXT DEFAULT 'emerald'");
  } catch(e) {}

  try {
    database.runSync("ALTER TABLE user_profile ADD COLUMN currency TEXT DEFAULT 'PHP'");
  } catch(e) {}

  try {
    database.runSync("ALTER TABLE user_profile ADD COLUMN hide_balance_default INTEGER DEFAULT 0");
  } catch(e) {}

  try {
    database.runSync("ALTER TABLE transactions ADD COLUMN due_date TEXT");
  } catch(e) {}

  const userCount = database.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM user_profile`);
  if (userCount && userCount.count === 0) {
    database.runSync(
      `INSERT INTO user_profile (id, name, email, biometrics_enabled, accent_color, currency, hide_balance_default) VALUES (1, ?, ?, 0, 'emerald', 'PHP', 0)`, 
      ['John Doe', 'john.doe@example.com']
    );
  }

  // Ensure Default Accounts
  const ensureAccount = (name: string, type: string) => {
    try {
      const exists = database.getFirstSync<{ id: number }>('SELECT id FROM accounts WHERE LOWER(name) = LOWER(?)', [name]);
      if (!exists) {
        database.runSync('INSERT INTO accounts (name, type, balance, currency) VALUES (?, ?, 0, "PHP")', [name, type]);
      }
    } catch(e) {}
  };
  ensureAccount('Cash', 'cash');
  ensureAccount('Main Bank', 'bank');
  ensureAccount('GCash', 'ewallet');
  ensureAccount('SPayLater', 'credit');

  // One-time seeding of built-in categories so users can delete any category
  // without it being resurrected on subsequent app launches
  try {
    database.runSync("ALTER TABLE user_profile ADD COLUMN categories_seeded INTEGER DEFAULT 0");
  } catch(e) {}

  const prof = database.getFirstSync<{ categories_seeded?: number }>('SELECT categories_seeded FROM user_profile WHERE id = 1');
  const catCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  const alreadySeeded = prof && prof.categories_seeded === 1;
  const isEmpty = !catCount || catCount.count === 0;

  if (!alreadySeeded || isEmpty) {
    seedDefaultCategories(database);
    try {
      database.runSync('UPDATE user_profile SET categories_seeded = 1 WHERE id = 1');
    } catch(e) {}
  }
};

export type Account = {
  id: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
};

export const getAccounts = (): Account[] => {
  const db = getDB();
  return db.getAllSync('SELECT * FROM accounts ORDER BY id ASC');
};

export const addAccount = (name: string, type: string, initialBalance: number = 0, currency: string = 'PHP') => {
  const db = getDB();
  db.runSync('INSERT INTO accounts (name, type, balance, currency) VALUES (?, ?, ?, ?)', [name, type, initialBalance, currency]);
};

export const updateAccount = (id: number, name: string, type: string, balance: number, currency: string = 'PHP') => {
  const db = getDB();
  db.runSync('UPDATE accounts SET name = ?, type = ?, balance = ?, currency = ? WHERE id = ?', [name, type, balance, currency, id]);
};

export const deleteAccount = (id: number) => {
  const db = getDB();
  db.runSync('DELETE FROM accounts WHERE id = ?', [id]);
};

export const transferFunds = (
  fromAccountId: number, 
  toAccountId: number, 
  amount: number, 
  notes?: string, 
  date?: string
) => {
  const db = getDB();
  const transferDate = date || new Date().toISOString().split('T')[0];
  const title = notes && notes.trim() ? `Transfer: ${notes.trim()}` : 'Account Transfer';
  
  // Deduct from source
  db.runSync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, fromAccountId]);
  // Add to destination
  db.runSync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toAccountId]);
  
  // Log transfer transaction for auditability
  db.runSync(
    'INSERT INTO transactions (title, amount, type, date, category, account_id, to_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, -amount, 'expense', transferDate, 'Transfer', fromAccountId, toAccountId]
  );
};

export const exportTransactionsCSV = (): string => {
  const db = getDB();
  const txs = db.getAllSync<any>(`
    SELECT t.id, t.date, t.title, t.type, t.category, t.amount, a.name as account_name, t.due_date
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    ORDER BY t.date DESC
  `);
  
  const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Account', 'Amount', 'Due Date'];
  const rows = (txs || []).map((t: any) => [
    t.id,
    `"${t.date || ''}"`,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    t.type || '',
    `"${(t.category || '').replace(/"/g, '""')}"`,
    `"${(t.account_name || 'Cash').replace(/"/g, '""')}"`,
    t.amount || 0,
    `"${t.due_date || ''}"`
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

// --- USER PROFILE API ---
export type UserProfile = {
  name: string;
  email: string;
  biometrics_enabled: number;
  accent_color: string;
  currency: string;
  hide_balance_default: number;
};

export const getUserProfile = (): UserProfile => {
  const db = getDB();
  try {
    const row = db.getFirstSync<{
      name: string; 
      email: string; 
      biometrics_enabled: number;
      accent_color?: string;
      currency?: string;
      hide_balance_default?: number;
    }>('SELECT name, email, biometrics_enabled, accent_color, currency, hide_balance_default FROM user_profile WHERE id = 1');
    return {
      name: row?.name || 'John Doe',
      email: row?.email || 'john.doe@example.com',
      biometrics_enabled: row?.biometrics_enabled ?? 0,
      accent_color: row?.accent_color || 'emerald',
      currency: row?.currency || 'PHP',
      hide_balance_default: row?.hide_balance_default ?? 0
    };
  } catch (e) {
    return { 
      name: 'John Doe', 
      email: 'john.doe@example.com', 
      biometrics_enabled: 0, 
      accent_color: 'emerald', 
      currency: 'PHP', 
      hide_balance_default: 0 
    };
  }
};

export const updateUserProfile = (
  name?: string, 
  email?: string, 
  currency?: string, 
  hide_balance_default?: number, 
  accent_color?: string
) => {
  const db = getDB();
  const current = getUserProfile();
  const newName = name !== undefined ? name : current.name;
  const newEmail = email !== undefined ? email : current.email;
  const newCurrency = currency !== undefined ? currency : current.currency;
  const newHide = hide_balance_default !== undefined ? hide_balance_default : current.hide_balance_default;
  const newAccent = accent_color !== undefined ? accent_color : current.accent_color;

  db.runSync(
    `INSERT INTO user_profile (id, name, email, biometrics_enabled, accent_color, currency, hide_balance_default)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       name=excluded.name, 
       email=excluded.email, 
       accent_color=excluded.accent_color, 
       currency=excluded.currency, 
       hide_balance_default=excluded.hide_balance_default`, 
    [newName, newEmail, current.biometrics_enabled, newAccent, newCurrency, newHide]
  );
};

export const updateBiometricsEnabled = (enabled: boolean) => {
  const db = getDB();
  const current = getUserProfile();
  db.runSync(
    'INSERT INTO user_profile (id, name, email, biometrics_enabled, accent_color, currency, hide_balance_default) VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET biometrics_enabled=excluded.biometrics_enabled', 
    [current.name, current.email, enabled ? 1 : 0, current.accent_color, current.currency, current.hide_balance_default]
  );
};

export const getAccentColorFromDB = (): string => {
  try {
    const p = getUserProfile();
    return p.accent_color || 'emerald';
  } catch (e) {
    return 'emerald';
  }
};

export const setAccentColorInDB = (key: string): void => {
  try {
    const db = getDB();
    db.runSync('UPDATE user_profile SET accent_color = ? WHERE id = 1', [key]);
  } catch (e) {
    console.warn('Failed to update accent color in db:', e);
  }
};

// Categories CRUD API
export const seedDefaultCategories = (targetDb?: SQLite.SQLiteDatabase): number => {
  if (Platform.OS === 'web' || isWebFallback) {
    let added = 0;
    for (const cat of DEFAULT_BUILTIN_CATEGORIES) {
      const exists = mockDb.categories.find(
        c => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === cat.type
      );
      if (!exists) {
        mockDb.categories.push({ id: Date.now() + Math.floor(Math.random() * 1000), ...cat });
        added++;
      }
    }
    return added;
  }

  const activeDb = targetDb || getDB();
  let addedCount = 0;
  for (const cat of DEFAULT_BUILTIN_CATEGORIES) {
    try {
      const exists = activeDb.getFirstSync<{ id: number }>(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND type = ?',
        [cat.name, cat.type]
      );
      if (!exists) {
        activeDb.runSync(
          'INSERT INTO categories (name, icon, color, type) VALUES (?, ?, ?, ?)',
          [cat.name, cat.icon, cat.color, cat.type]
        );
        addedCount++;
      }
    } catch (e) {
      console.warn('Failed to insert default category:', cat.name, e);
    }
  }
  return addedCount;
};

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

export const updateTransaction = (
  id: number, 
  title: string, 
  amount: number, 
  type: string, 
  category: string, 
  date: string,
  account_id?: number,
  due_date?: string | null
) => {
  const db = getDB();
  const oldTx = db.getFirstSync<{ amount: number; account_id: number; type: string }>(
    `SELECT amount, account_id, type FROM transactions WHERE id = ?`, 
    [id]
  );

  if (oldTx) {
    const targetAccountId = account_id || oldTx.account_id;
    let signedAmount = amount;
    if (type === 'expense') {
      signedAmount = -Math.abs(amount);
    } else if (type === 'income') {
      signedAmount = Math.abs(amount);
    }
    
    // Reverse old transaction impact on previous account balance
    db.runSync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [oldTx.amount, oldTx.account_id]);
    // Apply new transaction impact to target account balance
    db.runSync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [signedAmount, targetAccountId]);
    
    // Update transaction
    db.runSync(
      `UPDATE transactions SET title = ?, amount = ?, type = ?, category = ?, date = ?, account_id = ?, due_date = ? WHERE id = ?`,
      [title, signedAmount, type, category, date, targetAccountId, due_date || null, id]
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
  return dbInstance.getAllSync('SELECT * FROM budgets ORDER BY id ASC');
};

export const saveBudget = (category: string, amount: number, period: string = 'monthly'): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'INSERT INTO budgets (category, amount, period) VALUES (?, ?, ?) ON CONFLICT(category) DO UPDATE SET amount=excluded.amount, period=excluded.period',
    [category, amount, period]
  );
};

export const updateBudget = (id: number, category: string, amount: number, period: string = 'monthly'): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'UPDATE budgets SET category = ?, amount = ?, period = ? WHERE id = ?',
    [category, amount, period, id]
  );
};

export const deleteBudget = (id: number): void => {
  const dbInstance = getDB();
  dbInstance.runSync('DELETE FROM budgets WHERE id = ?', [id]);
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
  return dbInstance.getAllSync('SELECT * FROM goals ORDER BY id ASC');
};

export const addGoal = (title: string, target_amount: number, color: string, icon: string, deadline?: string): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'INSERT INTO goals (title, target_amount, color, icon, deadline) VALUES (?, ?, ?, ?, ?)',
    [title, target_amount, color, icon, deadline || null]
  );
};

export const updateGoal = (id: number, title: string, target_amount: number, color?: string, icon?: string, deadline?: string): void => {
  const dbInstance = getDB();
  dbInstance.runSync(
    'UPDATE goals SET title = ?, target_amount = ?, color = COALESCE(?, color), icon = COALESCE(?, icon), deadline = ? WHERE id = ?',
    [title, target_amount, color || null, icon || null, deadline || null, id]
  );
};

export const deleteGoal = (id: number): void => {
  const dbInstance = getDB();
  dbInstance.runSync('DELETE FROM goals WHERE id = ?', [id]);
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
    version: 2,
    timestamp: new Date().toISOString(),
    data: {
      accounts: safeGet('SELECT * FROM accounts'),
      categories: safeGet('SELECT * FROM categories'),
      transactions: safeGet('SELECT * FROM transactions'),
      splitTransactions: safeGet('SELECT * FROM split_transactions'),
      budgets: safeGet('SELECT * FROM budgets'),
      goals: safeGet('SELECT * FROM goals'),
      reminders: safeGet('SELECT * FROM reminders'),
      userProfile: safeGet('SELECT * FROM user_profile')
    }
  };
  return JSON.stringify(backup, null, 2);
};

export const importBackupJSON = (jsonString: string): void => {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.data) throw new Error("Invalid backup format");
    
    const { 
      accounts, 
      categories, 
      transactions, 
      splitTransactions, 
      budgets, 
      goals,
      reminders,
      userProfile 
    } = backup.data;
    
    const dbInstance = getDB();
    dbInstance.execSync('PRAGMA foreign_keys = OFF;');
    
    // Clear existing data
    dbInstance.runSync('DELETE FROM split_transactions');
    dbInstance.runSync('DELETE FROM transactions');
    dbInstance.runSync('DELETE FROM categories');
    dbInstance.runSync('DELETE FROM accounts');
    dbInstance.runSync('DELETE FROM budgets');
    dbInstance.runSync('DELETE FROM goals');
    dbInstance.runSync('DELETE FROM reminders');
    
    // Restore Accounts
    if (accounts && Array.isArray(accounts)) {
      accounts.forEach((acc: any) => {
        dbInstance.runSync(
          'INSERT INTO accounts (id, name, type, balance, currency) VALUES (?, ?, ?, ?, ?)',
          [acc.id, acc.name, acc.type, acc.balance, acc.currency || 'PHP']
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
          'INSERT INTO transactions (id, account_id, to_account_id, title, amount, type, date, category, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [tx.id, accId, toAccId, tx.title, tx.amount, tx.type, tx.date, tx.category, tx.due_date || null]
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

    // Restore Reminders
    if (reminders && Array.isArray(reminders)) {
      reminders.forEach((r: any) => {
        dbInstance.runSync(
          'INSERT INTO reminders (id, title, due_date, is_completed) VALUES (?, ?, ?, ?)',
          [r.id, r.title, r.due_date || null, r.is_completed || 0]
        );
      });
    }

    // Restore User Profile
    if (userProfile && Array.isArray(userProfile) && userProfile.length > 0) {
      const p = userProfile[0];
      dbInstance.runSync(
        `INSERT OR REPLACE INTO user_profile (id, name, email, biometrics_enabled, accent_color, currency, hide_balance_default) 
         VALUES (1, ?, ?, ?, ?, ?, ?)`,
        [
          p.name || 'User',
          p.email || '',
          p.biometrics_enabled || 0,
          p.accent_color || 'emerald',
          p.currency || 'PHP',
          p.hide_balance_default || 0
        ]
      );
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
