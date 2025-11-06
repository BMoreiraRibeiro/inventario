// Estado da aplicação
let inventory = [];
let currentEditId = null;
let isLoggedIn = false;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se já está logado
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        showInventoryScreen();
    } else {
        showLoginScreen();
    }

    // Carregar dados do localStorage
    loadInventory();
    
    // Listener para Enter no login
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
});

// Funções de Login
function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('inventoryScreen').classList.remove('active');
}

function showInventoryScreen() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('inventoryScreen').classList.add('active');
    renderItems();
    updateStats();
}

function login() {
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('loginError');
    
    if (password === CONFIG.PASSWORD) {
        isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        errorElement.textContent = '';
        showInventoryScreen();
    } else {
        errorElement.textContent = '❌ Password incorreta';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        isLoggedIn = false;
        sessionStorage.removeItem('isLoggedIn');
        showLoginScreen();
        document.getElementById('passwordInput').value = '';
    }
}

// Funções de LocalStorage
function loadInventory() {
    const saved = localStorage.getItem('inventory');
    if (saved) {
        inventory = JSON.parse(saved);
    }
}

function saveInventory() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
}

// Funções de Modal
function showAddItemModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemModal').classList.add('active');
}

function showEditItemModal(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Editar Item';
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemMinStock').value = item.minStock;
    document.getElementById('itemLocation').value = item.location || '';
    document.getElementById('itemNotes').value = item.notes || '';
    document.getElementById('itemModal').classList.add('active');
}

function closeModal() {
    document.getElementById('itemModal').classList.remove('active');
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
        location: document.getElementById('itemLocation').value.trim(),
        notes: document.getElementById('itemNotes').value.trim(),
        createdAt: currentEditId ? inventory.find(i => i.id === currentEditId).createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditId) {
        // Editar item existente
        const index = inventory.findIndex(i => i.id === currentEditId);
        inventory[index] = item;
    } else {
        // Adicionar novo item
        inventory.push(item);
    }
    
    saveInventory();
    closeModal();
    renderItems();
    updateStats();
}

function deleteItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    if (confirm(`Tem certeza que deseja eliminar "${item.name}"?`)) {
        inventory = inventory.filter(i => i.id !== id);
        saveInventory();
        renderItems();
        updateStats();
    }
}

function adjustStock(id, delta) {
    const item = inventory.find(i => i.id === id);
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
    
    // Filtrar items
    let filteredItems = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) ||
                            (item.location && item.location.toLowerCase().includes(searchTerm)) ||
                            (item.notes && item.notes.toLowerCase().includes(searchTerm));
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    if (filteredItems.length === 0) {
        container.innerHTML = '';
        emptyMessage.classList.add('show');
        return;
    }
    
    emptyMessage.classList.remove('show');
    
    // Ordenar por nome
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = filteredItems.map(item => {
        const categoryIcons = {
            ferramentas: '🔨',
            eletrico: '⚡',
            eletronico: '🔌',
            placas: '🖥️',
            ferragens: '🔩',
            outros: '📦'
        };
        
        const categoryNames = {
            ferramentas: 'Ferramentas',
            eletrico: 'Material Elétrico',
            eletronico: 'Componentes Eletrônicos',
            placas: 'Placas e Arduinos',
            ferragens: 'Ferragens',
            outros: 'Outros'
        };
        
        const isLowStock = item.quantity <= item.minStock && item.quantity > 0;
        const isEmpty = item.quantity === 0;
        
        let stockClass = '';
        let stockBadge = '';
        
        if (isEmpty) {
            stockClass = 'empty';
            stockBadge = '<span class="stock-badge empty">SEM STOCK</span>';
        } else if (isLowStock) {
            stockClass = 'low';
            stockBadge = '<span class="stock-badge low">STOCK BAIXO</span>';
        }
        
        return `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <div class="item-title">${item.name}</div>
                        <div class="item-category">${categoryIcons[item.category]} ${categoryNames[item.category]}</div>
                    </div>
                </div>
                
                <div class="item-details">
                    <div class="item-detail">
                        <span>Quantidade:</span>
                        <span class="stock-quantity ${stockClass}">${item.quantity} ${stockBadge}</span>
                    </div>
                    <div class="item-detail">
                        <span>Stock Mínimo:</span>
                        <span>${item.minStock}</span>
                    </div>
                    ${item.location ? `
                        <div class="item-location">📍 ${item.location}</div>
                    ` : ''}
                    ${item.notes ? `
                        <div class="item-notes">💬 ${item.notes}</div>
                    ` : ''}
                </div>
                
                <div class="stock-controls">
                    <button class="stock-btn minus" onclick="adjustStock(${item.id}, -1)" ${item.quantity === 0 ? 'disabled' : ''}>−</button>
                    <button class="stock-btn plus" onclick="adjustStock(${item.id}, 1)">+</button>
                </div>
                
                <div class="item-actions">
                    <button class="btn-edit" onclick="showEditItemModal(${item.id})">✏️ Editar</button>
                    <button class="btn-delete" onclick="deleteItem(${item.id})">🗑️ Eliminar</button>
                </div>
            </div>
        `;
    }).join('');
}

function filterItems() {
    renderItems();
    updateStats();
}

function updateStats() {
    // Total de itens
    document.getElementById('totalItems').textContent = inventory.length;
    
    // Total de categorias únicas
    const uniqueCategories = new Set(inventory.map(item => item.category));
    document.getElementById('totalCategories').textContent = uniqueCategories.size;
    
    // Items com stock baixo
    const lowStockCount = inventory.filter(item => 
        item.quantity <= item.minStock && item.quantity >= 0
    ).length;
    document.getElementById('lowStock').textContent = lowStockCount;
}

// Fechar modal clicando fora
window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
        closeModal();
    }
}
