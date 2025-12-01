import React, { createContext, useState, useEffect, useContext } from 'react';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import { auth, db } from '../firebaseConfig';
import {
    onAuthStateChanged,
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from 'firebase/firestore';

// Configure notifications only on native platforms
if (Platform.OS !== 'web') {
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (error) {
        console.warn('Error setting notification handler:', error);
    }
}

export interface Item {
    id: string;
    name: string;
    price: number;
    createdAt: number;
    unlockAt: number;
    status: 'waiting' | 'bought' | 'saved';
    image?: string;
    resolvedAt?: number;
    category?: string;
}

export type Theme = 'light' | 'dark';

interface StoreContextType {
    items: Item[];
    moneySaved: number;
    moneySpent: number;
    user: User | null;
    theme: Theme;
    isLoading: boolean;
    addItem: (name: string, price: number, duration: number, unit: 'days' | 'minutes', category?: string) => Promise<void>;
    resolveItem: (id: string, decision: 'buy' | 'save') => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    clearAllData: () => Promise<void>;
    signIn: (email: string, pass: string) => Promise<void>;
    signUp: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
    toggleTheme: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<Item[]>([]);
    const [moneySaved, setMoneySaved] = useState(0);
    const [moneySpent, setMoneySpent] = useState(0);
    const [user, setUser] = useState<User | null>(null);
    const [theme, setTheme] = useState<Theme>('light');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsLoading(false);
            SplashScreen.hideAsync();
        });
        return unsubscribeAuth;
    }, []);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setMoneySaved(0);
            setMoneySpent(0);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);

        // Listen to user preferences (theme, stats)
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMoneySaved(data.moneySaved || 0);
                setMoneySpent(data.moneySpent || 0);
                setTheme(data.theme || 'light');
            } else {
                // Initialize user doc if not exists
                setDoc(userDocRef, { moneySaved: 0, moneySpent: 0, theme: 'light' }, { merge: true });
            }
        });

        // Listen to items subcollection
        const itemsRef = collection(userDocRef, 'items');
        const q = query(itemsRef, orderBy('createdAt', 'desc'));
        const unsubscribeItems = onSnapshot(q, (snapshot) => {
            const loadedItems: Item[] = [];
            snapshot.forEach((doc) => {
                loadedItems.push(doc.data() as Item);
            });
            setItems(loadedItems);
        });

        return () => {
            unsubscribeUser();
            unsubscribeItems();
        };
    }, [user]);

    const requestPermissions = async () => {
        if (Platform.OS === 'web') return;
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log('Notification permissions not granted');
        }
    };

    useEffect(() => {
        const setupNotifications = async () => {
            try {
                await requestPermissions();
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                    });
                }
            } catch (error) {
                console.warn('Error setting up notifications:', error);
            }
        };
        setupNotifications();
    }, []);

    const addItem = async (name: string, price: number, duration: number, unit: 'days' | 'minutes', category: string = 'Otros') => {
        if (!user) return;

        // Sanitize input
        const cleanName = name.replace(/<[^>]*>/g, '').trim();
        if (!cleanName) return;

        const now = Date.now();
        let multiplier = 1000 * 60; // minutos
        if (unit === 'days') {
            multiplier = 1000 * 60 * 60 * 24;
        }

        const unlockAt = now + duration * multiplier;
        const newItem: Item = {
            id: Math.random().toString(36).substr(2, 9),
            name: cleanName,
            price,
            createdAt: now,
            unlockAt,
            status: 'waiting',
            category,
        };

        // Save to Firestore
        const itemRef = doc(db, 'users', user.uid, 'items', newItem.id);
        await setDoc(itemRef, newItem);

        // Schedule notification
        if (Platform.OS !== 'web') {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "¡Tiempo cumplido!",
                    body: `¿Realmente quieres comprar ${cleanName}?`,
                    data: { itemId: newItem.id },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: duration * (unit === 'days' ? 24 * 60 * 60 : 60),
                    repeats: false,
                },
            });
        }
    };

    const resolveItem = async (id: string, decision: 'buy' | 'save') => {
        if (!user) return;

        const item = items.find(i => i.id === id);
        if (!item) return;

        const itemRef = doc(db, 'users', user.uid, 'items', id);
        const userRef = doc(db, 'users', user.uid);

        const resolvedAt = Date.now();

        if (decision === 'save') {
            await updateDoc(itemRef, { status: 'saved', resolvedAt });
            await updateDoc(userRef, { moneySaved: moneySaved + item.price });
        } else {
            await updateDoc(itemRef, { status: 'bought', resolvedAt });
            await updateDoc(userRef, { moneySpent: moneySpent + item.price });
        }
    };

    const deleteItem = async (id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'items', id));
    };

    const clearAllData = async () => {
        // Caution: This deletes everything for the user in Firestore
        // For simplicity, we just reset stats and delete items one by one
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { moneySaved: 0, moneySpent: 0 });

        items.forEach(async (item) => {
            await deleteDoc(doc(db, 'users', user.uid, 'items', item.id));
        });
    };

    const toggleTheme = async () => {
        if (!user) return;
        const newTheme = theme === 'light' ? 'dark' : 'light';
        await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
        // Optimistic update
        setTheme(newTheme);
    };

    const signIn = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const signUp = async (email: string, pass: string) => {
        await createUserWithEmailAndPassword(auth, email, pass);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <StoreContext.Provider value={{
            items,
            moneySaved,
            moneySpent,
            user,
            theme,
            isLoading,
            addItem,
            resolveItem,
            deleteItem,
            clearAllData,
            signIn,
            signUp,
            signOut,
            toggleTheme
        }}>
            {children}
        </StoreContext.Provider>
    );
};
