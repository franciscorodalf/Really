import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import { StoreProvider, useStore } from '../StoreContext';
import { useNetworkStatus } from '../../hooks/use-network-status';
import { cacheKey, queueKey } from '../../utils/offlineStorage';
import { EMPTY_VIEW, type QueuedOp, type SyncView } from '../../utils/offlineOps';
import type { Item } from '../types';

jest.mock('../../hooks/use-network-status', () => ({
    useNetworkStatus: jest.fn(() => true),
}));

jest.mock('../../firebaseConfig', () => ({
    auth: {},
    db: {},
}));

// Estado del mock de autenticación: el usuario inicial y el último callback registrado,
// para poder simular cierres de sesión y cambios de cuenta.
const mockAuth: { user: any; callback: ((user: any) => void) | null } = {
    user: { uid: 'test-user', email: 'test@example.com' },
    callback: null,
};

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: any) => void) => {
        mockAuth.callback = callback;
        callback(mockAuth.user);
        return jest.fn();
    }),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
}));

// Los listeners se registran en orden: documento de usuario, deseos y metas. Por defecto
// no emiten nada (arranque sin red): cada test emite los snapshots «reales» que necesite.
const mockListeners: ((snap: any) => void)[] = [];

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    setDoc: jest.fn(() => Promise.resolve()),
    onSnapshot: jest.fn((_ref: unknown, callback: (snap: any) => void) => {
        mockListeners.push(callback);
        return jest.fn();
    }),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    query: jest.fn(),
    orderBy: jest.fn(),
    getDoc: jest.fn(),
    runTransaction: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    setNotificationChannelAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('expo-constants', () => ({
    executionEnvironment: 'standalone',
    ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

const firestore = jest.requireMock('firebase/firestore');
const notifications = jest.requireMock('expo-notifications');
const mockedNetwork = useNetworkStatus as jest.Mock;

const makeItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'item-x',
    name: 'Deseo',
    price: 20,
    createdAt: 1000,
    unlockAt: 1000,
    status: 'waiting',
    ...overrides,
});

const savedItems = (count: number) =>
    Array.from({ length: count }, (_, i) =>
        makeItem({ id: `s${i}`, name: `S${i}`, price: 10, createdAt: 100 + i, status: 'saved', resolvedAt: 200 + i }),
    );

const seedCache = (uid: string, view: Partial<SyncView>) =>
    AsyncStorage.setItem(cacheKey(uid), JSON.stringify({ ...EMPTY_VIEW, ...view }));

const seedQueue = (uid: string, ops: QueuedOp[]) => AsyncStorage.setItem(queueKey(uid), JSON.stringify(ops));

const readJson = async (key: string) => {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
};

// Deja que terminen las promesas pendientes (AsyncStorage, flush de la cola) dentro de `act`.
const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

const renderStore = async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider>{children}</StoreProvider>;
    const hook = renderHook(() => useStore(), { wrapper });
    await settle();
    return hook;
};

const setOnline = async (rerender: (props?: unknown) => void, online: boolean) => {
    mockedNetwork.mockReturnValue(online);
    rerender({});
    await settle();
};

// Emite snapshots «reales» en los tres listeners (usuario, deseos, metas).
const emitServer = (data: { user?: Record<string, unknown> | null; items?: unknown[]; goals?: unknown[] }) => {
    act(() => {
        const [userListener, itemsListener, goalsListener] = mockListeners.slice(-3);
        if (data.user !== undefined) {
            userListener({
                exists: () => data.user !== null,
                data: () => data.user ?? {},
                forEach: () => { },
            });
        }
        if (data.items !== undefined) {
            itemsListener({
                exists: () => true,
                data: () => ({}),
                forEach: (fn: (doc: any) => void) => data.items!.forEach((d) => fn({ data: () => d })),
            });
        }
        if (data.goals !== undefined) {
            goalsListener({
                exists: () => true,
                data: () => ({}),
                forEach: (fn: (doc: any) => void) => data.goals!.forEach((d) => fn({ data: () => d })),
            });
        }
    });
};

const makeTransaction = (itemData: unknown, userData: unknown) => ({
    get: jest.fn()
        .mockResolvedValueOnce({ exists: () => true, data: () => itemData })
        .mockResolvedValueOnce({ exists: () => true, data: () => userData }),
    update: jest.fn(),
    set: jest.fn(),
});

beforeEach(() => {
    jest.clearAllMocks();
    firestore.runTransaction.mockReset();
    mockListeners.length = 0;
    mockAuth.user = { uid: 'test-user', email: 'test@example.com' };
    mockedNetwork.mockReturnValue(true);
});

const goalG = { id: 'g', name: 'Viaje', targetAmount: 500, currentAmount: 0, icon: 'airplane', color: '#000', createdAt: 1 };

const makeAllocateTransaction = (moneySaved: number) => ({
    get: jest.fn()
        .mockResolvedValueOnce({ exists: () => true, data: () => goalG })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ moneySaved }) }),
    update: jest.fn(),
    set: jest.fn(),
});

describe('StoreContext offline-first', () => {
    it('arranque en frío sin red: muestra los datos de la caché', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', {
            items: [makeItem({ id: 'a', createdAt: 2 }), makeItem({ id: 'b', createdAt: 1 })],
            moneySaved: 50,
        });

        const { result } = await renderStore();

        expect(result.current.items).toHaveLength(2);
        expect(result.current.moneySaved).toBe(50);
        expect(result.current.syncStatus).toEqual({ isOnline: false, pendingCount: 0, isSyncing: false });
    });

    it('arranque en frío sin red: reanuda la cola persistida', async () => {
        mockedNetwork.mockReturnValue(false);
        const pending = makeItem({ id: 'pend', name: 'Pendiente' });
        await seedQueue('test-user', [{ type: 'addItem', item: pending, opId: 'op-1', createdAt: 5 } as QueuedOp]);

        const { result, rerender } = await renderStore();

        expect(result.current.items.map((i) => i.id)).toEqual(['pend']);
        expect(result.current.syncStatus.pendingCount).toBe(1);
        expect(firestore.setDoc).not.toHaveBeenCalled();

        await setOnline(rerender, true);

        expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'users/test-user/items/pend' }, pending);
        expect(result.current.syncStatus.pendingCount).toBe(0);
        expect(await readJson(queueKey('test-user'))).toEqual([]);
    });

    it('sin red, addItem aparece al instante y queda en la cola', async () => {
        mockedNetwork.mockReturnValue(false);
        const { result } = await renderStore();

        await act(async () => {
            await result.current.addItem('Zapatillas', 30, 1, 'days');
        });
        await settle();

        expect(firestore.setDoc).not.toHaveBeenCalled();
        expect(result.current.items).toEqual([expect.objectContaining({ name: 'Zapatillas', price: 30, status: 'waiting' })]);
        expect(result.current.syncStatus.pendingCount).toBe(1);
        expect(result.current.syncStatus.isOnline).toBe(false);
        const persisted = await readJson(queueKey('test-user'));
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({ type: 'addItem', item: { name: 'Zapatillas' } });
    });

    it('al volver la red se reproduce la cola en orden', async () => {
        mockedNetwork.mockReturnValue(false);
        const { result, rerender } = await renderStore();

        await act(async () => {
            await result.current.addItem('Primero', 10, 1, 'days');
        });
        await act(async () => {
            await result.current.addItem('Segundo', 20, 1, 'days');
        });
        expect(result.current.syncStatus.pendingCount).toBe(2);

        await setOnline(rerender, true);

        const names = firestore.setDoc.mock.calls
            .filter(([ref]: [{ path: string }]) => ref.path.includes('/items/'))
            .map(([, data]: [unknown, { name: string }]) => data.name);
        expect(names).toEqual(['Primero', 'Segundo']);
        expect(result.current.syncStatus.pendingCount).toBe(0);
        // Sin eco del servidor en el mock, la vista conserva lo ya confirmado (sin parpadeo).
        expect(result.current.items.map((i) => i.name).sort()).toEqual(['Primero', 'Segundo']);
    });

    it('las operaciones persistidas se ejecutan antes que las nuevas', async () => {
        const old = makeItem({ id: 'old', name: 'Antiguo' });
        await seedQueue('test-user', [{ type: 'addItem', item: old, opId: 'op-old', createdAt: 1 } as QueuedOp]);

        const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider>{children}</StoreProvider>;
        const { result } = renderHook(() => useStore(), { wrapper });

        // La hidratación de AsyncStorage todavía no ha terminado: la nueva operación se encola en memoria.
        await act(async () => {
            await result.current.addItem('Nuevo', 10, 1, 'days');
        });
        await settle();

        const names = firestore.setDoc.mock.calls
            .filter(([ref]: [{ path: string }]) => ref.path.includes('/items/'))
            .map(([, data]: [unknown, { name: string }]) => data.name);
        expect(names).toEqual(['Antiguo', 'Nuevo']);
        expect(result.current.syncStatus.pendingCount).toBe(0);
    });

    it('sin red, resolver dos deseos seguidos cuenta la racha en cadena', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', {
            items: [
                ...savedItems(3),
                makeItem({ id: 'x', createdAt: 500 }),
                makeItem({ id: 'y', createdAt: 600 }),
            ],
            moneySaved: 30,
            savedCount: 3,
            achievements: ['first_save', 'streak_3'],
        });
        const { result, rerender } = await renderStore();

        await act(async () => {
            await Promise.all([
                result.current.resolveItem('x', 'save'),
                result.current.resolveItem('y', 'save'),
            ]);
        });
        await settle();

        const persisted = await readJson(queueKey('test-user'));
        expect(persisted.map((op: QueuedOp & { streakBefore: number }) => op.streakBefore)).toEqual([3, 4]);
        expect(firestore.runTransaction).not.toHaveBeenCalled();

        const txX = makeTransaction(makeItem({ id: 'x' }), { moneySaved: 30, savedCount: 3, achievements: ['first_save', 'streak_3'] });
        const txY = makeTransaction(makeItem({ id: 'y' }), { moneySaved: 50, savedCount: 4, achievements: ['first_save', 'streak_3'] });
        const transactions = [txX, txY];
        firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(transactions.shift()));

        await setOnline(rerender, true);

        expect(txX.set.mock.calls[0][1].achievements).not.toContain('streak_5');
        expect(txY.set.mock.calls[0][1].achievements).toContain('streak_5');
        expect(result.current.newAchievementSignal).toBe(1);
        expect(result.current.syncStatus.pendingCount).toBe(0);
    });

    it('sin red, resolver actualiza la vista al instante', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10 });
        const { result } = await renderStore();

        await act(async () => {
            await result.current.resolveItem('x', 'save');
        });

        expect(result.current.moneySaved).toBe(30);
        expect(result.current.items[0]).toMatchObject({ id: 'x', status: 'saved' });
        expect(firestore.runTransaction).not.toHaveBeenCalled();
    });

    it('un fallo permanente descarta la operación y avisa', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10 });
        const { result, rerender } = await renderStore();

        await act(async () => {
            await result.current.resolveItem('x', 'save');
        });
        await act(async () => {
            await result.current.addItem('Después', 5, 1, 'days');
        });
        expect(result.current.moneySaved).toBe(30);

        firestore.runTransaction.mockRejectedValue({ code: 'permission-denied' });
        await setOnline(rerender, true);

        expect(result.current.notice).toEqual(
            expect.objectContaining({ type: 'error', message: 'No se pudo actualizar el deseo.' }),
        );
        expect(result.current.notice?.actionLabel).toBeUndefined();
        // La cola sigue avanzando: la operación siguiente se ejecuta y no hay reintentos en bucle.
        expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
        expect(firestore.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('users/test-user/items/') }),
            expect.objectContaining({ name: 'Después' }),
        );
        expect(result.current.syncStatus.pendingCount).toBe(0);
        // La vista vuelve al estado del servidor para el deseo rechazado.
        expect(result.current.moneySaved).toBe(10);
        expect(result.current.items.find((i) => i.id === 'x')?.status).toBe('waiting');
    });

    it('un addItem descartado cancela su notificación', async () => {
        notifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-1');
        firestore.setDoc.mockImplementation((ref: { path: string }) =>
            ref.path.includes('/items/') ? Promise.reject({ code: 'permission-denied' }) : Promise.resolve(),
        );
        const { result } = await renderStore();

        await act(async () => {
            await result.current.addItem('Zapatillas', 30, 1, 'days');
        });

        expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
        expect(result.current.notice).toEqual(
            expect.objectContaining({ type: 'error', message: 'No se pudo guardar el deseo.' }),
        );
        expect(result.current.items).toEqual([]);
        firestore.setDoc.mockImplementation(() => Promise.resolve());
    });

    it('un fallo transitorio mantiene la operación en la cola', async () => {
        await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10 });
        firestore.runTransaction.mockRejectedValue({ code: 'unavailable' });
        const { result } = await renderStore();

        await act(async () => {
            await result.current.resolveItem('x', 'save');
        });

        expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
        expect(result.current.syncStatus.pendingCount).toBe(1);
        expect(result.current.notice).toBeNull();
        expect(result.current.moneySaved).toBe(30);
    });

    it('tras un fallo transitorio reintenta a los 15 s', async () => {
        jest.useFakeTimers();
        try {
            await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10 });
            firestore.runTransaction.mockRejectedValueOnce({ code: 'unavailable' });
            const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider>{children}</StoreProvider>;
            const { result } = renderHook(() => useStore(), { wrapper });
            await act(async () => {
                await jest.advanceTimersByTimeAsync(0);
            });

            await act(async () => {
                await result.current.resolveItem('x', 'buy');
            });
            expect(firestore.runTransaction).toHaveBeenCalledTimes(1);

            const tx = makeTransaction(makeItem({ id: 'x', price: 20 }), { moneySaved: 10, moneySpent: 0 });
            firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));

            await act(async () => {
                await jest.advanceTimersByTimeAsync(14_000);
            });
            expect(firestore.runTransaction).toHaveBeenCalledTimes(1);

            await act(async () => {
                await jest.advanceTimersByTimeAsync(1_000);
            });
            expect(firestore.runTransaction).toHaveBeenCalledTimes(2);
            expect(result.current.syncStatus.pendingCount).toBe(0);
            expect(result.current.notice).toEqual(expect.objectContaining({ message: 'Compra registrada.' }));
        } finally {
            jest.useRealTimers();
        }
    });

    it('allocateSavings reproducido sin fondos avisa Fondos insuficientes.', async () => {
        mockedNetwork.mockReturnValue(false);
        const goal = { id: 'g', name: 'Viaje', targetAmount: 500, currentAmount: 0, icon: 'airplane', color: '#000', createdAt: 1 };
        await seedCache('test-user', { goals: [goal], moneySaved: 100 });
        const { result, rerender } = await renderStore();

        await act(async () => {
            await result.current.allocateSavings('g', 50);
        });
        expect(result.current.moneySaved).toBe(50);
        expect(result.current.goals[0].currentAmount).toBe(50);

        const tx = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => goal })
                .mockResolvedValueOnce({ exists: () => true, data: () => ({ moneySaved: 10 }) }),
            update: jest.fn(),
            set: jest.fn(),
        };
        firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));

        await setOnline(rerender, true);

        expect(result.current.notice).toEqual(expect.objectContaining({ type: 'error', message: 'Fondos insuficientes.' }));
        expect(tx.update).not.toHaveBeenCalled();
        expect(result.current.syncStatus.pendingCount).toBe(0);
        expect(result.current.moneySaved).toBe(100);
        expect(result.current.goals[0].currentAmount).toBe(0);
    });

    it('resolver un deseo que el servidor ya tenía resuelto no avisa ni suma', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20, notificationId: 'n-x' })], moneySaved: 10 });
        const { result, rerender } = await renderStore();

        await act(async () => {
            await result.current.resolveItem('x', 'save');
        });
        // La notificación local se cancela al instante, aunque no haya red.
        expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n-x');

        const tx = makeTransaction(makeItem({ id: 'x', price: 20, status: 'saved' }), { moneySaved: 30, savedCount: 1 });
        firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));

        await setOnline(rerender, true);

        expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
        expect(tx.set).not.toHaveBeenCalled();
        expect(result.current.notice).toBeNull();
        expect(result.current.newAchievementSignal).toBe(0);
        expect(result.current.syncStatus.pendingCount).toBe(0);
        expect(result.current.moneySaved).toBe(10);
    });

    it('la caché y la cola van por uid', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('other-user', { items: [makeItem({ id: 'ajeno' })], moneySaved: 999 });
        await seedQueue('other-user', [
            { type: 'addItem', item: makeItem({ id: 'ajeno-pend' }), opId: 'op-ajena', createdAt: 1 } as QueuedOp,
        ]);
        await seedCache('test-user', { items: [makeItem({ id: 'mio' })], moneySaved: 5 });

        const { result } = await renderStore();

        expect(result.current.items.map((i) => i.id)).toEqual(['mio']);
        expect(result.current.moneySaved).toBe(5);
        expect(result.current.syncStatus.pendingCount).toBe(0);

        // Cambio de cuenta: solo se ven los datos del nuevo uid.
        await act(async () => {
            mockAuth.callback?.({ uid: 'other-user', email: 'other@example.com' });
        });
        await settle();

        expect(result.current.items.map((i) => i.id).sort()).toEqual(['ajeno', 'ajeno-pend']);
        expect(result.current.moneySaved).toBe(999);
        expect(result.current.syncStatus.pendingCount).toBe(1);
        expect(await readJson(queueKey('test-user'))).toBeNull();
    });

    it('una hidratación tardía de otro uid se ignora', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'mio' })], moneySaved: 5 });

        const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider>{children}</StoreProvider>;
        const { result } = renderHook(() => useStore(), { wrapper });
        // Cierra sesión antes de que termine la lectura de AsyncStorage de test-user.
        act(() => {
            mockAuth.callback?.(null);
        });
        await settle();

        expect(result.current.user).toBeNull();
        expect(result.current.items).toEqual([]);
        expect(result.current.moneySaved).toBe(0);
    });

    it('cerrar sesión vacía la vista y la cola en memoria', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'mio' })], moneySaved: 40, hourlyWage: 12 });
        const { result } = await renderStore();

        await act(async () => {
            await result.current.addItem('Pendiente', 10, 1, 'days');
        });
        await settle();
        expect(result.current.syncStatus.pendingCount).toBe(1);

        await act(async () => {
            mockAuth.callback?.(null);
        });
        await settle();

        expect(result.current.user).toBeNull();
        expect(result.current.items).toEqual([]);
        expect(result.current.moneySaved).toBe(0);
        expect(result.current.hourlyWage).toBeNull();
        expect(result.current.syncStatus.pendingCount).toBe(0);
        // La cola persistida se conserva para cuando vuelva a entrar el mismo usuario.
        expect(await readJson(queueKey('test-user'))).toHaveLength(1);
    });

    it('la caché solo se escribe con snapshots reales, no con la superposición', async () => {
        mockedNetwork.mockReturnValue(false);
        const { result } = await renderStore();
        expect(await readJson(cacheKey('test-user'))).toBeNull();

        emitServer({ user: { moneySaved: 10, savedCount: 0 }, items: [makeItem({ id: 'srv' })], goals: [] });
        await settle();

        const afterSnapshots = await readJson(cacheKey('test-user'));
        expect(afterSnapshots.items.map((i: { id: string }) => i.id)).toEqual(['srv']);
        expect(afterSnapshots.moneySaved).toBe(10);

        await act(async () => {
            await result.current.addItem('Solo local', 10, 1, 'days');
        });
        await act(async () => {
            await result.current.resolveItem('srv', 'save');
        });
        await settle();

        expect(result.current.items).toHaveLength(2);
        const afterOps = await readJson(cacheKey('test-user'));
        expect(afterOps.items.map((i: { id: string }) => i.id)).toEqual(['srv']);
        expect(afterOps.items[0].status).toBe('waiting');
        expect(afterOps.moneySaved).toBe(10);
    });

    it('con la caché ya cargada se guarda aunque falte un listener por responder', async () => {
        await seedCache('test-user', { items: [makeItem({ id: 'viejo' })], goals: [], moneySaved: 5 });
        await renderStore();

        emitServer({ user: { moneySaved: 7 }, items: [makeItem({ id: 'nuevo' })] });
        await settle();

        const cached = await readJson(cacheKey('test-user'));
        expect(cached.items.map((i: { id: string }) => i.id)).toEqual(['nuevo']);
        expect(cached.moneySaved).toBe(7);
    });

    it('un snapshot real anterior a la hidratación no pisa la caché guardada con una vista a medias', async () => {
        await seedCache('test-user', { items: [makeItem({ id: 'guardado' })], moneySaved: 80 });
        const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider>{children}</StoreProvider>;
        renderHook(() => useStore(), { wrapper });
        // Llega un snapshot real de deseos antes de que termine la lectura de AsyncStorage.
        emitServer({ items: [makeItem({ id: 'srv' })] });
        await settle();

        const cached = await readJson(cacheKey('test-user'));
        expect(cached.moneySaved).toBe(80);
    });

    describe('ecos parciales del servidor (cada listener llega por separado)', () => {
        const renderResolved = async () => {
            await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10, savedCount: 0 });
            const tx = makeTransaction(makeItem({ id: 'x', price: 20 }), { moneySaved: 10, savedCount: 0, achievements: ['first_save'] });
            firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));
            const hook = await renderStore();
            await act(async () => {
                await hook.result.current.resolveItem('x', 'save');
            });
            // Confirmada y todavía sin eco: la vista ya muestra el ahorro.
            expect(hook.result.current.moneySaved).toBe(30);
            return hook;
        };

        it('resolveItem: el eco solo del usuario no suma el precio dos veces', async () => {
            const { result } = await renderResolved();

            emitServer({ user: { moneySaved: 30, savedCount: 1 } });
            expect(result.current.moneySaved).toBe(30);

            emitServer({ items: [makeItem({ id: 'x', price: 20, status: 'saved', resolvedAt: 5 })] });
            expect(result.current.moneySaved).toBe(30);
            expect(result.current.items[0].status).toBe('saved');
        });

        it('resolveItem: el eco solo de deseos nunca muestra un total duplicado', async () => {
            const { result } = await renderResolved();

            emitServer({ items: [makeItem({ id: 'x', price: 20, status: 'saved', resolvedAt: 5 })] });
            // Parpadeo breve aceptado: valor anterior del servidor, nunca uno inventado.
            expect(result.current.moneySaved).toBe(10);
            expect(result.current.items[0].status).toBe('saved');

            emitServer({ user: { moneySaved: 30, savedCount: 1 } });
            expect(result.current.moneySaved).toBe(30);
        });

        it('resolveItem: un eco que llega antes de que resuelva la transacción no duplica', async () => {
            await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10, savedCount: 0 });
            const tx = makeTransaction(makeItem({ id: 'x', price: 20 }), { moneySaved: 10, savedCount: 0, achievements: ['first_save'] });
            let release: () => void = () => { };
            const gate = new Promise<void>((resolve) => { release = resolve; });
            firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => {
                const value = await fn(tx);
                // El commit llega al listener del usuario antes de que resuelva runTransaction.
                const [userListener] = mockListeners.slice(-3);
                userListener({ exists: () => true, data: () => ({ moneySaved: 30, savedCount: 1 }) });
                await gate;
                return value;
            });
            const { result } = await renderStore();

            let pending: Promise<void> = Promise.resolve();
            await act(async () => {
                pending = result.current.resolveItem('x', 'save');
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
            expect(result.current.syncStatus.pendingCount).toBe(1);
            expect(result.current.moneySaved).toBe(30);

            release();
            await act(async () => {
                await pending;
            });
            expect(result.current.syncStatus.pendingCount).toBe(0);
            expect(result.current.moneySaved).toBe(30);
        });

        const renderAllocated = async () => {
            await seedCache('test-user', { goals: [goalG], moneySaved: 100 });
            const tx = makeAllocateTransaction(100);
            firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));
            const hook = await renderStore();
            await act(async () => {
                await hook.result.current.allocateSavings('g', 30);
            });
            expect(tx.update).toHaveBeenCalled();
            expect(hook.result.current.moneySaved).toBe(70);
            expect(hook.result.current.goals[0].currentAmount).toBe(30);
            return hook;
        };

        it('allocateSavings: el eco solo del usuario no resta dos veces', async () => {
            const { result } = await renderAllocated();

            emitServer({ user: { moneySaved: 70 } });
            expect(result.current.moneySaved).toBe(70);
            expect(result.current.goals[0].currentAmount).toBe(0);

            emitServer({ goals: [{ ...goalG, currentAmount: 30 }] });
            expect(result.current.moneySaved).toBe(70);
            expect(result.current.goals[0].currentAmount).toBe(30);
        });

        it('allocateSavings: el eco solo de metas no suma dos veces a la meta', async () => {
            const { result } = await renderAllocated();

            emitServer({ goals: [{ ...goalG, currentAmount: 30 }] });
            expect(result.current.goals[0].currentAmount).toBe(30);
            expect(result.current.moneySaved).toBe(100);

            emitServer({ user: { moneySaved: 70 } });
            expect(result.current.moneySaved).toBe(70);
            expect(result.current.goals[0].currentAmount).toBe(30);
        });
    });

    it('no arma el reintento si el provider se desmonta con un pase en vuelo', async () => {
        await seedCache('test-user', { items: [makeItem({ id: 'x', price: 20 })], moneySaved: 10 });
        let release: () => void = () => { };
        const gate = new Promise<void>((resolve) => { release = resolve; });
        firestore.runTransaction.mockImplementation(async () => {
            await gate;
            throw { code: 'unavailable' };
        });
        const { result, unmount } = await renderStore();

        let pending: Promise<void> = Promise.resolve();
        await act(async () => {
            pending = result.current.resolveItem('x', 'save');
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        unmount();

        const timeoutSpy = jest.spyOn(global, 'setTimeout');
        try {
            release();
            await act(async () => {
                await pending;
            });
            expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 15_000)).toBe(false);
        } finally {
            timeoutSpy.mockRestore();
        }
    });

    it('la caché no cuenta como snapshot real para la migración de savedCount', async () => {
        await seedCache('test-user', { items: savedItems(2), savedCount: null });
        await renderStore();

        expect(firestore.setDoc).not.toHaveBeenCalledWith(expect.anything(), { savedCount: expect.any(Number) }, { merge: true });

        emitServer({ user: { moneySaved: 20 }, items: savedItems(3), goals: [] });
        await settle();

        expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'users/test-user' }, { savedCount: 3 }, { merge: true });
    });

    it('ignora los snapshots servidos desde la caché de Firestore sin red', async () => {
        mockedNetwork.mockReturnValue(false);
        await seedCache('test-user', { items: [makeItem({ id: 'mio' })], moneySaved: 40 });
        const { result } = await renderStore();

        act(() => {
            const [userListener, itemsListener] = mockListeners.slice(-3);
            userListener({ exists: () => false, data: () => ({}), metadata: { fromCache: true } });
            itemsListener({ forEach: () => { }, metadata: { fromCache: true } });
        });
        await settle();

        expect(result.current.items.map((i) => i.id)).toEqual(['mio']);
        expect(result.current.moneySaved).toBe(40);
        // No inicializa el documento de usuario (pondría moneySaved a 0 al volver la red).
        expect(firestore.setDoc).not.toHaveBeenCalled();
    });
});
