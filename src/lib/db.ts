import path from "path";
import fs from "fs";
import { DatabaseSync } from "node:sqlite";

export interface Statement<T = any> {
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: any[]): T | undefined;
  all(...params: any[]): T[];
}

export interface IDatabase {
  prepare<T = any>(sql: string): Statement<T>;
  exec(sql: string): void;
  pragma(pragmaSql: string): any;
  transaction<T>(fn: () => T): () => T;
}

let dbInstance: IDatabase | null = null;

export function getDb(): IDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.join(process.cwd(), "expense.db");
  const rawDb = new DatabaseSync(dbPath);
  rawDb.exec("PRAGMA journal_mode = WAL;");
  rawDb.exec("PRAGMA foreign_keys = ON;");

  dbInstance = {
    prepare<T = any>(sql: string): Statement<T> {
      const stmt = rawDb.prepare(sql);
      return {
        run(...params: any[]) {
          const res = stmt.run(...params);
          return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
        },
        get(...params: any[]) {
          return stmt.get(...params) as T | undefined;
        },
        all(...params: any[]) {
          return stmt.all(...params) as unknown as T[];
        },
      };
    },
    exec(sql: string) {
      rawDb.exec(sql);
    },
    pragma(sql: string) {
      return rawDb.prepare(`PRAGMA ${sql}`).all();
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        rawDb.exec("BEGIN IMMEDIATE TRANSACTION;");
        try {
          const result = fn();
          rawDb.exec("COMMIT;");
          return result;
        } catch (e) {
          rawDb.exec("ROLLBACK;");
          throw e;
        }
      };
    },
  };

  // Safe schema initialization
  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db: IDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT DEFAULT 'Digital Product',
      selling_price REAL DEFAULT 0,
      product_cost REAL DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ad_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      ad_account_name TEXT,
      product_id INTEGER,
      product_name TEXT,
      campaign_type TEXT DEFAULT 'Sales',
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS revenues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      campaign_name TEXT,
      order_count INTEGER DEFAULT 1,
      amount REAL NOT NULL,
      net_amount REAL,
      product_cost REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      deduction_amount REAL DEFAULT 0,
      payment_id TEXT UNIQUE,
      customer_email TEXT,
      customer_phone TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'Received',
      raw_data TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS other_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      payment_method TEXT DEFAULT 'UPI',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS csv_import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      import_type TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      imported_rows INTEGER NOT NULL,
      skipped_rows INTEGER NOT NULL,
      duplicate_rows INTEGER NOT NULL,
      total_amount REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ad_expenses_date ON ad_expenses(date);
    CREATE INDEX IF NOT EXISTS idx_ad_expenses_product ON ad_expenses(product_id);
    CREATE INDEX IF NOT EXISTS idx_revenues_date ON revenues(date);
    CREATE INDEX IF NOT EXISTS idx_revenues_product ON revenues(product_id);
    CREATE INDEX IF NOT EXISTS idx_revenues_payment_id ON revenues(payment_id);
    CREATE INDEX IF NOT EXISTS idx_other_expenses_date ON other_expenses(date);
    CREATE INDEX IF NOT EXISTS idx_other_expenses_category ON other_expenses(category);
  `);

  // Default settings if empty
  const checkSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'currency'").get();
  if (!checkSetting) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('currency', 'INR')").run();
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('currency_symbol', '₹')").run();
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('default_filter', 'last_30_days')").run();
  }
}
