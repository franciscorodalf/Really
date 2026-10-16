import type { Goal, Item, Theme } from '../context/types';

export interface SyncView {
    items: Item[];
    goals: Goal[];
    moneySaved: number;
    moneySpent: number;
    savedCount: number | null;
    achievements: string[];
    theme: Theme;
    hourlyWage: number | null;
}

export type Op =
    | { type: 'addItem'; item: Item }
    | { type: 'resolveItem'; itemId: string; decision: 'buy' | 'save'; resolvedAt: number; streakBefore: number }
    | { type: 'deleteItem'; itemId: string }
    | { type: 'clearAll'; itemIds: string[] }
    | { type: 'addGoal'; goal: Goal }
    | { type: 'deleteGoal'; goalId: string }
    | { type: 'allocateSavings'; goalId: string; amount: number }
    | { type: 'setHourlyWage'; wage: number | null }
    | { type: 'setTheme'; theme: Theme };

export type QueuedOp = Op & { opId: string; createdAt: number };

export const EMPTY_VIEW: SyncView = {
    items: [],
    goals: [],
    moneySaved: 0,
    moneySpent: 0,
    savedCount: null,
    achievements: [],
    theme: 'light',
    hourlyWage: null,
};

const insertByCreatedAtDesc = <T extends { id: string; createdAt: number }>(list: T[], entry: T): T[] => {
    if (list.some((existing) => existing.id === entry.id)) return list;
    return [...list, entry].sort((a, b) => b.createdAt - a.createdAt);
};

const applyOne = (view: SyncView, op: Op): SyncView => {
    switch (op.type) {
        case 'addItem':
            return { ...view, items: insertByCreatedAtDesc(view.items, op.item) };
        case 'addGoal':
            return { ...view, goals: insertByCreatedAtDesc(view.goals, op.goal) };
        case 'resolveItem': {
            const target = view.items.find((item) => item.id === op.itemId);
            if (!target || target.status !== 'waiting') return view;
            const items = view.items.map((item) =>
                item.id === op.itemId
                    ? { ...item, status: op.decision === 'save' ? ('saved' as const) : ('bought' as const), resolvedAt: op.resolvedAt }
                    : item,
            );
            if (op.decision === 'save') {
                return {
                    ...view,
                    items,
                    moneySaved: view.moneySaved + target.price,
                    savedCount: view.savedCount === null ? null : view.savedCount + 1,
                };
            }
            return { ...view, items, moneySpent: view.moneySpent + target.price };
        }
        case 'deleteItem':
            return { ...view, items: view.items.filter((item) => item.id !== op.itemId) };
        case 'deleteGoal':
            return { ...view, goals: view.goals.filter((goal) => goal.id !== op.goalId) };
        case 'clearAll':
            return {
                ...view,
                moneySaved: 0,
                moneySpent: 0,
                items: view.items.filter((item) => !op.itemIds.includes(item.id)),
            };
        case 'allocateSavings': {
            const goal = view.goals.find((g) => g.id === op.goalId);
            if (!goal || view.moneySaved < op.amount) return view;
            return {
                ...view,
                moneySaved: view.moneySaved - op.amount,
                goals: view.goals.map((g) =>
                    g.id === op.goalId ? { ...g, currentAmount: g.currentAmount + op.amount } : g,
                ),
            };
        }
        case 'setHourlyWage':
            return { ...view, hourlyWage: op.wage };
        case 'setTheme':
            return { ...view, theme: op.theme };
        default:
            return view;
    }
};

/**
 * Superpone las operaciones en cola sobre la última vista del servidor.
 * Es pura (no muta la entrada) y cada regla es idempotente frente a una vista
 * que ya contiene el efecto de la operación. Los logros no se superponen:
 * los decide el servidor al reproducir la operación.
 */
export function applyOps(view: SyncView, ops: QueuedOp[]): SyncView {
    return ops.reduce<SyncView>((acc, op) => applyOne(acc, op), view);
}

export function createOpId(now: number): string {
    return `${now}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
}
