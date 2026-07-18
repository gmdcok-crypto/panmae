/* 데이터 스토어 — localStorage 영속화 (오프라인 PWA 대응) */
const store = (() => {
  const KEY = 'panmae-erp-v1';

  const seed = () => {
    const companies = [
      { id: 1, name: '한빛유통', ceo: '김한빛', bizNo: '123-45-67890', phone: '02-1234-5678', type: '매출처', address: '서울 마포구 양화로 12', memo: '' },
      { id: 2, name: '대성상사', ceo: '이대성', bizNo: '234-56-78901', phone: '031-987-6543', type: '매입처', address: '경기 성남시 분당구 판교로 55', memo: '월말 정산' },
      { id: 3, name: '그린식품', ceo: '박초록', bizNo: '345-67-89012', phone: '02-555-0101', type: '매출처', address: '서울 송파구 올림픽로 300', memo: '' },
      { id: 4, name: '동해물산', ceo: '최동해', bizNo: '456-78-90123', phone: '033-222-3333', type: '매입처', address: '강원 강릉시 경강로 210', memo: '' },
      { id: 5, name: '서진테크', ceo: '정서진', bizNo: '567-89-01234', phone: '02-777-8888', type: '매출/매입', address: '서울 구로구 디지털로 288', memo: '' },
    ];

    const products = [
      { id: 1, code: 'P-001', name: '냉동 닭가슴살 1kg', unit: 'EA', purchasePrice: 5500, salesPrice: 7800, memo: '' },
      { id: 2, code: 'P-002', name: '냉장 닭다리살 1kg', unit: 'EA', purchasePrice: 6200, salesPrice: 8900, memo: '' },
      { id: 3, code: 'P-003', name: '훈제 오리 슬라이스 500g', unit: 'EA', purchasePrice: 7100, salesPrice: 9900, memo: '' },
      { id: 4, code: 'P-004', name: '계란 30구', unit: '판', purchasePrice: 5900, salesPrice: 7500, memo: '' },
      { id: 5, code: 'P-005', name: '메추리알 1kg', unit: 'EA', purchasePrice: 4300, salesPrice: 6200, memo: '' },
    ];

    const mk = (id, type, date, companyId, lines, paid, memo) => {
      const supply = lines.reduce((s, l) => s + l.qty * l.price, 0);
      const vat = Math.round(supply * 0.1);
      return {
        id, type, date, companyId,
        lines: lines.map((l, i) => ({ no: i + 1, ...l, amount: l.qty * l.price })),
        supply, vat, total: supply + vat, paid, memo: memo || '',
      };
    };

    const t = fmt.today().slice(0, 8);
    const transactions = [
      mk(1, 'sales', t + '02', 1, [{ productId: 1, name: '냉동 닭가슴살 1kg', qty: 20, price: 7800 }, { productId: 4, name: '계란 30구', qty: 10, price: 7500 }], 200000, ''),
      mk(2, 'purchase', t + '03', 2, [{ productId: 1, name: '냉동 닭가슴살 1kg', qty: 50, price: 5500 }], 302500, '현금 매입'),
      mk(3, 'sales', t + '05', 3, [{ productId: 2, name: '냉장 닭다리살 1kg', qty: 30, price: 8900 }], 0, '월말 수금 예정'),
      mk(4, 'purchase', t + '08', 4, [{ productId: 3, name: '훈제 오리 슬라이스 500g', qty: 40, price: 7100 }, { productId: 5, name: '메추리알 1kg', qty: 25, price: 4300 }], 100000, ''),
      mk(5, 'sales', t + '10', 5, [{ productId: 3, name: '훈제 오리 슬라이스 500g', qty: 15, price: 9900 }, { productId: 5, name: '메추리알 1kg', qty: 20, price: 6200 }], 300000, ''),
    ];

    return { companies, products, transactions, seq: { company: 6, product: 6, txn: 6 } };
  };

  let data;
  try {
    data = JSON.parse(localStorage.getItem(KEY)) || seed();
  } catch {
    data = seed();
  }

  const save = () => localStorage.setItem(KEY, JSON.stringify(data));
  if (!localStorage.getItem(KEY)) save();

  const companyName = (id) => data.companies.find((c) => c.id === id)?.name || '(삭제됨)';

  return {
    get companies() { return data.companies; },
    get products() { return data.products; },
    get transactions() { return data.transactions; },
    companyName,

    addCompany(c) {
      c.id = data.seq.company++;
      data.companies.push(c);
      save();
      return c;
    },
    updateCompany(id, patch) {
      const c = data.companies.find((x) => x.id === id);
      if (c) { Object.assign(c, patch); save(); }
    },
    removeCompany(id) {
      data.companies = data.companies.filter((c) => c.id !== id);
      save();
    },

    addProduct(p) {
      p.id = data.seq.product++;
      data.products.push(p);
      save();
      return p;
    },
    updateProduct(id, patch) {
      const p = data.products.find((x) => x.id === id);
      if (p) { Object.assign(p, patch); save(); }
    },
    removeProduct(id) {
      data.products = data.products.filter((p) => p.id !== id);
      save();
    },

    addTxn(t) {
      t.id = data.seq.txn++;
      data.transactions.push(t);
      save();
      return t;
    },
    updateTxn(id, patch) {
      const t = data.transactions.find((x) => x.id === id);
      if (t) { Object.assign(t, patch); save(); }
    },
    removeTxn(id) {
      data.transactions = data.transactions.filter((t) => t.id !== id);
      save();
    },

    /* 거래처별 미수금(매출) / 미지급금(매입) 집계 */
    outstanding(type) {
      const byCompany = new Map();
      for (const t of data.transactions) {
        if (t.type !== type) continue;
        const cur = byCompany.get(t.companyId) || { companyId: t.companyId, total: 0, paid: 0, count: 0, lastDate: '' };
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

    /* 이번 달 합계 */
    monthlySummary() {
      const prefix = fmt.today().slice(0, 7);
      let sales = 0, purchase = 0;
      for (const t of data.transactions) {
        if (!t.date.startsWith(prefix)) continue;
        if (t.type === 'sales') sales += t.total;
        else purchase += t.total;
      }
      const receivable = this.outstanding('sales').reduce((s, r) => s + r.balance, 0);
      const payable = this.outstanding('purchase').reduce((s, r) => s + r.balance, 0);
      return { sales, purchase, receivable, payable };
    },

    resetToSeed() {
      data = seed();
      save();
    },
  };
})();
