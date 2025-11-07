// Supabase client initialization
let supabase = null;
let isSyncing = false;
let lastSyncTime = null;

// Initialize Supabase client
function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase library not loaded');
        return false;
    }
    
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
        console.warn('⚠️ Supabase credentials not configured in config.js');
        return false;
    }
    
    try {
        supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
        console.log('URL:', CONFIG.SUPABASE_URL);
        return true;
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        return false;
    }
}

// Sync categories to Supabase
async function syncCategoriesToCloud() {
    if (!supabase) return;
    
    try {
        // Get local categories
        const localCategories = categories;
        
        // Fetch from Supabase
        const { data: cloudCategories, error: fetchError } = await supabase
            .from('categories')
            .select('*');
        
        if (fetchError) throw fetchError;
        console.log(`☁️ Cloud categories count: ${cloudCategories?.length || 0}`);

    // Build payload for upsert: include key, label, icon and subs (as json)
    const payload = localCategories.map(c => ({ key: c.key, label: c.label, icon: c.icon || '', subs: c.subs || [] }));

        // Batch upsert by key (now that UNIQUE constraint exists)
        const { data: upserted, error: upsertErr } = await supabase
            .from('categories')
            .upsert(payload, { onConflict: 'key' })
            .select('key');

        if (upsertErr) {
            console.error('❌ Error upserting categories:', upsertErr);
        } else {
            console.log(`✅ Categories upserted: ${upserted?.length || 0}`);
        }

        // Delete cloud categories that don't exist locally (in a batch)
        const localKeys = localCategories.map(c => c.key);
        const toDelete = (cloudCategories || []).filter(cc => !localKeys.includes(cc.key));
        if (toDelete.length > 0) {
            console.log(`🗑️ Deleting ${toDelete.length} categories from cloud`);
            const keysToDelete = toDelete.map(d => d.key);
            // perform deletes sequentially to respect policies
            for (const k of keysToDelete) {
                const { error: delErr } = await supabase.from('categories').delete().eq('key', k);
                if (delErr) console.error('❌ Error deleting category:', delErr);
            }
        }
    } catch (error) {
        console.error('❌ Sync categories error:', error);
    }
}

// Sync locations to Supabase
async function syncLocationsToCloud() {
    if (!supabase) return;
    
    try {
        const localLocations = locations;
        
        const { data: cloudLocations, error: fetchError } = await supabase
            .from('locations')
            .select('*, sublocations(*)');
        
        if (fetchError) throw fetchError;
        console.log(`☁️ Cloud locations count: ${cloudLocations?.length || 0}`);

        // Delete cloud locations that don't exist locally
        const localNames = localLocations.map(l => l.name);
        const toDelete = (cloudLocations || []).filter(cl => !localNames.includes(cl.name));
        if (toDelete.length > 0) {
            console.log(`🗑️ Deleting ${toDelete.length} locations from cloud`);
            for (const l of toDelete) {
                const { error: delErr } = await supabase
                    .from('locations')
                    .delete()
                    .eq('name', l.name);
                if (delErr) console.error('❌ Error deleting location:', delErr);
            }
        }

        // Batch upsert locations by name (now that UNIQUE constraint exists)
        const locPayload = localLocations.map(l => ({ name: l.name }));
        const { data: locUpserted, error: locUpsertErr } = await supabase
            .from('locations')
            .upsert(locPayload, { onConflict: 'name' })
            .select('id,name');

        if (locUpsertErr) {
            console.error('❌ Error upserting locations:', locUpsertErr);
        } else {
            console.log(`✅ Locations upserted: ${locUpserted?.length || 0}`);
        }

        // Map location name -> id from server (after upsert fetch)
        const { data: serverLocations } = await supabase.from('locations').select('id,name');
        const nameToId = (serverLocations || []).reduce((acc, cur) => { acc[cur.name] = cur.id; return acc; }, {});

        // Replace sublocations for each local location: delete existing and insert current
        for (const loc of localLocations) {
            const locId = nameToId[loc.name];
            if (!locId) continue;
            // delete existing sublocations
            const { error: delErr } = await supabase.from('sublocations').delete().eq('location_id', locId);
            if (delErr) console.error('❌ Error deleting sublocations for', loc.name, delErr);
            if (loc.subs && loc.subs.length > 0) {
                const subsPayload = loc.subs.map(s => ({ location_id: locId, name: s }));
                const { error: insErr } = await supabase.from('sublocations').insert(subsPayload);
                if (insErr) console.error('❌ Error inserting sublocations for', loc.name, insErr);
            }
        }

        console.log('✅ Locations synced (batch upsert + sublocations replaced)');
    } catch (error) {
        console.error('❌ Sync locations error:', error);
    }
}

// Sync inventory items to Supabase
async function syncInventoryToCloud() {
    if (!supabase) {
        console.warn('⚠️ Supabase not initialized, skipping inventory sync');
        return;
    }
    
    try {
        console.log('🔄 Syncing inventory to cloud...');
        const localItems = inventory;
        console.log(`📦 Local items count: ${localItems.length}`);
        
        const { data: cloudItems, error: fetchError } = await supabase
            .from('inventory_items')
            .select('*');
        
        if (fetchError) {
            console.error('❌ Error fetching cloud items:', fetchError);
            throw fetchError;
        }
        
        console.log(`☁️ Cloud items count: ${cloudItems?.length || 0}`);
        
        // Delete items that don't exist locally (removed items)
        const localIds = localItems.map(i => String(i.id));
        const cloudItemsToDelete = cloudItems?.filter(ci => !localIds.includes(String(ci.id))) || [];
        
        if (cloudItemsToDelete.length > 0) {
            console.log(`🗑️ Deleting ${cloudItemsToDelete.length} items from cloud`);
            for (const item of cloudItemsToDelete) {
                const { error: delError } = await supabase
                    .from('inventory_items')
                    .delete()
                    .eq('id', item.id);
                if (delError) console.error('Delete error:', delError);
            }
        }
        
        // Prepare items: ensure IDs are UUIDs (server expects UUID primary keys)
        const needsIdFix = [];
        for (let i = 0; i < localItems.length; i++) {
            const it = localItems[i];
            // Treat numeric or timestamp ids as local-only and replace with UUID
            const looksLikeUUID = typeof it.id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(it.id);
            if (!looksLikeUUID) {
                // generate UUID if available
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    const newId = crypto.randomUUID();
                    needsIdFix.push({ oldId: it.id, newId, index: i });
                    it.id = newId;
                } else {
                    // fallback: prefix timestamp to reduce collision risk
                    const newId = 'local-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
                    needsIdFix.push({ oldId: it.id, newId, index: i });
                    it.id = newId;
                }
            }
        }

        // Persist any local id fixes to localStorage without triggering another cloud sync
        if (needsIdFix.length > 0) {
            try {
                localStorage.setItem('inventory', JSON.stringify(localItems));
                // update in-memory too
                inventory = localItems;
                console.log(`🔁 Converted ${needsIdFix.length} local ids to UUIDs for cloud compatibility`);
            } catch (err) {
                console.warn('⚠️ Could not persist local id fixes:', err);
            }
        }

        // Build payload for upsert
        const payload = localItems.map(item => ({
            id: String(item.id),
            name: item.name,
            category_key: item.category || '',
            quantity: item.quantity || 0,
            min_stock: item.minStock || 0,
            location_parent: item.locationParent || '',
            location_child: item.locationChild || '',
            notes: item.notes || ''
        }));

        // Use upsert to insert or update in a single call (on conflict by id)
        const { data: upserted, error: upsertError } = await supabase
            .from('inventory_items')
            .upsert(payload, { onConflict: 'id' })
            .select('*');

        if (upsertError) {
            console.error('❌ Error upserting inventory items:', upsertError);
        } else {
            console.log(`✅ Inventory upserted, server returned ${upserted?.length || 0} rows`);
        }
    } catch (error) {
        console.error('❌ Sync inventory error:', error);
        throw error;
    }
}

// Load data from Supabase to local
async function loadFromCloud() {
    if (!supabase) return;
    
    try {
        isSyncing = true;
        
        // Load categories
        const { data: cloudCategories } = await supabase
            .from('categories')
            .select('*');
        
        if (cloudCategories && cloudCategories.length > 0) {
            categories = cloudCategories.map(c => ({
                key: c.key,
                label: c.label,
                icon: c.icon || '',
                subs: c.subs || []
            }));
            saveCategories();
            populateCategorySelects();
        }
        
        // Load locations with sublocations
        const { data: cloudLocations } = await supabase
            .from('locations')
            .select('*, sublocations(name)');
        
        if (cloudLocations && cloudLocations.length > 0) {
            locations = cloudLocations.map(l => ({
                name: l.name,
                subs: l.sublocations?.map(s => s.name) || []
            }));
            saveLocations();
            populateLocationSelects();
            populateLocationFilters();
        }
        
        // Load inventory items
        const { data: cloudItems } = await supabase
            .from('inventory_items')
            .select('*');
        
        if (cloudItems && cloudItems.length > 0) {
            inventory = cloudItems.map(i => ({
                id: i.id,
                name: i.name,
                category: i.category_key,
                quantity: i.quantity,
                minStock: i.min_stock,
                locationParent: i.location_parent || '',
                locationChild: i.location_child || '',
                notes: i.notes || '',
                createdAt: i.created_at,
                updatedAt: i.updated_at
            }));
            saveInventory();
            renderItems();
            updateStats();
        }
        
        lastSyncTime = new Date();
        console.log('✅ Data loaded from cloud');
        
    } catch (error) {
        console.error('❌ Load from cloud error:', error);
    } finally {
        isSyncing = false;
    }
}

// Full sync: push local data to cloud
async function syncToCloud() {
    if (!supabase || isSyncing) return;
    
    try {
        isSyncing = true;
        showSyncStatus('Sincronizando...');
        // Show blocking UI while doing full sync
        try { document.getElementById('blockingSyncOverlay').style.display = 'flex'; } catch(e) {}
        
        await syncCategoriesToCloud();
        await syncLocationsToCloud();
        await syncInventoryToCloud();
        
        lastSyncTime = new Date();
        showSyncStatus('✓ Sincronizado', true);
        console.log('✅ Full sync completed');
        
    } catch (error) {
        console.error('❌ Sync error:', error);
        showSyncStatus('✗ Erro ao sincronizar', false);
    } finally {
        isSyncing = false;
        try { document.getElementById('blockingSyncOverlay').style.display = 'none'; } catch(e) {}
    }
}

// Show sync status in UI
function showSyncStatus(message, success = null) {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    
    if (success === true) {
        statusEl.style.color = 'var(--success-color)';
    } else if (success === false) {
        statusEl.style.color = 'var(--danger-color)';
    } else {
        statusEl.style.color = 'var(--text-secondary)';
    }
    
    if (success !== null) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Auto-sync on data changes
function setupAutoSync() {
    if (!supabase) return;
    
    // Sync every 30 seconds if there are changes
    setInterval(() => {
        if (!isSyncing) {
            syncToCloud();
        }
    }, 30000);
}

// Quick health check to verify connectivity and permissions
async function testConnection() {
    if (!supabase) {
        console.warn('⚠️ Supabase not initialized');
        return false;
    }

    try {
        const { data, error } = await supabase
            .from('categories')
            .select('key')
            .limit(1);

        if (error) {
            console.error('❌ Supabase test query failed:', error);
            return false;
        }

        console.log('✅ Supabase test query ok:', data);
        return true;
    } catch (err) {
        console.error('❌ Supabase testConnection error:', err);
        return false;
    }
}

// Try to initialize supabase client automatically when script loads
try {
    const ok = initSupabase();
    if (ok) {
        console.log('ℹ️ Supabase client initialized on load');
    } else {
        console.warn('⚠️ Supabase client not initialized on load (check CONFIG and supabase-js script)');
    }
} catch (e) {
    console.error('❌ Error during automatic Supabase init:', e);
}

// Expose functions for debugging from the console
window.supabaseSync = window.supabaseSync || {};
Object.assign(window.supabaseSync, {
    initSupabase,
    testConnection,
    syncToCloud,
    loadFromCloud,
    syncInventoryToCloud,
    syncCategoriesToCloud,
    syncLocationsToCloud,
});
