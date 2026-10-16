import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedOp, SyncView } from './offlineOps';

export const cacheKey = (uid: string) => `really:cache:v1:${uid}`;
export const queueKey = (uid: string) => `really:queue:v1:${uid}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isSyncView = (value: unknown): value is SyncView =>
    isRecord(value) && Array.isArray(value.items) && Array.isArray(value.goals);

const isQueuedOp = (value: unknown): value is QueuedOp =>
    isRecord(value) && typeof value.opId === 'string' && typeof value.type === 'string';

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
    return Array.isArray(data) ? data.filter(isQueuedOp) : [];
}

export async function saveQueue(uid: string, ops: QueuedOp[]): Promise<void> {
    await writeJson(queueKey(uid), ops);
}
