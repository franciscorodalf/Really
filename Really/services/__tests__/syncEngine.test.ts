import {
    classifyError,
    executeOp,
    flushQueue,
    WRITE_TIMEOUT_MS,
    type OpResult,
    type SettleOutcome,
} from '../syncEngine';
import type { QueuedOp } from '../../utils/offlineOps';
import type { Item, Goal } from '../../context/types';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    runTransaction: jest.fn(),
}));

const firestore = jest.requireMock('firebase/firestore');
const db = {} as any;
const uid = 'u1';

const meta = { opId: 'op-1', createdAt: 1 };

const item: Item = {
    id: 'item-1',
    name: 'Zapatillas',
    price: 10,
    createdAt: 1000,
    unlockAt: 2000,
    status: 'waiting',
    notificationId: 'notif-1',
} as Item;

const goal: Goal = { id: 'goal-1', name: 'Viaje', targetAmount: 500, currentAmount: 20, createdAt: 1 } as Goal;

const makeTransaction = (snaps: { exists: boolean; data?: unknown }[]) => {
    const get = jest.fn();
    snaps.forEach((s) => get.mockResolvedValueOnce({ exists: () => s.exists, data: () => s.data }));
    return { get, update: jest.fn(), set: jest.fn() };
};

const useTransaction = (transaction: ReturnType<typeof makeTransaction>) => {
    firestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(transaction));
};

beforeEach(() => {
    jest.clearAllMocks();
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.deleteDoc.mockResolvedValue(undefined);
});

describe('classifyError', () => {
    it.each(['unavailable', 'network-request-failed', 'deadline-exceeded'])(
        'clasifica el código %s como transitorio',
        (code) => {
            expect(classifyError({ code })).toBe('transient');
        },
    );

    it('clasifica el mensaje de cliente sin conexión como transitorio', () => {
        const error = new Error('Failed to get document because the client is offline.');
        expect(classifyError(error)).toBe('transient');
    });

    it('clasifica permission-denied como permanente', () => {
        expect(classifyError({ code: 'permission-denied' })).toBe('permanent');
    });

    it('clasifica un Error sin código como permanente', () => {
        expect(classifyError(new Error('boom'))).toBe('permanent');
    });
});

describe('executeOp escrituras simples', () => {
    it('addItem escribe el deseo con setDoc', async () => {
        const result = await executeOp(db, uid, { ...meta, type: 'addItem', item });
        expect(firestore.doc).toHaveBeenCalledWith(db, 'users', uid, 'items', 'item-1');
        expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'users/u1/items/item-1' }, item);
        expect(result).toEqual({ type: 'other' });
    });

    it('deleteItem borra el deseo con deleteDoc', async () => {
        await executeOp(db, uid, { ...meta, type: 'deleteItem', itemId: 'item-1' });
        expect(firestore.deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/items/item-1' });
    });

    it('addGoal escribe la meta con setDoc', async () => {
        await executeOp(db, uid, { ...meta, type: 'addGoal', goal });
        expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'users/u1/goals/goal-1' }, goal);
    });

    it('deleteGoal borra la meta con deleteDoc', async () => {
        await executeOp(db, uid, { ...meta, type: 'deleteGoal', goalId: 'goal-1' });
        expect(firestore.deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/goals/goal-1' });
    });

    it('setHourlyWage actualiza el usuario con el sueldo exacto', async () => {
        await executeOp(db, uid, { ...meta, type: 'setHourlyWage', wage: 12.5 });
        expect(firestore.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { hourlyWage: 12.5 });
    });

    it('setTheme actualiza el usuario con el tema exacto', async () => {
        await executeOp(db, uid, { ...meta, type: 'setTheme', theme: 'dark' });
        expect(firestore.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { theme: 'dark' });
    });

    it('clearAll pone los totales a 0 y borra cada deseo', async () => {
        await executeOp(db, uid, { ...meta, type: 'clearAll', itemIds: ['a', 'b'] });
        expect(firestore.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { moneySaved: 0, moneySpent: 0 });
        expect(firestore.deleteDoc).toHaveBeenCalledTimes(2);
        expect(firestore.deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/items/a' });
        expect(firestore.deleteDoc).toHaveBeenCalledWith({ path: 'users/u1/items/b' });
    });
});

describe('executeOp con escritura colgada', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('executeOp: una escritura colgada acaba como error transitorio', async () => {
        firestore.setDoc.mockReturnValue(new Promise(() => {}));
        const pending = executeOp(db, uid, { ...meta, type: 'addItem', item }).then(
            () => null,
            (error: unknown) => error,
        );

        await jest.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);
        const error = await pending;

        expect(error).toMatchObject({ code: 'unavailable' });
        expect(classifyError(error)).toBe('transient');
    });

    it('no deja temporizadores pendientes cuando la escritura termina', async () => {
        await executeOp(db, uid, { ...meta, type: 'addItem', item });
        expect(jest.getTimerCount()).toBe(0);
    });
});

describe('executeOp resolveItem', () => {
    const resolveOp = (decision: 'buy' | 'save', streakBefore = 0): QueuedOp => ({
        ...meta,
        type: 'resolveItem',
        itemId: 'item-1',
        decision,
        resolvedAt: 5000,
        streakBefore,
    });

    it('executeOp resolveItem save concede logros, actualiza totales y devuelve la notificación', async () => {
        const tx = makeTransaction([
            { exists: true, data: item },
            { exists: true, data: { moneySaved: 90, savedCount: 0, achievements: [] } },
        ]);
        useTransaction(tx);

        const result = await executeOp(db, uid, resolveOp('save', 2));

        expect(tx.update).toHaveBeenCalledWith({ path: 'users/u1/items/item-1' }, { status: 'saved', resolvedAt: 5000 });
        expect(tx.set).toHaveBeenCalledWith(
            { path: 'users/u1' },
            {
                moneySaved: 100,
                savedCount: 1,
                achievements: ['first_save', 'saver_100', 'streak_3'],
            },
            { merge: true },
        );
        expect(result).toMatchObject({
            type: 'resolveItem',
            applied: true,
            notificationId: 'notif-1',
        });
        const earned = (result as Extract<OpResult, { type: 'resolveItem' }>).earned;
        expect(earned).toHaveLength(3);
    });

    it('executeOp resolveItem sobre un deseo ya resuelto no escribe nada', async () => {
        const tx = makeTransaction([{ exists: true, data: { ...item, status: 'saved' } }]);
        useTransaction(tx);

        const result = await executeOp(db, uid, resolveOp('save'));

        expect(result).toEqual({ type: 'resolveItem', earned: [], notificationId: null, applied: false });
        expect(tx.update).not.toHaveBeenCalled();
        expect(tx.set).not.toHaveBeenCalled();
    });

    it('executeOp resolveItem sobre un deseo inexistente no escribe nada', async () => {
        const tx = makeTransaction([{ exists: false }]);
        useTransaction(tx);

        const result = await executeOp(db, uid, resolveOp('buy'));

        expect(result).toEqual({ type: 'resolveItem', earned: [], notificationId: null, applied: false });
        expect(tx.update).not.toHaveBeenCalled();
        expect(tx.set).not.toHaveBeenCalled();
    });

    it('executeOp resolveItem buy suma moneySpent y no concede logros', async () => {
        const tx = makeTransaction([
            { exists: true, data: item },
            { exists: true, data: { moneySpent: 5, moneySaved: 0, savedCount: 0, achievements: [] } },
        ]);
        useTransaction(tx);

        const result = await executeOp(db, uid, resolveOp('buy', 4));

        expect(tx.update).toHaveBeenCalledWith({ path: 'users/u1/items/item-1' }, { status: 'bought', resolvedAt: 5000 });
        expect(tx.set).toHaveBeenCalledWith({ path: 'users/u1' }, { moneySpent: 15 }, { merge: true });
        expect(result).toEqual({ type: 'resolveItem', earned: [], notificationId: 'notif-1', applied: true });
    });
});

describe('executeOp allocateSavings', () => {
    const allocateOp: QueuedOp = { ...meta, type: 'allocateSavings', goalId: 'goal-1', amount: 30 };

    it('executeOp allocateSavings con fondos suficientes escribe meta y usuario', async () => {
        const tx = makeTransaction([
            { exists: true, data: goal },
            { exists: true, data: { moneySaved: 100 } },
        ]);
        useTransaction(tx);

        const result = await executeOp(db, uid, allocateOp);

        expect(tx.update).toHaveBeenCalledWith({ path: 'users/u1/goals/goal-1' }, { currentAmount: 50 });
        expect(tx.set).toHaveBeenCalledWith({ path: 'users/u1' }, { moneySaved: 70 }, { merge: true });
        expect(result).toEqual({ type: 'allocateSavings', insufficient: false });
    });

    it('executeOp allocateSavings sin fondos devuelve insufficient sin escribir', async () => {
        const tx = makeTransaction([
            { exists: true, data: goal },
            { exists: true, data: { moneySaved: 10 } },
        ]);
        useTransaction(tx);

        const result = await executeOp(db, uid, allocateOp);

        expect(result).toEqual({ type: 'allocateSavings', insufficient: true });
        expect(tx.update).not.toHaveBeenCalled();
        expect(tx.set).not.toHaveBeenCalled();
    });

    it('executeOp allocateSavings con una meta inexistente no escribe nada', async () => {
        const tx = makeTransaction([{ exists: false }]);
        useTransaction(tx);

        const result = await executeOp(db, uid, allocateOp);

        expect(result).toEqual({ type: 'allocateSavings', insufficient: false });
        expect(tx.update).not.toHaveBeenCalled();
    });
});

describe('flushQueue', () => {
    const op = (id: string): QueuedOp => ({ opId: id, createdAt: 1, type: 'deleteItem', itemId: id });
    const ok: OpResult = { type: 'other' };

    const makeQueue = (initial: QueuedOp[]) => {
        const queue = [...initial];
        return {
            queue,
            peek: () => queue[0],
            remove: (opId: string) => {
                const index = queue.findIndex((o) => o.opId === opId);
                if (index >= 0) queue.splice(index, 1);
            },
        };
    };

    it('drena la cola en orden FIFO', async () => {
        const q = makeQueue([op('a'), op('b'), op('c')]);
        const executed: string[] = [];
        const settled: [string, SettleOutcome['status']][] = [];

        const outcome = await flushQueue({
            peek: q.peek,
            remove: q.remove,
            execute: async (o) => {
                executed.push(o.opId);
                return ok;
            },
            onSettled: (o, s) => settled.push([o.opId, s.status]),
        });

        expect(outcome).toBe('drained');
        expect(executed).toEqual(['a', 'b', 'c']);
        expect(settled).toEqual([['a', 'done'], ['b', 'done'], ['c', 'done']]);
        expect(q.queue).toHaveLength(0);
    });

    it('se detiene con offline en el primer error transitorio y conserva la operación', async () => {
        const q = makeQueue([op('a'), op('b'), op('c')]);
        const executed: string[] = [];
        const onSettled = jest.fn();

        const outcome = await flushQueue({
            peek: q.peek,
            remove: q.remove,
            execute: async (o) => {
                executed.push(o.opId);
                if (o.opId === 'b') throw { code: 'unavailable' };
                return ok;
            },
            onSettled,
        });

        expect(outcome).toBe('offline');
        expect(executed).toEqual(['a', 'b']);
        expect(q.queue.map((o) => o.opId)).toEqual(['b', 'c']);
        expect(onSettled).toHaveBeenCalledTimes(1);
    });

    it('descarta una operación con error permanente, avisa y continúa', async () => {
        const q = makeQueue([op('a'), op('b')]);
        const error = { code: 'permission-denied' };
        const settled: [string, SettleOutcome][] = [];

        const outcome = await flushQueue({
            peek: q.peek,
            remove: q.remove,
            execute: async (o) => {
                if (o.opId === 'a') throw error;
                return ok;
            },
            onSettled: (o, s) => settled.push([o.opId, s]),
        });

        expect(outcome).toBe('drained');
        expect(settled).toEqual([
            ['a', { status: 'dropped', error }],
            ['b', { status: 'done', result: ok }],
        ]);
        expect(q.queue).toHaveLength(0);
    });

    it('acepta operaciones añadidas mientras corre', async () => {
        const q = makeQueue([op('a')]);
        const executed: string[] = [];

        const outcome = await flushQueue({
            peek: q.peek,
            remove: q.remove,
            execute: async (o) => {
                executed.push(o.opId);
                if (o.opId === 'a') q.queue.push(op('late'));
                return ok;
            },
            onSettled: () => {},
        });

        expect(outcome).toBe('drained');
        expect(executed).toEqual(['a', 'late']);
    });
});
