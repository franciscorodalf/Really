import React, { createContext, useState, useEffect, useContext } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
let Notifications: any;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Only require expo-notifications if NOT in Expo Go on Android
if (Platform.OS !== 'android' || !isExpoGo) {
    try {
        Notifications = require('expo-notifications');
    } catch (error) {
        console.warn('expo-notifications not available:', error);
    }
}
import * as SplashScreen from 'expo-splash-screen';
import { Platform, Alert } from 'react-native';
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
if (Platform.OS !== 'web' && Notifications) {
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
    categoryIcon?: string;
    categoryColor?: string;
}

export interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    icon: string;
    color: string;
    createdAt: number;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_save', title: 'Primer Ahorro', description: 'Has ahorrado tu primer deseo', icon: 'star' },
    { id: 'saver_10', title: 'Coleccionista', description: 'Has ahorrado 10 deseos', icon: 'library' },
    { id: 'saver_100', title: 'Ahorrador Novato', description: 'Has ahorrado más de $100', icon: 'wallet' },
    { id: 'saver_200', title: 'Buen Comienzo', description: 'Has ahorrado más de $200', icon: 'trending-up' },
    { id: 'saver_1000', title: 'Gran Ahorrador', description: 'Has ahorrado más de $1000', icon: 'trophy' },
    { id: 'saver_2000', title: 'Experto', description: 'Has ahorrado más de $2000', icon: 'ribbon' },
    { id: 'saver_5000', title: 'Magnate', description: 'Has ahorrado más de $5000', icon: 'diamond' },
    { id: 'saver_10000', title: 'Leyenda', description: 'Has ahorrado más de $10000', icon: 'ribbon' },
];

export type Theme = 'light' | 'dark';

interface StoreContextType {
    items: Item[];
    goals: Goal[];
    userAchievements: string[];
    moneySaved: number;
    moneySpent: number;
    user: User | null;
    theme: Theme;
    isLoading: boolean;
    addItem: (name: string, price: number, duration: number, unit: 'days' | 'minutes', category?: string, categoryIcon?: string, categoryColor?: string) => Promise<void>;
    resolveItem: (id: string, decision: 'buy' | 'save') => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    clearAllData: () => Promise<void>;
    signIn: (email: string, pass: string) => Promise<void>;
    signUp: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
    toggleTheme: () => Promise<void>;
    addGoal: (name: string, targetAmount: number, icon: string, color: string) => Promise<void>;
    deleteGoal: (id: string) => Promise<void>;
    allocateSavings: (goalId: string, amount: number) => Promise<void>;
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
    const [goals, setGoals] = useState<Goal[]>([]);
    const [userAchievements, setUserAchievements] = useState<string[]>([]);
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
            setGoals([]);
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
                setUserAchievements(data.achievements || []);

                // Ensure supportId is saved
                if (!data.supportId) {
                    const supportId = user.uid.slice(-6).toUpperCase();
                    updateDoc(userDocRef, { supportId });
                }
            } else {
                // Initialize user doc if not exists
                const supportId = user.uid.slice(-6).toUpperCase();
                setDoc(userDocRef, { moneySaved: 0, moneySpent: 0, theme: 'light', supportId }, { merge: true });
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

        // Listen to goals subcollection
        const goalsRef = collection(userDocRef, 'goals');
        const qGoals = query(goalsRef, orderBy('createdAt', 'desc'));
        const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
            const loadedGoals: Goal[] = [];
            snapshot.forEach((doc) => {
                loadedGoals.push(doc.data() as Goal);
            });
            setGoals(loadedGoals);
        });

        return () => {
            unsubscribeUser();
            unsubscribeItems();
            unsubscribeGoals();
        };
    }, [user]);

    const requestPermissions = async () => {
        if (Platform.OS === 'web' || !Notifications) return;
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log('Notification permissions not granted');
        }
    };

    useEffect(() => {
        const setupNotifications = async () => {
            try {
                await requestPermissions();
                if (Platform.OS === 'android' && Notifications) {
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

    const addItem = async (name: string, price: number, duration: number, unit: 'days' | 'minutes', category: string = 'Otros', categoryIcon: string = 'pricetag', categoryColor: string = '#999') => {
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
            categoryIcon,
            categoryColor,
        };

        // Save to Firestore
        const itemRef = doc(db, 'users', user.uid, 'items', newItem.id);
        await setDoc(itemRef, newItem);

        // Schedule notification
        if (Platform.OS !== 'web' && Notifications) {
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
            const newSaved = moneySaved + item.price;
            await updateDoc(itemRef, { status: 'saved', resolvedAt });

            // Check achievements
            const newAchievements = [...userAchievements];
            const earned: string[] = [];

            // Calculate total saved items count (including this one)
            const savedCount = items.filter(i => i.status === 'saved').length + 1;

            if (!newAchievements.includes('first_save')) { newAchievements.push('first_save'); earned.push('Primer Ahorro'); }
            if (savedCount >= 10 && !newAchievements.includes('saver_10')) { newAchievements.push('saver_10'); earned.push('Coleccionista'); }

            if (newSaved >= 100 && !newAchievements.includes('saver_100')) { newAchievements.push('saver_100'); earned.push('Ahorrador Novato'); }
            if (newSaved >= 200 && !newAchievements.includes('saver_200')) { newAchievements.push('saver_200'); earned.push('Buen Comienzo'); }
            if (newSaved >= 1000 && !newAchievements.includes('saver_1000')) { newAchievements.push('saver_1000'); earned.push('Gran Ahorrador'); }
            if (newSaved >= 2000 && !newAchievements.includes('saver_2000')) { newAchievements.push('saver_2000'); earned.push('Experto'); }
            if (newSaved >= 5000 && !newAchievements.includes('saver_5000')) { newAchievements.push('saver_5000'); earned.push('Magnate'); }
            if (newSaved >= 10000 && !newAchievements.includes('saver_10000')) { newAchievements.push('saver_10000'); earned.push('Leyenda'); }

            if (earned.length > 0) {
                Alert.alert(
                    '¡Logro Desbloqueado!',
                    `Has conseguido: ${earned.join(', ')}`,
                    [{ text: 'Genial' }]
                );
            }

            await updateDoc(userRef, { moneySaved: newSaved, achievements: newAchievements });
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

    const addGoal = async (name: string, targetAmount: number, icon: string, color: string) => {
        if (!user) return;
        const newGoal: Goal = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            targetAmount,
            currentAmount: 0,
            icon,
            color,
            createdAt: Date.now(),
        };
        await setDoc(doc(db, 'users', user.uid, 'goals', newGoal.id), newGoal);
    };

    const deleteGoal = async (id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'goals', id));
    };

    const allocateSavings = async (goalId: string, amount: number) => {
        if (!user) return;
        const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
        const userRef = doc(db, 'users', user.uid);

        // Transaction would be better, but keeping it simple
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        if (moneySaved < amount) {
            // Not enough savings
            return;
        }

        await updateDoc(goalRef, { currentAmount: goal.currentAmount + amount });
        await updateDoc(userRef, { moneySaved: moneySaved - amount });
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
            toggleTheme,
            goals,
            userAchievements,
            addGoal,
            deleteGoal,
            allocateSavings
        }}>
            {children}
        </StoreContext.Provider>
    );
};
