// ===================================================
// DASHBOARD VIEW
// ===================================================

const Dashboard = {
  filters: { docType: 'all', status: 'all', warehouse: 'all', location: 'all', category: 'all' },

  render() {
    const S = AppState;
    document.getElementById('page-title').textContent = 'Dashboard';
    document.getElementById('page-content').innerHTML = `
      <!-- Filters -->
      <div class="filter-bar">
        <select class="filter-select" onchange="Dashboard.setFilter('docType',this.value)">
          <option value="all">📋 All Documents</option>
          <option value="receipt">Receipts</option>
          <option value="delivery">Deliveries</option>
          <option value="transfer">Internal</option>
          <option value="adjustment">Adjustments</option>
        </select>
        <select class="filter-select" onchange="Dashboard.setFilter('status',this.value)">
          <option value="all">🔖 All Statuses</option>
          <option value="draft">Draft</option>
          <option value="waiting">Waiting</option>
          <option value="ready">Ready</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select class="filter-select" onchange="Dashboard.setFilter('warehouse',this.value)">
          <option value="all">🏭 All Warehouses</option>
          ${S.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="Dashboard.setFilter('location',this.value)">
          <option value="all">📍 All Locations</option>
          ${S.locations.map(l=>`<option value="${l.id}">${l.label} – ${l.type}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="Dashboard.setFilter('category',this.value)">
          <option value="all">🏷️ All Categories</option>
          ${S.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid" id="kpi-grid">
        ${this.kpiCards()}
      </div>

      <!-- Main Grid: Alerts + Timeline | Warehouse Map -->
      <div class="grid-2 mb-6">
        <!-- Left -->
        <div class="flex-col gap-4">
          <div class="card">
            <div class="card-header">
              <span class="card-header-title">⚠️ Critical Alerts</span>
              <span class="badge badge-danger">${S.lowStockProducts.length + S.outOfStockProducts.length}</span>
            </div>
            <div class="card-body" style="padding-top:14px;">
              ${this.alertsHTML()}
            </div>
          </div>

          <!-- Intelligence Insights -->
          <div class="card">
            <div class="card-header"><span class="card-header-title">🧠 Inventory Intelligence</span></div>
            <div class="card-body" style="padding-top:14px;">
              ${this.insightsHTML()}
            </div>
          </div>
        </div>

        <!-- Right: Warehouse + Timeline -->
        <div class="flex-col gap-4">
          <div class="card">
            <div class="card-header">
              <span class="card-header-title">🏭 Warehouse A – Live Grid</span>
              <select class="filter-select" style="width:auto;padding:4px 10px;font-size:12px;" onchange="Dashboard.renderWarehouseGrid(this.value)">
                ${S.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div class="card-body">
              <div class="rack-grid" id="rack-grid">${this.rackGridHTML(1)}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-header-title">📈 Live Stock Movements</span></div>
            <div class="card-body" style="padding-top:14px;max-height:270px;overflow-y:auto">
              <div class="timeline">${this.timelineHTML()}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Products table preview -->
      ${this.productsPreviewHTML()}

      <!-- FAB -->
      <div class="fab-container" id="fab-container">
        <button class="fab" id="fab-btn" onclick="Dashboard.toggleFab()">➕</button>
        <div class="fab-actions" id="fab-actions">
          <div class="fab-action" id="fa-1"><span class="fab-action-label">Create Product</span><button class="fab-btn primary" onclick="App.navigate('products');ProductsView.openCreateModal()">📦</button></div>
          <div class="fab-action" id="fa-2"><span class="fab-action-label">Receive Goods</span><button class="fab-btn secondary" onclick="App.navigate('operations');OperationsView.switchTab('receipts');OperationsView.openNewReceipt()">📥</button></div>
          <div class="fab-action" id="fa-3"><span class="fab-action-label">New Delivery</span><button class="fab-btn success" onclick="App.navigate('operations');OperationsView.switchTab('deliveries');OperationsView.openNewDelivery()">📤</button></div>
          <div class="fab-action" id="fa-4"><span class="fab-action-label">Stock Adjustment</span><button class="fab-btn info" onclick="App.navigate('operations');OperationsView.switchTab('adjustments')">🔧</button></div>
        </div>
      </div>`;

    this.animateKPIs();
  },

  kpiCards() {
    const S = AppState;
    const defs = [
      { label:'Total Products',    value: S.products.length,              color:'primary',   icon:'📦', delta:'+2 this week',    up:true },
      { label:'Low Stock Items',   value: S.lowStockProducts.length,      color:'warning',   icon:'📉', delta:'Needs reorder',   up:false },
      { label:'Out of Stock',      value: S.outOfStockProducts.length,    color:'danger',    icon:'❌', delta:'Urgent attention', up:false },
      { label:'Pending Receipts',  value: S.pendingReceipts.length,       color:'info',      icon:'📥', delta:'Incoming stock',   up:true },
      { label:'Pending Deliveries',value: S.pendingDeliveries.length,     color:'secondary', icon:'📤', delta:'To ship',         up:true },
      { label:'Internal Transfers',value: S.scheduledTransfers.length,    color:'success',   icon:'🔄', delta:'Scheduled',       up:true }
    ];
    return defs.map(d=>`
      <div class="kpi-card ${d.color}">
        <div class="kpi-label">${d.label}</div>
        <div class="kpi-value" data-target="${d.value}" id="kpi-${d.label.replace(/\s/g,'-')}">0</div>
        <div class="kpi-delta ${d.up?'up':'down'}">${d.up?'↑':'↓'} ${d.delta}</div>
        <div class="kpi-icon">${d.icon}</div>
      </div>`).join('');
  },

  animateKPIs() {
    document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      let cur = 0;
      const step = Math.max(1, Math.ceil(target / 25));
      const iv = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur;
        if (cur >= target) clearInterval(iv);
      }, 35);
    });
  },

  alertsHTML() {
    const S = AppState;
    const alerts = [
      ...S.outOfStockProducts.map(p=>({ type:'danger', title:`${p.name} is OUT OF STOCK`, desc:`SKU: ${p.sku} – Qty: 0 ${p.uom}` })),
      ...S.lowStockProducts.map(p=>({ type:'warning', title:`${p.name} – Low Stock`, desc:`Only ${p.onHand} ${p.uom} left. Reorder at ${p.reorderPoint}.` }))
    ];
    if (!alerts.length) return '<div class="empty-state"><span class="empty-state-icon">✅</span><p class="empty-state-text">All stock levels healthy</p></div>';
    return alerts.map(a=>`
      <div class="alert-item">
        <span class="alert-icon" style="color:var(--${a.type})">${a.type==='danger'?'🚨':'⚠️'}</span>
        <div class="alert-text">
          <div class="alert-title">${a.title}</div>
          <div class="alert-desc">${a.desc}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="App.navigate('products')">View</button>
      </div>`).join('');
  },

  insightsHTML() {
    const S = AppState;
    const low = S.lowStockProducts;
    const insights = [
      { text: low.length ? `${low[0]?.name} will run out soon at current rate.` : 'All critical products are well-stocked.', icon:'⚡', color:'danger' },
      { text: `${S.products.filter(p=>p.onHand > p.reorderPoint * 5).length} products have 5x+ reorder buffer – consider capacity.`, icon:'⏱️', color:'warning' },
      { text: `Warehouse B has ${Math.round(100 - S.locations.filter(l=>l.warehouseId===2).reduce((a,l)=>a+l.fill,0)/S.locations.filter(l=>l.warehouseId===2).length)}% average free capacity.`, icon:'ℹ️', color:'info' }
    ];
    return insights.map(i=>`
      <div class="alert-item">
        <span class="alert-icon" style="color:var(--${i.color})">${i.icon}</span>
        <div class="alert-text"><div class="alert-title">${i.text}</div></div>
      </div>`).join('');
  },

  rackGridHTML(warehouseId) {
    return AppState.locations.filter(l=>l.warehouseId==warehouseId).map(l=>`
      <div class="rack-cell ${l.status}" title="${l.type} – ${l.fill}% fill">
        <div class="rack-label">${l.label}</div>
        <div class="rack-name">${l.type}</div>
        <div class="rack-pct">${l.fill}%</div>
        <div class="progress-bar" style="margin-top:6px">
          <div class="progress-fill" style="width:${l.fill}%;background:${l.status==='healthy'?'var(--success)':l.status==='low'?'var(--warning)':'var(--danger)'}"></div>
        </div>
      </div>`).join('');
  },

  renderWarehouseGrid(wId) {
    const grid = document.getElementById('rack-grid');
    if (grid) grid.innerHTML = this.rackGridHTML(wId);
  },

  timelineHTML() {
    const colors = { receipt:'green', delivery:'orange', transfer:'blue', adjustment:'red' };
    const icons  = { receipt:'📥', delivery:'📤', transfer:'🔄', adjustment:'🔧' };
    return AppState.ledger.slice(0,8).map(m=>{
      const prod = AppState.getProductById(m.productId);
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${colors[m.type]||'purple'}"></div>
          <div class="timeline-time">${m.date} · ${m.ref}</div>
          <div class="timeline-action">${icons[m.type]||'•'} ${prod?.name || 'Product'} ${m.qty>0?'+':''}${m.qty} ${prod?.uom||''}</div>
          <div class="timeline-detail">${m.fromLoc} → ${m.toLoc}</div>
        </div>`;
    }).join('');
  },

  productsPreviewHTML() {
    const rows = AppState.products.slice(0,5).map(p=>{
      const cat = AppState.getCategoryById(p.categoryId);
      const loc = AppState.getLocationById(p.locationId);
      const status = p.onHand === 0 ? ['danger','Out of Stock'] : p.onHand <= p.reorderPoint ? ['warning','Low Stock'] : ['success','In Stock'];
      return `<tr>
        <td class="td-primary"><span style="margin-right:8px">${cat?.icon||'📦'}</span>${p.name}</td>
        <td><span class="badge badge-muted">${p.sku}</span></td>
        <td>${cat?.name||'-'}</td>
        <td><strong>${p.onHand}</strong> ${p.uom}</td>
        <td class="td-muted">${loc?.name||'-'}</td>
        <td><span class="badge badge-${status[0]}">${status[1]}</span></td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <span style="font-weight:700;font-size:15px">📋 Product Overview</span>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="App.navigate('products')">View All →</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Product</th><th>SKU</th><th>Category</th><th>On Hand</th><th>Location</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  setFilter(key, value) {
    this.filters[key] = value;
    // Re-render KPI area with filter info (simplified)
    Toast.show('info','Filter Applied',`Filtered by ${key}: ${value}`);
  },

  toggleFab() {
    const open = document.getElementById('fa-1').classList.contains('show');
    [1,2,3,4].forEach((i,idx) => {
      const el = document.getElementById(`fa-${i}`);
      if (open) el.classList.remove('show');
      else setTimeout(() => el.classList.add('show'), idx * 60);
    });
    const fab = document.getElementById('fab-btn');
    fab.style.transform = open ? '' : 'rotate(45deg)';
  }
};

window.Dashboard = Dashboard;
