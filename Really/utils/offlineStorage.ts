import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedOp, SyncView } from './offlineOps';

export const cacheKey = (uid: string) => `really:cache:v1:${uid}`;
export const queueKey = (uid: string) => `really:queue:v1:${uid}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isSyncView = (value: unknown): value is SyncView =>
    isRecord(value) && Array.isArray(value.items) && Array.isArray(value.goals);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

// Única validación de operaciones persistidas: además de `opId`/`type`, comprueba los campos de
// cada tipo. Una operación con forma inesperada (versión antigua, datos corruptos) rompería la
// superposición `applyOps` durante el render en cada arranque, así que se descarta al cargar.
export function isWellFormedOp(value: unknown): value is QueuedOp {
    if (!isRecord(value) || !isString(value.opId) || !isFiniteNumber(value.createdAt)) return false;
    const o = value;
    switch (o.type) {
        case 'addItem':
            return isRecord(o.item) && isString(o.item.id) && isFiniteNumber(o.item.price) && isFiniteNumber(o.item.createdAt);
        case 'resolveItem':
            return isString(o.itemId) && (o.decision === 'buy' || o.decision === 'save')
                && isFiniteNumber(o.resolvedAt) && isFiniteNumber(o.streakBefore);
        case 'deleteItem':
            return isString(o.itemId);
        case 'clearAll':
            return Array.isArray(o.itemIds) && o.itemIds.every(isString);
        case 'addGoal':
            return isRecord(o.goal) && isString(o.goal.id) && isFiniteNumber(o.goal.currentAmount) && isFiniteNumber(o.goal.createdAt);
        case 'deleteGoal':
            return isString(o.goalId);
        case 'allocateSavings':
            return isString(o.goalId) && isFiniteNumber(o.amount);
        case 'setHourlyWage':
            return o.wage === null || isFiniteNumber(o.wage);
        case 'setTheme':
            return o.theme === 'light' || o.theme === 'dark';
        default:
            return false;
    }
}

async function readJson(key: string): Promise<unknown> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null || raw === undefined) return undefined;
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`[offlineStorage] no se pudo leer ${key}`, error);
        return undefined;
    }
}

async function writeJson(key: string, value: unknown): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`[offlineStorage] no se pudo guardar ${key}`, error);
    }
}

export async function loadCache(uid: string): Promise<SyncView | null> {
    const data = await readJson(cacheKey(uid));
    return isSyncView(data) ? data : null;
}

export async function saveCache(uid: string, view: SyncView): Promise<void> {
    await writeJson(cacheKey(uid), view);
}

export async function loadQueue(uid: string): Promise<QueuedOp[]> {
    const data = await readJson(queueKey(uid));
    return Array.isArray(data) ? data.filter(isWellFormedOp) : [];
}

export async function saveQueue(uid: string, ops: QueuedOp[]): Promise<void> {
    await writeJson(queueKey(uid), ops);
}
