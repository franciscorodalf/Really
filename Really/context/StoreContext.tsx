import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
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
import { Platform } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { computeCurrentStreak } from '../utils/gamificationStats';
import { awardSaveAchievements } from '../utils/achievementRules';
import type { Item, Goal, Theme } from './types';
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
    orderBy,
    getDoc,
    runTransaction
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

export { ACHIEVEMENTS } from './types';
export type { Item, Goal, Achievement, Theme } from './types';
export type NoticeType = 'success' | 'error' | 'info';

export interface Notice {
    type: NoticeType;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    autoHide?: boolean;
}

interface StoreContextType {
    items: Item[];
    goals: Goal[];
    userAchievements: string[];
    moneySaved: number;
    moneySpent: number;
    user: User | null;
    theme: Theme;
    hourlyWage: number | null;
    isLoading: boolean;
    notice: Notice | null;
    showNotice: (notice: Notice) => void;
    clearNotice: () => void;
    newAchievementSignal: number;
    addItem: (name: string, price: number, duration: number, unit: 'days' | 'hours' | 'minutes', category?: string, categoryIcon?: string, categoryColor?: string) => Promise<void>;
    resolveItem: (id: string, decision: 'buy' | 'save') => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    clearAllData: () => Promise<void>;
    signIn: (email: string, pass: string) => Promise<void>;
    signUp: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
    toggleTheme: () => Promise<void>;
    setHourlyWage: (wage: number | null) => Promise<void>;
    addGoal: (name: string, targetAmount: number, icon: string, color: string) => Promise<void>;
    deleteGoal: (id: string) => Promise<void>;
    allocateSavings: (goalId: string, amount: number) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Helpers a nivel de módulo: solo se invocan desde handlers asíncronos (nunca durante el
// render), y así las reglas de pureza de React no los confunden con lógica de render.
const currentTimeMs = () => Date.now();
const generateId = () => Math.random().toString(36).substr(2, 9);

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
    const [savedCount, setSavedCount] = useState<number | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [theme, setTheme] = useState<Theme>('light');
    const [hourlyWage, setHourlyWageState] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasItemsLoaded, setHasItemsLoaded] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [hasOfflineNotice, setHasOfflineNotice] = useState(false);
    const [newAchievementSignal, setNewAchievementSignal] = useState(0);

    // Refs para calcular la racha con datos frescos: el estado `items` capturado en el
    // closure puede estar desfasado si hay resoluciones en vuelo (la transacción no
    // actualiza el estado local hasta que el servidor confirma) o si se reintenta una
    // resolución antigua.
    const itemsRef = useRef<Item[]>([]);
    const pendingResolutionsRef = useRef<Map<string, { status: 'saved' | 'bought'; resolvedAt: number }>>(new Map());

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                // Al cerrar sesión se vacía el estado derivado del usuario anterior.
                setItems([]);
                setGoals([]);
                setMoneySaved(0);
                setMoneySpent(0);
                setSavedCount(null);
                setHasItemsLoaded(false);
                setNewAchievementSignal(0);
                setHourlyWageState(null);
            }
            setUser(currentUser);
            setIsLoading(false);
            SplashScreen.hideAsync();
        });
        return unsubscribeAuth;
    }, []);

    useEffect(() => {
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);

        // Listen to user preferences (theme, stats)
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMoneySaved(data.moneySaved || 0);
                setMoneySpent(data.moneySpent || 0);
                setTheme(data.theme || 'light');
                setUserAchievements(data.achievements || []);
                setSavedCount(typeof data.savedCount === 'number' ? data.savedCount : null);
                setHourlyWageState(typeof data.hourlyWage === 'number' ? data.hourlyWage : null);

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
            setHasItemsLoaded(true);
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

    useEffect(() => {
        if (!user || !hasItemsLoaded || savedCount !== null) return;
        const computedSavedCount = items.filter(i => i.status === 'saved').length;
        setDoc(doc(db, 'users', user.uid), { savedCount: computedSavedCount }, { merge: true });
        // Migración puntual: refleja en local el contador recién escrito en Firestore. La condición
        // `savedCount !== null` de arriba evita que el efecto se repita, así que no hay cascada.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSavedCount(computedSavedCount);
    }, [user, hasItemsLoaded, savedCount, items]);

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

    const showNotice = (nextNotice: Notice) => {
        setNotice(nextNotice);
    };

    const clearNotice = () => {
        setNotice(null);
        setHasOfflineNotice(false);
    };

    const isOfflineError = (error: any) => {
        const code = error?.code;
        return code === 'unavailable' || code === 'network-request-failed';
    };

    const showOfflineNotice = (retry: () => void) => {
        if (hasOfflineNotice) return true;
        setHasOfflineNotice(true);
        showNotice({
            type: 'info',
            message: 'Parece que estás offline.',
            actionLabel: 'Reintentar',
            onAction: retry,
            autoHide: false,
        });
        return true;
    };

    const addItem = async (name: string, price: number, duration: number, unit: 'days' | 'hours' | 'minutes', category: string = 'Otros', categoryIcon: string = 'pricetag', categoryColor: string = '#999') => {
        if (!user) return;

        // Sanitize input
        const cleanName = name.replace(/<[^>]*>/g, '').trim();
        if (!cleanName) {
            showNotice({ type: 'error', message: 'Escribe un nombre.', autoHide: true });
            return;
        }
        if (cleanName.length > 80) {
            showNotice({ type: 'error', message: 'El nombre es muy largo (máx. 80).', autoHide: true });
            return;
        }
        if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
            showNotice({ type: 'error', message: 'Precio inválido.', autoHide: true });
            return;
        }
        if (!Number.isFinite(duration) || duration <= 0) {
            showNotice({ type: 'error', message: 'Duración inválida.', autoHide: true });
            return;
        }
        if (unit === 'days' && duration > 3650) {
            showNotice({ type: 'error', message: 'Duración demasiado alta.', autoHide: true });
            return;
        }
        if (unit === 'hours' && duration > 24 * 365) {
            showNotice({ type: 'error', message: 'Duración demasiado alta.', autoHide: true });
            return;
        }
        if (unit === 'minutes' && duration > 60 * 24 * 365) {
            showNotice({ type: 'error', message: 'Duración demasiado alta.', autoHide: true });
            return;
        }

        const now = currentTimeMs();
        let multiplier = 1000 * 60; // minutos
        if (unit === 'days') {
            multiplier = 1000 * 60 * 60 * 24;
        } else if (unit === 'hours') {
            multiplier = 1000 * 60 * 60;
        }

        const unlockAt = now + duration * multiplier;
        let notificationId: string | undefined;
        const newItem: Item = {
            id: generateId(),
            name: cleanName,
            price,
            createdAt: now,
            unlockAt,
            status: 'waiting',
            category,
            categoryIcon,
            categoryColor,
            notificationId,
        };

        try {
            // Schedule notification
            if (Platform.OS !== 'web' && Notifications) {
                try {
                    notificationId = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "¡Tiempo cumplido!",
                            body: `¿Realmente quieres comprar ${cleanName}?`,
                            data: { itemId: newItem.id },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                            seconds: duration * (unit === 'days' ? 24 * 60 * 60 : unit === 'hours' ? 60 * 60 : 60),
                            repeats: false,
                        },
                    });
                    newItem.notificationId = notificationId;
                } catch (error) {
                    console.warn('Error scheduling notification:', error);
                }
            }

            // Save to Firestore
            const itemRef = doc(db, 'users', user.uid, 'items', newItem.id);
            await setDoc(itemRef, newItem);
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => addItem(name, price, duration, unit, category, categoryIcon, categoryColor));
                return;
            }
            if (notificationId && Notifications) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(notificationId);
                } catch (cancelError) {
                    console.warn('Error canceling notification after failure:', cancelError);
                }
            }
            showNotice({
                type: 'error',
                message: 'No se pudo guardar el deseo. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => addItem(name, price, duration, unit, category, categoryIcon, categoryColor),
                autoHide: false,
            });
        }
    };

    const resolveItem = async (id: string, decision: 'buy' | 'save') => {
        if (!user) return;
        const itemRef = doc(db, 'users', user.uid, 'items', id);
        const userRef = doc(db, 'users', user.uid);
        const resolvedAt = currentTimeMs();

        // Racha previa: items actuales + resoluciones aún en vuelo (se calcula ANTES de
        // registrar la entrada de esta llamada, que solo sirve a llamadas concurrentes posteriores).
        const pendingResolutions = pendingResolutionsRef.current;
        const itemsForStreak = itemsRef.current.map((item) => {
            const pending = pendingResolutions.get(item.id);
            return pending ? { ...item, status: pending.status, resolvedAt: pending.resolvedAt } : item;
        });
        const streakBeforeResolution = computeCurrentStreak(itemsForStreak);
        const ownPending = { status: decision === 'save' ? ('saved' as const) : ('bought' as const), resolvedAt };
        pendingResolutions.set(id, ownPending);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const itemSnap = await transaction.get(itemRef);
                if (!itemSnap.exists()) return { earned: [] as string[], notificationId: null as string | null };

                const item = itemSnap.data() as Item;
                if (item.status !== 'waiting') return { earned: [] as string[], notificationId: null as string | null };

                const userSnap = await transaction.get(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};

                const currentSaved = Number(userData.moneySaved || 0);
                const currentSpent = Number(userData.moneySpent || 0);
                const currentSavedCount = Number(userData.savedCount || 0);
                const currentAchievements: string[] = Array.isArray(userData.achievements) ? userData.achievements : [];

                let newAchievements = [...currentAchievements];
                let newlyEarned: string[] = [];

                if (decision === 'save') {
                    const newSaved = currentSaved + item.price;
                    const newSavedCount = currentSavedCount + 1;
                    const newStreak = streakBeforeResolution + 1;

                    const awarded = awardSaveAchievements({
                        current: currentAchievements,
                        newSaved,
                        newSavedCount,
                        newStreak,
                    });
                    newAchievements = awarded.achievements;
                    newlyEarned = awarded.earned;

                    transaction.update(itemRef, { status: 'saved', resolvedAt });
                    transaction.set(userRef, {
                        moneySaved: newSaved,
                        savedCount: newSavedCount,
                        achievements: newAchievements,
                    }, { merge: true });
                } else {
                    const newSpent = currentSpent + item.price;
                    transaction.update(itemRef, { status: 'bought', resolvedAt });
                    transaction.set(userRef, { moneySpent: newSpent }, { merge: true });
                }

                return { earned: newlyEarned, notificationId: item.notificationId || null };
            });

            if (result.notificationId && Notifications) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(result.notificationId);
                } catch (error) {
                    console.warn('Error canceling notification:', error);
                }
            }

            if (result.earned.length > 0) {
                setNewAchievementSignal((s) => s + 1);
            } else {
                showNotice({
                    type: 'success',
                    message: decision === 'save' ? '¡Ahorro sumado!' : 'Compra registrada.',
                    autoHide: true,
                });
            }
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => resolveItem(id, decision));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo actualizar el deseo. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => resolveItem(id, decision),
                autoHide: false,
            });
        } finally {
            if (pendingResolutions.get(id) === ownPending) {
                pendingResolutions.delete(id);
            }
        }
    };

    const deleteItem = async (id: string) => {
        if (!user) return;
        try {
            if (Notifications) {
                try {
                    let notificationId = items.find(i => i.id === id)?.notificationId;
                    if (!notificationId) {
                        const itemSnap = await getDoc(doc(db, 'users', user.uid, 'items', id));
                        if (itemSnap.exists()) {
                            const data = itemSnap.data() as Item;
                            notificationId = data.notificationId;
                        }
                    }
                    if (notificationId) {
                        await Notifications.cancelScheduledNotificationAsync(notificationId);
                    }
                } catch (error) {
                    console.warn('Error canceling notification:', error);
                }
            }
            await deleteDoc(doc(db, 'users', user.uid, 'items', id));
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => deleteItem(id));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo eliminar el deseo. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => deleteItem(id),
                autoHide: false,
            });
        }
    };

    const clearAllData = async () => {
        // Caution: This deletes everything for the user in Firestore
        // For simplicity, we just reset stats and delete items one by one
        if (!user) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { moneySaved: 0, moneySpent: 0 });

            if (Notifications) {
                for (const item of items) {
                    if (item.notificationId) {
                        try {
                            await Notifications.cancelScheduledNotificationAsync(item.notificationId);
                        } catch (error) {
                            console.warn('Error canceling notification:', error);
                        }
                    }
                }
            }

            await Promise.all(
                items.map((item) => deleteDoc(doc(db, 'users', user.uid, 'items', item.id)))
            );
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => clearAllData());
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo borrar todo. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => clearAllData(),
                autoHide: false,
            });
        }
    };

    const toggleTheme = async () => {
        if (!user) return;
        const newTheme = theme === 'light' ? 'dark' : 'light';
        await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
        // Optimistic update
        setTheme(newTheme);
    };

    const setHourlyWage = async (wage: number | null) => {
        if (!user) return;
        if (wage !== null && (!Number.isFinite(wage) || wage <= 0 || wage > 100000)) {
            showNotice({ type: 'error', message: 'Sueldo por hora inválido.', autoHide: true });
            return;
        }
        try {
            await updateDoc(doc(db, 'users', user.uid), { hourlyWage: wage });
            setHourlyWageState(wage);
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => setHourlyWage(wage));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo guardar el sueldo por hora. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => setHourlyWage(wage),
                autoHide: false,
            });
        }
    };

    const addGoal = async (name: string, targetAmount: number, icon: string, color: string) => {
        if (!user) return;
        const cleanName = name.replace(/<[^>]*>/g, '').trim();
        if (!cleanName) {
            showNotice({ type: 'error', message: 'Escribe un nombre.', autoHide: true });
            return;
        }
        if (cleanName.length > 80) {
            showNotice({ type: 'error', message: 'El nombre es muy largo (máx. 80).', autoHide: true });
            return;
        }
        if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1000000) {
            showNotice({ type: 'error', message: 'Monto inválido.', autoHide: true });
            return;
        }
        try {
            const newGoal: Goal = {
                id: generateId(),
                name: cleanName,
                targetAmount,
                currentAmount: 0,
                icon,
                color,
                createdAt: currentTimeMs(),
            };
            await setDoc(doc(db, 'users', user.uid, 'goals', newGoal.id), newGoal);
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => addGoal(name, targetAmount, icon, color));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo crear la meta. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => addGoal(name, targetAmount, icon, color),
                autoHide: false,
            });
        }
    };

    const deleteGoal = async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'goals', id));
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => deleteGoal(id));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo eliminar la meta. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => deleteGoal(id),
                autoHide: false,
            });
        }
    };

    const allocateSavings = async (goalId: string, amount: number) => {
        if (!user) return;
        if (amount <= 0) {
            showNotice({ type: 'error', message: 'Monto inválido.', autoHide: true });
            return;
        }
        const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
        const userRef = doc(db, 'users', user.uid);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const goalSnap = await transaction.get(goalRef);
                if (!goalSnap.exists()) return { insufficient: false };

                const userSnap = await transaction.get(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                const currentSaved = Number(userData.moneySaved || 0);

                if (currentSaved < amount) {
                    return { insufficient: true };
                }

                const goal = goalSnap.data() as Goal;
                transaction.update(goalRef, { currentAmount: goal.currentAmount + amount });
                transaction.set(userRef, { moneySaved: currentSaved - amount }, { merge: true });
                return { insufficient: false };
            });

            if (result?.insufficient) {
                showNotice({ type: 'error', message: 'Fondos insuficientes.', autoHide: true });
            }
        } catch (error) {
            if (isOfflineError(error)) {
                showOfflineNotice(() => allocateSavings(goalId, amount));
                return;
            }
            showNotice({
                type: 'error',
                message: 'No se pudo asignar el ahorro. Reintenta.',
                actionLabel: 'Reintentar',
                onAction: () => allocateSavings(goalId, amount),
                autoHide: false,
            });
        }
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
            hourlyWage,
            isLoading,
            notice,
            showNotice,
            clearNotice,
            newAchievementSignal,
            addItem,
            resolveItem,
            deleteItem,
            clearAllData,
            signIn,
            signUp,
            signOut,
            toggleTheme,
            setHourlyWage,
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
