// Estado da aplicação
let inventory = [];
let currentEditId = null;
let isLoggedIn = false;
let locations = [];
let categories = [];
let pendingDeleteContext = null; // { type: 'item'|'category'|'location'|'sublocation', payload... }
let modalZIndex = 1000;
// Quando true, não dispara sync enquanto o modal está aberto; sincroniza 1x ao fechar
window.modalSyncSuppressed = false;

/* =======================
   Helpers de Modal
   ======================= */
function openModal(el) {
    if (!el) return;
    const headerEl = document.querySelector('header');
    let headerH = 0;
    if (headerEl) {
        try { headerH = headerEl.getBoundingClientRect().height || 0; } catch (_) {}
    }
    el.classList.add('active');
    modalZIndex += 1;
    el.style.zIndex = modalZIndex;

    const modalContent = el.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.marginTop = (headerH + 12) + 'px';
        modalContent.style.maxHeight = 'calc(100vh - ' + (headerH + 40) + 'px)';
        modalContent.style.overflowY = 'auto';
    }
    try { el.scrollTop = 0; } catch (_) {}
}

function closeModalEl(el) {
    if (!el) return;
    const shouldTriggerSync = !!window.modalSyncSuppressed;
    window.modalSyncSuppressed = false;

    el.classList.remove('active');
    el.style.zIndex = '';
    const modalContent = el.querySelector && el.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.marginTop = '';
        modalContent.style.maxHeight = '';
        modalContent.style.overflowY = '';
    }
    if (shouldTriggerSync) {
        setTimeout(() => {
            try {
                if (typeof syncToCloud !== 'undefined' && !isSyncing) syncToCloud();
            } catch (e) { console.warn('Error triggering sync after modal close', e); }
        }, 250);
    }
}

// Debounce para pedir sync (REMOVIDO - não há mais auto-sync)
// Sync manual apenas quando necessário

// Helpers
function slugify(s) {
    return s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
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
function getCategoryMeta(key) {
    const map = defaultCategoryMap();
    const found = categories.find(c => c.key === key);
    if (found) return { label: found.label, icon: found.icon || '' };
    if (map[key]) return map[key];
    return { label: key || 'Sem categoria', icon: '' };
}

/* =======================
   Inicialização
   ======================= */
function initApp() {
    // Forçar login ativo (como pediste)
    isLoggedIn = true;
    try { sessionStorage.setItem('isLoggedIn', 'true'); } catch(_) {}
    showInventoryScreen();

    loadInventory();
    // listeners de login (mantidos por compatibilidade)
    const pwd = document.getElementById('passwordInput');
    if (pwd) {
        pwd.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            login();
        });
    }

    loadLocations();
    populateLocationSelects();
    populateLocationFilters();

    loadCategories();
    populateCategorySelects();

    const groupEl = document.getElementById('groupBy');
    if (groupEl) groupEl.addEventListener('change', () => renderItems());

    renderItems();
    updateStats();

    // Supabase
    if (typeof initSupabase !== 'undefined' && initSupabase()) {
        loadFromCloud();
        // Removed auto-sync - sync only happens manually or on save
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* =======================
   Login (mantido)
   ======================= */
function showLoginScreen() {
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
    const loginEl = document.getElementById('loginScreen');
    const invEl = document.getElementById('inventoryScreen');
    if (loginEl) {
        loginEl.classList.remove('active');
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
    const password = document.getElementById('passwordInput')?.value || '';
    const errorElement = document.getElementById('loginError');
    if (typeof CONFIG === 'undefined' || !CONFIG.PASSWORD) {
        if (errorElement) errorElement.textContent = '❌ Erro: Ficheiro de configuração não carregado';
        return;
    }
    if (password === CONFIG.PASSWORD) {
        isLoggedIn = true;
        try { sessionStorage.setItem('isLoggedIn', 'true'); } catch(_) {}
        if (errorElement) errorElement.textContent = '';
        showInventoryScreen();
    } else {
        if (errorElement) errorElement.textContent = '❌ Password incorreta';
        const pwd = document.getElementById('passwordInput');
        if (pwd) { pwd.value = ''; pwd.focus(); }
    }
}

function logout() {
    if (!confirm('Tem certeza que deseja sair?')) return;
    try {
        isLoggedIn = false;
        sessionStorage.removeItem('isLoggedIn');
        showLoginScreen();
        setTimeout(() => {
            try { sessionStorage.removeItem('isLoggedIn'); } catch(_){}
        }, 50);
    } catch (err) {
        console.error('Erro durante logout:', err);
    }
}

/* =======================
   Locais
   ======================= */
function loadLocations() {
    const saved = localStorage.getItem('locations');
    if (saved) {
        try { locations = JSON.parse(saved); } catch(_) { locations = []; }
    } else {
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
    // Removed auto-sync
}
function populateLocationSelects(selectedParent, selectedChild) {
    const parentSel = document.getElementById('itemLocationParent');
    const childSel = document.getElementById('itemLocationChild');
    if (!parentSel || !childSel) return;

    parentSel.innerHTML = '';
    childSel.innerHTML = '';

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

// Modais de locais
function showAddLocationModal() {
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('locationModal');
    const input = document.getElementById('locationName');
    if (!modal || !input) return;
    input.value = '';
    openModal(modal);
    setTimeout(() => input.focus(), 50);
}
function closeLocationModal() {
    closeModalEl(document.getElementById('locationModal'));
}
function submitLocationForm(event) {
    event.preventDefault();
    const name = document.getElementById('locationName').value.trim();
    const errEl = document.getElementById('locationError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (!name) return;
    if (locations.find(l => l.name === name)) {
        if (errEl) { errEl.textContent = 'Local já existe'; errEl.style.display = 'block'; }
        return;
    }
    locations.push({ name, subs: [] });
    saveLocations();
    populateLocationSelects(name, '');
    populateLocationFilters(name, '');
    if (typeof populateLocationManager !== 'undefined') populateLocationManager();
    closeLocationModal();
}

function showAddSublocationModal(parentName) {
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('sublocationModal');
    const parentSel = document.getElementById('sublocationParent');
    const currentParent = parentName || (document.getElementById('itemLocationParent') ? document.getElementById('itemLocationParent').value : '');
    if (!modal || !parentSel) return;

    parentSel.innerHTML = '';
    locations.forEach(loc => {
        const o = document.createElement('option');
        o.value = loc.name;
        o.textContent = loc.name;
        parentSel.appendChild(o);
    });
    if (currentParent) parentSel.value = currentParent;
    const nameInput = document.getElementById('sublocationName');
    if (nameInput) nameInput.value = '';
    openModal(modal);
    setTimeout(() => nameInput && nameInput.focus(), 50);
}
function closeSublocationModal() {
    closeModalEl(document.getElementById('sublocationModal'));
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

    const itemParent = document.getElementById('itemLocationParent');
    const itemChild = document.getElementById('itemLocationChild');
    if (itemParent) itemParent.value = parentName;
    if (itemChild) {
        if (itemParent.onchange) itemParent.onchange();
        itemChild.value = subName;
    }
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

/* =======================
   Categorias
   ======================= */
function loadCategories() {
    const saved = localStorage.getItem('categories');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Normalize older formats: strings, or objects without subs
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                const map = defaultCategoryMap();
                categories = parsed.map(k => ({ key: k, label: (map[k] && map[k].label) ? map[k].label : k, icon: (map[k] && map[k].icon) ? map[k].icon : '', subs: [] }));
            } else {
                categories = parsed.map(c => ({ key: c.key, label: c.label, icon: c.icon || '', subs: c.subs || [] }));
            }
        } catch (_) { categories = []; }
    } else {
        categories = [
            { key: 'ferramentas', label: 'Ferramentas', icon: '🔨', subs: [] },
            { key: 'eletrico', label: 'Material Elétrico', icon: '⚡', subs: [] },
            { key: 'eletronico', label: 'Componentes Eletrônicos', icon: '🔌', subs: [] },
            { key: 'placas', label: 'Placas e Arduinos', icon: '🖥️', subs: [] },
            { key: 'ferragens', label: 'Ferragens', icon: '🔩', subs: [] },
            { key: 'outros', label: 'Outros', icon: '📦', subs: [] }
        ];
        saveCategories();
    }
}
function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
    // Removed auto-sync
}
function populateCategorySelects(selected) {
    const filter = document.getElementById('categoryFilter');
    const itemSel = document.getElementById('itemCategory');
    if (!filter || !itemSel) return;

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

    // Prepare itemSubcategory select if present
    const itemSubSel = document.getElementById('itemSubcategory');
    if (itemSubSel) {
        itemSubSel.innerHTML = '';
        const opt = document.createElement('option'); opt.value = ''; opt.textContent = '— Nenhuma —'; itemSubSel.appendChild(opt);
        // if a category is preselected, populate its subs
        const selCat = categories.find(c => c.key === (selected && selected !== 'filter' ? selected : itemSel.value));
        if (selCat && Array.isArray(selCat.subs) && selCat.subs.length > 0) {
            selCat.subs.forEach(s => {
                const o = document.createElement('option'); o.value = s; o.textContent = s; itemSubSel.appendChild(o);
            });
            itemSubSel.style.display = 'inline-block';
        } else {
            itemSubSel.style.display = 'none';
        }
    }
}

// When category changes in item modal, populate subcategories select
function addCategoryChangeHandler() {
    document.addEventListener('change', function(e) {
        if (!e.target) return;
        if (e.target.id === 'itemCategory') {
            const sel = e.target.value;
            const subSel = document.getElementById('itemSubcategory');
            if (!subSel) return;
            const cat = categories.find(c => c.key === sel);
            if (!cat || !Array.isArray(cat.subs) || cat.subs.length === 0) {
                subSel.style.display = 'none';
                subSel.innerHTML = '';
                return;
            }
            subSel.style.display = 'inline-block';
            subSel.innerHTML = '';
            const empty = document.createElement('option'); empty.value = ''; empty.textContent = '— Nenhuma —'; subSel.appendChild(empty);
            cat.subs.forEach(s => {
                const o = document.createElement('option'); o.value = s; o.textContent = s; subSel.appendChild(o);
            });
        }
    });
}
// register handler once
addCategoryChangeHandler();

// Modal de criar categoria
function showAddCategoryModal() {
    window.modalSyncSuppressed = true;
    const modal = document.getElementById('categoryModal');
    const input = document.getElementById('categoryName');
    if (!modal || !input) return;
    input.value = '';
    const icon = document.getElementById('categoryIcon');
    if (icon) icon.value = '';
    openModal(modal);
    setTimeout(() => input.focus(), 50);
}
function closeCategoryModal() {
    closeModalEl(document.getElementById('categoryModal'));
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
    const newCat = { key, label: name, icon: icon || '', subs: [] };
    categories.push(newCat);
    saveCategories();
    populateCategorySelects(newCat.key);
    populateCategoryManager();
    closeCategoryModal();
}

// Add subcategory from item modal (button next to subcategory select)
function addSubcategoryToSelectedCategory() {
    const catSel = document.getElementById('itemCategory');
    if (!catSel) return alert('Escolha primeiro uma categoria');
    const catKey = catSel.value;
    if (!catKey) return alert('Escolha primeiro uma categoria');
    const name = prompt('Nome da nova subcategoria para ' + catKey + ':');
    if (!name) return;
    const cat = categories.find(c => c.key === catKey);
    if (!cat) return alert('Categoria não encontrada');
    cat.subs = cat.subs || [];
    const trimmed = name.trim();
    if (!trimmed) return;
    if (cat.subs.includes(trimmed)) return alert('Subcategoria já existe');
    cat.subs.push(trimmed);
    saveCategories();
    populateCategorySelects(catKey);
    alert('Subcategoria adicionada');
}

// Gestor de categorias
function showCategoryManager() {
    populateCategoryManager();
    openModal(document.getElementById('categoryManagerModal'));
}
function closeCategoryManager() {
    closeModalEl(document.getElementById('categoryManagerModal'));
}
function populateCategoryManager() {
    const list = document.getElementById('categoryManagerList');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const row = document.createElement('div');
        row.style.borderBottom = '1px solid var(--border-color)';
        row.style.padding = '8px 0';

        const header = document.createElement('div');
        header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
        header.innerHTML = `<div><strong>${cat.icon || ''} ${cat.label}</strong> <span style="color:var(--text-secondary); font-size:12px; margin-left:8px;">(${cat.key})</span></div>`;

        const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';
        const editBtn = document.createElement('button'); editBtn.className = 'btn-primary'; editBtn.textContent = 'Editar';
        const addSubBtn = document.createElement('button'); addSubBtn.className = 'btn-secondary'; addSubBtn.textContent = '+ Sub';
        const delBtn = document.createElement('button'); delBtn.className = 'btn-delete'; delBtn.textContent = 'Eliminar';

        editBtn.onclick = () => editCategoryInline(cat.key);
        addSubBtn.onclick = () => addSubcategoryInline(cat.key);
        delBtn.onclick = () => showDeleteModal({ type: 'category', key: cat.key });

        actions.appendChild(editBtn);
        actions.appendChild(addSubBtn);
        actions.appendChild(delBtn);
        header.appendChild(actions);
        row.appendChild(header);

        // Show subcategories under the category
        const subsDiv = document.createElement('div');
        subsDiv.style.marginLeft = '12px'; subsDiv.style.marginTop = '8px';
        if (Array.isArray(cat.subs) && cat.subs.length > 0) {
            cat.subs.forEach(sub => {
                const subRow = document.createElement('div');
                subRow.style.display = 'flex'; subRow.style.justifyContent = 'space-between'; subRow.style.alignItems = 'center'; subRow.style.padding = '4px 0';
                const left = document.createElement('div'); left.textContent = sub;
                const right = document.createElement('div');
                const delSub = document.createElement('button'); delSub.className = 'btn-delete'; delSub.textContent = 'Eliminar';
                delSub.onclick = () => removeSubcategory(cat.key, sub);
                right.appendChild(delSub);
                subRow.appendChild(left); subRow.appendChild(right);
                subsDiv.appendChild(subRow);
            });
        } else {
            const none = document.createElement('div'); none.style.color = 'var(--text-secondary)'; none.style.fontSize = '13px'; none.textContent = 'Sem subcategorias';
            subsDiv.appendChild(none);
        }
        row.appendChild(subsDiv);

        list.appendChild(row);
    });
}

function addSubcategoryInline(categoryKey) {
    const name = prompt('Nome da nova subcategoria para ' + categoryKey + ':');
    if (!name) return;
    const cat = categories.find(c => c.key === categoryKey);
    if (!cat) { alert('Categoria não encontrada'); return; }
    const trimmed = name.trim();
    if (!trimmed) return;
    cat.subs = cat.subs || [];
    if (cat.subs.includes(trimmed)) { alert('Subcategoria já existe'); return; }
    cat.subs.push(trimmed);
    saveCategories(); populateCategoryManager(); populateCategorySelects();
}

function removeSubcategory(categoryKey, subName) {
    const cat = categories.find(c => c.key === categoryKey);
    if (!cat) return;
    cat.subs = (cat.subs || []).filter(s => s !== subName);
    saveCategories(); populateCategoryManager(); populateCategorySelects();
}

// Save changes made in the Category Manager: persist locally and optionally to Supabase
async function saveCategoryManagerChanges() {
    try {
        console.log('💾 [CATEGORIES] Saving categories from manager...');
        saveCategories();
        // If supabase client available, sync categories
        if (typeof syncCategoriesToCloud !== 'undefined' && typeof initSupabase !== 'undefined' && supabase) {
            try {
                await syncCategoriesToCloud();
                showSyncStatus('✓ Categorias gravadas', true);
                console.log('✅ [CATEGORIES] Synced to Supabase');
            } catch (err) {
                console.error('❌ [CATEGORIES] Error syncing categories to Supabase:', err);
                showSyncStatus('✗ Erro ao gravar categorias', false);
            }
        } else {
            console.log('⚠️ [CATEGORIES] Supabase not initialized - saved locally only');
            showSyncStatus('Categorias gravadas localmente', true);
        }
        populateCategoryManager();
        populateCategorySelects();
        closeCategoryManager();
    } catch (err) {
        console.error('❌ [CATEGORIES] Save error:', err);
        alert('Erro ao gravar categorias: ' + err.message);
    }
}

// Save changes made in the Location Manager: persist locally and optionally to Supabase
async function saveLocationManagerChanges() {
    try {
        console.log('💾 [LOCATIONS] Saving locations from manager...');
        saveLocations();
        if (typeof syncLocationsToCloud !== 'undefined' && typeof initSupabase !== 'undefined' && supabase) {
            try {
                await syncLocationsToCloud();
                showSyncStatus('✓ Locais gravados', true);
                console.log('✅ [LOCATIONS] Synced to Supabase');
            } catch (err) {
                console.error('❌ [LOCATIONS] Error syncing locations to Supabase:', err);
                showSyncStatus('✗ Erro ao gravar locais', false);
            }
        } else {
            console.log('⚠️ [LOCATIONS] Supabase not initialized - saved locally only');
            showSyncStatus('Locais gravados localmente', true);
        }
        populateLocationManager();
        populateLocationSelects();
        populateLocationFilters();
        closeLocationManager();
    } catch (err) {
        console.error('❌ [LOCATIONS] Save error:', err);
        alert('Erro ao gravar locais: ' + err.message);
    }
}
function editCategoryInline(key) {
    const list = document.getElementById('categoryManagerList');
    if (!list) return;
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
                if (newKey !== c.key && categories.find(x => x.key === newKey)) { if (mgrErr) { mgrErr.textContent = 'Key já existe'; mgrErr.style.display = 'block'; } return; }
                c.label = newLabel; c.icon = newIcon; c.key = newKey;
                saveCategories(); populateCategorySelects(); populateCategoryManager();
                renderItems(); // atualizar labels nos cards
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

/* =======================
   Gestor de Locais
   ======================= */
function showLocationManager() {
    populateLocationManager();
    openModal(document.getElementById('locationManagerModal'));
}
function closeLocationManager() {
    closeModalEl(document.getElementById('locationManagerModal'));
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
        delBtn.onclick = () => showDeleteModal({ type: 'location', name: loc.name });

        actions.appendChild(editBtn);
        actions.appendChild(addSubBtn);
        actions.appendChild(delBtn);
        header.appendChild(actions);
        container.appendChild(header);

        const subsDiv = document.createElement('div');
        subsDiv.style.marginLeft = '16px';
        loc.subs.forEach(sub => {
            const subRow = document.createElement('div');
            subRow.style.display = 'flex';
            subRow.style.justifyContent = 'space-between';
            subRow.style.alignItems = 'center';
            subRow.style.padding = '4px 0';
            subRow.innerHTML = `<span>${sub}</span>`;
            const subActions = document.createElement('div');
            const delSubBtn = document.createElement('button');
            delSubBtn.className = 'btn-delete';
            delSubBtn.textContent = 'Eliminar Sub';
            delSubBtn.onclick = () => showDeleteModal({ type: 'sublocation', parent: loc.name, name: sub });
            subActions.appendChild(delSubBtn);
            subRow.appendChild(subActions);
            subsDiv.appendChild(subRow);
        });
        container.appendChild(subsDiv);
        list.appendChild(container);
    });
}
function editLocationInline(name) {
    const list = document.getElementById('locationManagerList');
    if (!list) return;
    list.innerHTML = '';
    locations.forEach(loc => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        if (loc.name === name) {
            const left = document.createElement('div');
            left.innerHTML = `<input id="editLocName" value="${loc.name}" style="padding:6px; margin-right:8px;">`;
            const actions = document.createElement('div');
            actions.style.display = 'flex'; actions.style.gap = '8px';
            const save = document.createElement('button'); save.className = 'btn-primary'; save.textContent = 'Salvar';
            const cancel = document.createElement('button'); cancel.className = 'btn-secondary'; cancel.textContent = 'Cancelar';
            save.onclick = () => {
                const newName = document.getElementById('editLocName').value.trim();
                if (!newName) return;
                if (newName !== loc.name && locations.find(l => l.name === newName)) return;
                // atualizar refs de itens
                inventory.forEach(it => {
                    if (it.locationParent === loc.name) it.locationParent = newName;
                });
                loc.name = newName;
                saveLocations(); saveInventory();
                populateLocationSelects(); populateLocationFilters();
                populateLocationManager();
                renderItems();
            };
            cancel.onclick = () => populateLocationManager();
            row.appendChild(left); row.appendChild(actions);
            actions.appendChild(save); actions.appendChild(cancel);
        } else {
            row.innerHTML = `<div><strong>${loc.name}</strong></div>`;
        }
        list.appendChild(row);
    });
}

/* =======================
   Persistência de Itens
   ======================= */
function loadInventory() {
    const saved = localStorage.getItem('inventory');
    if (saved) {
        try { inventory = JSON.parse(saved); } catch (_) { inventory = []; }
    } else {
        inventory = [];
        saveInventory();
    }
}
function saveInventory() {
    try {
        localStorage.setItem('inventory', JSON.stringify(inventory));
    } catch (e) {
        console.error('❌ [PERSIST] Could not persist inventory to localStorage:', e);
    }
    // Removed auto-sync - only manual sync now
}

/* =======================
   Modal de Item
   ======================= */
function showAddItemModal() {
    window.modalSyncSuppressed = true;
    currentEditId = null;
    const modal = document.getElementById('itemModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = 'Adicionar Item';
    document.getElementById('itemName').value = '';
    document.getElementById('itemQuantity').value = 1;
    document.getElementById('itemMinStock').value = 1;
    document.getElementById('itemNotes').value = '';
    populateCategorySelects();
    populateLocationSelects();
    openModal(modal);
}
function closeModal() {
    closeModalEl(document.getElementById('itemModal'));
}
function saveItem(event) {
    event.preventDefault();
    const name = document.getElementById('itemName').value.trim();
    const quantity = parseInt(document.getElementById('itemQuantity').value || '0', 10);
    const minStock = parseInt(document.getElementById('itemMinStock').value || '0', 10);
    const category = document.getElementById('itemCategory').value;
    const subcategory = document.getElementById('itemSubcategory') ? document.getElementById('itemSubcategory').value : '';
    const locationParent = document.getElementById('itemLocationParent').value || '';
    const locationChild = document.getElementById('itemLocationChild').value || '';
    const notes = document.getElementById('itemNotes').value.trim();

    if (!name || !category) {
        const err = document.getElementById('itemCategoryError');
        if (err && !category) { err.textContent = 'Selecione uma categoria'; err.style.display = 'block'; }
        return;
    }

    if (currentEditId) {
        const idx = inventory.findIndex(i => i.id === currentEditId);
        if (idx !== -1) {
            inventory[idx] = { ...inventory[idx], name, quantity, minStock, category, subcategory, locationParent, locationChild, notes, updatedAt: Date.now() };
        }
    } else {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'local-' + Date.now() + '-' + Math.floor(Math.random()*100000);
        const now = Date.now();
        inventory.push({ id, name, quantity, minStock, category, subcategory, locationParent, locationChild, notes, createdAt: now, updatedAt: now });
    }

    saveInventory();
    renderItems();
    updateStats();
    closeModal();
}

/* =======================
   Eliminar (Modal genérico)
   ======================= */
function showDeleteModal(ctx) {
    // ctx: { type: 'item'|'category'|'location'|'sublocation', id?, key?, name?, parent? }
    pendingDeleteContext = ctx;
    // HTML uses id="deleteModal" and id="deleteMessage"
    const modal = document.getElementById('deleteModal');
    const msg = document.getElementById('deleteMessage');
    if (!modal || !msg) return;
    let text = 'Tem a certeza que deseja eliminar?';
    if (ctx.type === 'item') text = 'Eliminar este item definitivamente?';
    if (ctx.type === 'category') text = `Eliminar a categoria "${ctx.key}"? (os itens mantêm a key atual)`;
    if (ctx.type === 'location') text = `Eliminar o local "${ctx.name}" e todos os seus sub-locais?`;
    if (ctx.type === 'sublocation') text = `Eliminar o sub-local "${ctx.name}" do local "${ctx.parent}"?`;
    msg.textContent = text;
    openModal(modal);
}
function closeDeleteModal() {
    pendingDeleteContext = null;
    closeModalEl(document.getElementById('deleteModal'));
}
function confirmDeleteModal() {
    if (!pendingDeleteContext) return;
    const ctx = pendingDeleteContext;
    pendingDeleteContext = null;

    if (ctx.type === 'item') {
        const removedId = ctx.id;
        inventory = inventory.filter(i => i.id !== removedId);
        saveInventory();
        renderItems(); updateStats();
        // Delete from Supabase as well if available
        (async () => {
            try {
                if (typeof supabase !== 'undefined' && supabase) {
                    const { error } = await supabase.from('inventory_items').delete().eq('id', removedId);
                    if (error) {
                        console.error('❌ [STOCK] Error deleting item from Supabase:', error);
                        showSyncStatus('✗ Erro ao eliminar item na cloud', false);
                    } else {
                        console.log('✅ [STOCK] Item deleted from Supabase');
                        showSyncStatus('Item eliminado (cloud)', true);
                    }
                }
            } catch (e) {
                console.error('❌ [STOCK] Exception deleting item from Supabase:', e);
            }
        })();
    } else if (ctx.type === 'category') {
        categories = categories.filter(c => c.key !== ctx.key);
        // os itens mantêm a category_key existente; opcionalmente poderias limpar
        saveCategories();
        populateCategorySelects();
        renderItems();
    } else if (ctx.type === 'location') {
        const name = ctx.name;
        locations = locations.filter(l => l.name !== name);
        // limpar refs
        inventory.forEach(it => {
            if (it.locationParent === name) { it.locationParent = ''; it.locationChild = ''; }
        });
        saveLocations(); saveInventory();
        populateLocationFilters(); populateLocationSelects();
        renderItems();
    } else if (ctx.type === 'sublocation') {
        const parent = locations.find(l => l.name === ctx.parent);
        if (parent) {
            parent.subs = parent.subs.filter(s => s !== ctx.name);
            // limpar refs
            inventory.forEach(it => {
                if (it.locationParent === ctx.parent && it.locationChild === ctx.name) it.locationChild = '';
            });
            saveLocations(); saveInventory();
            populateLocationFilters(); populateLocationSelects();
            populateLocationManager();
            renderItems();
        }
    }
    closeDeleteModal();
}

// wrapper matching HTML onclick
function confirmDelete() { return confirmDeleteModal(); }

/* =======================
   Low Stock
   ======================= */
function showLowStockModal() {
    const modal = document.getElementById('lowStockModal');
    const list = document.getElementById('lowStockList');
    if (!modal || !list) return;
    list.innerHTML = '';
    const lows = inventory.filter(i => (i.minStock || 0) > 0 && i.quantity <= i.minStock)
                          .sort((a,b)=> (a.quantity - a.minStock) - (b.quantity - b.minStock));
    if (lows.length === 0) {
        const row = document.createElement('div');
        row.style.padding = '8px';
        row.textContent = 'Sem itens com stock baixo ✅';
        list.appendChild(row);
    } else {
        lows.forEach(it => {
            const r = document.createElement('div');
            r.className = 'low-row';
            r.onclick = () => editItem(it.id);
            r.innerHTML = `<span class="name">${it.name}</span><span class="qty">${it.quantity} / min ${it.minStock}</span>`;
            list.appendChild(r);
        });
    }
    openModal(modal);
}
function closeLowStockModal() { closeModalEl(document.getElementById('lowStockModal')); }

/* =======================
   Renderização de Itens
   ======================= */
function onLocationFilterChange() {
    // Mantido por compatibilidade com onchange inline no HTML
    filterItems();
}
function filterItems() {
    renderItems();
}

function groupItems(items, groupBy) {
    if (groupBy === 'locationParent') {
        const map = {};
        items.forEach(i => {
            const k = i.locationParent || '— Sem Local —';
            if (!map[k]) map[k] = [];
            map[k].push(i);
        });
        return map;
    }
    if (groupBy === 'locationChild') {
        const map = {};
        items.forEach(i => {
            const k = (i.locationParent ? (i.locationParent + ' / ') : '') + (i.locationChild || '— Sem Sub-Local —');
            if (!map[k]) map[k] = [];
            map[k].push(i);
        });
        return map;
    }
    return null;
}

function renderItems() {
    const list = document.getElementById('itemsList');
    const empty = document.getElementById('emptyMessage');
    if (!list || !empty) return;

    const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const cat = (document.getElementById('categoryFilter')?.value || 'all');
    const pLoc = (document.getElementById('locationFilterParent')?.value || 'all');
    const cLoc = (document.getElementById('locationFilterChild')?.value || 'all');
    const groupBy = (document.getElementById('groupBy')?.value || 'none');

    let items = inventory.slice();

    if (q) {
        items = items.filter(i =>
            (i.name || '').toLowerCase().includes(q) ||
            (i.notes || '').toLowerCase().includes(q) ||
            (i.locationParent || '').toLowerCase().includes(q) ||
            (i.locationChild || '').toLowerCase().includes(q)
        );
    }
    if (cat !== 'all') items = items.filter(i => (i.category || '') === cat);
    if (pLoc !== 'all') items = items.filter(i => (i.locationParent || '') === pLoc);
    if (cLoc !== 'all') items = items.filter(i => (i.locationChild || '') === cLoc);

    items.sort((a,b)=> (a.name||'').localeCompare(b.name||''));

    list.innerHTML = '';
    empty.style.display = items.length ? 'none' : 'block';

    const grouped = groupItems(items, groupBy);
    if (grouped) {
        Object.keys(grouped).sort().forEach(groupKey => {
            const groupHeader = document.createElement('div');
            groupHeader.style.gridColumn = '1 / -1';
            groupHeader.style.color = 'var(--text-secondary)';
            groupHeader.style.margin = '8px 0 4px';
            groupHeader.textContent = groupKey;
            list.appendChild(groupHeader);
            grouped[groupKey].forEach(renderCard);
        });
    } else {
        items.forEach(renderCard);
    }

    function renderCard(item) {
        const meta = getCategoryMeta(item.category);
        const card = document.createElement('div');
        card.className = 'item-card';

        const header = document.createElement('div');
        header.className = 'item-header';

        const headerContent = document.createElement('div');
        headerContent.innerHTML = `
            <div class="item-title">${item.name}</div>
            <div class="item-category">${(meta.icon||'')} ${meta.label}</div>
        `;

        header.appendChild(headerContent);

        const details = document.createElement('div');
        details.className = 'item-details';
        const locStr = (item.locationParent || '—') + (item.locationChild ? ' / ' + item.locationChild : '');
        details.innerHTML = `
            <div class="item-detail"><span>Quantidade</span><span>${item.quantity}</span></div>
            <div class="item-detail"><span>Stock mínimo</span><span>${item.minStock || 0}</span></div>
            <div class="item-detail"><span>Local</span><span>${locStr}</span></div>
            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
        `;

        // Stock display with edit icon (replacing +/- buttons)
        const stockControls = document.createElement('div');
        stockControls.className = 'stock-controls';
        stockControls.style.cssText = 'display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background 0.2s;';
        stockControls.onclick = () => showStockEditModal(item.id);
        stockControls.onmouseenter = function() { this.style.background = 'rgba(59, 130, 246, 0.1)'; };
        stockControls.onmouseleave = function() { this.style.background = ''; };

        const qtyLabel = document.createElement('span');
        qtyLabel.textContent = 'Stock: ';
        qtyLabel.style.cssText = 'font-size:13px; color:var(--text-secondary);';

        const qtyDisplay = document.createElement('span');
        qtyDisplay.className = 'stock-qty';
        qtyDisplay.textContent = item.quantity;
        qtyDisplay.style.cssText = 'font-weight:600; font-size:15px; color:var(--primary-color);';

        const editIcon = document.createElement('span');
        editIcon.textContent = '✏️';
        editIcon.style.cssText = 'font-size:14px;';
        editIcon.title = 'Editar stock';

        stockControls.appendChild(qtyLabel);
        stockControls.appendChild(qtyDisplay);
        stockControls.appendChild(editIcon);

        // Item actions (Edit and Delete)
        const itemActions = document.createElement('div');
        itemActions.className = 'item-actions';

        const editActionBtn = document.createElement('button');
        editActionBtn.className = 'btn-edit';
        editActionBtn.textContent = '✏️ Editar';
        editActionBtn.onclick = () => editItem(item.id);

        const delActionBtn = document.createElement('button');
        delActionBtn.className = 'btn-delete';
        delActionBtn.textContent = '🗑️ Eliminar';
        delActionBtn.onclick = () => showDeleteModal({ type: 'item', id: item.id });

        itemActions.appendChild(editActionBtn);
        itemActions.appendChild(delActionBtn);

        card.appendChild(header);
        card.appendChild(details);
        card.appendChild(stockControls);
        card.appendChild(itemActions);

        // badges de stock
        if ((item.minStock || 0) > 0 && item.quantity <= item.minStock) {
            const badge = document.createElement('div');
            badge.className = 'badge warning';
            badge.textContent = 'Stock baixo';
            card.appendChild(badge);
        }
        if (item.quantity === 0) {
            const badge = document.createElement('div');
            badge.className = 'badge danger';
            badge.textContent = 'Sem stock';
            card.appendChild(badge);
        }

        list.appendChild(card);
    }
}

/* =======================
   Editar / Incrementar / Decrementar
   ======================= */
function editItem(id) {
    window.modalSyncSuppressed = true;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    currentEditId = id;
    const modal = document.getElementById('itemModal');
    if (!modal) return;

    document.getElementById('modalTitle').textContent = 'Editar Item';
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemQuantity').value = item.quantity ?? 0;
    document.getElementById('itemMinStock').value = item.minStock ?? 0;
    populateCategorySelects(item.category || '');
    populateLocationSelects(item.locationParent || '', item.locationChild || '');
    document.getElementById('itemNotes').value = item.notes || '';
    // set subcategory if present
    const subSel = document.getElementById('itemSubcategory');
    if (subSel) {
        try { subSel.value = item.subcategory || ''; } catch(_) { /* ignore */ }
    }

    openModal(modal);
}

/* =======================
   Modal de Edição de Stock
   ======================= */
let currentStockEditId = null;

function showStockEditModal(itemId) {
    try {
        console.log('📊 [STOCK] Opening stock edit modal for item:', itemId);
        const item = inventory.find(i => String(i.id) === String(itemId));
        if (!item) {
            console.error('❌ [STOCK] Item not found:', itemId);
            alert('Erro: Item não encontrado');
            return;
        }

        currentStockEditId = itemId;
        const modal = document.getElementById('stockEditModal');
        const nameEl = document.getElementById('stockEditItemName');
        const qtyInput = document.getElementById('stockEditQuantity');

        if (!modal || !nameEl || !qtyInput) {
            console.error('❌ [STOCK] Modal elements not found');
            return;
        }

        nameEl.textContent = item.name;
        qtyInput.value = item.quantity || 0;
        
        openModal(modal);
        setTimeout(() => qtyInput.focus(), 100);
        
        console.log('✅ [STOCK] Modal opened successfully');
    } catch (error) {
        console.error('❌ [STOCK] Error opening modal:', error);
        alert('Erro ao abrir modal de edição de stock');
    }
}

function closeStockEditModal() {
    currentStockEditId = null;
    closeModalEl(document.getElementById('stockEditModal'));
}

async function saveStockChange() {
    try {
        console.log('💾 [STOCK] Saving stock change for item:', currentStockEditId);
        
        if (!currentStockEditId) {
            console.error('❌ [STOCK] No item selected');
            return;
        }

        const qtyInput = document.getElementById('stockEditQuantity');
        const newQuantity = parseInt(qtyInput.value || '0', 10);

        if (newQuantity < 0) {
            alert('A quantidade não pode ser negativa');
            return;
        }

        // Find item in local inventory
        const item = inventory.find(i => String(i.id) === String(currentStockEditId));
        if (!item) {
            console.error('❌ [STOCK] Item not found in inventory');
            alert('Erro: Item não encontrado');
            return;
        }

        const oldQuantity = item.quantity;
        item.quantity = newQuantity;
    item.updatedAt = Date.now();

        console.log(`📊 [STOCK] Quantity changed: ${oldQuantity} → ${newQuantity}`);

        // Save to localStorage
        saveInventory();

        // Save directly to Supabase
        if (supabase) {
            console.log('☁️ [STOCK] Syncing to Supabase...');
            const { data, error } = await supabase
                .from('inventory_items')
                .update({ quantity: newQuantity })
                .eq('id', item.id);

            if (error) {
                console.error('❌ [STOCK] Supabase update error:', error);
                alert('Erro ao gravar na base de dados: ' + error.message);
                // Revert local change
                item.quantity = oldQuantity;
                saveInventory();
                renderItems();
                updateStats();
                return;
            }

            console.log('✅ [STOCK] Successfully saved to Supabase');
        } else {
            console.warn('⚠️ [STOCK] Supabase not available - saved locally only');
        }

        // Update UI
        renderItems();
        updateStats();
        closeStockEditModal();

        console.log('✅ [STOCK] Stock update complete');
    } catch (error) {
        console.error('❌ [STOCK] Error saving stock:', error);
        alert('Erro ao gravar stock: ' + error.message);
    }
}


/* =======================
   Estatísticas
   ======================= */
function updateStats() {
    const totalEl = document.getElementById('totalItems');
    const lowEl = document.getElementById('lowStock');
    if (totalEl) totalEl.textContent = String(inventory.length);
    const low = inventory.filter(i => (i.minStock || 0) > 0 && i.quantity <= i.minStock).length;
    if (lowEl) lowEl.textContent = String(low);
}

/* =======================
   Expor funções globais (para onclick inline no HTML)
   ======================= */
window.showAddItemModal = showAddItemModal;
window.closeModal = closeModal;
window.saveItem = saveItem;
window.filterItems = filterItems;
window.onLocationFilterChange = onLocationFilterChange;
window.renderItems = renderItems;
window.updateStats = updateStats;
window.showCategoryManager = showCategoryManager;
window.closeCategoryManager = closeCategoryManager;
window.showLocationManager = showLocationManager;
window.closeLocationManager = closeLocationManager;
window.showAddLocationModal = showAddLocationModal;
window.closeLocationModal = closeLocationModal;
window.submitLocationForm = submitLocationForm;
window.showAddSublocationModal = showAddSublocationModal;
window.closeSublocationModal = closeSublocationModal;
window.submitSublocationForm = submitSublocationForm;
window.showAddCategoryModal = showAddCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.submitCategoryForm = submitCategoryForm;
window.populateCategoryManager = populateCategoryManager;
window.populateLocationManager = populateLocationManager;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeleteModal = confirmDeleteModal;
window.showLowStockModal = showLowStockModal;
window.closeLowStockModal = closeLowStockModal;
window.editItem = editItem;
window.showStockEditModal = showStockEditModal;
window.closeStockEditModal = closeStockEditModal;
window.saveStockChange = saveStockChange;
window.logout = logout;
window.login = login;
