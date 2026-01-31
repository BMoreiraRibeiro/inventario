// GitHub Gist Sync - Sincronização automática com GitHub Gist
let isSyncing = false;
let lastSyncTime = null;
let syncDebounceTimer = null;
let gistId = null;

/* =======================
   GitHub Gist API
   ======================= */

// Inicializar Gist ID do localStorage ou config
function initGistSync() {
    if (!CONFIG.GITHUB_TOKEN) {
        console.warn('⚠️ GitHub token não configurado');
        return false;
    }
    
    // Tentar carregar GIST_ID do localStorage (caso tenha sido criado antes)
    const savedGistId = localStorage.getItem('gistId');
    if (savedGistId) {
        gistId = savedGistId;
        console.log('✅ Gist ID carregado:', gistId);
    } else if (CONFIG.GIST_ID) {
        gistId = CONFIG.GIST_ID;
        console.log('✅ Gist ID do config:', gistId);
    }
    
    return true;
}

// Criar novo Gist (primeira vez)
async function createGist(data) {
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Inventário Pessoal - Backup Automático',
                public: false,
                files: {
                    'inventario-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Erro ao criar Gist: ${error.message || response.statusText}`);
        }
        
        const gist = await response.json();
        gistId = gist.id;
        
        // Salvar Gist ID no localStorage para uso futuro
        localStorage.setItem('gistId', gistId);
        
        console.log('✅ Gist criado com sucesso:', gistId);
        return gist;
    } catch (error) {
        console.error('❌ Erro ao criar Gist:', error);
        throw error;
    }
}

// Atualizar Gist existente
async function updateGist(data) {
    if (!gistId) {
        throw new Error('Gist ID não encontrado. Criando novo Gist...');
    }
    
    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'inventario-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Erro ao atualizar Gist: ${error.message || response.statusText}`);
        }
        
        const gist = await response.json();
        console.log('✅ Gist atualizado com sucesso');
        return gist;
    } catch (error) {
        console.error('❌ Erro ao atualizar Gist:', error);
        throw error;
    }
}

// Carregar dados do Gist
async function loadFromGist() {
    if (!gistId) {
        console.log('ℹ️ Nenhum Gist configurado ainda');
        return null;
    }
    
    try {
        showSyncStatus('Carregando dados...', 'syncing');
        
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('⚠️ Gist não encontrado. Será criado um novo no próximo sync.');
                localStorage.removeItem('gistId');
                gistId = null;
                return null;
            }
            throw new Error(`Erro ao carregar Gist: ${response.statusText}`);
        }
        
        const gist = await response.json();
        const fileContent = gist.files['inventario-data.json']?.content;
        
        if (!fileContent) {
            throw new Error('Arquivo de dados não encontrado no Gist');
        }
        
        const data = JSON.parse(fileContent);
        console.log('✅ Dados carregados do Gist');
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar do Gist:', error);
        showSyncStatus('Erro ao carregar', 'error');
        throw error;
    }
}

// Sincronizar para Gist (push)
async function syncToGist() {
    if (!CONFIG.GITHUB_TOKEN) {
        console.warn('⚠️ Sync cancelado: GitHub token não configurado');
        return;
    }
    
    if (isSyncing) {
        console.log('⏳ Sync já em andamento...');
        return;
    }
    
    try {
        isSyncing = true;
        showSyncStatus('Sincronizando...', 'syncing');
        
        // Preparar dados para sincronização
        const data = {
            version: '1.0',
            lastSync: new Date().toISOString(),
            inventory: inventory || [],
            locations: locations || [],
            categories: categories || []
        };
        
        // Se não tiver Gist ID, criar novo
        if (!gistId) {
            await createGist(data);
        } else {
            await updateGist(data);
        }
        
        lastSyncTime = new Date();
        showSyncStatus('✓ Sincronizado', 'success');
        updateSyncTimeDisplay();
        
        console.log('✅ Sincronização completa');
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        
        // Se o erro for porque o Gist não existe, tentar criar novo
        if (error.message.includes('Gist ID não encontrado') || error.message.includes('404')) {
            gistId = null;
            localStorage.removeItem('gistId');
            try {
                const data = {
                    version: '1.0',
                    lastSync: new Date().toISOString(),
                    inventory: inventory || [],
                    locations: locations || [],
                    categories: categories || []
                };
                await createGist(data);
                lastSyncTime = new Date();
                showSyncStatus('✓ Sincronizado', 'success');
                updateSyncTimeDisplay();
            } catch (retryError) {
                showSyncStatus('✗ Erro ao sincronizar', 'error');
            }
        } else {
            showSyncStatus('✗ Erro ao sincronizar', 'error');
        }
    } finally {
        isSyncing = false;
    }
}

// Carregar dados do Gist e mesclar com local
async function pullFromGist() {
    try {
        const cloudData = await loadFromGist();
        
        if (!cloudData) {
            console.log('ℹ️ Nenhum dado na cloud ainda');
            return;
        }
        
        // Verificar se dados cloud são mais recentes que local
        const cloudTime = cloudData.lastSync ? new Date(cloudData.lastSync).getTime() : 0;
        const localTime = lastSyncTime ? lastSyncTime.getTime() : 0;
        
        if (cloudTime > localTime) {
            console.log('🔄 Dados da cloud são mais recentes, atualizando local...');
            
            // Atualizar dados locais
            if (cloudData.inventory) {
                inventory = cloudData.inventory;
                saveInventory();
            }
            if (cloudData.locations) {
                locations = cloudData.locations;
                saveLocations();
            }
            if (cloudData.categories) {
                categories = cloudData.categories;
                saveCategories();
            }
            
            // Atualizar UI
            if (typeof populateLocationSelects === 'function') populateLocationSelects();
            if (typeof populateLocationFilters === 'function') populateLocationFilters();
            if (typeof populateCategorySelects === 'function') populateCategorySelects();
            if (typeof renderItems === 'function') renderItems();
            if (typeof updateStats === 'function') updateStats();
            
            lastSyncTime = new Date(cloudData.lastSync);
            showSyncStatus('✓ Dados atualizados', 'success');
            updateSyncTimeDisplay();
        } else {
            console.log('ℹ️ Dados locais estão atualizados');
            showSyncStatus('✓ Sincronizado', 'success');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

// Sincronização com debounce (evita múltiplas chamadas seguidas)
function debouncedSync() {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }
    
    syncDebounceTimer = setTimeout(() => {
        syncToGist();
    }, 3000); // Aguarda 3 segundos após última alteração
}

// Mostrar status de sincronização
function showSyncStatus(message, type = 'info') {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.style.display = 'inline-block';
    
    // Remover classes anteriores
    statusEl.classList.remove('sync-success', 'sync-error', 'sync-syncing');
    
    // Adicionar classe baseada no tipo
    if (type === 'success') {
        statusEl.classList.add('sync-success');
        // Ocultar após 3 segundos
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.style.display = 'none';
            }
        }, 3000);
    } else if (type === 'error') {
        statusEl.classList.add('sync-error');
    } else if (type === 'syncing') {
        statusEl.classList.add('sync-syncing');
    }
}

// Atualizar display de tempo da última sincronização
function updateSyncTimeDisplay() {
    const timeEl = document.getElementById('lastSyncTime');
    if (!timeEl || !lastSyncTime) return;
    
    const now = new Date();
    const diff = Math.floor((now - lastSyncTime) / 1000); // segundos
    
    let timeText = '';
    if (diff < 60) {
        timeText = 'Há poucos segundos';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        timeText = `Há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        timeText = `Há ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
        const days = Math.floor(diff / 86400);
        timeText = `Há ${days} dia${days > 1 ? 's' : ''}`;
    }
    
    timeEl.textContent = timeText;
    timeEl.style.display = 'inline-block';
}

// Atualizar tempo periodicamente
setInterval(() => {
    if (lastSyncTime) {
        updateSyncTimeDisplay();
    }
}, 30000); // Atualiza a cada 30 segundos

// Inicializar sync ao carregar
if (typeof window !== 'undefined') {
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (initGistSync()) {
                // Carregar dados do Gist ao iniciar
                pullFromGist();
            }
        });
    } else {
        if (initGistSync()) {
            pullFromGist();
        }
    }
}

// Expor funções globalmente
window.gistSync = {
    syncToGist,
    pullFromGist,
    debouncedSync,
    loadFromGist,
    isConfigured: () => !!CONFIG.GITHUB_TOKEN,
    getGistId: () => gistId,
    getLastSyncTime: () => lastSyncTime
};
