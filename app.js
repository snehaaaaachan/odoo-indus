// ===================================================
// TOAST NOTIFICATION SYSTEM
// ===================================================
const Toast = {
  show(type, title, msg, duration = 4000) {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const container = document.getElementById('toast-container') || (() => {
      const el = document.createElement('div'); el.id = 'toast-container';
      document.body.appendChild(el); return el;
    })();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]||'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${msg}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
};

// ===================================================
// MAIN APP ROUTER & SHELL
// ===================================================
const App = {
  currentView: 'dashboard',

  async launch() {
    document.getElementById('auth-root').style.display = 'none';
    const appRoot = document.getElementById('app-root');
    appRoot.style.display = 'flex';
    appRoot.classList.remove('hidden');

    Toast.show('info', 'Connecting', 'Loading live data from Oracle Database...');
    if (AppState.fetchServerData) {
      await AppState.fetchServerData();
    }

    this.renderShell();
    
    // Role-based redirect
    if (AppState.currentUser.role === 'Staff') {
      this.navigate('operations');
    } else {
      this.navigate('dashboard');
    }
  },

  renderShell() {
    const u = AppState.currentUser;
    document.getElementById('app-root').innerHTML = `
      <div class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">📦</div>
          <div>
            <div class="sidebar-logo-text">Inventory Pro</div>
            <div class="sidebar-logo-sub">v1.0 • Hackathon Edition</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${u.role !== 'Staff' ? `
          <a class="nav-item active" id="nav-dashboard" onclick="App.navigate('dashboard')">
            <span class="nav-item-icon">🏠</span> Dashboard
          </a>
          ` : ''}
          <div class="nav-section-label">Operations</div>
          ${u.role !== 'Staff' ? `
          <a class="nav-item" id="nav-products"   onclick="App.navigate('products')">
            <span class="nav-item-icon">📦</span> Products
          </a>
          ` : ''}
          <a class="nav-item" id="nav-operations" onclick="App.navigate('operations')">
            <span class="nav-item-icon">⚙️</span> Warehouse Operations
            <span class="nav-item-badge" id="ops-badge">0</span>
          </a>
          ${u.role !== 'Staff' ? `
          <a class="nav-item" id="nav-history"    onclick="App.navigate('history')">
            <span class="nav-item-icon">📋</span> Move History
          </a>
          <div class="nav-section-label">Administration</div>
          <a class="nav-item" id="nav-settings"   onclick="App.navigate('settings')">
            <span class="nav-item-icon">⚙️</span> Settings
          </a>
          ` : ''}
        </nav>
        <div class="sidebar-footer">
          <div class="user-card" onclick="App.toggleProfileDropdown()">
            <div class="user-avatar" id="sidebar-user-avatar">${u.avatar}</div>
            <div class="user-info">
              <div class="user-name" id="sidebar-user-name">${u.name}</div>
              <div class="user-role">${u.role}</div>
            </div>
            <span class="user-arrow">▲</span>
          </div>
          <!-- Profile Dropdown -->
          <div class="profile-dropdown" id="profile-dropdown" style="bottom:70px">
            <div class="profile-dropdown-header">
              <div class="profile-dropdown-name">${u.name}</div>
              <div class="profile-dropdown-email">${u.email}</div>
            </div>
            <div class="dropdown-item" onclick="App.navigate('settings');App.closeProfileDropdown()">
              <span class="dropdown-item-icon">👤</span> My Profile
            </div>
            <div class="dropdown-item" onclick="App.navigate('settings');App.closeProfileDropdown()">
              <span class="dropdown-item-icon">⚙️</span> Settings
            </div>
            <div class="dropdown-item danger" onclick="App.logout()">
              <span class="dropdown-item-icon">🚪</span> Logout
            </div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <header class="topbar">
          <span class="topbar-title" id="page-title">Dashboard</span>
          <div class="topbar-search">
            <span>🔍</span>
            <input type="text" placeholder="Search products by name or SKU…" id="global-search" oninput="App.globalSearch(this.value)">
          </div>
          <div class="topbar-actions">
            <div style="position:relative">
              <button class="icon-btn" id="alert-btn" onclick="App.toggleAlertPanel()">🔔
                <span class="notification-badge" id="alert-badge"></span>
              </button>
              <!-- Alerts Dropdown -->
              <div class="profile-dropdown" id="alert-panel" style="right:0;top:calc(100% + 10px);min-width:300px">
                <div class="profile-dropdown-header"><strong>Low Stock Alerts</strong></div>
                <div id="alert-panel-items" style="max-height:280px;overflow-y:auto;padding:8px"></div>
              </div>
            </div>
            <button class="icon-btn" onclick="App.toggleDarkMode()">🌙</button>
            <div style="position:relative">
              <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer" onclick="App.toggleProfileDropdown()">${u.avatar}</div>
            </div>
          </div>
        </header>

        <div class="page-content" id="page-content"></div>
      </div>

      <div id="toast-container"></div>`;

    this.refreshBadges();
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#profile-dropdown') && !e.target.closest('.user-card') && !e.target.closest('[onclick*="toggleProfileDropdown"]')) {
        this.closeProfileDropdown();
      }
      if (!e.target.closest('#alert-panel') && !e.target.closest('#alert-btn')) {
        document.getElementById('alert-panel')?.classList.remove('open');
      }
    });
  },

  navigate(view) {
    this.currentView = view;
    ['dashboard','products','operations','history','settings'].forEach(v => {
      document.getElementById(`nav-${v}`)?.classList.toggle('active', v === view);
    });
    // Remove any dashboard FABs when navigating away
    const fab = document.getElementById('fab-container');
    if (fab && view !== 'dashboard') fab.remove();

    document.getElementById('page-title').textContent = {
      dashboard:'Dashboard', products:'Products', operations:'Operations',
      history:'Move History', settings:'Settings'
    }[view] || view;

    switch(view) {
      case 'dashboard':   Dashboard.render();    break;
      case 'products':    ProductsView.render(); break;
      case 'operations':  OperationsView.render();break;
      case 'history':     HistoryView.render();  break;
      case 'settings':    SettingsView.render(); break;
    }
    this.refreshBadges();
  },

  refreshBadges() {
    const pending = AppState.pendingReceipts.length + AppState.pendingDeliveries.length + AppState.scheduledTransfers.length;
    const badge   = document.getElementById('ops-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }

    // Alert bell
    const alerts = AppState.lowStockProducts.length + AppState.outOfStockProducts.length;
    const alertBadge = document.getElementById('alert-badge');
    if (alertBadge) alertBadge.style.display = alerts > 0 ? 'block' : 'none';

    // Alert panel content
    const alertItems = document.getElementById('alert-panel-items');
    if (alertItems) {
      const items = [
        ...AppState.outOfStockProducts.map(p=>`<div style="padding:8px;border-radius:6px;background:#fee2e2;margin-bottom:6px;font-size:12px"><strong style="color:var(--danger)">❌ OUT: ${p.name}</strong><br>SKU: ${p.sku}</div>`),
        ...AppState.lowStockProducts.map(p=>`<div style="padding:8px;border-radius:6px;background:#fef3c7;margin-bottom:6px;font-size:12px"><strong style="color:var(--warning)">⚠️ LOW: ${p.name}</strong><br>${p.onHand} ${p.uom} remaining</div>`)
      ];
      alertItems.innerHTML = items.length ? items.join('') : '<p style="padding:12px;color:var(--text-muted);font-size:13px">All stock levels OK ✅</p>';
    }
  },

  globalSearch(q) {
    if (!q.trim()) return;
    const matches = AppState.products.filter(p =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.sku.toLowerCase().includes(q.toLowerCase())
    );
    if (matches.length) {
      this.navigate('products');
      setTimeout(() => {
        ProductsView.searchQuery = q;
        const searchEl = document.getElementById('prod-search');
        if (searchEl) searchEl.value = q;
        ProductsView.refreshTable();
      }, 50);
    } else {
      Toast.show('info','No Results',`No products found for "${q}"`);
    }
  },

  toggleProfileDropdown() {
    document.getElementById('profile-dropdown')?.classList.toggle('open');
  },
  closeProfileDropdown() {
    document.getElementById('profile-dropdown')?.classList.remove('open');
  },

  toggleAlertPanel() {
    document.getElementById('alert-panel')?.classList.toggle('open');
  },

  toggleDarkMode() {
    AppState.darkMode = !AppState.darkMode;
    document.body.classList.toggle('dark-mode', AppState.darkMode);
    Toast.show('info', AppState.darkMode ? 'Dark Mode On' : 'Light Mode On', '');
  },

  logout() {
    AppState.currentUser = null;
    document.getElementById('app-root').style.display  = 'none';
    document.getElementById('auth-root').style.display = 'flex';
    Auth.showLogin();
    Toast.show('info','Logged Out','You have been signed out.');
  }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
  Auth.render();
});

window.App   = App;
window.Toast = Toast;
