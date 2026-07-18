/* 숫자·날짜 포맷 유틸 */
const fmt = {
  comma(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('ko-KR');
  },

  won(n) {
    return fmt.comma(n) + '원';
  },

  today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  },

  monthStart() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  },

  parseNum(s) {
    if (typeof s === 'number') return s;
    const v = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(v) ? v : 0;
  },

  clock() {
    const d = new Date();
    return (
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0')
    );
  },

  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
