import { todayISO, uid, getCurrencySymbol } from './utils.js';

export const APP_KEY = 'alghadeer_app_v2';

export function loadApp(){
  try{
    const raw = localStorage.getItem(APP_KEY);
    if(!raw) return emptyApp();
    const data = JSON.parse(raw);
    if(!data || data.v !== 2) return emptyApp();
    data.clients ||= [];
    data.invoicesByClient ||= {};
    data.statementsByInvoice ||= {};
    return data;
  }catch{
    return emptyApp();
  }
}

export function saveApp(app){
  localStorage.setItem(APP_KEY, JSON.stringify(app));
}

export function emptyApp(){
  return { v:2, clients:[], invoicesByClient:{}, statementsByInvoice:{} };
}

export function getClient(app, id){
  return app.clients.find(c => c.id === id) || null;
}

export function getInvoices(app, clientId){
  return app.invoicesByClient[clientId] || [];
}

export function getStatement(app, invoiceId){
  return app.statementsByInvoice[invoiceId] || null;
}

export function defaultStatement(currency, invoiceName){
  const sym = getCurrencySymbol(currency);
  return {
    sv: 1,
    meta: { date: todayISO(), period: 'مفتوحة', currency: sym, invoiceName: invoiceName || 'فاتورة' },
    t1: { headerTitles: ['رقم','البيان','المبلغ'], rows: [['1','شغل',`0${sym}`]] },
    t2: { headerTitles: ['رقم','التاريخ','البيان','المبلغ'], rows: [['1','','استلام نقدي',`0${sym}`]] },
  };
}

export function ensureClientHasFirstInvoice(app, clientId){
  app.invoicesByClient[clientId] ||= [];
  const list = app.invoicesByClient[clientId];
  if(list.length > 0) return;

  const invId = uid('inv');
  const invName = 'فاتورة 1';
  list.push({ id: invId, name: invName, date: todayISO(), createdAt: Date.now() });

  const c = getClient(app, clientId);
  app.statementsByInvoice[invId] = defaultStatement(c?.currency || '$', invName);
}
