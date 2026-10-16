import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Estado de la red: `null` hasta conocerlo, `true` si hay conexión y no se
 * sabe que Internet sea inalcanzable, `false` en otro caso. Un
 * `isInternetReachable` desconocido (`null`) cuenta como conectado.
 */
export function useNetworkStatus(): boolean | null {
    const [online, setOnline] = useState<boolean | null>(null);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        });
        return unsubscribe;
    }, []);

    return online;
}
