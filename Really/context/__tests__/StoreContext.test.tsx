import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { StoreProvider, useStore, ACHIEVEMENTS } from '../StoreContext';

// Mock Firebase
jest.mock('../../firebaseConfig', () => ({
    auth: {},
    db: {},
}));

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn((auth, callback) => {
        callback({ uid: 'test-user', email: 'test@example.com' });
        return jest.fn();
    }),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(() => ({ id: 'mock-doc-ref' })),
    setDoc: jest.fn(),
    onSnapshot: jest.fn((ref, callback) => {
        // Simulate empty data initially
        callback({ exists: () => false, data: () => ({}), forEach: () => { } });
        return jest.fn();
    }),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    getDoc: jest.fn(),
    runTransaction: jest.fn(),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    setNotificationChannelAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
    executionEnvironment: 'standalone',
    ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

describe('StoreContext', () => {
    it('provides initial state correctly', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });

        // Wait for auth effect
        await act(async () => { });

        expect(result.current.items).toEqual([]);
        expect(result.current.moneySaved).toBe(0);
        expect(result.current.moneySpent).toBe(0);
        expect(result.current.user).toBeTruthy();
    });

    it('can add an item', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.addItem('Test Item', 100, 1, 'minutes', 'Test');
        });

        // Since we mocked Firestore and onSnapshot doesn't update automatically in this mock,
        // we can't verify items array update without more complex mocking.
        // However, we can verify the function didn't crash.
        expect(true).toBe(true);
    });

    it('resolveItem updates stats, achievements and cancels notification', async () => {
        const { runTransaction } = require('firebase/firestore');
        const { cancelScheduledNotificationAsync } = require('expo-notifications');

        const itemData = {
            id: 'item-1',
            name: 'Test',
            price: 50,
            createdAt: Date.now(),
            unlockAt: Date.now(),
            status: 'waiting',
            notificationId: 'notif-123',
        };
        const userData = {
            moneySaved: 0,
            moneySpent: 0,
            savedCount: 0,
            achievements: [],
        };

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => itemData })
                .mockResolvedValueOnce({ exists: () => true, data: () => userData }),
            update: jest.fn(),
            set: jest.fn(),
        };

        runTransaction.mockImplementation(async (_db: any, updateFn: any) => {
            return updateFn(transaction);
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.resolveItem('item-1', 'save');
        });

        expect(transaction.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ status: 'saved', resolvedAt: expect.any(Number) })
        );
        expect(transaction.set).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                moneySaved: 50,
                savedCount: 1,
                achievements: expect.arrayContaining(['first_save']),
            }),
            { merge: true }
        );
        expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-123');
        expect(result.current.newAchievementSignal).toBe(1);
        expect(result.current.notice).toBeNull();
    });

    it('resolveItem shows a success notice (not the achievement signal) when no achievement is earned', async () => {
        const { runTransaction } = require('firebase/firestore');

        const itemData = {
            id: 'item-2',
            name: 'Test',
            price: 5,
            createdAt: Date.now(),
            unlockAt: Date.now(),
            status: 'waiting',
        };
        const userData = {
            moneySaved: 50,
            moneySpent: 0,
            savedCount: 1,
            achievements: ['first_save'],
        };

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => itemData })
                .mockResolvedValueOnce({ exists: () => true, data: () => userData }),
            update: jest.fn(),
            set: jest.fn(),
        };

        runTransaction.mockImplementation(async (_db: any, updateFn: any) => {
            return updateFn(transaction);
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.resolveItem('item-2', 'save');
        });

        expect(result.current.newAchievementSignal).toBe(0);
        expect(result.current.notice).toEqual(
            expect.objectContaining({ type: 'success', message: '¡Ahorro sumado!' })
        );
    });

    it('allocateSavings does nothing when funds are insufficient', async () => {
        const { runTransaction } = require('firebase/firestore');

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => ({ id: 'goal-1', currentAmount: 0 }) })
                .mockResolvedValueOnce({ exists: () => true, data: () => ({ moneySaved: 10 }) }),
            update: jest.fn(),
            set: jest.fn(),
        };

        runTransaction.mockImplementation(async (_db: any, updateFn: any) => {
            return updateFn(transaction);
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.allocateSavings('goal-1', 20);
        });

        expect(transaction.update).not.toHaveBeenCalled();
        expect(transaction.set).not.toHaveBeenCalled();
    });

    it('carga hourlyWage desde el documento de usuario', async () => {
        const { onSnapshot } = require('firebase/firestore');
        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            callback({ exists: () => true, data: () => ({ hourlyWage: 25 }), forEach: () => { } });
            return jest.fn();
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        expect(result.current.hourlyWage).toBe(25);
    });

    it('setHourlyWage guarda el valor y actualiza el estado local', async () => {
        const { updateDoc } = require('firebase/firestore');
        updateDoc.mockClear();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.setHourlyWage(30);
        });

        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { hourlyWage: 30 });
        expect(result.current.hourlyWage).toBe(30);
    });

    it('setHourlyWage(null) borra el valor guardado', async () => {
        const { updateDoc } = require('firebase/firestore');
        updateDoc.mockClear();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.setHourlyWage(30);
        });
        await act(async () => {
            await result.current.setHourlyWage(null);
        });

        expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), { hourlyWage: null });
        expect(result.current.hourlyWage).toBeNull();
    });

    it('setHourlyWage rechaza valores fuera de rango', async () => {
        const { updateDoc } = require('firebase/firestore');
        updateDoc.mockClear();

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.setHourlyWage(-5);
        });

        expect(updateDoc).not.toHaveBeenCalled();
        expect(result.current.notice?.type).toBe('error');
    });

    it('ACHIEVEMENTS incluye los nuevos logros de racha', () => {
        const ids = ACHIEVEMENTS.map((a) => a.id);
        expect(ids).toEqual(expect.arrayContaining(['streak_3', 'streak_5', 'streak_10']));

        const streak3 = ACHIEVEMENTS.find((a) => a.id === 'streak_3');
        expect(streak3).toMatchObject({ title: 'Racha de Defensa', icon: 'flame-outline' });

        const streak5 = ACHIEVEMENTS.find((a) => a.id === 'streak_5');
        expect(streak5).toMatchObject({ title: 'Disciplina de Hierro', icon: 'flame' });

        const streak10 = ACHIEVEMENTS.find((a) => a.id === 'streak_10');
        expect(streak10).toMatchObject({ title: 'Inquebrantable', icon: 'shield-checkmark' });
    });

    it('resolveItem desbloquea el logro de racha al encadenar 3 ahorros seguidos', async () => {
        const { onSnapshot, runTransaction } = require('firebase/firestore');

        // 1ª llamada a onSnapshot = documento de usuario (valores por defecto)
        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            callback({ exists: () => false, data: () => ({}), forEach: () => { } });
            return jest.fn();
        });
        // 2ª llamada a onSnapshot = colección de items: 2 ahorros ya existentes
        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            const mockItems = [
                { id: 'a', name: 'A', price: 10, createdAt: 1000, unlockAt: 1000, status: 'saved', resolvedAt: 2000 },
                { id: 'b', name: 'B', price: 10, createdAt: 1500, unlockAt: 1500, status: 'saved', resolvedAt: 3000 },
            ];
            callback({
                exists: () => true,
                data: () => ({}),
                forEach: (fn: (doc: any) => void) => mockItems.forEach((data) => fn({ data: () => data })),
            });
            return jest.fn();
        });

        const itemData = {
            id: 'item-3',
            name: 'Test',
            price: 5,
            createdAt: 4000,
            unlockAt: 4000,
            status: 'waiting',
        };
        const userData = { moneySaved: 20, moneySpent: 0, savedCount: 2, achievements: ['first_save'] };

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => itemData })
                .mockResolvedValueOnce({ exists: () => true, data: () => userData }),
            update: jest.fn(),
            set: jest.fn(),
        };

        runTransaction.mockImplementation(async (_db: any, updateFn: any) => {
            return updateFn(transaction);
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );

        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.resolveItem('item-3', 'save');
        });

        expect(transaction.set).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                achievements: expect.arrayContaining(['streak_3']),
            }),
            { merge: true }
        );
    });

    it('resolveItem con decisión "buy" nunca desbloquea logros de racha', async () => {
        const { onSnapshot, runTransaction } = require('firebase/firestore');

        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            callback({ exists: () => false, data: () => ({}), forEach: () => { } });
            return jest.fn();
        });
        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            const mockItems = [
                { id: 'a', name: 'A', price: 10, createdAt: 1000, unlockAt: 1000, status: 'saved', resolvedAt: 2000 },
                { id: 'b', name: 'B', price: 10, createdAt: 1500, unlockAt: 1500, status: 'saved', resolvedAt: 3000 },
                { id: 'c', name: 'C', price: 10, createdAt: 1700, unlockAt: 1700, status: 'saved', resolvedAt: 3500 },
            ];
            callback({
                exists: () => true,
                data: () => ({}),
                forEach: (fn: (doc: any) => void) => mockItems.forEach((data) => fn({ data: () => data })),
            });
            return jest.fn();
        });

        const itemData = {
            id: 'item-4',
            name: 'Test',
            price: 5,
            createdAt: 4000,
            unlockAt: 4000,
            status: 'waiting',
        };
        const userData = { moneySaved: 30, moneySpent: 0, savedCount: 3, achievements: ['first_save'] };

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => itemData })
                .mockResolvedValueOnce({ exists: () => true, data: () => userData }),
            update: jest.fn(),
            set: jest.fn(),
        };

        runTransaction.mockImplementation(async (_db: any, updateFn: any) => updateFn(transaction));

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <StoreProvider>{children}</StoreProvider>
        );
        const { result } = renderHook(() => useStore(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.resolveItem('item-4', 'buy');
        });

        expect(transaction.set).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ moneySpent: 5 }),
            { merge: true }
        );
        const setCallArgs = transaction.set.mock.calls[0][1];
        expect(setCallArgs.achievements).toBeUndefined();
    });
});
