import { parseMoney } from './utils.js';

function sanitizeSheetName(name){
  return String(name).replace(/[\[\]\*\/\\\?\:]/g, ' ').slice(0, 31);
}

export function exportWorkbook(sheets, filename){
  if(typeof XLSX !== 'undefined'){
    const wb = XLSX.utils.book_new();
    for(const s of sheets){
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(s.name));
    }
    XLSX.writeFile(wb, filename);
    return;
  }

  // Offline fallback (.xls SpreadsheetML)
  import('./offline-excel.js')
    .then(m => m.exportSpreadsheetMLWorkbook(sheets, filename))
    .catch(() => alert('تعذر التصدير: مكتبة التصدير غير متاحة.'));
}

export function tableDomToAoA(tableEl, totalsLabel, totalsValue){
  const headers = Array.from(tableEl.tHead.rows[0].cells).map(c => c.innerText);
  const body = Array.from(tableEl.tBodies[0].rows).map(tr => Array.from(tr.cells).map(td => td.innerText));

  const totalsRow = new Array(headers.length).fill('');
  if(headers.length >= 2) totalsRow[headers.length - 2] = totalsLabel;
  if(headers.length >= 1) totalsRow[headers.length - 1] = totalsValue;

  return [headers, ...body, totalsRow];
}

export function payloadToAoA(payload, totalLabel, sym){
  const headers = Array.isArray(payload?.headerTitles) ? payload.headerTitles : [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  const total = sumAmountFromPayload(payload);
  const totalsRow = new Array(headers.length).fill('');
  if(headers.length >= 2) totalsRow[headers.length - 2] = totalLabel;
  if(headers.length >= 1) totalsRow[headers.length - 1] = `${total}${sym}`;

  return [headers, ...rows, totalsRow];
}

export function sumAmountFromPayload(t){
  if(!t || !Array.isArray(t.rows) || !Array.isArray(t.headerTitles)) return 0;
  const amountIdx = Math.max(0, t.headerTitles.length - 1);
  let sum = 0;
  for(const r of t.rows){
    sum += parseMoney(r?.[amountIdx] ?? '');
  }
  return sum;
}
