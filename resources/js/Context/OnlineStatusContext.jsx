import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPendingCount } from '../Utils/offlineDb';
import { initSyncEngine, flushOfflineTransactions } from '../Utils/syncEngine';

const OnlineStatusContext = createContext({
    isOnline: true,
    pendingCount: 0,
    syncOfflineTransactions: async () => {},
});

export function OnlineStatusProvider({ children }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await getPendingCount();
            setPendingCount(count);
        } catch (e) {
            // ignore if indexedDB not ready
        }
    }, []);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            refreshPendingCount();
        };
        const goOffline = () => {
            setIsOnline(false);
            refreshPendingCount();
        };

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        const handleSyncChange = (e) => {
            if (e.detail && typeof e.detail.remainingCount === 'number') {
                setPendingCount(e.detail.remainingCount);
            } else {
                refreshPendingCount();
            }
        };
        window.addEventListener('pos:sync-change', handleSyncChange);

        refreshPendingCount();
        const cleanupSync = initSyncEngine();

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('pos:sync-change', handleSyncChange);
            cleanupSync();
        };
    }, [refreshPendingCount]);

    const syncOfflineTransactions = useCallback(async () => {
        const result = await flushOfflineTransactions();
        await refreshPendingCount();
        return result;
    }, [refreshPendingCount]);

    return (
        <OnlineStatusContext.Provider value={{ isOnline, pendingCount, syncOfflineTransactions, refreshPendingCount }}>
            {children}
        </OnlineStatusContext.Provider>
    );
}

export function useOnlineStatus() {
    const context = useContext(OnlineStatusContext);
    return context.isOnline;
}

export function useOfflineSync() {
    return useContext(OnlineStatusContext);
}
