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
        
        // Merge logic: local wins for now (simple approach)
        for (const cat of localCategories) {
            const exists = cloudCategories?.find(c => c.key === cat.key);
            
            if (exists) {
                // Update
                await supabase
                    .from('categories')
                    .update({ label: cat.label, icon: cat.icon })
                    .eq('key', cat.key);
            } else {
                // Insert
                await supabase
                    .from('categories')
                    .insert({ key: cat.key, label: cat.label, icon: cat.icon });
            }
        }
        
        console.log('✅ Categories synced');
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
        
        for (const loc of localLocations) {
            const exists = cloudLocations?.find(l => l.name === loc.name);
            
            if (exists) {
                // Update location
                const { data: locationData } = await supabase
                    .from('locations')
                    .update({ name: loc.name })
                    .eq('name', loc.name)
                    .select()
                    .single();
                
                // Sync sublocations
                if (locationData) {
                    // Delete old sublocations
                    await supabase
                        .from('sublocations')
                        .delete()
                        .eq('location_id', locationData.id);
                    
                    // Insert new sublocations
                    if (loc.subs && loc.subs.length > 0) {
                        await supabase
                            .from('sublocations')
                            .insert(loc.subs.map(sub => ({
                                location_id: locationData.id,
                                name: sub
                            })));
                    }
                }
            } else {
                // Insert location
                const { data: newLocation } = await supabase
                    .from('locations')
                    .insert({ name: loc.name })
                    .select()
                    .single();
                
                // Insert sublocations
                if (newLocation && loc.subs && loc.subs.length > 0) {
                    await supabase
                        .from('sublocations')
                        .insert(loc.subs.map(sub => ({
                            location_id: newLocation.id,
                            name: sub
                        })));
                }
            }
        }
        
        console.log('✅ Locations synced');
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
        
        // Upsert local items
        let insertedCount = 0;
        let updatedCount = 0;
        
        for (const item of localItems) {
            const cloudItem = cloudItems?.find(ci => String(ci.id) === String(item.id));
            
            const itemData = {
                id: String(item.id),
                name: item.name,
                category_key: item.category || '',
                quantity: item.quantity || 0,
                min_stock: item.minStock || 0,
                location_parent: item.locationParent || '',
                location_child: item.locationChild || '',
                notes: item.notes || ''
            };
            
            if (cloudItem) {
                // Update
                const { error: updateError } = await supabase
                    .from('inventory_items')
                    .update(itemData)
                    .eq('id', String(item.id));
                
                if (updateError) {
                    console.error(`❌ Error updating item ${item.name}:`, updateError);
                } else {
                    updatedCount++;
                }
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('inventory_items')
                    .insert([itemData]);
                
                if (insertError) {
                    console.error(`❌ Error inserting item ${item.name}:`, insertError);
                } else {
                    insertedCount++;
                }
            }
        }
        
        console.log(`✅ Inventory synced - Inserted: ${insertedCount}, Updated: ${updatedCount}`);
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
                icon: c.icon || ''
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
