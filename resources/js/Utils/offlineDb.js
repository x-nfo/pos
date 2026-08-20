import { openDB } from 'idb';

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
            db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customers')) {
            db.createObjectStore('customers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pricing')) {
            db.createObjectStore('pricing', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pending_transactions')) {
            db.createObjectStore('pending_transactions', { keyPath: 'id', autoIncrement: true });
        }
    },
});

export async function cacheProducts(products) {
    const db = await dbPromise;
    const tx = db.transaction('products', 'readwrite');
    for (const product of products) {
        await tx.store.put(product);
    }
    await tx.done;
}

export async function getCachedProducts() {
    const db = await dbPromise;
    return db.getAll('products');
}

export async function cacheCustomers(customers) {
    const db = await dbPromise;
    const tx = db.transaction('customers', 'readwrite');
    for (const customer of customers) {
        await tx.store.put(customer);
    }
    await tx.done;
}

export async function getCachedCustomers() {
    const db = await dbPromise;
    return db.getAll('customers');
}

export async function queueTransaction(transactionData) {
    const db = await dbPromise;
    const clientTxId = transactionData.client_tx_id || 
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));

    const record = {
        client_tx_id: clientTxId,
        data: {
            ...transactionData,
            client_tx_id: clientTxId,
        },
        status: 'pending', // 'pending' | 'syncing' | 'failed'
        error: null,
        created_at: transactionData.created_at || new Date().toISOString(),
    };

    const id = await db.add('pending_transactions', record);
    return { id, client_tx_id: clientTxId };
}

export async function getPendingTransactions() {
    const db = await dbPromise;
    return db.getAll('pending_transactions');
}

export async function getPendingCount() {
    const db = await dbPromise;
    return db.count('pending_transactions');
}

export async function updatePendingTransaction(id, updates) {
    const db = await dbPromise;
    const tx = db.transaction('pending_transactions', 'readwrite');
    const record = await tx.store.get(id);
    if (record) {
        Object.assign(record, updates);
        await tx.store.put(record);
    }
    await tx.done;
}

export async function removePendingTransaction(id) {
    const db = await dbPromise;
    return db.delete('pending_transactions', id);
}

export async function clearPendingTransactions() {
    const db = await dbPromise;
    await db.clear('pending_transactions');
}
