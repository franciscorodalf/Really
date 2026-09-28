import React from 'react';
import { render } from '@testing-library/react-native';
import { StoreProvider } from '../context/StoreContext';

jest.mock('../firebaseConfig', () => ({
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
        // Simula que el usuario todavía no tiene documento en Firestore.
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

export function renderWithStore(ui: React.ReactElement, options?: { hourlyWage?: number }) {
    if (options?.hourlyWage !== undefined) {
        const { onSnapshot } = require('firebase/firestore');
        onSnapshot.mockImplementationOnce((_ref: any, callback: any) => {
            callback({ exists: () => true, data: () => ({ hourlyWage: options.hourlyWage }), forEach: () => { } });
            return jest.fn();
        });
    }
    return render(<StoreProvider>{ui}</StoreProvider>);
}

export { StoreProvider };
