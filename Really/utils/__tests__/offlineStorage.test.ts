import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Goal, Item } from '../../context/types';
import type { QueuedOp, SyncView } from '../offlineOps';
import {
    cacheKey,
    loadCache,
    loadQueue,
    queueKey,
    saveCache,
    saveQueue,
} from '../offlineStorage';

const item: Item = {
    id: 'item-1',
    name: 'Zapatillas',
    price: 40,
    createdAt: 1000,
    unlockAt: 2000,
    status: 'waiting',
};

const goal: Goal = {
    id: 'goal-1',
    name: 'Viaje',
    targetAmount: 500,
    currentAmount: 25,
    icon: 'airplane',
    color: '#00f',
    createdAt: 1000,
};

const fullView: SyncView = {
    items: [item],
    goals: [goal],
    moneySaved: 120,
    moneySpent: 35,
    savedCount: 3,
    achievements: ['first_save'],
    theme: 'dark',
    hourlyWage: 12.5,
};

const makeOp = (n: number): QueuedOp => ({
    type: 'deleteItem',
    itemId: `item-${n}`,
    opId: `op-${n}`,
    createdAt: n,
});

describe('offlineStorage', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('saveCache/loadCache hacen ida y vuelta', async () => {
        await saveCache('u', fullView);
        expect(await loadCache('u')).toEqual(fullView);
    });

    it('loadCache devuelve null si no hay nada', async () => {
        expect(await loadCache('u')).toBeNull();
    });

    it('loadCache ignora JSON corrupto', async () => {
        await AsyncStorage.setItem(cacheKey('u'), '{no json');
        expect(await loadCache('u')).toBeNull();
    });

    it('loadCache ignora una vista con forma inesperada', async () => {
        await AsyncStorage.setItem(cacheKey('u'), '{"items": 3}');
        expect(await loadCache('u')).toBeNull();
    });

    it('saveQueue/loadQueue hacen ida y vuelta conservando el orden', async () => {
        const ops = [makeOp(3), makeOp(1), makeOp(2)];
        await saveQueue('u', ops);
        expect(await loadQueue('u')).toEqual(ops);
    });

    it('loadQueue devuelve [] si no hay nada', async () => {
        expect(await loadQueue('u')).toEqual([]);
    });

    it('loadQueue descarta elementos inválidos y conserva los válidos', async () => {
        const valid1 = makeOp(1);
        const valid2 = makeOp(2);
        await AsyncStorage.setItem(
            queueKey('u'),
            JSON.stringify([valid1, { type: 'deleteItem' }, { opId: 'x' }, null, 5, valid2]),
        );
        expect(await loadQueue('u')).toEqual([valid1, valid2]);
    });

    it('loadQueue devuelve [] si el JSON no es un array', async () => {
        await AsyncStorage.setItem(queueKey('u'), '{"opId":"x","type":"deleteItem"}');
        expect(await loadQueue('u')).toEqual([]);
    });

    it('loadQueue devuelve [] si el JSON es corrupto', async () => {
        await AsyncStorage.setItem(queueKey('u'), '[{broken');
        expect(await loadQueue('u')).toEqual([]);
    });

    it('las claves van separadas por uid', async () => {
        const viewB: SyncView = { ...fullView, moneySaved: 999 };
        await saveCache('a', fullView);
        await saveCache('b', viewB);
        await saveQueue('a', [makeOp(1)]);
        await saveQueue('b', [makeOp(2), makeOp(3)]);

        expect(await loadCache('a')).toEqual(fullView);
        expect(await loadCache('b')).toEqual(viewB);
        expect(await loadQueue('a')).toEqual([makeOp(1)]);
        expect(await loadQueue('b')).toEqual([makeOp(2), makeOp(3)]);
    });

    it('un fallo de AsyncStorage no lanza', async () => {
        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disco lleno'));
        await expect(saveQueue('u', [makeOp(1)])).resolves.toBeUndefined();

        (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('lectura'));
        expect(await loadQueue('u')).toEqual([]);

        (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('lectura'));
        expect(await loadCache('u')).toBeNull();

        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disco lleno'));
        await expect(saveCache('u', fullView)).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalled();
    });
});
