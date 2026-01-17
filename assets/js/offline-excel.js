/**
 * Offline Excel exporter (SpreadsheetML 2003 XML).
 *
 * Why: Provides multi-sheet "Excel" export without external libs/CDN.
 * Output: .xls (Excel XML) which opens in Excel/LibreOffice.
 */
export function exportSpreadsheetMLWorkbook(sheets, filename){
  const safeName = ensureXlsExtension(filename || 'export.xls');
  const xml = buildSpreadsheetML(sheets);
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), safeName);
}

function ensureXlsExtension(name){
  const n = String(name || 'export.xls');
  return /\.(xls|xml)$/i.test(n) ? n : `${n}.xls`;
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escXml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isNumberLike(v){
  if(v === null || v === undefined) return false;
  const s = String(v).trim();
  if(!s) return false;
  // Accept: 123, -123, 123.45
  return /^-?\d+(\.\d+)?$/.test(s);
}

function buildSpreadsheetML(sheets){
  const ws = (Array.isArray(sheets) ? sheets : []).map(s => buildWorksheet(s?.name, s?.aoa)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#F2F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 ${ws}
</Workbook>`;
}

function buildWorksheet(name, aoa){
  const sheetName = escXml(String(name || 'Sheet').slice(0, 31));
  const rows = Array.isArray(aoa) ? aoa : [];
  const xmlRows = rows.map((row, i) => buildRow(row, i === 0)).join('\n');

  return `<Worksheet ss:Name="${sheetName}">
  <Table>
   ${xmlRows}
  </Table>
 </Worksheet>`;
}

function buildRow(row, isHeader){
  const cells = (Array.isArray(row) ? row : []).map(v => buildCell(v, isHeader)).join('');
  return `<Row>${cells}</Row>`;
}

function buildCell(value, isHeader){
  const style = isHeader ? 'sHeader' : 'sCell';
  const v = value ?? '';
  const type = isNumberLike(v) && !isHeader ? 'Number' : 'String';
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${escXml(v)}</Data></Cell>`;
}
