// storage.js - Yeni dosya oluştur

class StorageManager {
    constructor() {
        this.dbName = 'PhysioTrackerDB';
        this.dbVersion = 1;
        this.db = null;
    }

    // IndexedDB'yi başlat
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Object stores oluştur
                if (!db.objectStoreNames.contains('clients')) {
                    const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
                    clientStore.createIndex('name', 'name', { unique: false });
                    clientStore.createIndex('phone', 'phone', { unique: false });
                    clientStore.createIndex('userId', 'userId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('clientId', 'clientId', { unique: false });
                    sessionStore.createIndex('date', 'date', { unique: false });
                    sessionStore.createIndex('userId', 'userId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('packages')) {
                    const packageStore = db.createObjectStore('packages', { keyPath: 'id' });
                    packageStore.createIndex('clientId', 'clientId', { unique: false });
                    packageStore.createIndex('userId', 'userId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
                    paymentStore.createIndex('packageId', 'packageId', { unique: false });
                    packageStore.createIndex('userId', 'userId', { unique: false });
                }
            };
        });
    }

    // Veri ekleme
    async add(storeName, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Kullanıcı ID'sini ekle
        data.userId = currentUser ? currentUser.id : 'guest';
        
        await store.add(data);
        return tx.complete;
    }

    // Veri güncelleme
    async update(storeName, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        await store.put(data);
        return tx.complete;
    }

    // Veri getirme
    async getAll(storeName) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index('userId');
        const userId = currentUser ? currentUser.id : 'guest';
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Veri silme
    async delete(storeName, id) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        await store.delete(id);
        return tx.complete;
    }

    // Arama
    async search(storeName, indexName, query) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor();
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value[indexName].toLowerCase().includes(query.toLowerCase())) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Yedekleme (Export)
    async exportData() {
        const data = {
            clients: await this.getAll('clients'),
            sessions: await this.getAll('sessions'),
            packages: await this.getAll('packages'),
            payments: await this.getAll('payments'),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `physio-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // İçe aktarma (Import)
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Verileri içe aktar
                    for (const client of data.clients) {
                        await this.add('clients', client);
                    }
                    for (const session of data.sessions) {
                        await this.add('sessions', session);
                    }
                    for (const pkg of data.packages) {
                        await this.add('packages', pkg);
                    }
                    for (const payment of data.payments) {
                        await this.add('payments', payment);
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }
}

// Kullanım
const storageManager = new StorageManager();
await storageManager.init();