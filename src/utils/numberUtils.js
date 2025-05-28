function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim();
  // Remove spaces
  let v = str.replace(/\s+/g, '');
  // Format like 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(v)) {
    v = v.replace(/\./g, '').replace(',', '.');
    return Number(v) || 0;
  }
  // Format like 1,234.56 -> 1234.56
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(v)) {
    v = v.replace(/,/g, '');
    return Number(v) || 0;
  }
  // Simple replace comma decimal
  return Number(v.replace(',', '.')) || 0;
}
module.exports = { parseNumber };
