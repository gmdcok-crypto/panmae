/**
 * panmae REST API — UI store와 1:1 대응
 */
const db = require("./db");

function mapCompany(r) {
  return {
    id: r.id,
    name: r.name,
    ceo: r.ceo,
    bizNo: r.biz_no,
    phone: r.phone,
    type: r.type,
    address: r.address,
    memo: r.memo,
  };
}

function mapProduct(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    purchasePrice: r.purchase_price,
    salesPrice: r.sales_price,
    memo: r.memo,
  };
}

function mapTxn(r, lines = []) {
  return {
    id: r.id,
    type: r.type,
    date: typeof r.txn_date === "string" ? r.txn_date.slice(0, 10) : r.txn_date.toISOString().slice(0, 10),
    companyId: r.company_id,
    supply: Number(r.supply),
    vat: Number(r.vat),
    total: Number(r.total),
    paid: Number(r.paid),
    memo: r.memo,
    lines: lines.map((l) => ({
      no: l.line_no,
      productId: l.product_id,
      name: l.name,
      qty: Number(l.qty),
      price: Number(l.price),
      amount: Number(l.amount),
    })),
  };
}

async function loadTxnLines(txnIds) {
  if (!txnIds.length) return new Map();
  const placeholders = txnIds.map(() => "?").join(",");
  const rows = await db.query(
    `SELECT * FROM transaction_items WHERE transaction_id IN (${placeholders}) ORDER BY transaction_id, line_no`,
    txnIds,
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.transaction_id)) map.set(r.transaction_id, []);
    map.get(r.transaction_id).push(r);
  }
  return map;
}

async function listCompanies() {
  const rows = await db.query("SELECT * FROM companies ORDER BY id");
  return rows.map(mapCompany);
}

async function listProducts() {
  const rows = await db.query("SELECT * FROM products ORDER BY id");
  return rows.map(mapProduct);
}

async function listTransactions() {
  const rows = await db.query("SELECT * FROM transactions ORDER BY txn_date DESC, id DESC");
  const lineMap = await loadTxnLines(rows.map((r) => r.id));
  return rows.map((r) => mapTxn(r, lineMap.get(r.id) || []));
}

function calcTotals(lines) {
  const supply = lines.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0);
  const vat = Math.round(supply * 0.1);
  return { supply, vat, total: supply + vat };
}

async function insertTxn(body) {
  const lines = (body.lines || []).filter((l) => l.productId && Number(l.qty) > 0);
  if (!body.companyId || !body.date || !body.type || !lines.length) {
    const err = new Error("일자, 거래처, 품목은 필수입니다.");
    err.status = 400;
    throw err;
  }
  const { supply, vat, total } = calcTotals(lines);
  const paid = Number(body.paid) || 0;

  return db.withTransaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO transactions (type, txn_date, company_id, supply, vat, total, paid, memo)
       VALUES (?,?,?,?,?,?,?,?)`,
      [body.type, body.date, body.companyId, supply, vat, total, paid, body.memo || ""],
    );
    const txnId = r.insertId;
    let no = 1;
    for (const l of lines) {
      const amount = Number(l.qty) * Number(l.price);
      await conn.execute(
        `INSERT INTO transaction_items (transaction_id, line_no, product_id, name, qty, price, amount)
         VALUES (?,?,?,?,?,?,?)`,
        [txnId, no++, l.productId, l.name || "", l.qty, l.price, amount],
      );
    }
    return txnId;
  });
}

async function updateTxn(id, body) {
  const lines = (body.lines || []).filter((l) => l.productId && Number(l.qty) > 0);
  if (!body.companyId || !body.date || !lines.length) {
    const err = new Error("일자, 거래처, 품목은 필수입니다.");
    err.status = 400;
    throw err;
  }
  const { supply, vat, total } = calcTotals(lines);
  const paid = Number(body.paid) || 0;

  return db.withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `UPDATE transactions SET type=?, txn_date=?, company_id=?, supply=?, vat=?, total=?, paid=?, memo=? WHERE id=?`,
      [body.type, body.date, body.companyId, supply, vat, total, paid, body.memo || "", id],
    );
    if (result.affectedRows === 0) {
      const err = new Error("전표를 찾을 수 없습니다.");
      err.status = 404;
      throw err;
    }
    await conn.execute("DELETE FROM transaction_items WHERE transaction_id=?", [id]);
    let no = 1;
    for (const l of lines) {
      const amount = Number(l.qty) * Number(l.price);
      await conn.execute(
        `INSERT INTO transaction_items (transaction_id, line_no, product_id, name, qty, price, amount)
         VALUES (?,?,?,?,?,?,?)`,
        [id, no++, l.productId, l.name || "", l.qty, l.price, amount],
      );
    }
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(Object.assign(new Error("요청이 너무 큽니다."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("잘못된 JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

/** @returns {Promise<boolean>} handled */
async function handle(req, res, pathname) {
  if (!pathname.startsWith("/api/")) return false;

  try {
    if (pathname === "/api/health" && req.method === "GET") {
      const dbOk = await db.ping();
      sendJson(res, dbOk ? 200 : 503, {
        status: dbOk ? "ok" : "degraded",
        service: "panmae",
        railway: Boolean(process.env.RAILWAY_ENVIRONMENT),
        db: dbOk,
        time: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === "/api/bootstrap" && req.method === "GET") {
      const [companies, products, transactions] = await Promise.all([
        listCompanies(),
        listProducts(),
        listTransactions(),
      ]);
      sendJson(res, 200, { companies, products, transactions });
      return true;
    }

    // --- companies ---
    if (pathname === "/api/companies" && req.method === "GET") {
      sendJson(res, 200, await listCompanies());
      return true;
    }
    if (pathname === "/api/companies" && req.method === "POST") {
      const body = await readJson(req);
      if (!body.name || !String(body.name).trim()) {
        sendJson(res, 400, { error: "상호는 필수입니다." });
        return true;
      }
      const result = await db.query(
        `INSERT INTO companies (name, ceo, biz_no, phone, type, address, memo) VALUES (?,?,?,?,?,?,?)`,
        [
          body.name.trim(),
          body.ceo || "",
          body.bizNo || "",
          body.phone || "",
          body.type || "매출처",
          body.address || "",
          body.memo || "",
        ],
      );
      const rows = await db.query("SELECT * FROM companies WHERE id=?", [result.insertId]);
      sendJson(res, 201, mapCompany(rows[0]));
      return true;
    }
    const companyMatch = pathname.match(/^\/api\/companies\/(\d+)$/);
    if (companyMatch && req.method === "PUT") {
      const id = Number(companyMatch[1]);
      const body = await readJson(req);
      await db.query(
        `UPDATE companies SET name=?, ceo=?, biz_no=?, phone=?, type=?, address=?, memo=? WHERE id=?`,
        [
          body.name,
          body.ceo || "",
          body.bizNo || "",
          body.phone || "",
          body.type || "매출처",
          body.address || "",
          body.memo || "",
          id,
        ],
      );
      const rows = await db.query("SELECT * FROM companies WHERE id=?", [id]);
      sendJson(res, 200, mapCompany(rows[0]));
      return true;
    }
    if (companyMatch && req.method === "DELETE") {
      const id = Number(companyMatch[1]);
      const [{ cnt }] = await db.query(
        "SELECT COUNT(*) AS cnt FROM transactions WHERE company_id=?",
        [id],
      );
      if (Number(cnt) > 0) {
        sendJson(res, 409, {
          error: `이 거래처의 전표 ${cnt}건이 있어 삭제할 수 없습니다. 전표를 먼저 삭제하세요.`,
        });
        return true;
      }
      await db.query("DELETE FROM companies WHERE id=?", [id]);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // --- products ---
    if (pathname === "/api/products" && req.method === "GET") {
      sendJson(res, 200, await listProducts());
      return true;
    }
    if (pathname === "/api/products" && req.method === "POST") {
      const body = await readJson(req);
      if (!body.code || !body.name) {
        sendJson(res, 400, { error: "품목코드와 품명은 필수입니다." });
        return true;
      }
      const result = await db.query(
        `INSERT INTO products (code, name, unit, purchase_price, sales_price, memo) VALUES (?,?,?,?,?,?)`,
        [
          body.code,
          body.name,
          body.unit || "EA",
          Number(body.purchasePrice) || 0,
          Number(body.salesPrice) || 0,
          body.memo || "",
        ],
      );
      const rows = await db.query("SELECT * FROM products WHERE id=?", [result.insertId]);
      sendJson(res, 201, mapProduct(rows[0]));
      return true;
    }
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === "PUT") {
      const id = Number(productMatch[1]);
      const body = await readJson(req);
      await db.query(
        `UPDATE products SET code=?, name=?, unit=?, purchase_price=?, sales_price=?, memo=? WHERE id=?`,
        [
          body.code,
          body.name,
          body.unit || "EA",
          Number(body.purchasePrice) || 0,
          Number(body.salesPrice) || 0,
          body.memo || "",
          id,
        ],
      );
      const rows = await db.query("SELECT * FROM products WHERE id=?", [id]);
      sendJson(res, 200, mapProduct(rows[0]));
      return true;
    }
    if (productMatch && req.method === "DELETE") {
      const id = Number(productMatch[1]);
      await db.query("DELETE FROM products WHERE id=?", [id]);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // --- transactions ---
    if (pathname === "/api/transactions" && req.method === "GET") {
      sendJson(res, 200, await listTransactions());
      return true;
    }
    if (pathname === "/api/transactions" && req.method === "POST") {
      const body = await readJson(req);
      const id = await insertTxn(body);
      const rows = await db.query("SELECT * FROM transactions WHERE id=?", [id]);
      const lineMap = await loadTxnLines([id]);
      sendJson(res, 201, mapTxn(rows[0], lineMap.get(id) || []));
      return true;
    }
    const txnMatch = pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (txnMatch && req.method === "PUT") {
      const id = Number(txnMatch[1]);
      const body = await readJson(req);
      await updateTxn(id, body);
      const rows = await db.query("SELECT * FROM transactions WHERE id=?", [id]);
      const lineMap = await loadTxnLines([id]);
      sendJson(res, 200, mapTxn(rows[0], lineMap.get(id) || []));
      return true;
    }
    if (txnMatch && req.method === "DELETE") {
      const id = Number(txnMatch[1]);
      await db.query("DELETE FROM transactions WHERE id=?", [id]);
      sendJson(res, 200, { ok: true });
      return true;
    }

    sendJson(res, 404, { error: "API not found" });
    return true;
  } catch (err) {
    console.error("[api]", err);
    sendJson(res, err.status || 500, { error: err.message || "서버 오류" });
    return true;
  }
}

module.exports = { handle };
