export function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();
}
