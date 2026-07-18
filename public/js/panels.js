/* 패널 렌더러 — 각 탭 화면 */
const panels = {};

/* ---------- 공통 그리드 헬퍼 ---------- */
function gridHtml({ columns, rows, footer, emptyText }) {
  const ths = columns.map((c) => `<th style="${c.width ? 'width:' + c.width : ''}">${fmt.esc(c.label)}</th>`).join('');
  let body;
  if (!rows.length) {
    body = `<tr><td class="dg__empty" colspan="${columns.length}">${fmt.esc(emptyText || '데이터가 없습니다.')}</td></tr>`;
  } else {
    body = rows
      .map((r) => `<tr data-id="${r.id}" class="${r._cls || ''}">${r.cells.map((c) => `<td class="${c.cls || ''}">${c.html}</td>`).join('')}</tr>`)
      .join('');
  }
  const foot = footer
    ? `<tfoot><tr>${footer.map((c) => `<td class="${c.cls || ''}" colspan="${c.span || 1}">${c.html}</td>`).join('')}</tr></tfoot>`
    : '';
  return `
    <div class="dg-wrap">
      <div class="dg-scroll">
        <table class="dg">
          <thead><tr>${ths}</tr></thead>
          <tbody>${body}</tbody>
          ${foot}
        </table>
      </div>
      <div class="dg-footer">총 ${rows.length}건</div>
    </div>`;
}

function bindRowSelect(container, onSelect) {
  const tbody = container.querySelector('.dg tbody');
  if (!tbody) return;
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    tbody.querySelectorAll('.dg__row--selected').forEach((x) => x.classList.remove('dg__row--selected'));
    tr.classList.add('dg__row--selected');
    onSelect(Number(tr.dataset.id), tr, e);
  });
}

/* ---------- 홈 ---------- */
panels.home = {
  title: '홈',
  render(el) {
    const s = store.monthlySummary();
    const recent = [...store.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 10);

    el.innerHTML = `
      <div class="erp-panel erp-panel--home">
        <div class="erp-home-title">경영 현황 — ${fmt.today().slice(0, 7)}</div>
        <div class="erp-home-stats">
          <div class="erp-home-stat erp-home-stat--sales">
            <span>이번 달 매출</span><strong>${fmt.won(s.sales)}</strong><small>부가세 포함</small>
          </div>
          <div class="erp-home-stat erp-home-stat--purchase">
            <span>이번 달 매입</span><strong>${fmt.won(s.purchase)}</strong><small>부가세 포함</small>
          </div>
          <div class="erp-home-stat ${s.receivable > 0 ? 'erp-home-stat--danger' : ''}">
            <span>미수금 잔액</span><strong>${fmt.won(s.receivable)}</strong><small>받을 돈</small>
          </div>
          <div class="erp-home-stat ${s.payable > 0 ? 'erp-home-stat--danger' : ''}">
            <span>미지급금 잔액</span><strong>${fmt.won(s.payable)}</strong><small>줄 돈</small>
          </div>
        </div>
        <div class="erp-home-section">
          <h3>최근 거래 10건</h3>
          ${gridHtml({
            columns: [
              { label: 'No', width: '36px' },
              { label: '일자', width: '90px' },
              { label: '구분', width: '52px' },
              { label: '거래처' },
              { label: '공급가액', width: '110px' },
              { label: '부가세', width: '90px' },
              { label: '합계', width: '110px' },
              { label: '수금/지급', width: '110px' },
            ],
            rows: recent.map((t, i) => ({
              id: t.id,
              cells: [
                { html: String(i + 1), cls: 'dg__no' },
                { html: fmt.esc(t.date) },
                { html: t.type === 'sales' ? '매출' : '매입', cls: 'dg__center' },
                { html: fmt.esc(store.companyName(t.companyId)) },
                { html: fmt.comma(t.supply), cls: 'dg__num' },
                { html: fmt.comma(t.vat), cls: 'dg__num' },
                { html: fmt.comma(t.total), cls: 'dg__num' },
                { html: fmt.comma(t.paid), cls: 'dg__num' },
              ],
            })),
          })}
        </div>
      </div>`;
  },
};

/* ---------- 거래처관리 ---------- */
panels.companies = {
  title: '거래처관리',
  render(el, ctx) {
    let selectedId = null;
    let keyword = '';

    const draw = () => {
      const rows = store.companies.filter(
        (c) => !keyword || c.name.includes(keyword) || c.ceo.includes(keyword) || c.bizNo.includes(keyword),
      );
      el.innerHTML = `
        <div class="erp-panel">
          <div class="erp-toolbar">
            <span class="erp-toolbar__title">거래처관리</span>
            <div class="erp-toolbar__actions">
              <button class="erp-btn erp-btn--primary" data-act="new">신규등록</button>
              <button class="erp-btn" data-act="edit" ${selectedId ? '' : 'disabled'}>수정</button>
              <button class="erp-btn erp-btn--danger" data-act="del" ${selectedId ? '' : 'disabled'}>삭제</button>
            </div>
            <div class="erp-toolbar__filter">
              <label>검색 <input type="text" data-filter value="${fmt.esc(keyword)}" placeholder="상호/대표자/사업자번호" /></label>
            </div>
          </div>
          ${gridHtml({
            columns: [
              { label: 'No', width: '36px' },
              { label: '상호' },
              { label: '대표자', width: '80px' },
              { label: '사업자번호', width: '120px' },
              { label: '구분', width: '90px' },
              { label: '전화', width: '120px' },
              { label: '주소' },
              { label: '비고', width: '120px' },
            ],
            rows: rows.map((c, i) => ({
              id: c.id,
              _cls: c.id === selectedId ? 'dg__row--selected' : '',
              cells: [
                { html: String(i + 1), cls: 'dg__no' },
                { html: fmt.esc(c.name) },
                { html: fmt.esc(c.ceo) },
                { html: fmt.esc(c.bizNo), cls: 'dg__center' },
                { html: fmt.esc(c.type), cls: 'dg__center' },
                { html: fmt.esc(c.phone) },
                { html: fmt.esc(c.address) },
                { html: fmt.esc(c.memo) },
              ],
            })),
            emptyText: '등록된 거래처가 없습니다.',
          })}
        </div>`;

      bindRowSelect(el, (id) => { selectedId = id; syncButtons(); });

      const syncButtons = () => {
        el.querySelector('[data-act="edit"]').disabled = !selectedId;
        el.querySelector('[data-act="del"]').disabled = !selectedId;
      };

      el.querySelector('[data-filter]').addEventListener('input', (e) => {
        keyword = e.target.value.trim();
        selectedId = null;
        draw();
        const inp = el.querySelector('[data-filter]');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      });

      el.querySelector('[data-act="new"]').addEventListener('click', () => panels.companies.form(el, ctx, null));
      el.querySelector('[data-act="edit"]').addEventListener('click', () => {
        if (selectedId) panels.companies.form(el, ctx, selectedId);
      });
      el.querySelector('[data-act="del"]').addEventListener('click', () => {
        if (!selectedId) return;
        if (confirm('선택한 거래처를 삭제하시겠습니까?')) {
          store.removeCompany(selectedId);
          selectedId = null;
          draw();
          ctx.refreshStatus();
        }
      });
    };

    draw();
  },

  form(el, ctx, id) {
    const c = id ? store.companies.find((x) => x.id === id) : null;
    el.innerHTML = `
      <div class="erp-panel erp-panel--form erp-panel--card-form">
        <div class="erp-form-card">
          <div class="erp-form-card__title">${c ? '거래처 수정' : '거래처 신규등록'}</div>
          <form class="erp-form-grid" id="company-form">
            <label><span>상호 *</span><input name="name" required value="${fmt.esc(c?.name || '')}" /></label>
            <label><span>대표자</span><input name="ceo" value="${fmt.esc(c?.ceo || '')}" /></label>
            <label><span>사업자번호</span><input name="bizNo" value="${fmt.esc(c?.bizNo || '')}" placeholder="000-00-00000" /></label>
            <label><span>구분</span>
              <select name="type">
                ${['매출처', '매입처', '매출/매입'].map((t) => `<option ${c?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </label>
            <label><span>전화</span><input name="phone" value="${fmt.esc(c?.phone || '')}" /></label>
            <label><span>&nbsp;</span><span></span></label>
            <label class="erp-form-grid__wide"><span>주소</span><input name="address" value="${fmt.esc(c?.address || '')}" /></label>
            <label class="erp-form-grid__wide"><span>비고</span><input name="memo" value="${fmt.esc(c?.memo || '')}" /></label>
          </form>
          <div class="erp-form-error" id="form-error"></div>
          <div class="erp-form-actions">
            <button class="erp-btn" data-act="cancel">취소 (목록)</button>
            <button class="erp-btn erp-btn--primary" data-act="save">저장</button>
          </div>
        </div>
      </div>`;

    el.querySelector('[data-act="cancel"]').addEventListener('click', () => panels.companies.render(el, ctx));
    el.querySelector('[data-act="save"]').addEventListener('click', () => {
      const f = el.querySelector('#company-form');
      const v = Object.fromEntries(new FormData(f).entries());
      if (!v.name.trim()) {
        el.querySelector('#form-error').textContent = '상호는 필수 입력입니다.';
        return;
      }
      if (c) store.updateCompany(c.id, v);
      else store.addCompany(v);
      panels.companies.render(el, ctx);
      ctx.refreshStatus();
    });
  },
};

/* ---------- 품목관리 ---------- */
panels.products = {
  title: '품목관리',
  render(el, ctx) {
    let selectedId = null;
    let keyword = '';

    const draw = () => {
      const rows = store.products.filter((p) => !keyword || p.name.includes(keyword) || p.code.includes(keyword));
      el.innerHTML = `
        <div class="erp-panel">
          <div class="erp-toolbar">
            <span class="erp-toolbar__title">품목관리</span>
            <div class="erp-toolbar__actions">
              <button class="erp-btn erp-btn--primary" data-act="new">신규등록</button>
              <button class="erp-btn" data-act="edit" ${selectedId ? '' : 'disabled'}>수정</button>
              <button class="erp-btn erp-btn--danger" data-act="del" ${selectedId ? '' : 'disabled'}>삭제</button>
            </div>
            <div class="erp-toolbar__filter">
              <label>검색 <input type="text" data-filter value="${fmt.esc(keyword)}" placeholder="품목코드/품명" /></label>
            </div>
          </div>
          ${gridHtml({
            columns: [
              { label: 'No', width: '36px' },
              { label: '품목코드', width: '90px' },
              { label: '품명' },
              { label: '단위', width: '56px' },
              { label: '매입단가', width: '100px' },
              { label: '매출단가', width: '100px' },
              { label: '마진', width: '100px' },
              { label: '비고', width: '120px' },
            ],
            rows: rows.map((p, i) => ({
              id: p.id,
              _cls: p.id === selectedId ? 'dg__row--selected' : '',
              cells: [
                { html: String(i + 1), cls: 'dg__no' },
                { html: fmt.esc(p.code), cls: 'dg__center' },
                { html: fmt.esc(p.name) },
                { html: fmt.esc(p.unit), cls: 'dg__center' },
                { html: fmt.comma(p.purchasePrice), cls: 'dg__num' },
                { html: fmt.comma(p.salesPrice), cls: 'dg__num' },
                { html: fmt.comma(p.salesPrice - p.purchasePrice), cls: 'dg__num' },
                { html: fmt.esc(p.memo) },
              ],
            })),
            emptyText: '등록된 품목이 없습니다.',
          })}
        </div>`;

      bindRowSelect(el, (id) => {
        selectedId = id;
        el.querySelector('[data-act="edit"]').disabled = false;
        el.querySelector('[data-act="del"]').disabled = false;
      });

      el.querySelector('[data-filter]').addEventListener('input', (e) => {
        keyword = e.target.value.trim();
        selectedId = null;
        draw();
        const inp = el.querySelector('[data-filter]');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      });

      el.querySelector('[data-act="new"]').addEventListener('click', () => panels.products.form(el, ctx, null));
      el.querySelector('[data-act="edit"]').addEventListener('click', () => {
        if (selectedId) panels.products.form(el, ctx, selectedId);
      });
      el.querySelector('[data-act="del"]').addEventListener('click', () => {
        if (!selectedId) return;
        if (confirm('선택한 품목을 삭제하시겠습니까?')) {
          store.removeProduct(selectedId);
          selectedId = null;
          draw();
        }
      });
    };

    draw();
  },

  form(el, ctx, id) {
    const p = id ? store.products.find((x) => x.id === id) : null;
    el.innerHTML = `
      <div class="erp-panel erp-panel--form erp-panel--card-form">
        <div class="erp-form-card">
          <div class="erp-form-card__title">${p ? '품목 수정' : '품목 신규등록'}</div>
          <form class="erp-form-grid" id="product-form">
            <label><span>품목코드 *</span><input name="code" required value="${fmt.esc(p?.code || '')}" placeholder="P-000" /></label>
            <label class="erp-form-grid__half"><span>품명 *</span><input name="name" required value="${fmt.esc(p?.name || '')}" /></label>
            <label><span>단위</span><input name="unit" value="${fmt.esc(p?.unit || 'EA')}" /></label>
            <label><span>매입단가</span><input name="purchasePrice" type="number" min="0" value="${p?.purchasePrice ?? 0}" /></label>
            <label><span>매출단가</span><input name="salesPrice" type="number" min="0" value="${p?.salesPrice ?? 0}" /></label>
            <label class="erp-form-grid__wide"><span>비고</span><input name="memo" value="${fmt.esc(p?.memo || '')}" /></label>
          </form>
          <div class="erp-form-error" id="form-error"></div>
          <div class="erp-form-actions">
            <button class="erp-btn" data-act="cancel">취소 (목록)</button>
            <button class="erp-btn erp-btn--primary" data-act="save">저장</button>
          </div>
        </div>
      </div>`;

    el.querySelector('[data-act="cancel"]').addEventListener('click', () => panels.products.render(el, ctx));
    el.querySelector('[data-act="save"]').addEventListener('click', () => {
      const f = el.querySelector('#product-form');
      const v = Object.fromEntries(new FormData(f).entries());
      if (!v.code.trim() || !v.name.trim()) {
        el.querySelector('#form-error').textContent = '품목코드와 품명은 필수 입력입니다.';
        return;
      }
      v.purchasePrice = fmt.parseNum(v.purchasePrice);
      v.salesPrice = fmt.parseNum(v.salesPrice);
      if (p) store.updateProduct(p.id, v);
      else store.addProduct(v);
      panels.products.render(el, ctx);
    });
  },
};

/* ---------- 매출/매입 목록 (공용) ---------- */
function txnListPanel(type) {
  const isSales = type === 'sales';
  const label = isSales ? '매출' : '매입';

  return {
    title: label + '관리',
    render(el, ctx) {
      let selectedId = null;
      let from = fmt.monthStart();
      let to = fmt.today();
      let keyword = '';

      const draw = () => {
        const rows = store.transactions
          .filter((t) => t.type === type)
          .filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
          .filter((t) => !keyword || store.companyName(t.companyId).includes(keyword))
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

        const sum = rows.reduce(
          (s, t) => ({ supply: s.supply + t.supply, vat: s.vat + t.vat, total: s.total + t.total, paid: s.paid + t.paid }),
          { supply: 0, vat: 0, total: 0, paid: 0 },
        );

        el.innerHTML = `
          <div class="erp-panel">
            <div class="erp-toolbar">
              <span class="erp-toolbar__title">${label}관리</span>
              <div class="erp-toolbar__actions">
                <button class="erp-btn erp-btn--primary" data-act="new">${label}등록</button>
                <button class="erp-btn" data-act="edit" ${selectedId ? '' : 'disabled'}>수정</button>
                <button class="erp-btn erp-btn--danger" data-act="del" ${selectedId ? '' : 'disabled'}>삭제</button>
              </div>
              <div class="erp-toolbar__filter">
                <label>기간 <input type="date" data-from value="${from}" /></label>
                <label>~ <input type="date" data-to value="${to}" /></label>
                <label>거래처 <input type="text" data-filter value="${fmt.esc(keyword)}" placeholder="거래처명" /></label>
              </div>
            </div>
            ${gridHtml({
              columns: [
                { label: 'No', width: '36px' },
                { label: '일자', width: '96px' },
                { label: '거래처' },
                { label: '품목수', width: '60px' },
                { label: '공급가액', width: '110px' },
                { label: '부가세', width: '96px' },
                { label: '합계', width: '110px' },
                { label: isSales ? '수금액' : '지급액', width: '110px' },
                { label: '잔액', width: '110px' },
                { label: '비고', width: '130px' },
              ],
              rows: rows.map((t, i) => ({
                id: t.id,
                _cls: (t.id === selectedId ? 'dg__row--selected ' : '') + (t.total - t.paid > 0 ? 'dg__row--highlight' : ''),
                cells: [
                  { html: String(i + 1), cls: 'dg__no' },
                  { html: fmt.esc(t.date), cls: 'dg__center' },
                  { html: fmt.esc(store.companyName(t.companyId)) },
                  { html: String(t.lines.length), cls: 'dg__center' },
                  { html: fmt.comma(t.supply), cls: 'dg__num' },
                  { html: fmt.comma(t.vat), cls: 'dg__num' },
                  { html: fmt.comma(t.total), cls: 'dg__num' },
                  { html: fmt.comma(t.paid), cls: 'dg__num' },
                  { html: fmt.comma(t.total - t.paid), cls: 'dg__num' },
                  { html: fmt.esc(t.memo) },
                ],
              })),
              footer: [
                { html: '합계', span: 4, cls: 'dg__center' },
                { html: fmt.comma(sum.supply), cls: 'dg__num' },
                { html: fmt.comma(sum.vat), cls: 'dg__num' },
                { html: fmt.comma(sum.total), cls: 'dg__num' },
                { html: fmt.comma(sum.paid), cls: 'dg__num' },
                { html: fmt.comma(sum.total - sum.paid), cls: 'dg__num' },
                { html: '' },
              ],
              emptyText: '조회된 ' + label + ' 전표가 없습니다.',
            })}
          </div>`;

        bindRowSelect(el, (id) => {
          selectedId = id;
          el.querySelector('[data-act="edit"]').disabled = false;
          el.querySelector('[data-act="del"]').disabled = false;
        });

        el.querySelector('[data-from]').addEventListener('change', (e) => { from = e.target.value; draw(); });
        el.querySelector('[data-to]').addEventListener('change', (e) => { to = e.target.value; draw(); });
        el.querySelector('[data-filter]').addEventListener('input', (e) => {
          keyword = e.target.value.trim();
          draw();
          const inp = el.querySelector('[data-filter]');
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        });

        el.querySelector('[data-act="new"]').addEventListener('click', () => ctx.openTab(type + '-new'));
        el.querySelector('[data-act="edit"]').addEventListener('click', () => {
          if (selectedId) ctx.openTab(type + '-new', { txnId: selectedId });
        });
        el.querySelector('[data-act="del"]').addEventListener('click', () => {
          if (!selectedId) return;
          if (confirm('선택한 전표를 삭제하시겠습니까?')) {
            store.removeTxn(selectedId);
            selectedId = null;
            draw();
            ctx.refreshStatus();
          }
        });
      };

      draw();
    },
  };
}

/* ---------- 매출/매입 등록 (공용) ---------- */
function txnFormPanel(type) {
  const isSales = type === 'sales';
  const label = isSales ? '매출' : '매입';
  const priceKey = isSales ? 'salesPrice' : 'purchasePrice';

  return {
    title: label + '등록',
    render(el, ctx, params) {
      const editing = params?.txnId ? store.transactions.find((t) => t.id === params.txnId) : null;
      const lines = editing
        ? editing.lines.map((l) => ({ ...l }))
        : [{ productId: '', name: '', qty: 1, price: 0 }];

      const state = {
        date: editing?.date || fmt.today(),
        companyId: editing?.companyId || '',
        paid: editing?.paid || 0,
        memo: editing?.memo || '',
      };

      const calc = () => {
        const supply = lines.reduce((s, l) => s + fmt.parseNum(l.qty) * fmt.parseNum(l.price), 0);
        const vat = Math.round(supply * 0.1);
        return { supply, vat, total: supply + vat };
      };

      const draw = () => {
        const { supply, vat, total } = calc();
        el.innerHTML = `
          <div class="erp-panel erp-panel--form">
            <div class="erp-toolbar">
              <span class="erp-toolbar__title">${label}${editing ? '수정' : '등록'}</span>
              <div class="erp-toolbar__actions">
                <button class="erp-btn erp-btn--primary" data-act="save">저장 (F8)</button>
                <button class="erp-btn" data-act="add-line">행추가</button>
                <button class="erp-btn" data-act="reset">초기화</button>
              </div>
            </div>
            <div class="erp-form-header">
              <label><span>일자 *</span><input type="date" data-h="date" value="${state.date}" /></label>
              <label><span>거래처 *</span>
                <select data-h="companyId">
                  <option value="">— 선택 —</option>
                  ${store.companies.map((c) => `<option value="${c.id}" ${state.companyId === c.id ? 'selected' : ''}>${fmt.esc(c.name)}</option>`).join('')}
                </select>
              </label>
              <label><span>${isSales ? '수금액' : '지급액'}</span><input type="number" min="0" data-h="paid" value="${state.paid}" /></label>
              <label><span>비고</span><input type="text" data-h="memo" value="${fmt.esc(state.memo)}" /></label>
            </div>
            <div class="dg-wrap dg-wrap--lines">
              <div class="dg-scroll">
                <table class="dg dg--edit">
                  <thead>
                    <tr>
                      <th style="width:36px">No</th>
                      <th>품목</th>
                      <th style="width:70px">수량</th>
                      <th style="width:110px">단가</th>
                      <th style="width:120px">공급가액</th>
                      <th style="width:40px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lines.map((l, i) => `
                      <tr data-line="${i}">
                        <td class="dg__no">${i + 1}</td>
                        <td>
                          <select class="dg-select" data-line-product>
                            <option value="">— 품목 선택 —</option>
                            ${store.products.map((p) => `<option value="${p.id}" ${l.productId === p.id ? 'selected' : ''}>${fmt.esc(p.code + ' ' + p.name)}</option>`).join('')}
                          </select>
                        </td>
                        <td><input class="dg-input dg-input--num" data-line-qty type="number" min="0" value="${l.qty}" /></td>
                        <td><input class="dg-input dg-input--num" data-line-price type="number" min="0" value="${l.price}" /></td>
                        <td class="dg__num">${fmt.comma(fmt.parseNum(l.qty) * fmt.parseNum(l.price))}</td>
                        <td><button class="dg__del" data-line-del title="행삭제">×</button></td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="erp-statusbar">
              <span>공급가액 <strong>${fmt.comma(supply)}</strong></span>
              <span>부가세 <strong>${fmt.comma(vat)}</strong></span>
              <span class="${isSales ? 'erp-statusbar__sales' : 'erp-statusbar__purchase'}">합계 <strong>${fmt.comma(total)}</strong></span>
              <span>잔액 <strong>${fmt.comma(total - fmt.parseNum(state.paid))}</strong></span>
            </div>
            <div class="erp-form-error" id="txn-error"></div>
          </div>`;

        el.querySelectorAll('[data-h]').forEach((inp) => {
          inp.addEventListener('change', () => {
            const k = inp.dataset.h;
            state[k] = k === 'companyId' || k === 'paid' ? fmt.parseNum(inp.value) : inp.value;
            if (k === 'paid') draw();
          });
        });

        el.querySelectorAll('tr[data-line]').forEach((tr) => {
          const i = Number(tr.dataset.line);
          tr.querySelector('[data-line-product]').addEventListener('change', (e) => {
            const p = store.products.find((x) => x.id === Number(e.target.value));
            lines[i].productId = p?.id || '';
            lines[i].name = p?.name || '';
            if (p) lines[i].price = p[priceKey];
            draw();
          });
          tr.querySelector('[data-line-qty]').addEventListener('change', (e) => {
            lines[i].qty = fmt.parseNum(e.target.value);
            draw();
          });
          tr.querySelector('[data-line-price]').addEventListener('change', (e) => {
            lines[i].price = fmt.parseNum(e.target.value);
            draw();
          });
          tr.querySelector('[data-line-del]').addEventListener('click', () => {
            lines.splice(i, 1);
            if (!lines.length) lines.push({ productId: '', name: '', qty: 1, price: 0 });
            draw();
          });
        });

        el.querySelector('[data-act="add-line"]').addEventListener('click', () => {
          lines.push({ productId: '', name: '', qty: 1, price: 0 });
          draw();
        });

        el.querySelector('[data-act="reset"]').addEventListener('click', () => {
          if (confirm('입력 내용을 초기화하시겠습니까?')) {
            ctx.openTab(type + '-new', {}, true);
          }
        });

        el.querySelector('[data-act="save"]').addEventListener('click', save);
      };

      const save = () => {
        const err = el.querySelector('#txn-error');
        if (!state.date) { err.textContent = '일자를 입력하세요.'; return; }
        if (!state.companyId) { err.textContent = '거래처를 선택하세요.'; return; }
        const valid = lines.filter((l) => l.productId && fmt.parseNum(l.qty) > 0);
        if (!valid.length) { err.textContent = '품목을 1건 이상 입력하세요.'; return; }

        const supply = valid.reduce((s, l) => s + fmt.parseNum(l.qty) * fmt.parseNum(l.price), 0);
        const vat = Math.round(supply * 0.1);
        const payload = {
          type,
          date: state.date,
          companyId: Number(state.companyId),
          lines: valid.map((l, i) => ({
            no: i + 1,
            productId: Number(l.productId),
            name: l.name,
            qty: fmt.parseNum(l.qty),
            price: fmt.parseNum(l.price),
            amount: fmt.parseNum(l.qty) * fmt.parseNum(l.price),
          })),
          supply,
          vat,
          total: supply + vat,
          paid: fmt.parseNum(state.paid),
          memo: state.memo,
        };

        if (editing) store.updateTxn(editing.id, payload);
        else store.addTxn(payload);

        ctx.refreshStatus();
        ctx.openTab(type + '-list', {}, true);
      };

      draw();
    },
  };
}

/* ---------- 미수금 / 미지급금 ---------- */
function outstandingPanel(type) {
  const isSales = type === 'sales';
  const label = isSales ? '미수금' : '미지급금';

  return {
    title: label,
    render(el) {
      const rows = store.outstanding(type);
      const sum = rows.reduce((s, r) => s + r.balance, 0);

      el.innerHTML = `
        <div class="erp-panel">
          <div class="erp-toolbar">
            <span class="erp-toolbar__title">${label} 현황</span>
            <div class="erp-toolbar__filter">
              <label>합계 <strong style="font-size:13px">&nbsp;${fmt.won(sum)}</strong></label>
            </div>
          </div>
          ${gridHtml({
            columns: [
              { label: 'No', width: '36px' },
              { label: '거래처' },
              { label: '거래건수', width: '80px' },
              { label: '총액', width: '120px' },
              { label: isSales ? '수금액' : '지급액', width: '120px' },
              { label: label + ' 잔액', width: '130px' },
              { label: '최근 거래일', width: '110px' },
            ],
            rows: rows.map((r, i) => ({
              id: r.companyId,
              _cls: 'dg__row--highlight',
              cells: [
                { html: String(i + 1), cls: 'dg__no' },
                { html: fmt.esc(r.name) },
                { html: String(r.count), cls: 'dg__center' },
                { html: fmt.comma(r.total), cls: 'dg__num' },
                { html: fmt.comma(r.paid), cls: 'dg__num' },
                { html: `<b>${fmt.comma(r.balance)}</b>`, cls: 'dg__num' },
                { html: fmt.esc(r.lastDate), cls: 'dg__center' },
              ],
            })),
            footer: [
              { html: '합계', span: 3, cls: 'dg__center' },
              { html: fmt.comma(rows.reduce((s, r) => s + r.total, 0)), cls: 'dg__num' },
              { html: fmt.comma(rows.reduce((s, r) => s + r.paid, 0)), cls: 'dg__num' },
              { html: fmt.comma(sum), cls: 'dg__num' },
              { html: '' },
            ],
            emptyText: label + ' 잔액이 없습니다.',
          })}
        </div>`;
    },
  };
}

panels['sales-list'] = txnListPanel('sales');
panels['sales-new'] = txnFormPanel('sales');
panels['sales-receivables'] = outstandingPanel('sales');
panels['purchase-list'] = txnListPanel('purchase');
panels['purchase-new'] = txnFormPanel('purchase');
panels['purchase-payables'] = outstandingPanel('purchase');
