import { act, renderHook } from '@testing-library/react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useNetworkStatus } from '../use-network-status';

type Listener = (state: NetInfoState) => void;

const mockedAddEventListener = NetInfo.addEventListener as jest.Mock;

const estado = (parcial: Partial<NetInfoState>) => parcial as NetInfoState;

describe('useNetworkStatus', () => {
    let listener: Listener | null;
    let unsubscribe: jest.Mock;

    const emitir = (state: NetInfoState) => {
        act(() => {
            listener?.(state);
        });
    };

    beforeEach(() => {
        listener = null;
        unsubscribe = jest.fn();
        mockedAddEventListener.mockReset();
        mockedAddEventListener.mockImplementation((cb: Listener) => {
            listener = cb;
            return unsubscribe;
        });
    });

    it('devuelve null antes de la primera lectura', () => {
        const { result } = renderHook(() => useNetworkStatus());
        expect(result.current).toBeNull();
        expect(mockedAddEventListener).toHaveBeenCalledTimes(1);
    });

    it('true con conexión', () => {
        const { result } = renderHook(() => useNetworkStatus());
        emitir(estado({ isConnected: true, isInternetReachable: true }));
        expect(result.current).toBe(true);
    });

    it('false con isConnected false', () => {
        const { result } = renderHook(() => useNetworkStatus());
        emitir(estado({ isConnected: false, isInternetReachable: false }));
        expect(result.current).toBe(false);
    });

    it('false con isInternetReachable false', () => {
        const { result } = renderHook(() => useNetworkStatus());
        emitir(estado({ isConnected: true, isInternetReachable: false }));
        expect(result.current).toBe(false);
    });

    it('true mientras isInternetReachable es null (aún desconocido)', () => {
        const { result } = renderHook(() => useNetworkStatus());
        emitir(estado({ isConnected: true, isInternetReachable: null }));
        expect(result.current).toBe(true);
    });

    it('se actualiza cuando cambia la red', () => {
        const { result } = renderHook(() => useNetworkStatus());
        emitir(estado({ isConnected: true, isInternetReachable: true }));
        expect(result.current).toBe(true);

        emitir(estado({ isConnected: false, isInternetReachable: false }));
        expect(result.current).toBe(false);

        emitir(estado({ isConnected: true, isInternetReachable: true }));
        expect(result.current).toBe(true);
    });

    it('cancela la suscripción al desmontar', () => {
        const { unmount } = renderHook(() => useNetworkStatus());
        expect(unsubscribe).not.toHaveBeenCalled();
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
