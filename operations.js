// ===================================================
// OPERATIONS VIEW – Receipts, Deliveries, Transfers, Adjustments
// ===================================================

const OperationsView = {
  activeTab: 'receipts',

  render() {
    document.getElementById('page-title').textContent = 'Operations';
    document.getElementById('page-content').innerHTML = `
      <div class="page-header flex items-center justify-between">
        <div>
          <div class="page-title">Operations</div>
          <div class="page-subtitle">Manage stock movements, receipts, and adjustments</div>
        </div>
      </div>
      <div class="tabs">
        <button class="tab active" id="tab-receipts"   onclick="OperationsView.switchTab('receipts')">📥 Receipts</button>
        <button class="tab" id="tab-deliveries" onclick="OperationsView.switchTab('deliveries')">📤 Deliveries</button>
        <button class="tab" id="tab-transfers"  onclick="OperationsView.switchTab('transfers')">🔄 Transfers</button>
        <button class="tab" id="tab-adjustments"onclick="OperationsView.switchTab('adjustments')">🔧 Adjustments</button>
      </div>
      <div id="ops-content"></div>

      <!-- New Receipt Modal -->
      <div class="modal-overlay" id="receipt-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title" id="receipt-modal-title">New Receipt</span>
            <button class="modal-close" onclick="OperationsView.closeModal('receipt-modal')">✕</button>
          </div>
          <div class="modal-body" id="receipt-modal-body"></div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="OperationsView.closeModal('receipt-modal')">Cancel</button>
            <button class="btn btn-primary" id="save-receipt-btn" onclick="OperationsView.saveReceipt()">💾 Save</button>
          </div>
        </div>
      </div>

      <!-- New Delivery Modal -->
      <div class="modal-overlay" id="delivery-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <span class="modal-title" id="delivery-modal-title">New Delivery Order</span>
            <button class="modal-close" onclick="OperationsView.closeModal('delivery-modal')">✕</button>
          </div>
          <div class="modal-body" id="delivery-modal-body"></div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="OperationsView.closeModal('delivery-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="OperationsView.saveDelivery()">💾 Save</button>
          </div>
        </div>
      </div>

      <!-- New Transfer Modal -->
      <div class="modal-overlay" id="transfer-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">New Internal Transfer</span>
            <button class="modal-close" onclick="OperationsView.closeModal('transfer-modal')">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="OperationsView.saveTransfer(event)">
              <div class="form-group">
                <label class="form-label">Product</label>
                <select id="tf-prod" class="form-control filter-select" style="width:100%">
                  ${AppState.products.map(p=>`<option value="${p.id}">${p.name} (${p.onHand} ${p.uom})</option>`).join('')}
                </select>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">From Location</label>
                  <select id="tf-from" class="form-control filter-select" style="width:100%">
                    ${AppState.locations.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">To Location</label>
                  <select id="tf-to" class="form-control filter-select" style="width:100%">
                    ${AppState.locations.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Quantity</label>
                  <input id="tf-qty" type="number" min="1" class="form-control" value="1" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Note</label>
                  <input id="tf-note" class="form-control" placeholder="Reason for transfer">
                </div>
              </div>
              <button type="submit" style="display:none"></button>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="OperationsView.closeModal('transfer-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="OperationsView.saveTransfer(event)">💾 Save</button>
          </div>
        </div>
      </div>

      <!-- New Adjustment Modal -->
      <div class="modal-overlay" id="adj-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Inventory Adjustment</span>
            <button class="modal-close" onclick="OperationsView.closeModal('adj-modal')">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="OperationsView.saveAdjustment(event)">
              <div class="form-group">
                <label class="form-label">Product</label>
                <select id="adj-prod" class="form-control filter-select" style="width:100%" onchange="OperationsView.adjProductChanged()">
                  ${AppState.products.map(p=>`<option value="${p.id}">${p.name} – System: ${p.onHand} ${p.uom}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Location</label>
                <select id="adj-loc" class="form-control filter-select" style="width:100%">
                  ${AppState.locations.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">System Quantity (current)</label>
                  <input id="adj-system" type="number" class="form-control" readonly style="background:var(--bg-body)">
                </div>
                <div class="form-group">
                  <label class="form-label">Counted Quantity *</label>
                  <input id="adj-counted" type="number" min="0" class="form-control" required oninput="OperationsView.calcAdjDiff()">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Difference</label>
                <div id="adj-diff" style="font-size:18px;font-weight:800;padding:8px;color:var(--text-muted)">—</div>
              </div>
              <div class="form-group">
                <label class="form-label">Reason</label>
                <input id="adj-reason" class="form-control" placeholder="e.g. Physical count, damaged goods…" required>
              </div>
              <button type="submit" style="display:none"></button>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="OperationsView.closeModal('adj-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="OperationsView.saveAdjustment(event)">✅ Apply Adjustment</button>
          </div>
        </div>
      </div>`;

    this.renderTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    ['receipts','deliveries','transfers','adjustments'].forEach(t=>{
      document.getElementById(`tab-${t}`)?.classList.toggle('active', t===tab);
    });
    this.renderTab();
  },

  renderTab() {
    const el = document.getElementById('ops-content');
    if (!el) return;
    switch(this.activeTab) {
      case 'receipts':    el.innerHTML = this.receiptsHTML();    break;
      case 'deliveries':  el.innerHTML = this.deliveriesHTML();  break;
      case 'transfers':   el.innerHTML = this.transfersHTML();   break;
      case 'adjustments': el.innerHTML = this.adjustmentsHTML(); break;
    }
  },

  // ---- RECEIPTS ----
  receiptsHTML() {
    const rows = AppState.receipts.map(r=>{
      const sup = AppState.getSupplierById(r.supplierId);
      const wh  = AppState.getWarehouseById(r.warehouseId);
      const st  = { draft:'muted', waiting:'info', ready:'warning', done:'success', cancelled:'danger' }[r.status]||'muted';
      const canValidate = r.status !== 'done';
      return `<tr>
        <td class="td-primary">${r.id}</td>
        <td>${sup?.name||'-'}</td>
        <td>${wh?.name||'-'}</td>
        <td class="td-muted">${r.date}</td>
        <td>${r.lines.length} line(s)</td>
        <td><span class="badge badge-${st}">${r.status}</span></td>
        <td>
          ${canValidate?`<button class="btn btn-sm btn-success" onclick="OperationsView.validateReceipt('${r.id}')">✅ Validate</button>`:'<span class="badge badge-success">Done</span>'}
        </td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <span style="font-weight:700;font-size:15px">📥 Receipts (Incoming Stock)</span>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="OperationsView.openNewReceipt()">+ New Receipt</button>
        </div>
        <div style="padding:12px 22px;background:var(--bg-body);border-bottom:1px solid var(--border)">
          <div class="steps">
            <div class="step-item active"><div class="step-circle">1</div><div class="step-label">Create</div></div>
            <div class="step-item"><div class="step-circle">2</div><div class="step-label">Add Products</div></div>
            <div class="step-item"><div class="step-circle">3</div><div class="step-label">Enter Qty</div></div>
            <div class="step-item"><div class="step-circle">4</div><div class="step-label">Validate</div></div>
          </div>
        </div>
        <table><thead><tr>
          <th>Receipt #</th><th>Supplier</th><th>Warehouse</th><th>Date</th><th>Lines</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>${rows||'<tr><td colspan="7"><div class="empty-state"><span>📥</span><p>No receipts</p></div></td></tr>'}</tbody></table>
      </div>`;
  },

  openNewReceipt() {
    document.getElementById('receipt-modal-title').textContent = 'New Receipt';
    document.getElementById('receipt-modal-body').innerHTML = `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Supplier / Vendor</label>
          <select id="rec-sup" class="form-control filter-select" style="width:100%">
            ${AppState.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Destination Warehouse</label>
          <select id="rec-wh" class="form-control filter-select" style="width:100%">
            ${AppState.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="divider"></div>
      <div style="font-weight:700;margin-bottom:12px">📦 Products to Receive</div>
      <div id="rec-lines"></div>
      <button class="btn btn-outline btn-sm" onclick="OperationsView.addReceiptLine()">+ Add Product</button>`;
    this._recLines = [];
    this.addReceiptLine();
    this.openModal('receipt-modal');
  },

  addReceiptLine() {
    const idx = this._recLines.length;
    this._recLines.push({ productId: AppState.products[0]?.id, qty: 1 });
    const container = document.getElementById('rec-lines');
    const div = document.createElement('div');
    div.className = 'grid-2 mb-2'; div.id = `rec-line-${idx}`;
    div.innerHTML = `
      <select class="form-control filter-select" style="width:100%" onchange="OperationsView._recLines[${idx}].productId=parseInt(this.value)">
        ${AppState.products.map(p=>`<option value="${p.id}">${p.name} (${p.sku})</option>`).join('')}
      </select>
      <div class="flex gap-2">
        <input type="number" min="1" class="form-control" value="1" placeholder="Qty" onchange="OperationsView._recLines[${idx}].qty=parseInt(this.value)||1">
        <button class="btn btn-danger btn-icon" onclick="document.getElementById('rec-line-${idx}').remove()">✕</button>
      </div>`;
    container.appendChild(div);
  },

  saveReceipt() {
    const supId = parseInt(document.getElementById('rec-sup').value);
    const whId  = parseInt(document.getElementById('rec-wh').value);
    const lines = this._recLines.filter(l=>l.qty>0).map(l=>({ productId:l.productId, qty:l.qty, received:0 }));
    if (!lines.length) { Toast.show('error','No Products','Add at least one product.'); return; }
    const id = AppState.nextId('REC');
    AppState.receipts.unshift({ id, supplierId:supId, warehouseId:whId, status:'ready', date: new Date().toISOString().slice(0,10), expectedDate: new Date().toISOString().slice(0,10), lines });
    Toast.show('success','Receipt Created', `${id} created with ${lines.length} line(s).`);
    this.closeModal('receipt-modal');
    this.renderTab();
  },

  validateReceipt(id) {
    if (AppState.validateReceipt(id)) {
      Toast.show('success','Validated',`${id} validated. Stock updated automatically.`);
    } else {
      Toast.show('error','Error','Could not validate receipt.');
    }
    this.renderTab();
    App.refreshBadges();
  },

  // ---- DELIVERIES ----
  deliveriesHTML() {
    const rows = AppState.deliveries.map(d=>{
      const wh = AppState.getWarehouseById(d.warehouseId);
      const st = { draft:'muted', waiting:'info', ready:'warning', done:'success' }[d.status]||'muted';
      const steps = d.status === 'done' ? ['done','done','done','done'] :
                    d.status === 'ready' ? ['done','done','active',''] :
                    ['done','active','',''];
      return `<tr>
        <td class="td-primary">${d.id}</td>
        <td>${d.customerId}</td>
        <td>${wh?.name||'-'}</td>
        <td class="td-muted">${d.date}</td>
        <td>${d.lines.length} line(s)</td>
        <td><span class="badge badge-${st}">${d.status}</span></td>
        <td>
          ${d.status!=='done'?`<button class="btn btn-sm btn-success" onclick="OperationsView.validateDelivery('${d.id}')">✅ Validate</button>`:'<span class="badge badge-success">Done</span>'}
        </td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <span style="font-weight:700;font-size:15px">📤 Delivery Orders</span>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="OperationsView.openNewDelivery()">+ New Delivery</button>
        </div>
        <div style="padding:12px 22px;background:var(--bg-body);border-bottom:1px solid var(--border)">
          <div class="steps">
            <div class="step-item done"><div class="step-circle">✓</div><div class="step-label">Create</div></div>
            <div class="step-item active"><div class="step-circle">2</div><div class="step-label">Pick Items</div></div>
            <div class="step-item"><div class="step-circle">3</div><div class="step-label">Pack Items</div></div>
            <div class="step-item"><div class="step-circle">4</div><div class="step-label">Validate</div></div>
          </div>
        </div>
        <table><thead><tr>
          <th>Delivery #</th><th>Customer</th><th>Warehouse</th><th>Date</th><th>Lines</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  },

  openNewDelivery() {
    document.getElementById('delivery-modal-title').textContent = 'New Delivery Order';
    document.getElementById('delivery-modal-body').innerHTML = `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Customer / Destination</label>
          <input id="del-cust" class="form-control" placeholder="Customer name" required>
        </div>
        <div class="form-group">
          <label class="form-label">Source Warehouse</label>
          <select id="del-wh" class="form-control filter-select" style="width:100%">
            ${AppState.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="divider"></div>
      <div style="font-weight:700;margin-bottom:12px">📦 Items to Ship</div>
      <div id="del-lines"></div>
      <button class="btn btn-outline btn-sm" onclick="OperationsView.addDeliveryLine()">+ Add Product</button>`;
    this._delLines = [];
    this.addDeliveryLine();
    this.openModal('delivery-modal');
  },

  addDeliveryLine() {
    const idx = this._delLines.length;
    this._delLines.push({ productId: AppState.products[0]?.id, qty: 1 });
    const container = document.getElementById('del-lines');
    const div = document.createElement('div');
    div.className = 'grid-2 mb-2'; div.id = `del-line-${idx}`;
    div.innerHTML = `
      <select class="form-control filter-select" style="width:100%" onchange="OperationsView._delLines[${idx}].productId=parseInt(this.value)">
        ${AppState.products.map(p=>`<option value="${p.id}">${p.name} – Avail: ${p.onHand} ${p.uom}</option>`).join('')}
      </select>
      <div class="flex gap-2">
        <input type="number" min="1" class="form-control" value="1" placeholder="Qty" onchange="OperationsView._delLines[${idx}].qty=parseInt(this.value)||1">
        <button class="btn btn-danger btn-icon" onclick="document.getElementById('del-line-${idx}').remove()">✕</button>
      </div>`;
    container.appendChild(div);
  },

  saveDelivery() {
    const cust = document.getElementById('del-cust').value.trim();
    const whId = parseInt(document.getElementById('del-wh').value);
    const lines = this._delLines.filter(l=>l.qty>0).map(l=>({ productId:l.productId, qty:l.qty, shipped:0 }));
    if (!cust) { Toast.show('error','Required','Enter customer name.'); return; }
    if (!lines.length) { Toast.show('error','No Products','Add at least one product.'); return; }
    const id = AppState.nextId('DEL');
    AppState.deliveries.unshift({ id, customerId:cust, warehouseId:whId, status:'ready', date: new Date().toISOString().slice(0,10), lines });
    Toast.show('success','Delivery Created', `${id} ready to ship.`);
    this.closeModal('delivery-modal');
    this.renderTab();
  },

  validateDelivery(id) {
    if (AppState.validateDelivery(id)) {
      Toast.show('success','Shipped!',`${id} validated. Stock decreased automatically.`);
    } else {
      Toast.show('error','Insufficient Stock','Not enough stock for one or more items.');
    }
    this.renderTab();
    App.refreshBadges();
  },

  // ---- TRANSFERS ----
  transfersHTML() {
    const rows = AppState.transfers.map(t=>{
      const prod = AppState.getProductById(t.productId);
      const from = AppState.getLocationById(t.fromLocationId);
      const to   = AppState.getLocationById(t.toLocationId);
      const st   = { done:'success', ready:'warning', draft:'muted' }[t.status]||'muted';
      return `<tr>
        <td class="td-primary">${t.id}</td>
        <td>${prod?.name||'-'}</td>
        <td class="td-muted">${from?.name||'-'}</td>
        <td class="td-muted">${to?.name||'-'}</td>
        <td>${t.qty} ${prod?.uom||''}</td>
        <td class="td-muted">${t.date}</td>
        <td><span class="badge badge-${st}">${t.status}</span></td>
        <td>
          ${t.status!=='done'?`<button class="btn btn-sm btn-success" onclick="OperationsView.validateTransfer('${t.id}')">✅ Validate</button>`:'<span class="badge badge-success">Done</span>'}
        </td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <span style="font-weight:700;font-size:15px">🔄 Internal Transfers</span>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="OperationsView.openModal('transfer-modal')">+ New Transfer</button>
        </div>
        <table><thead><tr>
          <th>Ref</th><th>Product</th><th>From</th><th>To</th><th>Qty</th><th>Date</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  },

  saveTransfer(e) {
    if (e && e.preventDefault) e.preventDefault();
    const prodId = parseInt(document.getElementById('tf-prod').value);
    const fromId = parseInt(document.getElementById('tf-from').value);
    const toId   = parseInt(document.getElementById('tf-to').value);
    const qty    = parseInt(document.getElementById('tf-qty').value)||0;
    const note   = document.getElementById('tf-note').value.trim();
    if (fromId === toId) { Toast.show('error','Invalid','From and To locations must be different.'); return; }
    if (qty < 1) { Toast.show('error','Invalid','Quantity must be at least 1.'); return; }
    const id = AppState.nextId('TRF');
    AppState.transfers.unshift({ id, fromLocationId:fromId, toLocationId:toId, productId:prodId, qty, status:'ready', date: new Date().toISOString().slice(0,10), note });
    Toast.show('success','Transfer Created', `${id} created.`);
    this.closeModal('transfer-modal');
    this.renderTab();
  },

  validateTransfer(id) {
    if (AppState.validateTransfer(id)) {
      Toast.show('success','Transferred!',`${id} validated. Movement logged.`);
    }
    this.renderTab();
  },

  // ---- ADJUSTMENTS ----
  adjustmentsHTML() {
    const rows = AppState.adjustments.map(a=>{
      const prod = AppState.getProductById(a.productId);
      const loc  = AppState.getLocationById(a.locationId);
      const diff = a.diff;
      return `<tr>
        <td class="td-primary">${a.id}</td>
        <td>${prod?.name||'-'}</td>
        <td class="td-muted">${loc?.name||'-'}</td>
        <td>${a.system}</td>
        <td>${a.counted}</td>
        <td style="font-weight:700;color:${diff<0?'var(--danger)':diff>0?'var(--success)':'var(--text-muted)'}">${diff>0?'+':''}${diff}</td>
        <td class="td-muted">${a.reason}</td>
        <td class="td-muted">${a.date}</td>
        <td><span class="badge badge-${a.status==='done'?'success':'warning'}">${a.status}</span></td>
        <td>${a.status!=='done'?`<button class="btn btn-sm btn-success" onclick="OperationsView.validateAdj('${a.id}')">✅ Apply</button>`:'—'}</td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <span style="font-weight:700;font-size:15px">🔧 Inventory Adjustments</span>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="OperationsView.openAdjModal()">+ New Adjustment</button>
        </div>
        <table><thead><tr>
          <th>Ref</th><th>Product</th><th>Location</th><th>System Qty</th><th>Counted</th><th>Difference</th><th>Reason</th><th>Date</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  },

  openAdjModal() {
    this.adjProductChanged();
    this.openModal('adj-modal');
  },

  adjProductChanged() {
    const el = document.getElementById('adj-prod');
    if (!el) return;
    const prod = AppState.getProductById(parseInt(el.value));
    const sysEl = document.getElementById('adj-system');
    if (sysEl && prod) sysEl.value = prod.onHand;
    this.calcAdjDiff();
  },

  calcAdjDiff() {
    const sys = parseInt(document.getElementById('adj-system')?.value)||0;
    const cnt = parseInt(document.getElementById('adj-counted')?.value);
    const el  = document.getElementById('adj-diff');
    if (!el || isNaN(cnt)) { el && (el.textContent = '—'); return; }
    const diff = cnt - sys;
    el.textContent = `${diff > 0 ? '+' : ''}${diff}`;
    el.style.color = diff < 0 ? 'var(--danger)' : diff > 0 ? 'var(--success)' : 'var(--text-muted)';
  },

  saveAdjustment(e) {
    if (e && e.preventDefault) e.preventDefault();
    const prodId  = parseInt(document.getElementById('adj-prod').value);
    const locId   = parseInt(document.getElementById('adj-loc').value);
    const counted = parseInt(document.getElementById('adj-counted').value);
    const reason  = document.getElementById('adj-reason').value.trim();
    const prod    = AppState.getProductById(prodId);
    if (isNaN(counted) || counted < 0) { Toast.show('error','Invalid','Enter a valid counted quantity.'); return; }
    if (!reason) { Toast.show('error','Required','Enter a reason.'); return; }
    const id = AppState.nextId('ADJ');
    const diff = counted - prod.onHand;
    AppState.adjustments.unshift({ id, productId:prodId, locationId:locId, counted, system:prod.onHand, diff, reason, date: new Date().toISOString().slice(0,10), status:'draft' });
    Toast.show('info','Adjustment Created', `Apply it to update stock.`);
    this.closeModal('adj-modal');
    this.renderTab();
  },

  validateAdj(id) {
    if (AppState.applyAdjustment(id)) {
      Toast.show('success','Applied!',`Adjustment logged. Stock updated.`);
    }
    this.renderTab();
    App.refreshBadges();
  },

  openModal(id) { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
};

window.OperationsView = OperationsView;
