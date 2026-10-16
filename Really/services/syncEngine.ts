import { deleteDoc, doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Goal, Item } from '../context/types';
import type { QueuedOp } from '../utils/offlineOps';
import { awardSaveAchievements } from '../utils/achievementRules';

export type OpResult =
    | { type: 'resolveItem'; earned: string[]; notificationId: string | null; applied: boolean }
    | { type: 'allocateSavings'; insufficient: boolean }
    | { type: 'other' };

export const WRITE_TIMEOUT_MS = 10_000;

const TRANSIENT_CODES = ['unavailable', 'network-request-failed', 'deadline-exceeded'];

export function classifyError(error: unknown): 'transient' | 'permanent' {
    const code = (error as { code?: unknown } | null | undefined)?.code;
    if (typeof code === 'string' && TRANSIENT_CODES.includes(code)) return 'transient';
    const message = (error as { message?: unknown } | null | undefined)?.message;
    if (typeof message === 'string' && message.toLowerCase().includes('offline')) return 'transient';
    return 'permanent';
}

// El SDK web de Firestore no rechaza setDoc/updateDoc/deleteDoc sin red: la promesa se queda
// colgada hasta que vuelve la conexión. Si vence el plazo, lo tratamos como un fallo transitorio.
function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(Object.assign(new Error('Firestore write timed out (offline)'), { code: 'unavailable' }));
        }, WRITE_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

const OTHER: OpResult = { type: 'other' };

async function resolveItem(
    db: Firestore,
    uid: string,
    op: Extract<QueuedOp, { type: 'resolveItem' }>,
): Promise<OpResult> {
    const itemRef = doc(db, 'users', uid, 'items', op.itemId);
    const userRef = doc(db, 'users', uid);
    const { decision, resolvedAt } = op;

    return runTransaction(db, async (transaction): Promise<OpResult> => {
        const notApplied: OpResult = { type: 'resolveItem', earned: [], notificationId: null, applied: false };

        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) return notApplied;

        const item = itemSnap.data() as Item;
        if (item.status !== 'waiting') return notApplied;

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const currentSaved = Number(userData.moneySaved || 0);
        const currentSpent = Number(userData.moneySpent || 0);
        const currentSavedCount = Number(userData.savedCount || 0);
        const currentAchievements: string[] = Array.isArray(userData.achievements) ? userData.achievements : [];

        let newlyEarned: string[] = [];

        if (decision === 'save') {
            const newSaved = currentSaved + item.price;
            const newSavedCount = currentSavedCount + 1;
            const newStreak = op.streakBefore + 1;

            const awarded = awardSaveAchievements({
                current: currentAchievements,
                newSaved,
                newSavedCount,
                newStreak,
            });
            newlyEarned = awarded.earned;

            transaction.update(itemRef, { status: 'saved', resolvedAt });
            transaction.set(userRef, {
                moneySaved: newSaved,
                savedCount: newSavedCount,
                achievements: awarded.achievements,
            }, { merge: true });
        } else {
            const newSpent = currentSpent + item.price;
            transaction.update(itemRef, { status: 'bought', resolvedAt });
            transaction.set(userRef, { moneySpent: newSpent }, { merge: true });
        }

        return {
            type: 'resolveItem',
            earned: newlyEarned,
            notificationId: item.notificationId || null,
            applied: true,
        };
    });
}

async function allocateSavings(
    db: Firestore,
    uid: string,
    op: Extract<QueuedOp, { type: 'allocateSavings' }>,
): Promise<OpResult> {
    const goalRef = doc(db, 'users', uid, 'goals', op.goalId);
    const userRef = doc(db, 'users', uid);
    const { amount } = op;

    return runTransaction(db, async (transaction): Promise<OpResult> => {
        const goalSnap = await transaction.get(goalRef);
        if (!goalSnap.exists()) return { type: 'allocateSavings', insufficient: false };

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const currentSaved = Number(userData.moneySaved || 0);

        if (currentSaved < amount) {
            return { type: 'allocateSavings', insufficient: true };
        }

        const goal = goalSnap.data() as Goal;
        transaction.update(goalRef, { currentAmount: goal.currentAmount + amount });
        transaction.set(userRef, { moneySaved: currentSaved - amount }, { merge: true });
        return { type: 'allocateSavings', insufficient: false };
    });
}

export async function executeOp(db: Firestore, uid: string, op: QueuedOp): Promise<OpResult> {
    switch (op.type) {
        case 'addItem':
            await withTimeout(setDoc(doc(db, 'users', uid, 'items', op.item.id), op.item));
            return OTHER;
        case 'deleteItem':
            await withTimeout(deleteDoc(doc(db, 'users', uid, 'items', op.itemId)));
            return OTHER;
        case 'addGoal':
            await withTimeout(setDoc(doc(db, 'users', uid, 'goals', op.goal.id), op.goal));
            return OTHER;
        case 'deleteGoal':
            await withTimeout(deleteDoc(doc(db, 'users', uid, 'goals', op.goalId)));
            return OTHER;
        case 'setHourlyWage':
            await withTimeout(updateDoc(doc(db, 'users', uid), { hourlyWage: op.wage }));
            return OTHER;
        case 'setTheme':
            await withTimeout(updateDoc(doc(db, 'users', uid), { theme: op.theme }));
            return OTHER;
        case 'clearAll':
            await withTimeout(updateDoc(doc(db, 'users', uid), { moneySaved: 0, moneySpent: 0 }));
            await Promise.all(
                op.itemIds.map((id) => withTimeout(deleteDoc(doc(db, 'users', uid, 'items', id)))),
            );
            return OTHER;
        case 'resolveItem':
            return resolveItem(db, uid, op);
        case 'allocateSavings':
            return allocateSavings(db, uid, op);
    }
}

export type SettleOutcome =
    | { status: 'done'; result: OpResult }
    | { status: 'dropped'; error: unknown };

export async function flushQueue(args: {
    peek: () => QueuedOp | undefined;
    remove: (opId: string) => void;
    execute: (op: QueuedOp) => Promise<OpResult>;
    onSettled: (op: QueuedOp, outcome: SettleOutcome) => void;
}): Promise<'drained' | 'offline'> {
    let op = args.peek();
    while (op) {
        try {
            const result = await args.execute(op);
            args.remove(op.opId);
            args.onSettled(op, { status: 'done', result });
        } catch (error) {
            if (classifyError(error) === 'transient') return 'offline';
            args.remove(op.opId);
            args.onSettled(op, { status: 'dropped', error });
        }
        op = args.peek();
    }
    return 'drained';
}
