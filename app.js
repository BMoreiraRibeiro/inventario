// Estado da aplicação
let inventory = [];
let currentEditId = null;
let isLoggedIn = false;
let locations = [];
let categories = [];
let pendingDeleteContext = null; // { type: 'item'|'category'|'location'|'sublocation', payload: ... }
let modalZIndex = 1000;
// When true, saves will not trigger immediate cloud sync; used while a modal is open so we sync once on close
window.modalSyncSuppressed = false;

function openModal(el) {
    if (!el) return;
    // Ensure modal doesn't overlap the app header: position modal content below header
    const headerEl = document.querySelector('header');
    let headerH = 0;
    if (headerEl) {
        try { headerH = headerEl.getBoundingClientRect().height || 0; } catch (e) { headerH = 0; }
    }
    el.classList.add('active');
    modalZIndex += 1;
    el.style.zIndex = modalZIndex;

    // Anchor modal-content below header and set a dynamic max-height so it only grows downward
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.marginTop = (headerH + 12) + 'px';
        // ensure it never exceeds viewport minus header area
        modalContent.style.maxHeight = 'calc(100vh - ' + (headerH + 40) + 'px)';
        modalContent.style.overflowY = 'auto';
    }

    // ensure overlay scroll is at top so user can scroll modal-content to see top
    try { el.scrollTop = 0; } catch (e) {}
}

function closeModalEl(el) {
    if (!el) return;
    // If we were suppressing syncs while this modal was open, mark that we should sync now
    const shouldTriggerSync = !!window.modalSyncSuppressed;
    // Clear suppression immediately so saves after close behave normally
    window.modalSyncSuppressed = false;

    el.classList.remove('active');
    // remove inline zIndex so other modals can reuse stacking
    el.style.zIndex = '';
    // clear any inline styles we set on modal-content when opening
    const modalContent = el.querySelector && el.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.marginTop = '';
        modalContent.style.maxHeight = '';
        modalContent.style.overflowY = '';
    }
    // Trigger a single full sync after closing the modal if we suppressed syncs
    if (shouldTriggerSync) {
        setTimeout(() => {
            try {
                if (typeof syncToCloud !== 'undefined' && !isSyncing) syncToCloud();
            } catch (e) { console.warn('Error triggering sync after modal close', e); }
        }, 250);
    }
}

// Debounced request to trigger a cloud sync. Use this when you want to ensure
// a sync runs shortly after a user action (e.g. after saving a new item) but
// avoid flooding multiple quick calls. This will call the global `syncToCloud`
// if available.
window._requestedSyncTimeout = null;
function requestCloudSync(delay = 400) {
    try { clearTimeout(window._requestedSyncTimeout); } catch (e) {}
    window._requestedSyncTimeout = setTimeout(() => {
        try {
            if (typeof syncToCloud !== 'undefined' && !isSyncing) syncToCloud();
        } catch (e) { console.warn('requestCloudSync error', e); }
    }, delay);
}

// Helper: slugify label to key
function slugify(s) {
    return s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
}

// Inicialização
// Inicialização segura: se o DOM já estiver carregado, executa imediatamente.
function initApp() {
    // Forçar mostrar inventário ao iniciar (carregar todos os items de imediato)
    // O botão Sair foi escondido pelo pedido do utilizador.
    isLoggedIn = true;
    try { sessionStorage.setItem('isLoggedIn', 'true'); } catch(e) {}
    showInventoryScreen();

    // Carregar dados do localStorage
    loadInventory();
    
    // Listener para Enter no login
    const pwd = document.getElementById('passwordInput');
    if (pwd) {
        pwd.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    }

    // Listener para o botão de login (mais robusto que onclick inline)
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            login();
        });
    }

    // Carregar locais
    loadLocations();
    populateLocationSelects();
    populateLocationFilters();
    // Carregar categorias
    loadCategories();
    populateCategorySelects();

    // groupBy default listener
    const groupEl = document.getElementById('groupBy');
    if (groupEl) groupEl.addEventListener('change', () => renderItems());

    // Render items right away
    renderItems();
    updateStats();
    
    // Initialize Supabase and sync
    if (typeof initSupabase !== 'undefined' && initSupabase()) {
        // Load from cloud on first load
        loadFromCloud().then(() => {
            // Setup auto-sync after initial load
            setupAutoSync();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM já carregado — inicializar imediatamente
    initApp();
}

// Funções de Login
function showLoginScreen() {
    console.log('Showing login screen');
    const loginEl = document.getElementById('loginScreen');
    const invEl = document.getElementById('inventoryScreen');
    if (loginEl) {
        loginEl.classList.add('active');
        loginEl.style.display = 'block';
        loginEl.style.visibility = 'visible';
        loginEl.style.zIndex = '9999';
    }
    if (invEl) {
        invEl.classList.remove('active');
        invEl.style.display = 'none';
    }
}

function showInventoryScreen() {
    console.log('Showing inventory screen');
    const loginEl = document.getElementById('loginScreen');
    const invEl = document.getElementById('inventoryScreen');
    if (loginEl) {
        loginEl.classList.remove('active');
        // Forçar esconder, independentemente do CSS ou cache
        loginEl.style.display = 'none';
        loginEl.style.visibility = 'hidden';
        loginEl.style.zIndex = '';
    }
    if (invEl) {
        invEl.classList.add('active');
        invEl.style.display = 'block';
        invEl.style.visibility = 'visible';
    }
    renderItems();
    updateStats();
}

function login() {
    console.log('Login function called');
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('loginError');
    
    console.log('Password entered:', password ? '***' : 'empty');
    console.log('CONFIG defined:', typeof CONFIG !== 'undefined');
    console.log('Expected password:', CONFIG ? '***' : 'undefined');
    
    // Verificar se CONFIG está definido
    if (typeof CONFIG === 'undefined' || !CONFIG.PASSWORD) {
        errorElement.textContent = '❌ Erro: Ficheiro de configuração não carregado';
        console.error('CONFIG não está definido. Certifique-se que config.js está carregado.');
        return;
    }
    
    if (password === CONFIG.PASSWORD) {
        console.log('Password correct! Logging in...');
        isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        errorElement.textContent = '';
        showInventoryScreen();
        console.log('Login screen should be hidden now');
    } else {
        console.log('Password incorrect');
        errorElement.textContent = '❌ Password incorreta';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
}

function logout() {
    console.log('Logout requested');
    if (!confirm('Tem certeza que deseja sair?')) return;
    try {
        isLoggedIn = false;
        sessionStorage.removeItem('isLoggedIn');
        // Esconder interface de inventário e mostrar login de forma forçada
        const loginEl = document.getElementById('loginScreen');
        const invEl = document.getElementById('inventoryScreen');
        if (invEl) {
            invEl.classList.remove('active');
            invEl.style.display = 'none';
            invEl.style.visibility = 'hidden';
        }
        if (loginEl) {
            loginEl.classList.add('active');
            loginEl.style.display = 'block';
            loginEl.style.visibility = 'visible';
            loginEl.style.zIndex = '9999';
        }
        const pwd = document.getElementById('passwordInput');
        if (pwd) pwd.value = '';
        console.log('Logged out — showing login screen');
        // Garantir estado limpo
        // reload para evitar problemas de cache/camadas sobrepostas
        setTimeout(() => {
            try { sessionStorage.removeItem('isLoggedIn'); } catch(e){}
        }, 50);
    } catch (err) {
        console.error('Erro durante logout:', err);
    }
}

// Localizações
function loadLocations() {
    const saved = localStorage.getItem('locations');
    if (saved) {
        try { locations = JSON.parse(saved); } catch(e) { locations = []; }
    } else {
        // Exemplo inicial
        locations = [
            { name: 'Armário', subs: ['Gaveta 1', 'Gaveta 2'] },
            { name: 'Gavetas', subs: ['Gaveta A', 'Gaveta B'] },
            { name: 'Caixa Módulos', subs: [] },
            { name: 'Prateleira Arduinos', subs: [] }
        ];
        saveLocations();
    }
}

function saveLocations() {
    localStorage.setItem('locations', JSON.stringify(locations));
    // Trigger cloud sync if available (skip when modalSyncSuppressed is true)
    if (!window.modalSyncSuppressed) {
        if (typeof syncLocationsToCloud !== 'undefined' && !isSyncing) {
            setTimeout(() => syncLocationsToCloud(), 100);
        }
        // Also request a full sync shortly after to ensure deletes/associations are propagated
        if (typeof syncToCloud !== 'undefined' && !isSyncing) {
            setTimeout(() => { try { syncToCloud(); } catch(e){} }, 500);
        }
    }
}

function populateLocationSelects(selectedParent, selectedChild) {
    const parentSel = document.getElementById('itemLocationParent');
    const childSel = document.getElementById('itemLocationChild');
    if (!parentSel || !childSel) return;

    // Limpar
    parentSel.innerHTML = '';
    childSel.innerHTML = '';

    // Opcao vazia
    const optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '— Nenhum —';
    parentSel.appendChild(optEmpty);

    locations.forEach(loc => {
        const o = document.createElement('option');
        o.value = loc.name;
        o.textContent = loc.name;
        parentSel.appendChild(o);
    });

    if (selectedParent) parentSel.value = selectedParent;

    // Preencher subs do parent selecionado
    const parent = locations.find(l => l.name === (selectedParent || parentSel.value));
    const subs = parent ? parent.subs : [];

    const optEmptyChild = document.createElement('option');
    optEmptyChild.value = '';
    optEmptyChild.textContent = '— Nenhum —';
    childSel.appendChild(optEmptyChild);

    subs.forEach(s => {
        const oc = document.createElement('option');
        oc.value = s;
        oc.textContent = s;
        childSel.appendChild(oc);
    });

    if (selectedChild) childSel.value = selectedChild;

    // Atualizar subs quando mudar parent
    parentSel.onchange = () => {
        const p = locations.find(l => l.name === parentSel.value);
        childSel.innerHTML = '';
        childSel.appendChild(optEmptyChild.cloneNode(true));
        (p ? p.subs : []).forEach(s => {
            const oc = document.createElement('option');
            oc.value = s;
            oc.textContent = s;
            childSel.appendChild(oc);
        });
    };
}

// Modal-based location management (replaces prompt-based flows)
function showAddLocationModal() {
    // Suppress cloud sync until modal is closed
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('locationModal');
    const input = document.getElementById('locationName');
    if (!modal || !input) return;
    input.value = '';
    openModal(modal);
    setTimeout(() => input.focus(), 50);
}

function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (!modal) return;
    closeModalEl(modal);
}

function submitLocationForm(event) {
    event.preventDefault();
    const name = document.getElementById('locationName').value.trim();
    const errEl = document.getElementById('locationError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (!name) return;
    if (locations.find(l => l.name === name)) { if (errEl) { errEl.textContent = 'Local já existe'; errEl.style.display = 'block'; } return; }
    locations.push({ name, subs: [] });
    saveLocations();
    populateLocationSelects(name, '');
    populateLocationFilters(name, '');
    // Update location manager UI immediately if it's open
    if (typeof populateLocationManager !== 'undefined') populateLocationManager();
    closeLocationModal();
}

function showAddSublocationModal(parentName) {
    // Suppress cloud sync until modal is closed
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('sublocationModal');
    const parentSel = document.getElementById('sublocationParent');
    const currentParent = parentName || (document.getElementById('itemLocationParent') ? document.getElementById('itemLocationParent').value : '');
    if (!modal || !parentSel) return;
    // populate parent select
    parentSel.innerHTML = '';
    locations.forEach(loc => {
        const o = document.createElement('option');
        o.value = loc.name;
        o.textContent = loc.name;
        parentSel.appendChild(o);
    });
    if (currentParent) parentSel.value = currentParent;
    document.getElementById('sublocationName').value = '';
    openModal(modal);
    setTimeout(() => document.getElementById('sublocationName').focus(), 50);
}

function closeSublocationModal() {
    const modal = document.getElementById('sublocationModal');
    if (!modal) return;
    closeModalEl(modal);
}

function submitSublocationForm(event) {
    event.preventDefault();
    const parentName = document.getElementById('sublocationParent').value;
    const subName = document.getElementById('sublocationName').value.trim();
    const errEl = document.getElementById('sublocationError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (!parentName) { if (errEl) { errEl.textContent = 'Selecione um Local pai'; errEl.style.display = 'block'; } return; }
    if (!subName) return;
    const parent = locations.find(l => l.name === parentName);
    if (!parent) return;
    if (parent.subs.includes(subName)) { if (errEl) { errEl.textContent = 'Sub-local já existe'; errEl.style.display = 'block'; } return; }
    parent.subs.push(subName);
    saveLocations();
    populateLocationSelects(parentName, subName);
    populateLocationFilters(parentName, subName);
    // ensure item modal selects reflect the new values
    const itemParent = document.getElementById('itemLocationParent');
    const itemChild = document.getElementById('itemLocationChild');
    if (itemParent) itemParent.value = parentName;
    if (itemChild) {
        // repopulate children for the selected parent
        const evt = new Event('change');
        if (itemParent.onchange) itemParent.onchange();
        itemChild.value = subName;
    }
    // Update location manager UI immediately if it's open
    if (typeof populateLocationManager !== 'undefined') populateLocationManager();
    closeSublocationModal();
}

function populateLocationFilters(selectedParent, selectedChild) {
    const parentSel = document.getElementById('locationFilterParent');
    const childSel = document.getElementById('locationFilterChild');
    if (!parentSel || !childSel) return;

    parentSel.innerHTML = '';
    childSel.innerHTML = '';

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'Todos os Locais';
    parentSel.appendChild(optAll);

    locations.forEach(loc => {
        const o = document.createElement('option');
        o.value = loc.name;
        o.textContent = loc.name;
        parentSel.appendChild(o);
    });

    if (selectedParent) parentSel.value = selectedParent;

    // preencher child
    const selectedParentName = selectedParent || parentSel.value;
    const parent = locations.find(l => l.name === selectedParentName);

    const optAllChild = document.createElement('option');
    optAllChild.value = 'all';
    optAllChild.textContent = 'Todos os Sub-Locais';
    childSel.appendChild(optAllChild);

    (parent ? parent.subs : []).forEach(s => {
        const oc = document.createElement('option');
        oc.value = s;
        oc.textContent = s;
        childSel.appendChild(oc);
    });

    if (selectedChild) childSel.value = selectedChild;

    parentSel.onchange = () => {
        const p = locations.find(l => l.name === parentSel.value);
        childSel.innerHTML = '';
        childSel.appendChild(optAllChild.cloneNode(true));
        (p ? p.subs : []).forEach(s => {
            const oc = document.createElement('option');
            oc.value = s;
            oc.textContent = s;
            childSel.appendChild(oc);
        });
        filterItems();
    };
}

// Categories model: array of objects { key, label, icon }
function loadCategories() {
    const saved = localStorage.getItem('categories');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // support legacy array of strings
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                const map = defaultCategoryMap();
                categories = parsed.map(k => ({ key: k, label: (map[k] && map[k].label) ? map[k].label : k, icon: (map[k] && map[k].icon) ? map[k].icon : '' }));
            } else {
                categories = parsed;
            }
        } catch (e) { categories = []; }
    } else {
        categories = [
            { key: 'ferramentas', label: 'Ferramentas', icon: '🔨' },
            { key: 'eletrico', label: 'Material Elétrico', icon: '⚡' },
            { key: 'eletronico', label: 'Componentes Eletrônicos', icon: '🔌' },
            { key: 'placas', label: 'Placas e Arduinos', icon: '🖥️' },
            { key: 'ferragens', label: 'Ferragens', icon: '🔩' },
            { key: 'outros', label: 'Outros', icon: '📦' }
        ];
        saveCategories();
    }
}

function defaultCategoryMap() {
    return {
        ferramentas: { label: 'Ferramentas', icon: '🔨' },
        eletrico: { label: 'Material Elétrico', icon: '⚡' },
        eletronico: { label: 'Componentes Eletrônicos', icon: '🔌' },
        placas: { label: 'Placas e Arduinos', icon: '🖥️' },
        ferragens: { label: 'Ferragens', icon: '🔩' },
        outros: { label: 'Outros', icon: '📦' }
    };
}

function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
    // Trigger cloud sync if available (skip when modalSyncSuppressed is true)
    if (!window.modalSyncSuppressed) {
        if (typeof syncCategoriesToCloud !== 'undefined' && !isSyncing) {
            setTimeout(() => syncCategoriesToCloud(), 100);
        }
        if (typeof syncToCloud !== 'undefined' && !isSyncing) {
            setTimeout(() => { try { syncToCloud(); } catch(e){} }, 500);
        }
    }
}

function populateCategorySelects(selected) {
    const filter = document.getElementById('categoryFilter');
    const itemSel = document.getElementById('itemCategory');
    if (!filter || !itemSel) return;
    // preserve current filter
    const currentFilter = filter.value || 'all';
    filter.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'Todas as Categorias';
    filter.appendChild(optAll);

    categories.forEach(cat => {
        const o = document.createElement('option');
        o.value = cat.key;
        o.textContent = `${cat.icon || ''} ${cat.label}`.trim();
        filter.appendChild(o);
    });
    filter.value = selected === 'filter' ? currentFilter : (filter.value || 'all');

    // item select
    itemSel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Selecione...';
    itemSel.appendChild(empty);
    categories.forEach(cat => {
        const o = document.createElement('option');
        o.value = cat.key;
        o.textContent = `${cat.icon || ''} ${cat.label}`.trim();
        itemSel.appendChild(o);
    });
    if (selected && selected !== 'filter') itemSel.value = selected;
}

// Category modal
function showAddCategoryModal() {
    // Suppress cloud sync until modal is closed
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('categoryModal');
    const input = document.getElementById('categoryName');
    if (!modal || !input) return;
    input.value = '';
    openModal(modal);
    setTimeout(() => input.focus(), 50);
}

function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (!modal) return;
    closeModalEl(modal);
}

function submitCategoryForm(event) {
    event.preventDefault();
    const name = document.getElementById('categoryName').value.trim();
    const icon = document.getElementById('categoryIcon').value.trim();
    const errEl = document.getElementById('categoryError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (!name) return;
    const key = slugify(name);
    if (categories.find(c => c.key === key || c.label.toLowerCase() === name.toLowerCase())) {
        if (errEl) { errEl.textContent = 'Categoria já existe'; errEl.style.display = 'block'; }
        return;
    }
    const newCat = { key, label: name, icon: icon || '' };
    categories.push(newCat);
    saveCategories();
    populateCategorySelects(newCat.key);
    populateCategoryManager();
    closeCategoryModal();
}

// Category manager
function showCategoryManager() {
    populateCategoryManager();
    const modal = document.getElementById('categoryManagerModal');
    if (!modal) return;
    openModal(modal);
}

function closeCategoryManager() {
    const modal = document.getElementById('categoryManagerModal');
    if (!modal) return;
    closeModalEl(modal);
}

function populateCategoryManager() {
    const list = document.getElementById('categoryManagerList');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.innerHTML = `<div><strong>${cat.icon || ''} ${cat.label}</strong> <span style="color:var(--text-secondary); font-size:12px; margin-left:8px;">(${cat.key})</span></div>`;
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
    const editBtn = document.createElement('button'); editBtn.className = 'btn-primary'; editBtn.textContent = 'Editar';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-delete'; delBtn.textContent = 'Eliminar';
        editBtn.onclick = () => editCategoryInline(cat.key);
        delBtn.onclick = () => {
            showDeleteModal({ type: 'category', key: cat.key });
        };
        actions.appendChild(editBtn); actions.appendChild(delBtn);
        row.appendChild(actions);
        list.appendChild(row);
    });
}

function editCategoryInline(key) {
    const cat = categories.find(c => c.key === key);
    if (!cat) return;
    const list = document.getElementById('categoryManagerList');
    // replace content with editable form
    list.innerHTML = '';
    categories.forEach(c => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        if (c.key === key) {
            const left = document.createElement('div');
            left.innerHTML = `<input id="editLabel" value="${c.label}" style="padding:6px; margin-right:8px;"><input id="editIcon" value="${c.icon || ''}" style="padding:6px; width:60px;">`;
            const actions = document.createElement('div');
            actions.style.display = 'flex'; actions.style.gap = '8px';
            const save = document.createElement('button'); save.className = 'btn-primary'; save.textContent = 'Salvar';
            const cancel = document.createElement('button'); cancel.className = 'btn-secondary'; cancel.textContent = 'Cancelar';
            save.onclick = () => {
                const newLabel = document.getElementById('editLabel').value.trim();
                const newIcon = document.getElementById('editIcon').value.trim();
                const mgrErr = document.getElementById('categoryManagerError'); if (mgrErr) { mgrErr.style.display='none'; mgrErr.textContent=''; }
                if (!newLabel) { if (mgrErr) { mgrErr.textContent = 'Nome inválido'; mgrErr.style.display = 'block'; } return; }
                const newKey = slugify(newLabel);
                // if key changed and conflicts
                if (newKey !== c.key && categories.find(x => x.key === newKey)) { if (mgrErr) { mgrErr.textContent = 'Key já existe'; mgrErr.style.display = 'block'; } return; }
                c.label = newLabel; c.icon = newIcon; c.key = newKey;
                saveCategories(); populateCategorySelects(); populateCategoryManager();
            };
            cancel.onclick = () => populateCategoryManager();
            actions.appendChild(save); actions.appendChild(cancel);
            row.appendChild(left); row.appendChild(actions);
        } else {
            row.innerHTML = `<div><strong>${c.icon || ''} ${c.label}</strong> <span style="color:var(--text-secondary); font-size:12px; margin-left:8px;">(${c.key})</span></div>`;
        }
        list.appendChild(row);
    });
}

// Location manager
function showLocationManager() {
    populateLocationManager();
    const modal = document.getElementById('locationManagerModal');
    if (!modal) return;
    openModal(modal);
}

function closeLocationManager() {
    const modal = document.getElementById('locationManagerModal');
    if (!modal) return;
    closeModalEl(modal);
}

function populateLocationManager() {
    const list = document.getElementById('locationManagerList');
    if (!list) return;
    list.innerHTML = '';
    locations.forEach(loc => {
        const container = document.createElement('div');
        container.style.borderBottom = '1px solid var(--border-color)';
        container.style.padding = '8px 0';
        const header = document.createElement('div');
        header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
        header.innerHTML = `<strong>${loc.name}</strong>`;
        const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';
    const editBtn = document.createElement('button'); editBtn.className = 'btn-primary'; editBtn.textContent = 'Editar';
    const addSubBtn = document.createElement('button'); addSubBtn.className = 'btn-secondary'; addSubBtn.textContent = '+ Sub';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-delete'; delBtn.textContent = 'Eliminar';
        editBtn.onclick = () => editLocationInline(loc.name);
        addSubBtn.onclick = () => showAddSublocationModal(loc.name);
            delBtn.onclick = () => {
                showDeleteModal({ type: 'location', name: loc.name });
            };
        actions.appendChild(editBtn); actions.appendChild(addSubBtn); actions.appendChild(delBtn);
        header.appendChild(actions);
        container.appendChild(header);

        if (loc.subs && loc.subs.length) {
            const ul = document.createElement('ul'); ul.style.marginTop = '8px';
            loc.subs.forEach(sub => {
                const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center';
                li.innerHTML = `<span>${sub}</span>`;
                const subActions = document.createElement('div'); subActions.style.display = 'flex'; subActions.style.gap = '8px';
                const editSub = document.createElement('button'); editSub.className = 'btn-primary'; editSub.textContent = 'Editar';
                const delSub = document.createElement('button'); delSub.className = 'btn-delete'; delSub.textContent = 'Eliminar';
                editSub.onclick = () => editSublocationInline(loc.name, sub);
                delSub.onclick = () => {
                    showDeleteModal({ type: 'sublocation', parent: loc.name, name: sub });
                };
                subActions.appendChild(editSub); subActions.appendChild(delSub);
                li.appendChild(subActions);
                ul.appendChild(li);
            });
            container.appendChild(ul);
        }

        list.appendChild(container);
    });
}

function editLocationInline(name) {
    const loc = locations.find(l => l.name === name);
    if (!loc) return;
    const list = document.getElementById('locationManagerList'); if (!list) return;
    list.innerHTML = '';
    locations.forEach(l => {
        const container = document.createElement('div');
        container.style.padding = '8px 0'; container.style.borderBottom = '1px solid var(--border-color)';
        if (l.name === name) {
            const left = document.createElement('div');
            left.innerHTML = `<input id="editLocationName" value="${l.name}" style="padding:6px; margin-right:8px;">`;
            const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';
            const save = document.createElement('button'); save.className = 'btn-primary'; save.textContent = 'Salvar';
            const cancel = document.createElement('button'); cancel.className = 'btn-secondary'; cancel.textContent = 'Cancelar';
            save.onclick = () => {
                const newName = document.getElementById('editLocationName').value.trim();
                const mgrErr = document.getElementById('locationManagerError'); if (mgrErr) { mgrErr.style.display='none'; mgrErr.textContent=''; }
                if (!newName) { if (mgrErr) { mgrErr.textContent = 'Nome inválido'; mgrErr.style.display='block'; } return; }
                // update name and any inventory references
                l.name = newName;
                locations = locations.map(x => x === l ? l : x);
                // update inventory items that referenced old name
                inventory.forEach(it => { if (it.locationParent === name) it.locationParent = newName; });
                saveLocations(); saveInventory(); populateLocationSelects(); populateLocationFilters(); populateLocationManager();
            };
            cancel.onclick = () => populateLocationManager();
            actions.appendChild(save); actions.appendChild(cancel);
            container.appendChild(left); container.appendChild(actions);
        } else {
            const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center';
            header.innerHTML = `<strong>${l.name}</strong>`;
            container.appendChild(header);
        }
        list.appendChild(container);
    });
}

function editSublocationInline(parentName, subName) {
    const parent = locations.find(l => l.name === parentName);
    if (!parent) return;
    const list = document.getElementById('locationManagerList'); if (!list) return;
    list.innerHTML = '';
    locations.forEach(l => {
        const container = document.createElement('div');
        container.style.padding = '8px 0'; container.style.borderBottom = '1px solid var(--border-color)';
        const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center';
        header.innerHTML = `<strong>${l.name}</strong>`;
        container.appendChild(header);
        if (l.name === parentName) {
            const ul = document.createElement('ul'); ul.style.marginTop='8px';
            l.subs.forEach(s => {
                const li = document.createElement('li'); li.style.display='flex'; li.style.justifyContent='space-between'; li.style.alignItems='center';
                if (s === subName) {
                    const left = document.createElement('div');
                    left.innerHTML = `<input id="editSubName" value="${s}" style="padding:6px; margin-right:8px;">`;
                    const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px';
                    const save = document.createElement('button'); save.className='btn-primary'; save.textContent='Salvar';
                    const cancel = document.createElement('button'); cancel.className='btn-secondary'; cancel.textContent='Cancelar';
                    save.onclick = () => {
                        const newName = document.getElementById('editSubName').value.trim();
                        const mgrErr = document.getElementById('locationManagerError'); if (mgrErr) { mgrErr.style.display='none'; mgrErr.textContent=''; }
                        if (!newName) { if (mgrErr) { mgrErr.textContent = 'Nome inválido'; mgrErr.style.display='block'; } return; }
                        l.subs = l.subs.map(x => x === s ? newName : x);
                        // update inventory references
                        inventory.forEach(it => { if (it.locationParent === parentName && it.locationChild === s) it.locationChild = newName; });
                        saveLocations(); saveInventory(); populateLocationSelects(); populateLocationFilters(); populateLocationManager();
                    };
                    cancel.onclick = () => populateLocationManager();
                    actions.appendChild(save); actions.appendChild(cancel);
                    li.appendChild(left); li.appendChild(actions);
                } else {
                    li.innerHTML = `<span>${s}</span>`;
                }
                ul.appendChild(li);
            });
            container.appendChild(ul);
        }
        list.appendChild(container);
    });
}

// Delete modal
function showDeleteModal(target) {
    // Suppress cloud sync until delete modal is closed (we'll sync on close)
    window.modalSyncSuppressed = true;
    // target can be number (item id) or object { type, payload }
    const modal = document.getElementById('deleteModal');
    const msg = document.getElementById('deleteMessage');
    if (!modal || !msg) return;
    let text = 'Tem certeza que deseja eliminar este item?';
    if (typeof target === 'number' || typeof target === 'string') {
        // legacy: item id
        const id = target;
        const item = inventory.find(i => String(i.id) === String(id));
        if (!item) return;
        pendingDeleteContext = { type: 'item', payload: { id } };
        text = `Tem certeza que deseja eliminar "${item.name}"?`;
    } else if (typeof target === 'object' && target) {
        const t = target.type;
        if (t === 'category') {
            const cat = categories.find(c => c.key === target.key);
            pendingDeleteContext = { type: 'category', payload: { key: target.key } };
            text = `Eliminar categoria "${cat ? cat.label : target.key}" e remover associação de itens?`;
        } else if (t === 'location') {
            pendingDeleteContext = { type: 'location', payload: { name: target.name } };
            text = `Eliminar local "${target.name}" e todos os seus sub-locais?`;
        } else if (t === 'sublocation') {
            pendingDeleteContext = { type: 'sublocation', payload: { parent: target.parent, name: target.name } };
            text = `Eliminar sub-local "${target.name}" do local "${target.parent}"?`;
        } else {
            // fallback
            pendingDeleteContext = null;
            return;
        }
    } else {
        return;
    }
    msg.textContent = text;
    openModal(modal);
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;
    closeModalEl(modal);
    pendingDeleteContext = null;
}

function confirmDelete() {
    if (!pendingDeleteContext) return closeDeleteModal();
    const ctx = pendingDeleteContext;
    pendingDeleteContext = null;
    if (ctx.type === 'item') {
        const id = ctx.payload.id;
        inventory = inventory.filter(i => String(i.id) !== String(id));
        saveInventory();
        closeDeleteModal();
        renderItems();
        updateStats();
        return;
    }
    if (ctx.type === 'category') {
        const key = ctx.payload.key;
        // remove category and clear from items
        categories = categories.filter(c => c.key !== key);
        inventory.forEach(it => { if (it.category === key) it.category = ''; });
        saveCategories(); saveInventory();
        populateCategorySelects(); populateCategoryManager();
        closeDeleteModal();
        renderItems(); updateStats();
        return;
    }
    if (ctx.type === 'location') {
        const name = ctx.payload.name;
        locations = locations.filter(l => l.name !== name);
        // clear location references in items
        inventory.forEach(it => { if (it.locationParent === name) { it.locationParent = ''; it.locationChild = ''; } });
        saveLocations(); saveInventory();
        populateLocationSelects(); populateLocationFilters(); populateLocationManager();
        closeDeleteModal(); renderItems(); updateStats();
        return;
    }
    if (ctx.type === 'sublocation') {
        const parent = ctx.payload.parent;
        const name = ctx.payload.name;
        const loc = locations.find(l => l.name === parent);
        if (loc) loc.subs = loc.subs.filter(s => s !== name);
        // clear item references to this sublocation
        inventory.forEach(it => { if (it.locationParent === parent && it.locationChild === name) it.locationChild = ''; });
        saveLocations(); saveInventory();
        populateLocationSelects(); populateLocationFilters(); populateLocationManager();
        closeDeleteModal(); renderItems(); updateStats();
        return;
    }
}

// Low-stock modal: open, close and populate
function showLowStockModal() {
    const modal = document.getElementById('lowStockModal');
    if (!modal) return;
    populateLowStockList();
    openModal(modal);
}

function closeLowStockModal() {
    const modal = document.getElementById('lowStockModal');
    if (!modal) return;
    closeModalEl(modal);
}

function populateLowStockList() {
    const container = document.getElementById('lowStockList');
    if (!container) return;
    container.innerHTML = '';
    const lowItems = inventory.filter(item => item.quantity <= (item.minStock || 0));
    if (!lowItems.length) {
        container.innerHTML = '<div style="padding:12px;color:var(--text-secondary);">Nenhum item com stock baixo</div>';
        return;
    }
    lowItems.forEach(it => {
        const row = document.createElement('div');
        row.className = 'low-row';
        const name = document.createElement('div'); name.className = 'name';
        name.textContent = it.name;
        const qty = document.createElement('div'); qty.className = 'qty';
        qty.textContent = `${it.quantity}`;
        row.appendChild(name);
        row.appendChild(qty);
        // make row clickable to open edit modal for this item
        row.style.cursor = 'pointer';
        row.onclick = () => {
            closeLowStockModal();
            // small timeout to ensure modal closed before opening next
            setTimeout(() => showEditItemModal(it.id), 80);
        };
        container.appendChild(row);
    });
}

function onLocationFilterChange() {
    // update child options and then filter
    const parentSel = document.getElementById('locationFilterParent');
    const childSel = document.getElementById('locationFilterChild');
    if (!parentSel || !childSel) return;
    const p = locations.find(l => l.name === parentSel.value);
    childSel.innerHTML = '';
    const optAllChild = document.createElement('option');
    optAllChild.value = 'all';
    optAllChild.textContent = 'Todos os Sub-Locais';
    childSel.appendChild(optAllChild);
    (p ? p.subs : []).forEach(s => {
        const oc = document.createElement('option');
        oc.value = s;
        oc.textContent = s;
        childSel.appendChild(oc);
    });
    filterItems();
}

// Funções de LocalStorage
function loadInventory() {
    const saved = localStorage.getItem('inventory');
        if (saved && saved !== '[]') {
        inventory = JSON.parse(saved);
        // Normalizar campos de localização (compatibilidade com versões antigas)
        inventory = inventory.map(item => {
            if (!('locationParent' in item) && 'location' in item) {
                // tentar separar por ' / '
                const parts = (item.location || '').split('/').map(s => s.trim()).filter(Boolean);
                return Object.assign({}, item, {
                    locationParent: parts.length > 1 ? parts[0] : '',
                    locationChild: parts.length > 1 ? parts.slice(1).join(' / ') : (parts[0] || '')
                });
            }
            item.locationParent = item.locationParent || '';
            item.locationChild = item.locationChild || '';
            return item;
        });
    } else {
        // Dados de exemplo iniciais
        inventory = [
            {
                id: 1,
                name: 'Resistências 220Ω',
                category: 'eletronico',
                quantity: 150,
                minStock: 20,
                location: 'Gaveta 1 - Componentes',
                notes: '1/4W, 5% tolerância',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 2,
                name: 'Resistências 10kΩ',
                category: 'eletronico',
                quantity: 200,
                minStock: 20,
                location: 'Gaveta 1 - Componentes',
                notes: '1/4W, 5% tolerância',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 3,
                name: 'LEDs Vermelhos 5mm',
                category: 'eletronico',
                quantity: 50,
                minStock: 10,
                location: 'Gaveta 1 - LEDs',
                notes: '3V, 20mA',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 4,
                name: 'LEDs Azuis 5mm',
                category: 'eletronico',
                quantity: 30,
                minStock: 10,
                location: 'Gaveta 1 - LEDs',
                notes: '3.2V, 20mA',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 5,
                name: 'LEDs Verdes 5mm',
                category: 'eletronico',
                quantity: 40,
                minStock: 10,
                location: 'Gaveta 1 - LEDs',
                notes: '3.2V, 20mA',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 6,
                name: 'LEDs Brancos 5mm',
                category: 'eletronico',
                quantity: 25,
                minStock: 10,
                location: 'Gaveta 1 - LEDs',
                notes: '3.2V, 20mA',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 7,
                name: 'RTC DS3231',
                category: 'eletronico',
                quantity: 5,
                minStock: 2,
                location: 'Caixa Módulos',
                notes: 'Alta precisão com bateria',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 8,
                name: 'RTC DS1307',
                category: 'eletronico',
                quantity: 3,
                minStock: 1,
                location: 'Caixa Módulos',
                notes: 'Com bateria CR2032',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 9,
                name: 'Arduino Uno R3',
                category: 'placas',
                quantity: 2,
                minStock: 1,
                location: 'Prateleira Arduinos',
                notes: 'ATmega328P, clone',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 10,
                name: 'Arduino Nano',
                category: 'placas',
                quantity: 4,
                minStock: 2,
                location: 'Prateleira Arduinos',
                notes: 'ATmega328P, USB mini',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 11,
                name: 'Chip ATmega328P-PU',
                category: 'eletronico',
                quantity: 8,
                minStock: 3,
                location: 'Gaveta 2 - ICs',
                notes: 'DIP-28, com bootloader Arduino',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 12,
                name: 'Módulo Carregador TP4056 USB-C',
                category: 'eletronico',
                quantity: 6,
                minStock: 2,
                location: 'Caixa Módulos',
                notes: 'Para baterias Li-ion 3.7V, 1A',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 13,
                name: 'Capacitores Cerâmicos 100nF',
                category: 'eletronico',
                quantity: 100,
                minStock: 20,
                location: 'Gaveta 1 - Componentes',
                notes: '50V',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 14,
                name: 'Capacitores Eletrolíticos 100µF',
                category: 'eletronico',
                quantity: 30,
                minStock: 10,
                location: 'Gaveta 1 - Componentes',
                notes: '25V',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 15,
                name: 'Transistores BC547',
                category: 'eletronico',
                quantity: 50,
                minStock: 10,
                location: 'Gaveta 2 - Semicondutores',
                notes: 'NPN, TO-92',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        saveInventory();
    }
}

function saveInventory() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
        // Trigger cloud sync if available (skip when modalSyncSuppressed is true)
        if (!window.modalSyncSuppressed) {
            if (typeof syncInventoryToCloud !== 'undefined' && !isSyncing) {
                setTimeout(() => syncInventoryToCloud(), 100);
            }
            if (typeof syncToCloud !== 'undefined' && !isSyncing) {
                setTimeout(() => { try { syncToCloud(); } catch(e){} }, 500);
            }
        }
}

// Funções de Modal
function showAddItemModal() {
    // Suppress cloud sync until modal is closed
    window.modalSyncSuppressed = true;
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Item';
    document.getElementById('itemForm').reset();
    // Garantir que os selects de localização estão populados ao abrir modal de adicionar
    populateLocationSelects('', '');
    populateLocationFilters();
    openModal(document.getElementById('itemModal'));
}

function showEditItemModal(id) {
    // Suppress cloud sync until modal is closed
    window.modalSyncSuppressed = true;
    const item = inventory.find(i => String(i.id) === String(id));
    if (!item) return;
    
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Editar Item';
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemMinStock').value = item.minStock;
    // Determinar parent/child (compatível com dados antigos que têm apenas 'location')
    function parseLocationString(s) {
        if (!s) return { parent: '', child: '' };
        // tentar vários separadores comuns
        const seps = [' / ', '/', ' - ', ' -', '- ', '-', ','];
        let parts = [s];
        for (const sep of seps) {
            if (s.includes(sep)) { parts = s.split(sep).map(p => p.trim()).filter(Boolean); break; }
        }
        if (parts.length === 1) return { parent: '', child: parts[0] };
        return { parent: parts[0], child: parts.slice(1).join(' / ') };
    }

    let parentVal = item.locationParent || '';
    let childVal = item.locationChild || '';
    if (!parentVal && !childVal && item.location) {
        const parsed = parseLocationString(item.location);
        parentVal = parsed.parent;
        childVal = parsed.child;
    }

    // Popular selects de localização e escolher os valores existentes
    populateLocationSelects(parentVal, childVal);
    const parentSel = document.getElementById('itemLocationParent');
    const childSel = document.getElementById('itemLocationChild');
    if (parentSel) parentSel.value = parentVal || '';
    if (childSel) childSel.value = childVal || '';
    document.getElementById('itemNotes').value = item.notes || '';
    openModal(document.getElementById('itemModal'));
}

function closeModal() {
    closeModalEl(document.getElementById('itemModal'));
    currentEditId = null;
}

// Funções CRUD
function saveItem(event) {
    event.preventDefault();
    
    const item = {
        id: currentEditId || Date.now(),
        name: document.getElementById('itemName').value.trim(),
        category: document.getElementById('itemCategory').value,
        quantity: parseInt(document.getElementById('itemQuantity').value),
        minStock: parseInt(document.getElementById('itemMinStock').value),
        locationParent: document.getElementById('itemLocationParent') ? document.getElementById('itemLocationParent').value : '',
        locationChild: document.getElementById('itemLocationChild') ? document.getElementById('itemLocationChild').value : '',
        notes: document.getElementById('itemNotes').value.trim(),
        createdAt: currentEditId ? (inventory.find(i => String(i.id) === String(currentEditId)) || {}).createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditId) {
        // Editar item existente
        const index = inventory.findIndex(i => String(i.id) === String(currentEditId));
        if (index !== -1) inventory[index] = item;
    } else {
        // Adicionar novo item
        inventory.push(item);
    }
    
    saveInventory();
    closeModal();
    renderItems();
    updateStats();
    // Ensure we request a cloud sync shortly after saving an item so the DB
    // is updated even when modal suppression logic is in use.
    try { requestCloudSync(300); } catch (e) { /* ignore if helper not present */ }
}

function deleteItem(id) {
    // Backwards-compatible wrapper -> open modal confirmation
    showDeleteModal(id);
}

function adjustStock(id, delta) {
    const item = inventory.find(i => String(i.id) === String(id));
    if (!item) return;
    
    item.quantity = Math.max(0, item.quantity + delta);
    item.updatedAt = new Date().toISOString();
    
    saveInventory();
    renderItems();
    updateStats();
}

// Funções de Renderização
function renderItems() {
    const container = document.getElementById('itemsList');
    const emptyMessage = document.getElementById('emptyMessage');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const groupBy = (document.getElementById('groupBy') ? document.getElementById('groupBy').value : 'none');
    
    // Filtrar items (incluir parent/child location e filtros selects de Local/Sub-Local)
    const locParentFilter = (document.getElementById('locationFilterParent') ? document.getElementById('locationFilterParent').value : 'all');
    const locChildFilter = (document.getElementById('locationFilterChild') ? document.getElementById('locationFilterChild').value : 'all');

    let filteredItems = inventory.filter(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
        const notesMatch = item.notes && item.notes.toLowerCase().includes(searchTerm);
        const parentMatch = item.locationParent && item.locationParent.toLowerCase().includes(searchTerm);
        const childMatch = item.locationChild && item.locationChild.toLowerCase().includes(searchTerm);
        const matchesSearch = nameMatch || notesMatch || parentMatch || childMatch;
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

        // Location filter logic:
        let matchesLocation = true;
        if (locParentFilter && locParentFilter !== 'all') {
            // match if item's parent equals filter OR child contains the parent name (legacy strings)
            const lp = (item.locationParent || '').toLowerCase();
            const lc = (item.locationChild || '').toLowerCase();
            const sel = locParentFilter.toLowerCase();
            matchesLocation = (lp === sel) || (lc === sel) || (lc.includes(sel));
        }
        if (matchesLocation && locChildFilter && locChildFilter !== 'all') {
            const lc = (item.locationChild || '').toLowerCase();
            const selc = locChildFilter.toLowerCase();
            matchesLocation = (lc === selc) || (lc.includes(selc));
        }

        return matchesSearch && matchesCategory && matchesLocation;
    });
    
    if (filteredItems.length === 0) {
        container.innerHTML = '';
        emptyMessage.classList.add('show');
        return;
    }
    
    emptyMessage.classList.remove('show');
    
    // Ordenar por nome
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));

    // Render helper
    function renderItemCard(item) {
        const catObj = categories.find(c => c.key === item.category) || { icon: '', label: item.category || '' };
        const isLowStock = item.quantity <= item.minStock && item.quantity > 0;
        const isEmpty = item.quantity === 0;
        let stockClass = '';
        let stockBadge = '';
        if (isEmpty) { stockClass = 'empty'; stockBadge = '<span class="stock-badge empty">SEM STOCK</span>'; }
        else if (isLowStock) { stockClass = 'low'; stockBadge = '<span class="stock-badge low">STOCK BAIXO</span>'; }
        const displayLocation = (item.locationParent ? item.locationParent + (item.locationChild ? ' / ' + item.locationChild : '') : (item.locationChild || ''));
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <div class="item-title">${item.name}</div>
                        <div class="item-category">${catObj.icon || ''} ${catObj.label || item.category}</div>
                    </div>
                </div>
                <div class="item-details">
                    <div class="item-detail"><span>Quantidade:</span><span class="stock-quantity ${stockClass}">${item.quantity} ${stockBadge}</span></div>
                    <div class="item-detail"><span>Stock Mínimo:</span><span>${item.minStock}</span></div>
                    ${displayLocation ? `\n                        <div class="item-location">📍 ${displayLocation}</div>\n                    ` : ''}
                    ${item.notes ? `\n                        <div class="item-notes">💬 ${item.notes}</div>\n                    ` : ''}
                </div>
                <div class="stock-controls"><button class="stock-btn minus" onclick="adjustStock(${JSON.stringify(item.id)}, -1)" ${item.quantity === 0 ? 'disabled' : ''}>−</button><button class="stock-btn plus" onclick="adjustStock(${JSON.stringify(item.id)}, 1)">+</button></div>
                <div class="item-actions"><button class="btn-edit" onclick="showEditItemModal(${JSON.stringify(item.id)})">✏️ Editar</button><button class="btn-delete" onclick="showDeleteModal(${JSON.stringify(item.id)})">🗑️ Eliminar</button></div>
            </div>
        `;
    }

    // Agrupar se necessário
    if (groupBy && groupBy !== 'none') {
        const groups = {};
        filteredItems.forEach(item => {
            const key = groupBy === 'locationParent' ? (item.locationParent || '— Sem Local —') : (item.locationChild || '— Sem Sub-Local —');
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        let html = '';
        Object.keys(groups).forEach(g => {
            html += `<div class="group-section"><h3 class="group-title">${g}</h3><div class="group-items">`;
            groups[g].forEach(it => { html += renderItemCard(it); });
            html += `</div></div>`;
        });
        container.innerHTML = html;
        return;
    }

    container.innerHTML = filteredItems.map(item => renderItemCard(item)).join('');
}

function filterItems() {
    renderItems();
    updateStats();
}

function updateStats() {
    // Total de itens
    document.getElementById('totalItems').textContent = inventory.length;
    
    // Total de categorias únicas (se existir o elemento)
    const uniqueCategories = new Set(inventory.map(item => item.category));
    const catEl = document.getElementById('totalCategories');
    if (catEl) catEl.textContent = uniqueCategories.size;
    
    // Items com stock baixo
    const lowStockCount = inventory.filter(item => 
        item.quantity <= item.minStock && item.quantity >= 0
    ).length;
    document.getElementById('lowStock').textContent = lowStockCount;
}

// Fechar modal clicando fora
window.onclick = function(event) {
    const itemModalEl = document.getElementById('itemModal');
    const locModalEl = document.getElementById('locationModal');
    const subModalEl = document.getElementById('sublocationModal');
    const catModalEl = document.getElementById('categoryModal');
    const catMgrEl = document.getElementById('categoryManagerModal');
    const locMgrEl = document.getElementById('locationManagerModal');
    const deleteEl = document.getElementById('deleteModal');
    if (event.target === itemModalEl) {
        closeModal();
    }
    if (event.target === locModalEl) {
        closeLocationModal();
    }
    if (event.target === subModalEl) {
        closeSublocationModal();
    }
    if (event.target === catModalEl) {
        closeCategoryModal();
    }
    if (event.target === catMgrEl) {
        closeCategoryManager();
    }
    if (event.target === locMgrEl) {
        closeLocationManager();
    }
    if (event.target === deleteEl) {
        closeDeleteModal();
    }
}
