/**
 * Wave 19 — tiny dependency-free CSV exporter.
 * UTF-8 BOM is prepended so Excel opens Dari/Pashto text correctly.
 */

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const rowsToCsv = (
  headers: (string | number)[],
  rows: (string | number | null | undefined)[][],
): string =>
  [headers, ...rows]
    .map(r => r.map(escapeCell).join(','))
    .join('\r\n');

export const downloadCsv = (
  filename: string,
  headers: (string | number)[],
  rows: (string | number | null | undefined)[][],
): void => {
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
