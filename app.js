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

    // Listener para o botão de login (mais robusto que onclick inline)
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            login();
        });
    }
});

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
