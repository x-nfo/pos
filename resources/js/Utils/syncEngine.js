import axios from 'axios';
import toast from 'react-hot-toast';
import {
    getPendingTransactions,
    getPendingCount,
    updatePendingTransaction,
    removePendingTransaction,
} from './offlineDb';

let isSyncing = false;

export async function flushOfflineTransactions() {
    if (isSyncing || !navigator.onLine) {
        return { synced: 0, failed: 0 };
    }

    isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
        const pending = await getPendingTransactions();
        if (!pending || pending.length === 0) {
            isSyncing = false;
            return { synced: 0, failed: 0 };
        }

        for (const item of pending) {
            try {
                await updatePendingTransaction(item.id, { status: 'syncing' });

                const payload = item.data;
                const url = typeof route === 'function' ? route('transactions.sync-offline') : '/transactions/sync-offline';
                
                const response = await axios.post(url, payload, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                });

                if (response.data && response.data.success) {
                    await removePendingTransaction(item.id);
                    syncedCount++;
                } else {
                    failedCount++;
                    await updatePendingTransaction(item.id, {
                        status: 'failed',
                        error: response.data?.message || 'Sinkronisasi gagal.',
                    });
                }
            } catch (err) {
                failedCount++;
                const errMsg = err.response?.data?.message || err.message || 'Gagal terhubung ke server.';
                await updatePendingTransaction(item.id, {
                    status: 'failed',
                    error: errMsg,
                });
            }
        }

        if (syncedCount > 0) {
            toast.success(`${syncedCount} transaksi offline berhasil disinkronkan ke server!`);
        }

        if (failedCount > 0) {
            toast.error(`${failedCount} transaksi offline gagal disinkronkan. Periksa antrean.`);
        }

        // Notify UI components of state change
        const remainingCount = await getPendingCount();
        window.dispatchEvent(new CustomEvent('pos:sync-change', { detail: { remainingCount } }));
    } catch (e) {
        console.error('Error during flushOfflineTransactions:', e);
    } finally {
        isSyncing = false;
    }

    return { synced: syncedCount, failed: failedCount };
}

export function initSyncEngine() {
    // Run flush on network restore
    const handleOnline = () => {
        setTimeout(() => {
            flushOfflineTransactions();
        }, 1000);
    };

    window.addEventListener('online', handleOnline);

    // Periodic check every 30s when online
    const timer = setInterval(() => {
        if (navigator.onLine) {
            flushOfflineTransactions();
        }
    }, 30000);

    // Initial check on load
    if (navigator.onLine) {
        setTimeout(() => {
            flushOfflineTransactions();
        }, 2000);
    }

    return () => {
        window.removeEventListener('online', handleOnline);
        clearInterval(timer);
    };
}
