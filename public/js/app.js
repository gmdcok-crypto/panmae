/* ERP 셸 — 트리 메뉴 · MDI 탭 · 상태바 */
(() => {
  const MENUS = [
    {
      label: '기초정보',
      items: [
        { kind: 'companies', label: '거래처관리' },
        { kind: 'products', label: '품목관리' },
      ],
    },
    {
      label: '매출',
      items: [
        { kind: 'sales-list', label: '매출관리' },
        { kind: 'sales-new', label: '매출등록' },
        { kind: 'sales-receivables', label: '미수금' },
      ],
    },
    {
      label: '매입',
      items: [
        { kind: 'purchase-list', label: '매입관리' },
        { kind: 'purchase-new', label: '매입등록' },
        { kind: 'purchase-payables', label: '미지급금' },
      ],
    },
    {
      label: '보고서',
      items: [{ kind: 'daily-report', label: '일계표' }],
    },
  ];

  const shell = document.getElementById('app');
  const treeEl = document.getElementById('tree-menu');
  const tabStripEl = document.getElementById('tab-strip');
  const workspaceEl = document.getElementById('workspace');
  const statusbarEl = document.getElementById('statusbar');

  /* 탭 상태 */
  let tabs = [{ kind: 'home', params: {} }];
  let activeKind = 'home';
  const expanded = Object.fromEntries(MENUS.map((m) => [m.label, true]));

  const ctx = {
    openTab,
    refreshStatus: renderStatusbar,
  };

  function openTab(kind, params = {}, forceRerender = false) {
    const existing = tabs.find((t) => t.kind === kind);
    if (!existing) {
      tabs.push({ kind, params });
    } else {
      existing.params = params;
    }
    const rerender = forceRerender || !existing || Object.keys(params).length > 0;
    activeKind = kind;
    closeMobileMenu();
    renderAll(rerender);
  }

  function closeTab(kind) {
    const idx = tabs.findIndex((t) => t.kind === kind);
    if (idx < 0 || kind === 'home') return;
    tabs.splice(idx, 1);
    if (activeKind === kind) {
      activeKind = (tabs[idx - 1] || tabs[0]).kind;
    }
    renderAll(true);
  }

  /* ---------- 트리 메뉴 ---------- */
  function renderTree() {
    const groupHtml = MENUS.map((group) => {
      const open = expanded[group.label];
      const groupActive = group.items.some((i) => i.kind === activeKind);
      return `
        <div class="erp-tree__group">
          <button type="button"
            class="erp-tree__item erp-tree__item--branch${groupActive ? ' erp-tree__item--parent-active' : ''}"
            data-group="${fmt.esc(group.label)}" aria-expanded="${open}">
            <span class="erp-tree__toggle">${open ? '▼' : '▶'}</span>
            <span class="erp-tree__label">${fmt.esc(group.label)}</span>
          </button>
          ${open ? `
            <div class="erp-tree__children">
              ${group.items.map((item) => `
                <button type="button"
                  class="erp-tree__item erp-tree__item--leaf${activeKind === item.kind ? ' erp-tree__item--active' : ''}"
                  data-kind="${item.kind}">
                  <span class="erp-tree__icon">·</span>
                  <span class="erp-tree__label">${fmt.esc(item.label)}</span>
                </button>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('');

    treeEl.innerHTML = `
      <button type="button"
        class="erp-tree__item erp-tree__item--root${activeKind === 'home' ? ' erp-tree__item--active' : ''}"
        data-kind="home">
        <span class="erp-tree__icon">▪</span>
        <span class="erp-tree__label">홈</span>
      </button>
      ${groupHtml}`;

    treeEl.querySelectorAll('[data-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        expanded[btn.dataset.group] = !expanded[btn.dataset.group];
        renderTree();
      });
    });

    treeEl.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => openTab(btn.dataset.kind));
    });
  }

  /* ---------- 탭 스트립 ---------- */
  function renderTabs() {
    tabStripEl.innerHTML = tabs
      .map((t) => {
        const p = panels[t.kind];
        const active = t.kind === activeKind;
        return `
          <div class="erp-tab${active ? ' erp-tab--active' : ''}" data-tab="${t.kind}" role="tab" aria-selected="${active}">
            <span class="erp-tab__label">${fmt.esc(p?.title || t.kind)}</span>
            ${t.kind === 'home' ? '' : `<button type="button" class="erp-tab__close" data-close="${t.kind}" aria-label="탭 닫기">×</button>`}
          </div>`;
      })
      .join('');

    tabStripEl.querySelectorAll('[data-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) return;
        if (tab.dataset.tab !== activeKind) {
          activeKind = tab.dataset.tab;
          renderAll(false);
        }
      });
    });

    tabStripEl.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeTab(btn.dataset.close));
    });
  }

  /* ---------- 워크스페이스 ---------- */
  const panelHosts = new Map();

  function renderWorkspace(rerenderActive) {
    for (const [kind, host] of panelHosts) {
      if (!tabs.some((t) => t.kind === kind)) {
        host.remove();
        panelHosts.delete(kind);
      }
    }

    for (const tab of tabs) {
      let host = panelHosts.get(tab.kind);
      const isActive = tab.kind === activeKind;
      if (!host) {
        host = document.createElement('div');
        host.style.width = '100%';
        host.style.height = '100%';
        workspaceEl.appendChild(host);
        panelHosts.set(tab.kind, host);
        panels[tab.kind]?.render(host, ctx, tab.params);
      } else if (isActive && rerenderActive) {
        panels[tab.kind]?.render(host, ctx, tab.params);
      }
      host.style.display = isActive ? '' : 'none';
    }
  }

  /* ---------- 상태바 ---------- */
  function renderStatusbar() {
    const s = store.monthlySummary();
    statusbarEl.innerHTML = `
      <span class="erp-statusbar__sales">이번 달 매출 <strong>${fmt.won(s.sales)}</strong></span>
      <span class="erp-statusbar__purchase">이번 달 매입 <strong>${fmt.won(s.purchase)}</strong></span>
      <span>미수금 <strong>${fmt.won(s.receivable)}</strong></span>
      <span>미지급금 <strong>${fmt.won(s.payable)}</strong></span>`;
  }

  function renderAll(rerenderActive) {
    renderTree();
    renderTabs();
    renderWorkspace(rerenderActive);
    renderStatusbar();
  }

  /* ---------- 모바일 메뉴 ---------- */
  function closeMobileMenu() {
    shell.classList.remove('erp-shell--menu-open');
  }

  document.querySelectorAll('[data-action="open-menu"]').forEach((b) =>
    b.addEventListener('click', () => shell.classList.add('erp-shell--menu-open')),
  );
  document.querySelectorAll('[data-action="close-menu"]').forEach((b) =>
    b.addEventListener('click', closeMobileMenu),
  );

  /* ---------- 시계 · 단축키 ---------- */
  const clockEl = document.getElementById('footer-clock');
  const tick = () => { clockEl.textContent = fmt.clock(); };
  tick();
  setInterval(tick, 30_000);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F8') {
      const btn = workspaceEl.querySelector('[data-act="save"]');
      if (btn && btn.closest('div').style.display !== 'none') {
        e.preventDefault();
        btn.click();
      }
    }
  });

  (async () => {
    workspaceEl.innerHTML = '<div class="erp-panel erp-panel--home"><p>데이터 불러오는 중…</p></div>';
    try {
      await store.reload();
      renderAll(true);
    } catch (err) {
      workspaceEl.innerHTML = `<div class="erp-panel erp-panel--home"><p style="color:#c00">데이터 로드 실패: ${fmt.esc(err.message)}</p>
        <p>Railway 앱 Variables에 MySQL Reference가 연결됐는지 확인하세요.</p>
        <button class="erp-btn erp-btn--primary" type="button" onclick="location.reload()">다시 시도</button></div>`;
    }
  })();
})();
