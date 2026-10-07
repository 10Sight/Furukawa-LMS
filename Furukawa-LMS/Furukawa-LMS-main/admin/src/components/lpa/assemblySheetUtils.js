export function isAssemblyCheckSheet(sheet) {
  return sheet?.columnCount === 14 && sheet.merges?.some(merge =>
    merge.s.r === 3 && merge.s.c === 11 && merge.e.c === 12 && merge.e.r >= 30);
}
