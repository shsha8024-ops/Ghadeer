export class TableEditor{
  constructor(opts){
    this.table = document.getElementById(opts.tableId);
    this.minCols = opts.minCols;
    this.getCurrencySymbol = opts.getCurrencySymbol;
    this.onChange = opts.onChange;
    this.sel = { rowIndex:null, colIndex:null };

    this._bindSelection();
  }

  get colCount(){
    return this.table.tHead.rows[0].cells.length;
  }

  get amountColIndex(){
    return this.colCount - 1;
  }

  updateFooterColspan(footLabelId){
    const colCount = this.colCount;
    const el = document.getElementById(footLabelId);
    if(el) el.setAttribute('colspan', String(colCount - 1));
  }

  renumber(){
    const rows = this.table.tBodies[0].rows;
    for(let i=0;i<rows.length;i++){
      rows[i].cells[0].innerText = String(i + 1);
    }
  }

  _clearSelectionStyles(){
    this.table.querySelectorAll('tr.selected-row').forEach(tr => tr.classList.remove('selected-row'));
    this.table.querySelectorAll('td.selected-col').forEach(td => td.classList.remove('selected-col'));
  }

  _applySelectionStyles(){
    this._clearSelectionStyles();
    const { rowIndex, colIndex } = this.sel;

    if(rowIndex !== null){
      const tr = this.table.tBodies[0].rows[rowIndex];
      if(tr) tr.classList.add('selected-row');
    }
    if(colIndex !== null){
      for(const tr of this.table.tBodies[0].rows){
        const td = tr.cells[colIndex];
        if(td) td.classList.add('selected-col');
      }
    }
  }

  _bindSelection(){
    document.addEventListener('click', (e) => {
      const t = e.target.closest?.('table');
      if(!t || t !== this.table) return;

      const isTh = e.target.tagName === 'TH';
      const isTd = e.target.tagName === 'TD';
      if(!isTh && !isTd) return;

      const colIndex = e.target.cellIndex;
      let rowIndex = null;

      if(isTd){
        const tr = e.target.closest('tr');
        rowIndex = Array.from(this.table.tBodies[0].rows).indexOf(tr);
        if(rowIndex < 0) rowIndex = null;
      }

      this.sel = { rowIndex, colIndex };
      this._applySelectionStyles();
    });
  }

  addRow(){
    const sym = this.getCurrencySymbol();
    const tr = document.createElement('tr');

    for(let c=0;c<this.colCount;c++){
      const td = document.createElement('td');

      if(c === 0){
        td.innerText = String(this.table.tBodies[0].rows.length + 1);
      }else if(c === this.amountColIndex){
        td.contentEditable = 'true';
        td.classList.add('amount');
        td.innerText = `0${sym}`;
      }else{
        td.contentEditable = 'true';
        td.innerText = '';
      }
      tr.appendChild(td);
    }

    this.table.tBodies[0].appendChild(tr);
    this.renumber();
    this._emitChange();
  }

  removeSelectedRow(){
    const tbody = this.table.tBodies[0];
    if(tbody.rows.length <= 1) return;
    if(this.sel.rowIndex === null) return;

    tbody.deleteRow(this.sel.rowIndex);
    this.sel.rowIndex = null;
    this.renumber();
    this._applySelectionStyles();
    this._emitChange();
  }

  addColumn(promptTitle = true){
    const headerRow = this.table.tHead.rows[0];
    const insertIndex = this.amountColIndex;

    let title = 'عمود جديد';
    if(promptTitle){
      title = (prompt('اسم العمود الجديد؟', 'عمود جديد') || 'عمود جديد').trim();
    }

    const th = document.createElement('th');
    th.innerText = title;
    headerRow.insertBefore(th, headerRow.cells[insertIndex]);

    for(const tr of this.table.tBodies[0].rows){
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.innerText = '';
      tr.insertBefore(td, tr.cells[insertIndex]);
    }

    this._emitChange();
  }

  addColumnAfterSelected(){
    const headerRow = this.table.tHead.rows[0];
    const amountIdx = this.amountColIndex;

    let insertIndex = amountIdx;
    if(this.sel.colIndex !== null && this.sel.colIndex > 0 && this.sel.colIndex < amountIdx){
      insertIndex = this.sel.colIndex + 1;
    }

    const title = (prompt('اسم العمود الجديد؟', 'عمود جديد') || 'عمود جديد').trim();
    const th = document.createElement('th');
    th.innerText = title;
    headerRow.insertBefore(th, headerRow.cells[insertIndex]);

    for(const tr of this.table.tBodies[0].rows){
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.innerText = '';
      tr.insertBefore(td, tr.cells[insertIndex]);
    }

    this._emitChange();
  }

  removeSelectedColumn(){
    const headerRow = this.table.tHead.rows[0];
    const colCount = this.colCount;

    if(colCount <= this.minCols) return;
    if(this.sel.colIndex === null) return;

    const idx = this.sel.colIndex;
    if(idx === 0) return;
    if(idx === this.amountColIndex) return;

    headerRow.deleteCell(idx);
    for(const tr of this.table.tBodies[0].rows){
      tr.deleteCell(idx);
    }

    this.sel.colIndex = Math.min(idx, this.colCount - 2);
    this._applySelectionStyles();
    this._emitChange();
  }

  serialize(){
    const headerTitles = Array.from(this.table.tHead.rows[0].cells).map(th => th.innerText);
    const rows = Array.from(this.table.tBodies[0].rows).map(tr => Array.from(tr.cells).map(td => td.innerText));
    return { headerTitles, rows };
  }

  build(payload, currencySym){
    const headerTitles = Array.isArray(payload?.headerTitles) ? payload.headerTitles.slice() : [];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];

    const safeHeader = (headerTitles.length >= this.minCols)
      ? headerTitles
      : Array.from(this.table.tHead.rows[0].cells).map(th => th.innerText);

    this.table.tHead.innerHTML = '';
    const hr = document.createElement('tr');
    for(const title of safeHeader){
      const th = document.createElement('th');
      th.innerText = title;
      hr.appendChild(th);
    }
    this.table.tHead.appendChild(hr);

    this.table.tBodies[0].innerHTML = '';
    const colCount = this.colCount;
    const amountIdx = this.amountColIndex;

    const makeRow = (values, i) => {
      const tr = document.createElement('tr');
      for(let c=0;c<colCount;c++){
        const td = document.createElement('td');
        if(c === 0){
          td.innerText = String(i + 1);
        }else if(c === amountIdx){
          td.contentEditable = 'true';
          td.classList.add('amount');
          td.innerText = (values?.[c] ?? `0${currencySym}`);
        }else{
          td.contentEditable = 'true';
          td.innerText = (values?.[c] ?? '');
        }
        tr.appendChild(td);
      }
      return tr;
    };

    if(rows.length === 0){
      this.table.tBodies[0].appendChild(makeRow([], 0));
    }else{
      for(let i=0;i<rows.length;i++){
        this.table.tBodies[0].appendChild(makeRow(rows[i], i));
      }
    }

    this.renumber();
    this.sel = { rowIndex:null, colIndex:null };
    this._applySelectionStyles();
  }

  _emitChange(){
    if(typeof this.onChange === 'function') this.onChange();
  }
}
