// ===================================================
// HISTORY VIEW – Stock Ledger / Move History
// ===================================================

const HistoryView = {
  filterType: 'all',
  searchRef: '',

  render() {
    document.getElementById('page-title').textContent = 'Move History';
    document.getElementById('page-content').innerHTML = `
      <div class="page-header flex items-center justify-between">
        <div>
          <div class="page-title">Stock Ledger</div>
          <div class="page-subtitle">Complete log of all stock movements, adjustments, and transfers</div>
        </div>
        <button class="btn btn-outline" onclick="HistoryView.exportCSV()">⬇️ Export</button>
      </div>

      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="topbar-search" style="width:240px">
            <span>🔍</span>
            <input type="text" placeholder="Search by ref or product…" oninput="HistoryView.handleSearch(this.value)">
          </div>
          <select class="filter-select" onchange="HistoryView.filterType=this.value;HistoryView.refresh()">
            <option value="all">All Types</option>
            <option value="receipt">📥 Receipts</option>
            <option value="delivery">📤 Deliveries</option>
            <option value="transfer">🔄 Transfers</option>
            <option value="adjustment">🔧 Adjustments</option>
          </select>
          <span class="text-muted text-sm" id="hist-count" style="margin-left:auto"></span>
        </div>
        <table>
          <thead><tr>
            <th>Date & Time</th><th>Type</th><th>Reference</th>
            <th>Product</th><th>Qty Change</th><th>From</th><th>To</th><th>Note</th>
          </tr></thead>
          <tbody id="history-tbody"></tbody>
        </table>
      </div>`;

    this.refresh();
  },

  filteredLedger() {
    const q = this.searchRef.toLowerCase();
    return AppState.ledger.filter(l => {
      const prod = AppState.getProductById(l.productId);
      const matchType = this.filterType === 'all' || l.type === this.filterType;
      const matchQ    = !q || l.ref.toLowerCase().includes(q) || prod?.name.toLowerCase().includes(q);
      return matchType && matchQ;
    });
  },

  refresh() {
    const entries = this.filteredLedger();
    const countEl = document.getElementById('hist-count');
    if (countEl) countEl.textContent = `${entries.length} entries`;
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    const icons  = { receipt:'📥', delivery:'📤', transfer:'🔄', adjustment:'🔧' };
    const colors = { receipt:'success', delivery:'warning', transfer:'info', adjustment:'danger' };

    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-state-icon">📋</span><p class="empty-state-text">No history entries</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = entries.map(l => {
      const prod = AppState.getProductById(l.productId);
      const color = colors[l.type]||'info';
      return `<tr>
        <td class="td-muted" style="font-size:12px">${l.date}</td>
        <td><span class="badge badge-${color}">${icons[l.type]||'•'} ${l.type}</span></td>
        <td><span class="badge badge-muted">${l.ref}</span></td>
        <td class="td-primary">${prod?.name||'—'}</td>
        <td style="font-weight:800;color:${l.qty>=0?'var(--success)':'var(--danger)'}">${l.qty>0?'+':''}${l.qty} ${prod?.uom||''}</td>
        <td class="td-muted">${l.fromLoc}</td>
        <td class="td-muted">${l.toLoc}</td>
        <td class="td-muted" style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.note}</td>
      </tr>`;
    }).join('');
  },

  handleSearch(q) { this.searchRef = q; this.refresh(); },

  exportCSV() {
    const headers = ['Date','Type','Reference','Product','Qty','From','To','Note'];
    const rows = this.filteredLedger().map(l => {
      const prod = AppState.getProductById(l.productId);
      return [l.date, l.type, l.ref, prod?.name||'', l.qty, l.fromLoc, l.toLoc, l.note]
        .map(v => `"${String(v).replace(/"/g,'""')}"`)
        .join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stock_ledger_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    Toast.show('success','Exported', 'Stock ledger downloaded as CSV.');
  }
};

window.HistoryView = HistoryView;
