// ===================================================
// SETTINGS VIEW – Warehouse & Location Management
// ===================================================

const SettingsView = {
  activeSection: 'warehouses',

  render() {
    document.getElementById('page-title').textContent = 'Settings';
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Manage warehouses, locations, and system configuration</div>
      </div>
      <div class="grid-2">
        <div>
          <div class="card mb-4">
            <div class="card-header">
              <span class="card-header-title">🏭 Warehouses</span>
              <button class="btn btn-primary btn-sm" onclick="SettingsView.openWarehouseModal()">+ New</button>
            </div>
            <div class="card-body" id="wh-list">${this.warehouseListHTML()}</div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-header-title">👤 My Profile</span>
            </div>
            <div class="card-body" id="profile-body">${this.profileHTML()}</div>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-header">
              <span class="card-header-title">📍 Locations / Racks</span>
              <button class="btn btn-primary btn-sm" onclick="SettingsView.openLocationModal()">+ New</button>
            </div>
            <div class="card-body" id="loc-list">${this.locationListHTML()}</div>
          </div>
        </div>
      </div>

      <!-- Warehouse Modal -->
      <div class="modal-overlay" id="wh-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title" id="wh-modal-title">New Warehouse</span>
            <button class="modal-close" onclick="SettingsView.closeModal('wh-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Warehouse Name *</label>
              <input id="wh-name" class="form-control" placeholder="e.g. Warehouse C" required>
            </div>
            <div class="form-group">
              <label class="form-label">Short Code *</label>
              <input id="wh-code" class="form-control" placeholder="e.g. WH-C" required>
            </div>
            <div class="form-group">
              <label class="form-label">Location / Address</label>
              <input id="wh-loc" class="form-control" placeholder="e.g. North Wing">
            </div>
            <div class="form-group">
              <label class="form-label">Capacity (units)</label>
              <input id="wh-cap" type="number" min="1" class="form-control" value="500">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SettingsView.closeModal('wh-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="SettingsView.saveWarehouse()">💾 Save</button>
          </div>
        </div>
      </div>

      <!-- Location Modal -->
      <div class="modal-overlay" id="loc-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">New Location / Rack</span>
            <button class="modal-close" onclick="SettingsView.closeModal('loc-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Warehouse *</label>
              <select id="loc-wh" class="form-control filter-select" style="width:100%">
                ${AppState.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Label (Rack ID) *</label>
                <input id="loc-label" class="form-control" placeholder="e.g. E1">
              </div>
              <div class="form-group">
                <label class="form-label">Zone</label>
                <input id="loc-zone" class="form-control" placeholder="e.g. E">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Product Type / Usage</label>
              <input id="loc-type" class="form-control" placeholder="e.g. Electronics">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SettingsView.closeModal('loc-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="SettingsView.saveLocation()">💾 Save</button>
          </div>
        </div>
      </div>

      <!-- Profile Edit Modal -->
      <div class="modal-overlay" id="profile-modal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">My Profile</span>
            <button class="modal-close" onclick="SettingsView.closeModal('profile-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input id="prof-name" class="form-control" value="${AppState.currentUser?.name||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input id="prof-email" class="form-control" value="${AppState.currentUser?.email||''}" readonly style="background:var(--bg-body)">
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <input class="form-control" value="${AppState.currentUser?.role||'Staff'}" readonly style="background:var(--bg-body)">
            </div>
            <div class="divider"></div>
            <div class="form-group">
              <label class="form-label">New Password (leave blank to keep)</label>
              <div class="input-group">
                <span class="input-icon">🔒</span>
                <input id="prof-pass" type="password" class="form-control" placeholder="New password">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="SettingsView.closeModal('profile-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="SettingsView.saveProfile()">💾 Save Profile</button>
          </div>
        </div>
      </div>`;
  },

  warehouseListHTML() {
    return AppState.warehouses.map(w=>`
      <div class="flex items-center justify-between mb-3" style="padding:12px;background:var(--bg-body);border-radius:8px;border:1px solid var(--border)">
        <div>
          <div style="font-weight:700">🏭 ${w.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${w.code} · ${w.location} · Cap: ${w.capacity}</div>
        </div>
        <div class="flex gap-2">
          <span class="badge badge-success">${w.status}</span>
          <button class="btn btn-sm btn-danger" onclick="SettingsView.deleteWarehouse(${w.id})">🗑</button>
        </div>
      </div>`).join('');
  },

  locationListHTML() {
    return AppState.locations.map(l=>{
      const wh = AppState.getWarehouseById(l.warehouseId);
      const st = { healthy:'success', low:'warning', critical:'danger' }[l.status]||'muted';
      return `
        <div class="flex items-center justify-between mb-3" style="padding:12px;background:var(--bg-body);border-radius:8px;border:1px solid var(--border)">
          <div>
            <div style="font-weight:700">📍 ${l.label} – ${l.type}</div>
            <div style="font-size:12px;color:var(--text-muted)">${wh?.name||'?'} · Zone ${l.zone} · ${l.fill}% fill</div>
          </div>
          <div class="flex gap-2">
            <span class="badge badge-${st}">${l.status}</span>
            <button class="btn btn-sm btn-danger" onclick="SettingsView.deleteLocation(${l.id})">🗑</button>
          </div>
        </div>`;
    }).join('');
  },

  profileHTML() {
    const u = AppState.currentUser;
    if (!u) return '';
    return `
      <div class="flex items-center gap-3 mb-4">
        <div class="user-avatar" style="width:52px;height:52px;font-size:18px">${u.avatar}</div>
        <div>
          <div style="font-weight:700;font-size:16px">${u.name}</div>
          <div style="color:var(--text-muted);font-size:13px">${u.email}</div>
          <div><span class="badge badge-primary">${u.role}</span></div>
        </div>
      </div>
      <button class="btn btn-outline btn-full" onclick="SettingsView.openModal('profile-modal')">✏️ Edit Profile</button>`;
  },

  openWarehouseModal() { this.openModal('wh-modal'); },
  openLocationModal()  { this.openModal('loc-modal'); },

  saveWarehouse() {
    const name = document.getElementById('wh-name').value.trim();
    const code = document.getElementById('wh-code').value.trim();
    if (!name || !code) { Toast.show('error','Required','Name and code are required.'); return; }
    AppState.warehouses.push({
      id: AppState._seqs.WHouse++, name, code,
      location: document.getElementById('wh-loc').value.trim() || 'N/A',
      capacity: parseInt(document.getElementById('wh-cap').value)||500,
      status: 'active'
    });
    Toast.show('success','Warehouse Created', name);
    this.closeModal('wh-modal');
    document.getElementById('wh-list').innerHTML = this.warehouseListHTML();
  },

  deleteWarehouse(id) {
    const wh = AppState.getWarehouseById(id);
    if (!confirm(`Delete "${wh.name}"?`)) return;
    AppState.warehouses = AppState.warehouses.filter(w=>w.id!==id);
    document.getElementById('wh-list').innerHTML = this.warehouseListHTML();
    Toast.show('success','Deleted', wh.name);
  },

  saveLocation() {
    const label = document.getElementById('loc-label').value.trim();
    const type  = document.getElementById('loc-type').value.trim() || 'General';
    const zone  = document.getElementById('loc-zone').value.trim()  || 'Z';
    const whId  = parseInt(document.getElementById('loc-wh').value);
    if (!label) { Toast.show('error','Required','Label is required.'); return; }
    const wh = AppState.getWarehouseById(whId);
    const name = `${wh?.code||'WH'}/Stock/${label}`;
    AppState.locations.push({ id: AppState._seqs.Loc++, warehouseId:whId, name, label, type, fill:0, status:'empty', zone });
    Toast.show('success','Location Added', `${label} in ${wh?.name}`);
    this.closeModal('loc-modal');
    document.getElementById('loc-list').innerHTML = this.locationListHTML();
  },

  deleteLocation(id) {
    AppState.locations = AppState.locations.filter(l=>l.id!==id);
    document.getElementById('loc-list').innerHTML = this.locationListHTML();
    Toast.show('success','Deleted','Location removed.');
  },

  saveProfile() {
    const name = document.getElementById('prof-name').value.trim();
    const pass = document.getElementById('prof-pass').value;
    if (!name) { Toast.show('error','Required','Name is required.'); return; }
    AppState.currentUser.name = name;
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    AppState.currentUser.avatar = initials;
    if (pass) AppState.currentUser.password = pass;
    Toast.show('success','Profile Saved','Your changes have been saved.');
    this.closeModal('profile-modal');
    document.getElementById('profile-body').innerHTML = this.profileHTML();
    // Refresh sidebar user info
    const nameEl = document.getElementById('sidebar-user-name');
    const avEl   = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = name;
    if (avEl)   avEl.textContent   = initials;
  },

  openModal(id) { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
};

window.SettingsView = SettingsView;
