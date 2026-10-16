import type { Goal, Item } from '../../context/types';
import {
    applyOps,
    createOpId,
    EMPTY_VIEW,
    Op,
    QueuedOp,
    SyncView,
} from '../offlineOps';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'item-1',
    name: 'Zapatillas',
    price: 40,
    createdAt: 1000,
    unlockAt: 2000,
    status: 'waiting',
    ...overrides,
});

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
    id: 'goal-1',
    name: 'Viaje',
    targetAmount: 500,
    currentAmount: 0,
    icon: 'airplane',
    color: '#00f',
    createdAt: 1000,
    ...overrides,
});

const makeView = (overrides: Partial<SyncView> = {}): SyncView => ({
    ...EMPTY_VIEW,
    ...overrides,
});

let seq = 0;
const queued = (op: Op): QueuedOp => {
    seq += 1;
    return { ...op, opId: `op-${seq}`, createdAt: seq };
};

const deepFreeze = <T,>(value: T): T => {
    if (value && typeof value === 'object') {
        Object.values(value as object).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
};

describe('applyOps', () => {
    it('addItem inserta ordenado por createdAt descendente', () => {
        const view = makeView({
            items: [makeItem({ id: 'a', createdAt: 3000 }), makeItem({ id: 'c', createdAt: 1000 })],
        });
        const result = applyOps(view, [
            queued({ type: 'addItem', item: makeItem({ id: 'b', createdAt: 2000 }) }),
        ]);
        expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('addItem ignora ids ya presentes', () => {
        const view = makeView({ items: [makeItem({ id: 'a', name: 'Original' })] });
        const result = applyOps(view, [
            queued({ type: 'addItem', item: makeItem({ id: 'a', name: 'Duplicado' }) }),
        ]);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Original');
    });

    it('addGoal inserta ordenado e ignora ids ya presentes', () => {
        const view = makeView({ goals: [makeGoal({ id: 'g1', createdAt: 1000 })] });
        const result = applyOps(view, [
            queued({ type: 'addGoal', goal: makeGoal({ id: 'g2', createdAt: 2000 }) }),
            queued({ type: 'addGoal', goal: makeGoal({ id: 'g1', name: 'Otro' }) }),
        ]);
        expect(result.goals.map((g) => g.id)).toEqual(['g2', 'g1']);
        expect(result.goals[1].name).toBe('Viaje');
    });

    it('resolveItem save suma ahorro y contador', () => {
        const view = makeView({ items: [makeItem({ price: 40 })], moneySaved: 10, savedCount: 2 });
        const result = applyOps(view, [
            queued({ type: 'resolveItem', itemId: 'item-1', decision: 'save', resolvedAt: 5000, streakBefore: 0 }),
        ]);
        expect(result.moneySaved).toBe(50);
        expect(result.savedCount).toBe(3);
        expect(result.items[0]).toMatchObject({ status: 'saved', resolvedAt: 5000 });
    });

    it('resolveItem save con savedCount null lo deja en null', () => {
        const view = makeView({ items: [makeItem()], savedCount: null });
        const result = applyOps(view, [
            queued({ type: 'resolveItem', itemId: 'item-1', decision: 'save', resolvedAt: 5000, streakBefore: 0 }),
        ]);
        expect(result.savedCount).toBeNull();
        expect(result.moneySaved).toBe(40);
    });

    it('resolveItem buy suma gasto y no toca savedCount', () => {
        const view = makeView({ items: [makeItem({ price: 40 })], moneySpent: 5, savedCount: 2 });
        const result = applyOps(view, [
            queued({ type: 'resolveItem', itemId: 'item-1', decision: 'buy', resolvedAt: 5000, streakBefore: 0 }),
        ]);
        expect(result.moneySpent).toBe(45);
        expect(result.moneySaved).toBe(0);
        expect(result.savedCount).toBe(2);
        expect(result.items[0]).toMatchObject({ status: 'bought', resolvedAt: 5000 });
    });

    it('resolveItem sobre un deseo ya resuelto no cambia nada', () => {
        const view = makeView({
            items: [makeItem({ status: 'saved', resolvedAt: 4000 })],
            moneySaved: 40,
            savedCount: 1,
        });
        const result = applyOps(view, [
            queued({ type: 'resolveItem', itemId: 'item-1', decision: 'save', resolvedAt: 5000, streakBefore: 0 }),
        ]);
        expect(result).toEqual(view);
    });

    it('resolveItem sobre un deseo inexistente no cambia nada', () => {
        const view = makeView({ items: [makeItem()], moneySaved: 3 });
        const result = applyOps(view, [
            queued({ type: 'resolveItem', itemId: 'fantasma', decision: 'save', resolvedAt: 5000, streakBefore: 0 }),
        ]);
        expect(result).toEqual(view);
    });

    it('deleteItem y deleteGoal son idempotentes', () => {
        const view = makeView({ items: [makeItem()], goals: [makeGoal()] });
        const ops = [
            queued({ type: 'deleteItem', itemId: 'item-1' }),
            queued({ type: 'deleteItem', itemId: 'item-1' }),
            queued({ type: 'deleteGoal', goalId: 'goal-1' }),
            queued({ type: 'deleteGoal', goalId: 'goal-1' }),
        ];
        const result = applyOps(view, ops);
        expect(result.items).toEqual([]);
        expect(result.goals).toEqual([]);
    });

    it('clearAll pone los totales a 0 y quita los deseos indicados', () => {
        const view = makeView({
            items: [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })],
            moneySaved: 100,
            moneySpent: 50,
        });
        const result = applyOps(view, [queued({ type: 'clearAll', itemIds: ['a', 'b'] })]);
        expect(result.moneySaved).toBe(0);
        expect(result.moneySpent).toBe(0);
        expect(result.items.map((i) => i.id)).toEqual(['c']);
    });

    it('allocateSavings mueve dinero a la meta', () => {
        const view = makeView({ goals: [makeGoal({ currentAmount: 20 })], moneySaved: 100 });
        const result = applyOps(view, [queued({ type: 'allocateSavings', goalId: 'goal-1', amount: 30 })]);
        expect(result.moneySaved).toBe(70);
        expect(result.goals[0].currentAmount).toBe(50);
    });

    it('allocateSavings sin fondos no cambia nada', () => {
        const view = makeView({ goals: [makeGoal()], moneySaved: 10 });
        const result = applyOps(view, [queued({ type: 'allocateSavings', goalId: 'goal-1', amount: 30 })]);
        expect(result).toEqual(view);
    });

    it('allocateSavings sobre una meta inexistente no cambia nada', () => {
        const view = makeView({ moneySaved: 100 });
        const result = applyOps(view, [queued({ type: 'allocateSavings', goalId: 'nope', amount: 30 })]);
        expect(result).toEqual(view);
    });

    it('setHourlyWage y setTheme asignan', () => {
        const result = applyOps(makeView(), [
            queued({ type: 'setHourlyWage', wage: 12.5 }),
            queued({ type: 'setTheme', theme: 'dark' }),
        ]);
        expect(result.hourlyWage).toBe(12.5);
        expect(result.theme).toBe('dark');
        const cleared = applyOps(result, [queued({ type: 'setHourlyWage', wage: null })]);
        expect(cleared.hourlyWage).toBeNull();
    });

    it('aplica las operaciones en orden', () => {
        const result = applyOps(makeView({ savedCount: 0 }), [
            queued({ type: 'addItem', item: makeItem({ id: 'x', price: 25 }) }),
            queued({ type: 'resolveItem', itemId: 'x', decision: 'save', resolvedAt: 9000, streakBefore: 0 }),
        ]);
        expect(result.items[0]).toMatchObject({ id: 'x', status: 'saved', resolvedAt: 9000 });
        expect(result.moneySaved).toBe(25);
        expect(result.savedCount).toBe(1);
    });

    it('no muta la vista de entrada', () => {
        const view = deepFreeze(
            makeView({ items: [makeItem()], goals: [makeGoal()], moneySaved: 100, savedCount: 1 }),
        );
        const ops = deepFreeze([
            queued({ type: 'addItem', item: makeItem({ id: 'n', createdAt: 5000 }) }),
            queued({ type: 'resolveItem', itemId: 'item-1', decision: 'save', resolvedAt: 5000, streakBefore: 0 }),
            queued({ type: 'allocateSavings', goalId: 'goal-1', amount: 10 }),
            queued({ type: 'clearAll', itemIds: ['n'] }),
            queued({ type: 'setTheme', theme: 'dark' }),
        ]);
        expect(() => applyOps(view, ops)).not.toThrow();
        expect(view.items[0].status).toBe('waiting');
        expect(view.moneySaved).toBe(100);
    });
});

describe('createOpId', () => {
    it('devuelve ids distintos para llamadas consecutivas', () => {
        const a = createOpId(1234);
        const b = createOpId(1234);
        expect(a).not.toBe(b);
        expect(a).toMatch(/^1234-[0-9a-z]{6}$/);
    });
});
