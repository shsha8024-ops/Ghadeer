export function todayISO(){
  const d = new Date();
  const z = (n) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}

export function uid(prefix){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

export function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");
}

export function getCurrencySymbol(currency){
  if(currency === 'IQD') return 'IQD';
  if(currency === 'USD') return 'USD';
  return '$';
}

export function normalizeDigits(s){
  const map = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
  };
  return String(s ?? '').replace(/[٠-٩۰-۹]/g, ch => map[ch] ?? ch);
}

export function parseMoney(text){
  const normalized = normalizeDigits(text);
  const cleaned = normalized.replace(/[^0-9.\-]/g,'');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}
