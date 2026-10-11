export function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return /[",\n]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}

export function serializeCsvRows(rows: readonly (readonly string[])[]) {
  return `\uFEFF${rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n')}\r\n`;
}
