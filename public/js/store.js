/* 데이터 스토어 — Railway MySQL API 연동 */
const store = (() => {
  let companies = [];
  let products = [];
  let transactions = [];
  let ready = false;

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `API 오류 (${res.status})`);
    return data;
  }

  async function reload() {
    const data = await api("/api/bootstrap");
    companies = data.companies || [];
    products = data.products || [];
    transactions = data.transactions || [];
    ready = true;
  }

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "(삭제됨)";

  return {
    get ready() { return ready; },
    get companies() { return companies; },
    get products() { return products; },
    get transactions() { return transactions; },
    companyName,
    reload,

    async addCompany(c) {
      const row = await api("/api/companies", { method: "POST", body: JSON.stringify(c) });
      companies.push(row);
      return row;
    },
    async updateCompany(id, patch) {
      const row = await api(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      const i = companies.findIndex((x) => x.id === id);
      if (i >= 0) companies[i] = row;
    },
    async removeCompany(id) {
      await api(`/api/companies/${id}`, { method: "DELETE" });
      companies = companies.filter((c) => c.id !== id);
    },

    async addProduct(p) {
      const row = await api("/api/products", { method: "POST", body: JSON.stringify(p) });
      products.push(row);
      return row;
    },
    async updateProduct(id, patch) {
      const row = await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      const i = products.findIndex((x) => x.id === id);
      if (i >= 0) products[i] = row;
    },
    async removeProduct(id) {
      await api(`/api/products/${id}`, { method: "DELETE" });
      products = products.filter((p) => p.id !== id);
    },

    async addTxn(t) {
      const row = await api("/api/transactions", { method: "POST", body: JSON.stringify(t) });
      transactions.unshift(row);
      return row;
    },
    async updateTxn(id, patch) {
      const row = await api(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      const i = transactions.findIndex((x) => x.id === id);
      if (i >= 0) transactions[i] = row;
    },
    async removeTxn(id) {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      transactions = transactions.filter((t) => t.id !== id);
    },

    outstanding(type) {
      const byCompany = new Map();
      for (const t of transactions) {
        if (t.type !== type) continue;
        const cur = byCompany.get(t.companyId) || { companyId: t.companyId, total: 0, paid: 0, count: 0, lastDate: "" };
        cur.total += t.total;
        cur.paid += t.paid;
        cur.count += 1;
        if (t.date > cur.lastDate) cur.lastDate = t.date;
        byCompany.set(t.companyId, cur);
      }
      return [...byCompany.values()]
        .map((r) => ({ ...r, balance: r.total - r.paid, name: companyName(r.companyId) }))
        .filter((r) => r.balance !== 0)
        .sort((a, b) => b.balance - a.balance);
    },

    monthlySummary() {
      const prefix = fmt.today().slice(0, 7);
      let sales = 0;
      let purchase = 0;
      for (const t of transactions) {
        if (!t.date.startsWith(prefix)) continue;
        if (t.type === "sales") sales += t.total;
        else purchase += t.total;
      }
      const receivable = this.outstanding("sales").reduce((s, r) => s + r.balance, 0);
      const payable = this.outstanding("purchase").reduce((s, r) => s + r.balance, 0);
      return { sales, purchase, receivable, payable };
    },
  };
})();
