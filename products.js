// ===================================================
// PRODUCTS VIEW – Create, Edit, View, Categories, Reordering
// ===================================================

const ProductsView = {
  searchQuery: '',
  filterCat: 'all',
  filterStatus: 'all',
  editingId: null,
  viewingId: null,

  render() {
    document.getElementById('page-title').textContent = 'Products';
    document.getElementById('page-content').innerHTML = `
      <div class="page-header flex items-center justify-between">
        <div>
          <div class="page-title">Product Catalog</div>
          <div class="page-subtitle">${AppState.products.length} products across ${AppState.categories.length} categories</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-outline" onclick="ProductsView.openCategoriesModal()">🏷️ Categories</button>
          <button class="btn btn-primary" onclick="ProductsView.openCreateModal()">+ New Product</button>
        </div>
      </div>

      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="topbar-search" style="width:280px">
            <span>🔍</span>
            <input type="text" id="prod-search" placeholder="Search product or SKU…" oninput="ProductsView.handleSearch(this.value)">
          </div>
          <select class="filter-select" onchange="ProductsView.filterCat=this.value;ProductsView.refreshTable()">
            <option value="all">All Categories</option>
            ${AppState.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
          </select>
          <select class="filter-select" onchange="ProductsView.filterStatus=this.value;ProductsView.refreshTable()">
            <option value="all">All Statuses</option>
            <option value="instock">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
          <span class="text-muted text-sm" id="prod-count" style="margin-left:auto"></span>
        </div>
        <table>
          <thead><tr>
            <th>Product</th><th>SKU Code</th><th>Category</th><th>UoM</th>
            <th>On Hand</th><th>Location</th><th>Reorder At</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="products-tbody"></tbody>
        </table>
      </div>

      <!-- Category Modal -->
      <div class="modal-overlay" id="cat-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">🏷️ Product Categories</span>
            <button class="modal-close" onclick="ProductsView.closeModal('cat-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div id="cat-list">${this.categoriesListHTML()}</div>
            <div class="divider"></div>
            <form onsubmit="ProductsView.addCategory(event)" class="flex gap-2">
              <input id="new-cat-name" class="form-control" placeholder="New category name" required>
              <button type="submit" class="btn btn-primary" style="white-space:nowrap">+ Add</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Create/Edit Product Modal -->
      <div class="modal-overlay" id="product-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title" id="prod-modal-title">New Product</span>
            <button class="modal-close" onclick="ProductsView.closeModal('product-modal')">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="ProductsView.saveProduct(event)" id="product-form">
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Product Name *</label>
                  <input id="pf-name" class="form-control" placeholder="e.g. Steel Rod 12mm" required>
                </div>
                <div class="form-group">
                  <label class="form-label">SKU / Product Code *</label>
                  <input id="pf-sku" class="form-control" placeholder="e.g. SR-12-001" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="pf-cat" class="form-control filter-select" style="width:100%">
                    ${AppState.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit of Measure</label>
                  <select id="pf-uom" class="form-control filter-select" style="width:100%">
                    ${['Unit','Meter','Piece','Pair','Roll','Kg','Liter','Box'].map(u=>`<option>${u}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Location</label>
                  <select id="pf-loc" class="form-control filter-select" style="width:100%">
                    ${AppState.locations.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Initial Stock (optional)</label>
                  <input id="pf-stock" type="number" min="0" class="form-control" placeholder="0" value="0">
                </div>
                <div class="form-group">
                  <label class="form-label">Reorder Point</label>
                  <input id="pf-reorder-pt" type="number" min="0" class="form-control" placeholder="20" value="20">
                </div>
                <div class="form-group">
                  <label class="form-label">Reorder Quantity</label>
                  <input id="pf-reorder-qty" type="number" min="0" class="form-control" placeholder="100" value="100">
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="ProductsView.closeModal('product-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="ProductsView.saveProduct(event)">💾 Save Product</button>
          </div>
        </div>
      </div>

      <!-- View Stock Modal -->
      <div class="modal-overlay" id="view-stock-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title" id="view-stock-title">Stock Details</span>
            <button class="modal-close" onclick="ProductsView.closeModal('view-stock-modal')">✕</button>
          </div>
          <div class="modal-body" id="view-stock-body"></div>
        </div>
      </div>`;

    this.refreshTable();
  },

  filteredProducts() {
    return AppState.products.filter(p => {
      const cat = AppState.getCategoryById(p.categoryId);
      const q = this.searchQuery.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = this.filterCat === 'all' || String(p.categoryId) === String(this.filterCat);
      const matchSt = this.filterStatus === 'all' ||
        (this.filterStatus === 'out' && p.onHand === 0) ||
        (this.filterStatus === 'low' && p.onHand > 0 && p.onHand <= p.reorderPoint) ||
        (this.filterStatus === 'instock' && p.onHand > p.reorderPoint);
      return matchQ && matchCat && matchSt;
    });
  },

  refreshTable() {
    const prods = this.filteredProducts();
    const countEl = document.getElementById('prod-count');
    if (countEl) countEl.textContent = `${prods.length} result${prods.length!==1?'s':''}`;
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    if (!prods.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="empty-state-icon">📦</span><p class="empty-state-text">No products found</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = prods.map(p => {
      const cat = AppState.getCategoryById(p.categoryId);
      const loc = AppState.getLocationById(p.locationId);
      const status = p.onHand === 0 ? ['danger','Out of Stock'] : p.onHand <= p.reorderPoint ? ['warning','Low Stock'] : ['success','In Stock'];
      return `<tr>
        <td class="td-primary">${cat?.icon||'📦'} ${p.name}</td>
        <td><span class="badge badge-muted">${p.sku}</span></td>
        <td>${cat?.name||'-'}</td>
        <td>${p.uom}</td>
        <td><strong>${p.onHand}</strong></td>
        <td class="td-muted">${loc?.name||'-'}</td>
        <td><span class="badge badge-info">${p.reorderPoint}</span></td>
        <td><span class="badge badge-${status[0]}">${status[1]}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-outline" onclick="ProductsView.viewStock(${p.id})">📊</button>
            <button class="btn btn-sm btn-outline" onclick="ProductsView.openEditModal(${p.id})">✏️</button>
            <button class="btn btn-sm btn-danger btn-sm" onclick="ProductsView.deleteProduct(${p.id})">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  handleSearch(q) { this.searchQuery = q; this.refreshTable(); },

  openCreateModal() {
    this.editingId = null;
    document.getElementById('prod-modal-title').textContent = 'New Product';
    ['pf-name','pf-sku'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pf-stock').value = '0';
    document.getElementById('pf-reorder-pt').value = '20';
    document.getElementById('pf-reorder-qty').value = '100';
    this.openModal('product-modal');
  },

  openEditModal(id) {
    this.editingId = id;
    const p = AppState.getProductById(id);
    document.getElementById('prod-modal-title').textContent = `Edit: ${p.name}`;
    document.getElementById('pf-name').value = p.name;
    document.getElementById('pf-sku').value  = p.sku;
    document.getElementById('pf-cat').value  = p.categoryId;
    document.getElementById('pf-uom').value  = p.uom;
    document.getElementById('pf-loc').value  = p.locationId;
    document.getElementById('pf-stock').value = p.onHand;
    document.getElementById('pf-reorder-pt').value  = p.reorderPoint;
    document.getElementById('pf-reorder-qty').value = p.reorderQty;
    this.openModal('product-modal');
  },

  saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('pf-name').value.trim();
    const sku  = document.getElementById('pf-sku').value.trim();
    if (!name || !sku) { Toast.show('error','Required','Name and SKU are required.'); return; }
    if (this.editingId) {
      const p = AppState.getProductById(this.editingId);
      p.name = name; p.sku = sku;
      p.categoryId  = parseInt(document.getElementById('pf-cat').value);
      p.uom         = document.getElementById('pf-uom').value;
      p.locationId  = parseInt(document.getElementById('pf-loc').value);
      p.onHand      = parseInt(document.getElementById('pf-stock').value)||0;
      p.reorderPoint= parseInt(document.getElementById('pf-reorder-pt').value)||0;
      p.reorderQty  = parseInt(document.getElementById('pf-reorder-qty').value)||0;
      Toast.show('success','Updated',`${name} updated.`);
    } else {
      const id = AppState._seqs.Prod++;
      AppState.products.push({
        id, name, sku,
        categoryId:  parseInt(document.getElementById('pf-cat').value),
        uom:         document.getElementById('pf-uom').value,
        locationId:  parseInt(document.getElementById('pf-loc').value),
        onHand:      parseInt(document.getElementById('pf-stock').value)||0,
        reorderPoint:parseInt(document.getElementById('pf-reorder-pt').value)||0,
        reorderQty:  parseInt(document.getElementById('pf-reorder-qty').value)||0,
        price: 0
      });
      Toast.show('success','Created',`${name} added.`);
    }
    this.closeModal('product-modal');
    this.refreshTable();
  },

  deleteProduct(id) {
    const p = AppState.getProductById(id);
    if (!confirm(`Delete "${p.name}"?`)) return;
    AppState.products = AppState.products.filter(p=>p.id !== id);
    Toast.show('success','Deleted',`${p.name} removed.`);
    this.refreshTable();
  },

  viewStock(id) {
    const p = AppState.getProductById(id);
    const cat = AppState.getCategoryById(p.categoryId);
    const loc = AppState.getLocationById(p.locationId);
    const ledger = AppState.ledger.filter(l=>l.productId===id);
    document.getElementById('view-stock-title').textContent = `${cat?.icon||'📦'} ${p.name} – Stock Details`;
    document.getElementById('view-stock-body').innerHTML = `
      <div class="stat-row mb-4">
        <div class="stat-item"><div class="stat-value" style="color:var(--primary)">${p.onHand}</div><div class="stat-label">${p.uom} On Hand</div></div>
        <div class="stat-item"><div class="stat-value" style="color:var(--warning)">${p.reorderPoint}</div><div class="stat-label">Reorder Point</div></div>
        <div class="stat-item"><div class="stat-value" style="color:var(--info)">${p.reorderQty}</div><div class="stat-label">Reorder Qty</div></div>
      </div>
      <div class="divider"></div>
      <div class="mb-3" style="font-weight:700">📍 Location: ${loc?.name||'-'}</div>
      <div class="mb-3" style="font-weight:700">📋 Movement History</div>
      ${ledger.length ? `
        <table><thead><tr><th>Date</th><th>Type</th><th>Ref</th><th>Qty</th><th>From</th><th>To</th></tr></thead>
        <tbody>${ledger.map(l=>`
          <tr>
            <td class="td-muted">${l.date}</td>
            <td><span class="badge badge-${l.type==='receipt'?'success':l.type==='delivery'?'warning':'info'}">${l.type}</span></td>
            <td>${l.ref}</td>
            <td style="color:${l.qty>=0?'var(--success)':'var(--danger)'};font-weight:700">${l.qty>0?'+':''}${l.qty}</td>
            <td class="td-muted">${l.fromLoc}</td>
            <td class="td-muted">${l.toLoc}</td>
          </tr>`).join('')}
        </tbody></table>` : '<div class="empty-state"><span class="empty-state-icon">📋</span><p class="empty-state-text">No movement history</p></div>'}`;
    this.openModal('view-stock-modal');
  },

  categoriesListHTML() {
    return AppState.categories.map(c=>`
      <div class="flex items-center justify-between mb-2">
        <span>${c.icon} ${c.name}</span>
        <button class="btn btn-sm btn-danger" onclick="ProductsView.deleteCategory(${c.id})">🗑</button>
      </div>`).join('');
  },

  addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) return;
    const icons = ['📦','🔩','⚙️','🧱','🔬','🪛','🧴','🔌'];
    AppState.categories.push({ id: AppState._seqs.Cat++, name, icon: icons[Math.floor(Math.random()*icons.length)], color:'#6B7280' });
    document.getElementById('new-cat-name').value = '';
    document.getElementById('cat-list').innerHTML = this.categoriesListHTML();
    Toast.show('success','Category Added', name);
  },

  deleteCategory(id) {
    AppState.categories = AppState.categories.filter(c=>c.id!==id);
    document.getElementById('cat-list').innerHTML = this.categoriesListHTML();
  },

  openCategoriesModal() { this.openModal('cat-modal'); },
  openModal(id) { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); }
};

window.ProductsView = ProductsView;
