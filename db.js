/**
 * Railway MySQL — 앱 기동 시 테이블 직접 생성 (스키마 스크립트 파일 없음)
 * 환경변수: MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
 * 또는 MYSQL_URL / MYSQL_PUBLIC_URL
 */
const mysql = require("mysql2/promise");

let pool = null;

function parseMysqlUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: (u.pathname || "/").replace(/^\//, "") || "railway",
    };
  } catch {
    return null;
  }
}

function resolveConfig() {
  const fromUrl =
    parseMysqlUrl(process.env.MYSQL_URL) ||
    parseMysqlUrl(process.env.MYSQL_PUBLIC_URL) ||
    parseMysqlUrl(process.env.DATABASE_URL);

  if (fromUrl && fromUrl.host && !String(fromUrl.host).includes("${{")) {
    return fromUrl;
  }

  const host = process.env.MYSQLHOST || process.env.MYSQL_HOST;
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || "";
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "railway";
  const port = Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306);

  if (!host || String(host).includes("${{")) return null;

  return { host, port, user, password, database };
}

async function getPool() {
  if (pool) return pool;
  const cfg = resolveConfig();
  if (!cfg) {
    throw new Error(
      "MySQL 환경변수가 없습니다. Railway 앱에 MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE Reference를 연결하세요.",
    );
  }

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "Z",
  });

  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function withTransaction(fn) {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** UI 구조에 맞춘 테이블을 DB에 직접 생성 */
async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      ceo VARCHAR(100) NOT NULL DEFAULT '',
      biz_no VARCHAR(50) NOT NULL DEFAULT '',
      phone VARCHAR(50) NOT NULL DEFAULT '',
      type VARCHAR(30) NOT NULL DEFAULT '매출처',
      address VARCHAR(255) NOT NULL DEFAULT '',
      memo VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_companies_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(200) NOT NULL,
      unit VARCHAR(20) NOT NULL DEFAULT 'EA',
      purchase_price INT NOT NULL DEFAULT 0,
      sales_price INT NOT NULL DEFAULT 0,
      memo VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_products_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('sales','purchase') NOT NULL,
      txn_date DATE NOT NULL,
      company_id INT NOT NULL,
      supply BIGINT NOT NULL DEFAULT 0,
      vat BIGINT NOT NULL DEFAULT 0,
      total BIGINT NOT NULL DEFAULT 0,
      paid BIGINT NOT NULL DEFAULT 0,
      memo VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_txn_date (txn_date),
      INDEX idx_txn_type (type),
      INDEX idx_txn_company (company_id),
      CONSTRAINT fk_txn_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL,
      line_no INT NOT NULL DEFAULT 1,
      product_id INT NULL,
      name VARCHAR(200) NOT NULL DEFAULT '',
      qty DECIMAL(12,2) NOT NULL DEFAULT 0,
      price INT NOT NULL DEFAULT 0,
      amount BIGINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_items_txn (transaction_id),
      CONSTRAINT fk_items_txn FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function seedIfEmpty() {
  const [{ cnt }] = await query("SELECT COUNT(*) AS cnt FROM companies");
  if (Number(cnt) > 0) return { seeded: false };

  await withTransaction(async (conn) => {
    const companies = [
      ["한빛유통", "김한빛", "123-45-67890", "02-1234-5678", "매출처", "서울 마포구 양화로 12", ""],
      ["대성상사", "이대성", "234-56-78901", "031-987-6543", "매입처", "경기 성남시 분당구 판교로 55", "월말 정산"],
      ["그린식품", "박초록", "345-67-89012", "02-555-0101", "매출처", "서울 송파구 올림픽로 300", ""],
      ["동해물산", "최동해", "456-78-90123", "033-222-3333", "매입처", "강원 강릉시 경강로 210", ""],
      ["서진테크", "정서진", "567-89-01234", "02-777-8888", "매출/매입", "서울 구로구 디지털로 288", ""],
    ];
    for (const row of companies) {
      await conn.execute(
        `INSERT INTO companies (name, ceo, biz_no, phone, type, address, memo) VALUES (?,?,?,?,?,?,?)`,
        row,
      );
    }

    const products = [
      ["P-001", "냉동 닭가슴살 1kg", "EA", 5500, 7800, ""],
      ["P-002", "냉장 닭다리살 1kg", "EA", 6200, 8900, ""],
      ["P-003", "훈제 오리 슬라이스 500g", "EA", 7100, 9900, ""],
      ["P-004", "계란 30구", "판", 5900, 7500, ""],
      ["P-005", "메추리알 1kg", "EA", 4300, 6200, ""],
    ];
    for (const row of products) {
      await conn.execute(
        `INSERT INTO products (code, name, unit, purchase_price, sales_price, memo) VALUES (?,?,?,?,?,?)`,
        row,
      );
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const base = `${y}-${m}`;

    const txns = [
      {
        type: "sales",
        date: `${base}-02`,
        companyId: 1,
        paid: 200000,
        memo: "",
        lines: [
          { productId: 1, name: "냉동 닭가슴살 1kg", qty: 20, price: 7800 },
          { productId: 4, name: "계란 30구", qty: 10, price: 7500 },
        ],
      },
      {
        type: "purchase",
        date: `${base}-03`,
        companyId: 2,
        paid: 302500,
        memo: "현금 매입",
        lines: [{ productId: 1, name: "냉동 닭가슴살 1kg", qty: 50, price: 5500 }],
      },
      {
        type: "sales",
        date: `${base}-05`,
        companyId: 3,
        paid: 0,
        memo: "월말 수금 예정",
        lines: [{ productId: 2, name: "냉장 닭다리살 1kg", qty: 30, price: 8900 }],
      },
      {
        type: "purchase",
        date: `${base}-08`,
        companyId: 4,
        paid: 100000,
        memo: "",
        lines: [
          { productId: 3, name: "훈제 오리 슬라이스 500g", qty: 40, price: 7100 },
          { productId: 5, name: "메추리알 1kg", qty: 25, price: 4300 },
        ],
      },
      {
        type: "sales",
        date: `${base}-10`,
        companyId: 5,
        paid: 300000,
        memo: "",
        lines: [
          { productId: 3, name: "훈제 오리 슬라이스 500g", qty: 15, price: 9900 },
          { productId: 5, name: "메추리알 1kg", qty: 20, price: 6200 },
        ],
      },
    ];

    for (const t of txns) {
      const supply = t.lines.reduce((s, l) => s + l.qty * l.price, 0);
      const vat = Math.round(supply * 0.1);
      const total = supply + vat;
      const [r] = await conn.execute(
        `INSERT INTO transactions (type, txn_date, company_id, supply, vat, total, paid, memo)
         VALUES (?,?,?,?,?,?,?,?)`,
        [t.type, t.date, t.companyId, supply, vat, total, t.paid, t.memo],
      );
      const txnId = r.insertId;
      let no = 1;
      for (const l of t.lines) {
        await conn.execute(
          `INSERT INTO transaction_items (transaction_id, line_no, product_id, name, qty, price, amount)
           VALUES (?,?,?,?,?,?,?)`,
          [txnId, no++, l.productId, l.name, l.qty, l.price, l.qty * l.price],
        );
      }
    }
  });

  return { seeded: true };
}

async function init() {
  const cfg = resolveConfig();
  if (!cfg) {
    return { ok: false, error: "MySQL env missing" };
  }
  await getPool();
  await ensureSchema();
  const seed = await seedIfEmpty();
  return { ok: true, host: cfg.host, database: cfg.database, seeded: seed.seeded };
}

async function ping() {
  try {
    await query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  init,
  ping,
  query,
  withTransaction,
  resolveConfig,
  getPool,
};
