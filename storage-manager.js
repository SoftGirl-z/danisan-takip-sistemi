/**
 * Gelişmiş Veri Yönetim Sistemi
 * IndexedDB + LocalStorage kombinasyonu
 */

class StorageManager {
    constructor() {
        this.dbName = 'PhysioTrackerDB';
        this.dbVersion = 2;
        this.db = null;
        this.syncQueue = [];
    }

    // IndexedDB'yi başlat
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('❌ IndexedDB açılamadı:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB başarıyla başlatıldı');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Clients store
                if (!db.objectStoreNames.contains('clients')) {
                    const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
                    clientStore.createIndex('name', 'name', { unique: false });
                    clientStore.createIndex('phone', 'phone', { unique: false });
                    clientStore.createIndex('userId', 'userId', { unique: false });
                    clientStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Sessions store
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('clientId', 'clientId', { unique: false });
                    sessionStore.createIndex('date', 'date', { unique: false });
                    sessionStore.createIndex('userId', 'userId', { unique: false });
                    sessionStore.createIndex('type', 'type', { unique: false });
                }
                
                // Packages store
                if (!db.objectStoreNames.contains('packages')) {
                    const packageStore = db.createObjectStore('packages', { keyPath: 'id' });
                    packageStore.createIndex('clientId', 'clientId', { unique: false });
                    packageStore.createIndex('userId', 'userId', { unique: false });
                    packageStore.createIndex('status', 'status', { unique: false });
                }
                
                // Payments store
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
                    paymentStore.createIndex('packageId', 'packageId', { unique: false });
                    paymentStore.createIndex('clientId', 'clientId', { unique: false });
                    paymentStore.createIndex('userId', 'userId', { unique: false });
                    paymentStore.createIndex('date', 'date', { unique: false });
                }

                // Users store
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('email', 'email', { unique: true });
                }

                console.log('✅ Veritabanı şeması oluşturuldu');
            };
        });
    }

    // Kullanıcı ID'sini al
    getUserId() {
        return currentUser ? currentUser.id : 'guest';
    }

    // Veri ekleme
    async add(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                
                // Kullanıcı ID'sini ve timestamp ekle
                data.userId = this.getUserId();
                data.updatedAt = new Date().toISOString();
                
                const request = store.add(data);
                
                request.onsuccess = () => {
                    console.log(`✅ ${storeName} eklendi:`, data.id);
                    resolve(data);
                };
                
                request.onerror = () => {
                    console.error(`❌ ${storeName} ekleme hatası:`, request.error);
                    reject(request.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    // Veri güncelleme
    async update(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                
                data.updatedAt = new Date().toISOString();
                const request = store.put(data);
                
                request.onsuccess = () => {
                    console.log(`✅ ${storeName} güncellendi:`, data.id);
                    resolve(data);
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    // Veri getirme - JSON key:value şeklinde (LocalStorage uyumlu)
    async get(key) {
        return new Promise((resolve, reject) => {
            try {
                // Önce localStorage'den dene (hızlı)
                const localData = localStorage.getItem(key);
                if (localData) {
                    console.log(`✅ LocalStorage'den yüklendi: ${key}`);
                    resolve({ value: localData });
                    return;
                }

                // Yoksa IndexedDB'de ara
                if (!this.db) {
                    resolve(null);
                    return;
                }

                const tx = this.db.transaction(['clients', 'sessions', 'packages', 'payments'], 'readonly');
                let found = false;

                ['clients', 'sessions', 'packages', 'payments'].forEach(storeName => {
                    const store = tx.objectStore(storeName);
                    const request = store.getAll();
                    
                    request.onsuccess = () => {
                        const data = request.result;
                        if (data && data.length > 0 && !found) {
                            // Tüm veriyi birleştir
                            console.log(`✅ IndexedDB'den yüklendi: ${key}`);
                            resolve({ value: JSON.stringify(data) });
                            found = true;
                        }
                    };
                });

                // 500ms sonra hala bulunamadıysa null dön
                setTimeout(() => {
                    if (!found) {
                        console.log(`⚠️ Veri bulunamadı: ${key}`);
                        resolve(null);
                    }
                }, 500);
            } catch (error) {
                console.error('Storage get hatası:', error);
                resolve(null);
            }
        });
    }

    // Veri kaydetme - JSON key:value şeklinde (LocalStorage uyumlu)
    async set(key, value) {
        try {
            // Önce localStorage'e kaydet (hızlı)
            localStorage.setItem(key, value);
            console.log(`✅ LocalStorage'a kaydedildi: ${key}`);
            
            // İsteğe bağlı: IndexedDB'ye de kaydet (yedekleme için)
            // Bu kısım isteğe bağlı - hız için skip edilebilir
            
            return true;
        } catch (error) {
            console.error('Storage set hatası:', error);
            return false;
        }
    }

    // Veri silme
    async delete(key) {
        try {
            localStorage.removeItem(key);
            console.log(`✅ LocalStorage'dan silindi: ${key}`);
            return true;
        } catch (error) {
            console.error('Storage delete hatası:', error);
            return false;
        }
    }

    // İtibaren veri getir
    async getAll(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const index = store.index('userId');
                const userId = this.getUserId();
                
                const request = index.getAll(userId);
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Belirli bir veriyi ID'sinden sil
    async deleteById(storeName, id) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(id);
                
                request.onsuccess = () => {
                    console.log(`✅ ${storeName} silindi:`, id);
                    resolve();
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Arama
    async search(storeName, indexName, query) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.openCursor();
                const results = [];
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        if (String(cursor.value[indexName]).toLowerCase().includes(query.toLowerCase())) {
                            results.push(cursor.value);
                        }
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Yedekleme (Export)
    async exportData() {
        try {
            const clients = await this.getAll('clients');
            const sessions = await this.getAll('sessions');
            const packages = await this.getAll('packages');
            const payments = await this.getAll('payments');
            
            const data = {
                clients,
                sessions,
                packages,
                payments,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `physio-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            return data;
        } catch (error) {
            console.error('Export hatası:', error);
            throw error;
        }
    }

    // İçe aktarma (Import)
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Verileri iç e aktar
                    if (data.clients) {
                        for (const client of data.clients) {
                            await this.add('clients', client);
                        }
                    }
                    if (data.sessions) {
                        for (const session of data.sessions) {
                            await this.add('sessions', session);
                        }
                    }
                    if (data.packages) {
                        for (const pkg of data.packages) {
                            await this.add('packages', pkg);
                        }
                    }
                    if (data.payments) {
                        for (const payment of data.payments) {
                            await this.add('payments', payment);
                        }
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // İstatistikler
    async getStats() {
        try {
            const clients = await this.getAll('clients');
            const sessions = await this.getAll('sessions');
            const packages = await this.getAll('packages');
            const payments = await this.getAll('payments');
            
            const totalIncome = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalDebt = packages.reduce((sum, p) => sum + ((p.price || 0) - (p.paidAmount || 0)), 0);
            
            const stats = {
                totalClients: clients.length,
                totalSessions: sessions.length,
                totalPackages: packages.length,
                totalIncome: totalIncome,
                totalDebt: totalDebt,
                activePackages: packages.filter(p => p.status === 'active').length
            };
            
            return stats;
        } catch (error) {
            console.error('Stats hatası:', error);
            return null;
        }
    }

    // Tahmini boyut
    async estimateSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: (estimate.usage / 1024 / 1024).toFixed(2) + ' MB',
                quota: (estimate.quota / 1024 / 1024).toFixed(2) + ' MB',
                percent: ((estimate.usage / estimate.quota) * 100).toFixed(1) + '%'
            };
        }
        return null;
    }
}

// ✅ GLOBAL INSTANCE OLUŞTUR VE window.storage'A ATA
const storageManager = new StorageManager();

// ⚠️ ÖNEMLİ: window.storage'a ata (app.js'te bekleniyor)
window.storage = storageManager;

// Başlangıçta StorageManager'ı initialize et
storageManager.init().catch(err => {
    console.error('❌ StorageManager başlatılırken hata:', err);
});

console.log('✅ storage-manager.js yüklendi ve window.storage tanımlandı');
