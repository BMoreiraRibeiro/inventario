// Firebase Firestore Sync - Sincronização em tempo real
let isSyncing = false;
let lastSyncTime = null;
let syncDebounceTimer = null;
let unsubscribeSnapshot = null;
let userDocId = null;

// ID do usuário baseado no password hash (simples mas funcional)
async function getUserDocId() {
    if (userDocId) return userDocId;
    
    // Usar hash simples do password como ID do documento
    // Em produção, usaria Firebase Auth, mas mantemos simples
    const password = CONFIG.PASSWORD || 'default';
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    userDocId = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('').substring(0, 32);
    
    return userDocId;
}

/* =======================
   Firestore Sync
   ======================= */

// Sincronizar para Firestore (push)
async function syncToFirestore() {
    if (!db) {
        console.warn('⚠️ Firestore não inicializado');
        return;
    }
    
    if (isSyncing) {
        console.log('⏳ Sync já em andamento...');
        return;
    }
    
    try {
        isSyncing = true;
        showSyncStatus('Sincronizando...', 'syncing');
        
        const docId = await getUserDocId();
        
        // Preparar dados para sincronização
        const data = {
            version: '1.0',
            lastSync: firebase.firestore.FieldValue.serverTimestamp(),
            inventory: (typeof inventory !== 'undefined' ? inventory : []) || [],
            locations: (typeof locations !== 'undefined' ? locations : []) || [],
            categories: (typeof categories !== 'undefined' ? categories : []) || [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Salvar no Firestore
        await db.collection('inventarios').doc(docId).set(data, { merge: true });
        
        lastSyncTime = new Date();
        showSyncStatus('✓ Sincronizado', 'success');
        updateSyncTimeDisplay();
        
        console.log('✅ Dados sincronizados com Firestore');
    } catch (error) {
        console.error('❌ Erro ao sincronizar:', error);
        showSyncStatus('Erro ao sincronizar', 'error');
    } finally {
        isSyncing = false;
    }
}

// Carregar dados do Firestore
async function loadFromFirestore() {
    if (!db) {
        console.warn('⚠️ Firestore não inicializado');
        return null;
    }
    
    try {
        showSyncStatus('Carregando dados...', 'syncing');
        
        const docId = await getUserDocId();
        const docRef = db.collection('inventarios').doc(docId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            console.log('ℹ️ Nenhum dado na cloud ainda. Será criado no primeiro sync.');
            return null;
        }
        
        const data = doc.data();
        console.log('✅ Dados carregados do Firestore');
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar do Firestore:', error);
        showSyncStatus('Erro ao carregar', 'error');
        return null;
    }
}

// Carregar dados do Firestore e atualizar local
async function pullFromFirestore() {
    if (isSyncing) {
        console.log('⏳ Sync em andamento, ignorando pull...');
        return;
    }
    
    try {
        isSyncing = true;
        const cloudData = await loadFromFirestore();
        
        if (!cloudData) {
            console.log('ℹ️ Nenhum dado na cloud ainda');
            isSyncing = false;
            return;
        }
        
        // Verificar se dados cloud são mais recentes que local
        const cloudTime = cloudData.updatedAt ? cloudData.updatedAt.toDate().getTime() : 0;
        const localTime = lastSyncTime ? lastSyncTime.getTime() : 0;
        
        if (cloudTime > localTime || !lastSyncTime) {
            console.log('🔄 Atualizando dados locais do Firestore...');
            
            // Atualizar dados locais DIRETO no localStorage (sem triggerar sync)
            if (cloudData.inventory && typeof inventory !== 'undefined') {
                inventory = cloudData.inventory;
                localStorage.setItem('inventory', JSON.stringify(inventory));
            }
            if (cloudData.locations && typeof locations !== 'undefined') {
                locations = cloudData.locations;
                localStorage.setItem('locations', JSON.stringify(locations));
            }
            if (cloudData.categories && typeof categories !== 'undefined') {
                categories = cloudData.categories;
                localStorage.setItem('categories', JSON.stringify(categories));
            }
            
            // Atualizar UI
            if (typeof populateLocationSelects === 'function') populateLocationSelects();
            if (typeof populateLocationFilters === 'function') populateLocationFilters();
            if (typeof populateCategorySelects === 'function') populateCategorySelects();
            if (typeof renderItems === 'function') renderItems();
            if (typeof updateStats === 'function') updateStats();
            
            lastSyncTime = cloudData.updatedAt ? cloudData.updatedAt.toDate() : new Date();
            showSyncStatus('✓ Dados atualizados', 'success');
            updateSyncTimeDisplay();
        } else {
            console.log('ℹ️ Dados locais estão atualizados');
            showSyncStatus('✓ Sincronizado', 'success');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    } finally {
        isSyncing = false;
    }
}

// Listener em tempo real (sincronização automática entre dispositivos)
async function startRealtimeSync() {
    if (unsubscribeSnapshot) {
        console.log('ℹ️ Listener em tempo real já ativo');
        return;
    }
    
    try {
        const docId = await getUserDocId();
        const docRef = db.collection('inventarios').doc(docId);
        
        unsubscribeSnapshot = docRef.onSnapshot((doc) => {
            if (!doc.exists) {
                console.log('ℹ️ Documento ainda não existe');
                return;
            }
            
            const data = doc.data();
            const cloudTime = data.updatedAt ? data.updatedAt.toDate().getTime() : 0;
            const localTime = lastSyncTime ? lastSyncTime.getTime() : 0;
            
            // Só atualizar se mudança veio de outro dispositivo
            if (cloudTime > localTime && !isSyncing) {
                console.log('🔔 Mudanças detectadas de outro dispositivo!');
                pullFromFirestore();
            }
        }, (error) => {
            console.error('❌ Erro no listener:', error);
        });
        
        console.log('✅ Sincronização em tempo real ativada');
    } catch (error) {
        console.error('❌ Erro ao ativar listener:', error);
    }
}

// Parar listener
function stopRealtimeSync() {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
        console.log('🛑 Sincronização em tempo real desativada');
    }
}

// Sincronização com debounce (evita múltiplas chamadas seguidas)
function debouncedSync() {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }
    
    syncDebounceTimer = setTimeout(() => {
        syncToFirestore();
    }, 3000); // 3 segundos de debounce
}

/* =======================
   UI Helpers
   ======================= */

function showSyncStatus(message, type) {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'sync-status';
    
    if (type === 'success') {
        statusEl.classList.add('sync-success');
    } else if (type === 'error') {
        statusEl.classList.add('sync-error');
    } else if (type === 'syncing') {
        statusEl.classList.add('sync-syncing');
    }
    
    // Auto-hide após 3 segundos se for sucesso
    if (type === 'success') {
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'sync-status';
        }, 3000);
    }
}

function updateSyncTimeDisplay() {
    const timeEl = document.getElementById('lastSyncTime');
    if (!timeEl || !lastSyncTime) return;
    
    const now = new Date();
    const diff = Math.floor((now - lastSyncTime) / 1000);
    
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
    const initFirebaseSync = () => {
        if (db) {
            console.log('🔥 Inicializando Firebase Sync...');
            // Carregar dados iniciais
            pullFromFirestore().then(() => {
                // Ativar sincronização em tempo real
                startRealtimeSync();
            });
        } else {
            console.warn('⚠️ Firebase não está pronto ainda');
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebaseSync);
    } else {
        // Se já carregou, executar com delay para garantir que Firebase está pronto
        setTimeout(initFirebaseSync, 500);
    }
}

// Expor funções globalmente
window.firebaseSync = {
    syncToFirestore,
    pullFromFirestore,
    debouncedSync,
    loadFromFirestore,
    startRealtimeSync,
    stopRealtimeSync,
    isConfigured: () => !!db,
    getLastSyncTime: () => lastSyncTime
};
