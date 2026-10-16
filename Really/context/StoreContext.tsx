import React, { createContext, useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
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
import { applyOps, createOpId, EMPTY_VIEW, type Op, type QueuedOp, type SyncView } from '../utils/offlineOps';
import { loadCache, loadQueue, saveCache, saveQueue } from '../utils/offlineStorage';
import { executeOp, flushQueue, type OpResult, type SettleOutcome } from '../services/syncEngine';
import { useNetworkStatus } from '../hooks/use-network-status';
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
    query,
    orderBy,
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

export interface SyncStatusState {
    isOnline: boolean;
    pendingCount: number;
    isSyncing: boolean;
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
    syncStatus: SyncStatusState;
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

// Reintento automático de la cola mientras queden operaciones y la red no esté marcada como caída.
const RETRY_DELAY_MS = 15_000;

// Aviso al descartar una operación por un fallo permanente (sin «Reintentar»: ya no está en la cola).
const DROP_MESSAGES: Record<Op['type'], string> = {
    addItem: 'No se pudo guardar el deseo.',
    resolveItem: 'No se pudo actualizar el deseo.',
    deleteItem: 'No se pudo eliminar el deseo.',
    clearAll: 'No se pudo borrar todo.',
    addGoal: 'No se pudo crear la meta.',
    deleteGoal: 'No se pudo eliminar la meta.',
    allocateSavings: 'No se pudo asignar el ahorro.',
    setHourlyWage: 'No se pudo guardar el sueldo por hora.',
    setTheme: 'No se pudo cambiar el tema.',
};

// --- Operaciones confirmadas a la espera del eco del servidor -------------------------------
// Cuando una operación termina bien sale de la cola, pero el listener correspondiente puede
// tardar en traer el cambio (las transacciones no tienen compensación de latencia). Para que la
// vista no «parpadee» al estado anterior, la operación se sigue superponiendo hasta que llegue
// el eco del servidor.
//
// OJO: `applyOps` NO es idempotente frente a un eco parcial. Si `resolveItem` ya se ve en el
// documento de usuario (moneySaved sumado) pero el deseo sigue `waiting` en la vista de deseos,
// volver a superponerla suma el precio dos veces; `allocateSavings` resta/suma de nuevo siempre.
// Como el SDK entrega cada listener por separado (y React puede renderizar entre ambos), la
// operación deja de superponerse en cuanto CUALQUIERA de sus listeners entrega un snapshot real
// posterior a su ejecución: se prefiere un parpadeo breve de estado a un total erróneo. La misma
// regla se aplica a la operación que se está ejecutando (máscara `echoedInFlight`).
type Listener = 'user' | 'items' | 'goals';
type SnapshotGen = Record<Listener, number>;
interface SettledOp {
    op: QueuedOp;
    gen: SnapshotGen;
}

const INITIAL_GEN: SnapshotGen = { user: 0, items: 0, goals: 0 };

const echoListeners = (op: Op): Listener[] => {
    switch (op.type) {
        case 'addItem':
        case 'deleteItem':
            return ['items'];
        case 'addGoal':
        case 'deleteGoal':
            return ['goals'];
        case 'resolveItem':
            return ['user', 'items'];
        case 'allocateSavings':
            return ['user', 'goals'];
        case 'clearAll':
            return op.itemIds.length > 0 ? ['user', 'items'] : ['user'];
        case 'setHourlyWage':
        case 'setTheme':
            return ['user'];
    }
};

const isEchoed = (entry: SettledOp, gen: SnapshotGen) =>
    echoListeners(entry.op).some((listener) => gen[listener] > entry.gen[listener]);

// Operaciones que se superponen a la vista del servidor: las confirmadas sin eco y la cola,
// salvo la que se está ejecutando si ya ha llegado su eco (`echoedOpId`).
const overlayOps = (settled: SettledOp[], queue: QueuedOp[], echoedOpId: string | null): QueuedOp[] => [
    ...settled.map((entry) => entry.op),
    ...(echoedOpId === null ? queue : queue.filter((op) => op.opId !== echoedOpId)),
];

// --- Cola persistida -------------------------------------------------------------------------
const isRecord = (value: unknown): value is Record<string, any> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

// `loadQueue` solo comprueba `opId` y `type`; una operación con forma inesperada rompería la
// superposición durante el render, así que se descarta al hidratar.
function isWellFormedOp(op: QueuedOp): boolean {
    const o = op as unknown as Record<string, any>;
    if (!isFiniteNumber(o.createdAt)) return false;
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

// Las operaciones persistidas van antes que las creadas en memoria durante la hidratación; se
// quitan duplicados por `opId` y se ordena por `createdAt` (orden estable ante empates).
const mergeQueues = (persisted: QueuedOp[], inMemory: QueuedOp[]): QueuedOp[] => {
    const seen = new Set<string>();
    const merged: QueuedOp[] = [];
    for (const op of [...persisted, ...inMemory]) {
        if (seen.has(op.opId)) continue;
        seen.add(op.opId);
        merged.push(op);
    }
    return merged.sort((a, b) => a.createdAt - b.createdAt);
};

// Nunca lanza: se usa también desde `onSettled`, que no debe fallar.
const cancelNotification = async (notificationId: string) => {
    if (!Notifications) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
        console.warn('Error canceling notification:', error);
    }
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [newAchievementSignal, setNewAchievementSignal] = useState(0);

    // Última vista recibida del servidor (o de la caché local hasta que llegue la primera),
    // cola de operaciones pendientes y operaciones confirmadas a la espera de su eco.
    const [serverView, setServerView] = useState<SyncView>(EMPTY_VIEW);
    const [queue, setQueue] = useState<QueuedOp[]>([]);
    const [settled, setSettled] = useState<SettledOp[]>([]);
    const [echoedInFlight, setEchoedInFlight] = useState<string | null>(null);
    const [hasItemsLoaded, setHasItemsLoaded] = useState(false);
    const [hasUserDocLoaded, setHasUserDocLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const isOnline = useNetworkStatus() !== false;

    // Espejos síncronos del estado: los handlers y el motor de sincronización leen siempre de
    // aquí, así dos llamadas seguidas en el mismo tick se ven entre sí.
    const userRef = useRef<User | null>(null);
    const serverViewRef = useRef<SyncView>(EMPTY_VIEW);
    const queueRef = useRef<QueuedOp[]>([]);
    const settledRef = useRef<SettledOp[]>([]);
    // Operación en ejecución y, si ya llegó el eco de alguno de sus listeners, su opId.
    const inFlightRef = useRef<QueuedOp | null>(null);
    const echoedInFlightRef = useRef<string | null>(null);
    const mountedRef = useRef(false);
    const snapshotGenRef = useRef<SnapshotGen>(INITIAL_GEN);
    const isOnlineRef = useRef(isOnline);
    // Cada cambio de usuario abre una «sesión» nueva; los resultados asíncronos de otra sesión se ignoran.
    const sessionRef = useRef(0);
    const hydratedRef = useRef(false);
    // true cuando la vista del servidor ya parte de la caché local (o no había caché que conservar):
    // a partir de ahí se puede guardar la caché aunque algún listener todavía no haya respondido.
    const cacheBaselineRef = useRef(false);
    const hydrationRef = useRef<Promise<void>>(Promise.resolve());
    const flushPromiseRef = useRef<Promise<void> | null>(null);
    const flushAgainRef = useRef(false);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Las escrituras en AsyncStorage se encadenan para que lleguen en orden.
    const persistChainRef = useRef<Promise<void>>(Promise.resolve());

    const view = useMemo(
        () => applyOps(serverView, overlayOps(settled, queue, echoedInFlight)),
        [serverView, settled, queue, echoedInFlight],
    );

    const showNotice = useCallback((nextNotice: Notice) => {
        setNotice(nextNotice);
    }, []);

    const clearNotice = useCallback(() => {
        setNotice(null);
    }, []);

    const persist = useCallback((task: () => Promise<void>) => {
        persistChainRef.current = persistChainRef.current
            .then(task)
            .catch((error) => console.warn('[StoreContext] error al persistir', error));
    }, []);

    const commitServerView = useCallback((next: SyncView) => {
        serverViewRef.current = next;
        setServerView(next);
    }, []);

    const commitSettled = useCallback((next: SettledOp[]) => {
        settledRef.current = next;
        setSettled(next);
    }, []);

    const commitEchoedInFlight = useCallback((opId: string | null) => {
        if (echoedInFlightRef.current === opId) return;
        echoedInFlightRef.current = opId;
        setEchoedInFlight(opId);
    }, []);

    // Actualiza la cola en memoria y, una vez hidratada, la persiste para el usuario actual.
    const commitQueue = useCallback((next: QueuedOp[]) => {
        queueRef.current = next;
        setQueue(next);
        const uid = userRef.current?.uid;
        if (uid && hydratedRef.current) persist(() => saveQueue(uid, next));
    }, [persist]);

    const currentView = useCallback(
        () => applyOps(serverViewRef.current, overlayOps(settledRef.current, queueRef.current, echoedInFlightRef.current)),
        [],
    );

    const clearRetry = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    // Reproduce la cola contra Firestore. Single-flight: si ya hay un flush en curso, se marca
    // para repetir la pasada al terminar y se devuelve la misma promesa, así quien acaba de
    // encolar espera también a que se ejecute su operación.
    const flush = useCallback(function flushImpl(): Promise<void> {
        if (flushPromiseRef.current) {
            flushAgainRef.current = true;
            return flushPromiseRef.current;
        }

        const handleSettled = (op: QueuedOp, outcome: SettleOutcome, gen: SnapshotGen) => {
            if (outcome.status === 'dropped') {
                console.warn('[StoreContext] operación descartada', op.type, outcome.error);
                showNotice({ type: 'error', message: DROP_MESSAGES[op.type], autoHide: false });
                if (op.type === 'addItem' && op.item.notificationId) {
                    void cancelNotification(op.item.notificationId);
                }
                return;
            }

            const result = outcome.result as OpResult | undefined;
            let keepOverlay = true;
            if (op.type === 'resolveItem' && result?.type === 'resolveItem') {
                if (result.notificationId) void cancelNotification(result.notificationId);
                keepOverlay = result.applied;
                if (result.applied) {
                    if (result.earned.length > 0) {
                        setNewAchievementSignal((s) => s + 1);
                    } else {
                        showNotice({
                            type: 'success',
                            message: op.decision === 'save' ? '¡Ahorro sumado!' : 'Compra registrada.',
                            autoHide: true,
                        });
                    }
                }
            } else if (op.type === 'allocateSavings' && result?.type === 'allocateSavings' && result.insufficient) {
                keepOverlay = false;
                showNotice({ type: 'error', message: 'Fondos insuficientes.', autoHide: true });
            }

            const entry: SettledOp = { op, gen };
            if (keepOverlay && !isEchoed(entry, snapshotGenRef.current)) {
                commitSettled([...settledRef.current, entry]);
            }
        };

        const runPass = async () => {
            const currentUser = userRef.current;
            const session = sessionRef.current;
            if (!currentUser || !hydratedRef.current || !isOnlineRef.current) return;
            clearRetry();
            if (queueRef.current.length === 0) return;

            const uid = currentUser.uid;
            const isCurrent = () => sessionRef.current === session;
            // No se arma un reintento si el provider ya se desmontó o cambió la sesión mientras
            // el pase estaba en vuelo (el temporizador quedaría huérfano).
            const scheduleRetry = () => {
                if (!mountedRef.current || !isCurrent()) return;
                clearRetry();
                retryTimerRef.current = setTimeout(() => {
                    retryTimerRef.current = null;
                    void flushImpl();
                }, RETRY_DELAY_MS);
            };
            let execGen: SnapshotGen = snapshotGenRef.current;
            setIsSyncing(true);
            try {
                const outcome = await flushQueue({
                    peek: () => (isCurrent() ? queueRef.current[0] : undefined),
                    remove: (opId) => {
                        if (isCurrent()) {
                            commitQueue(queueRef.current.filter((op) => op.opId !== opId));
                        } else {
                            // La sesión cambió mientras se ejecutaba: se quita igualmente de la cola
                            // persistida de su usuario para no reproducirla dos veces.
                            persist(async () => {
                                const stored = await loadQueue(uid);
                                await saveQueue(uid, stored.filter((op) => op.opId !== opId));
                            });
                        }
                    },
                    execute: (op) => {
                        execGen = { ...snapshotGenRef.current };
                        inFlightRef.current = op;
                        return executeOp(db, uid, op);
                    },
                    onSettled: (op, outcome) => {
                        inFlightRef.current = null;
                        if (!isCurrent()) return;
                        commitEchoedInFlight(null);
                        try {
                            handleSettled(op, outcome, execGen);
                        } catch (error) {
                            console.warn('[StoreContext] error al procesar una operación', error);
                        }
                    },
                });
                if (outcome === 'offline') scheduleRetry();
            } catch (error) {
                console.warn('[StoreContext] error al sincronizar la cola', error);
                if (queueRef.current.length > 0) scheduleRetry();
            } finally {
                // Si la operación sigue en la cola (fallo transitorio), vuelve a superponerse.
                inFlightRef.current = null;
                if (isCurrent()) {
                    commitEchoedInFlight(null);
                    setIsSyncing(false);
                }
            }
        };

        const run = (async () => {
            try {
                do {
                    flushAgainRef.current = false;
                    await runPass();
                } while (flushAgainRef.current);
            } finally {
                flushPromiseRef.current = null;
            }
        })();
        flushPromiseRef.current = run;
        return run;
    }, [showNotice, commitQueue, commitSettled, commitEchoedInFlight, clearRetry, persist]);

    // Carga la caché y la cola persistidas del usuario. La caché solo se aplica si todavía no
    // ha llegado ningún snapshot real; la cola persistida se fusiona por delante de la de memoria.
    const startHydration = useCallback((uid: string, session: number) => {
        const hydration = (async () => {
            let cache: SyncView | null = null;
            let persisted: QueuedOp[] = [];
            try {
                [cache, persisted] = await Promise.all([loadCache(uid), loadQueue(uid)]);
            } catch (error) {
                console.warn('[StoreContext] error al hidratar', error);
            }
            if (sessionRef.current !== session) return;

            const gen = snapshotGenRef.current;
            if (!cache) {
                cacheBaselineRef.current = true;
            } else if (gen.user === 0 && gen.items === 0 && gen.goals === 0) {
                commitServerView({ ...EMPTY_VIEW, ...cache });
                cacheBaselineRef.current = true;
            }

            const valid = persisted.filter(isWellFormedOp);
            hydratedRef.current = true;
            if (valid.length > 0 || queueRef.current.length > 0 || valid.length !== persisted.length) {
                commitQueue(mergeQueues(valid, queueRef.current));
            }
        })();
        hydrationRef.current = hydration;
        void hydration.then(() => {
            if (sessionRef.current === session) return flush();
        });
    }, [commitServerView, commitQueue, flush]);

    // Vacía todo lo que pertenece al usuario anterior. El tema visible se conserva para que la
    // pantalla de login no cambie de aspecto al cerrar sesión (como antes).
    const resetSession = useCallback(() => {
        const displayedTheme = currentView().theme;
        sessionRef.current += 1;
        clearRetry();
        hydratedRef.current = false;
        cacheBaselineRef.current = false;
        hydrationRef.current = Promise.resolve();
        flushAgainRef.current = false;
        snapshotGenRef.current = INITIAL_GEN;
        inFlightRef.current = null;
        commitEchoedInFlight(null);
        commitServerView({ ...EMPTY_VIEW, theme: displayedTheme });
        queueRef.current = [];
        setQueue([]);
        commitSettled([]);
        setHasItemsLoaded(false);
        setHasUserDocLoaded(false);
        setIsSyncing(false);
        setNewAchievementSignal(0);
    }, [currentView, clearRetry, commitServerView, commitSettled, commitEchoedInFlight]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            const nextUid = currentUser?.uid ?? null;
            if (nextUid !== (userRef.current?.uid ?? null)) {
                resetSession();
                userRef.current = currentUser;
                if (currentUser) startHydration(currentUser.uid, sessionRef.current);
            } else {
                userRef.current = currentUser;
            }
            setUser(currentUser);
            setIsLoading(false);
            SplashScreen.hideAsync();
        });
        return unsubscribeAuth;
    }, [resetSession, startHydration]);

    useEffect(() => {
        if (!user) return;

        const uid = user.uid;
        const session = sessionRef.current;
        const userDocRef = doc(db, 'users', uid);

        // Fusiona en la vista del servidor los campos que trae un snapshot real y guarda la caché.
        // Para no pisar la caché guardada con valores por defecto, solo se escribe cuando la vista
        // ya parte de la caché local o cuando han respondido los tres listeners. (Un listener que
        // arrancó sin red puede no volver a emitir si los datos del servidor coinciden con su
        // snapshot vacío desde caché, así que no basta con esperar siempre a los tres.)
        const applyServerPatch = (listener: Listener, patch: Partial<SyncView>) => {
            if (sessionRef.current !== session) return;
            const gen = { ...snapshotGenRef.current, [listener]: snapshotGenRef.current[listener] + 1 };
            snapshotGenRef.current = gen;
            const next = { ...serverViewRef.current, ...patch };
            commitServerView(next);

            const remaining = settledRef.current.filter((entry) => !isEchoed(entry, gen));
            if (remaining.length !== settledRef.current.length) commitSettled(remaining);
            // Eco de la operación que aún se está ejecutando (p. ej. el commit de una transacción
            // llega al listener antes de que resuelva `runTransaction`): deja de superponerse.
            const inFlight = inFlightRef.current;
            if (inFlight && echoListeners(inFlight).includes(listener)) commitEchoedInFlight(inFlight.opId);

            if (cacheBaselineRef.current || (gen.user > 0 && gen.items > 0 && gen.goals > 0)) persist(() => saveCache(uid, next));
        };

        // Sin red, Firestore entrega snapshots desde su caché en memoria (vacía en un arranque en
        // frío). No son datos reales del servidor: se ignoran para no pisar la caché local.
        const isFromCache = (snap: { metadata?: { fromCache?: boolean } }) => snap.metadata?.fromCache === true;

        // Listen to user preferences (theme, stats)
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (isFromCache(docSnap)) return;
            if (docSnap.exists()) {
                const data = docSnap.data();
                applyServerPatch('user', {
                    moneySaved: data.moneySaved || 0,
                    moneySpent: data.moneySpent || 0,
                    theme: data.theme || 'light',
                    achievements: data.achievements || [],
                    savedCount: typeof data.savedCount === 'number' ? data.savedCount : null,
                    hourlyWage: typeof data.hourlyWage === 'number' ? data.hourlyWage : null,
                });

                // Ensure supportId is saved
                if (!data.supportId) {
                    const supportId = uid.slice(-6).toUpperCase();
                    updateDoc(userDocRef, { supportId });
                }
            } else {
                applyServerPatch('user', {
                    moneySaved: EMPTY_VIEW.moneySaved,
                    moneySpent: EMPTY_VIEW.moneySpent,
                    theme: EMPTY_VIEW.theme,
                    achievements: EMPTY_VIEW.achievements,
                    savedCount: EMPTY_VIEW.savedCount,
                    hourlyWage: EMPTY_VIEW.hourlyWage,
                });
                // Initialize user doc if not exists
                const supportId = uid.slice(-6).toUpperCase();
                setDoc(userDocRef, { moneySaved: 0, moneySpent: 0, theme: 'light', supportId }, { merge: true });
            }
            setHasUserDocLoaded(true);
        });

        // Listen to items subcollection
        const itemsCollection = collection(userDocRef, 'items');
        const q = query(itemsCollection, orderBy('createdAt', 'desc'));
        const unsubscribeItems = onSnapshot(q, (snapshot) => {
            if (isFromCache(snapshot)) return;
            const loadedItems: Item[] = [];
            snapshot.forEach((doc) => {
                loadedItems.push(doc.data() as Item);
            });
            applyServerPatch('items', { items: loadedItems });
            setHasItemsLoaded(true);
        });

        // Listen to goals subcollection
        const goalsCollection = collection(userDocRef, 'goals');
        const qGoals = query(goalsCollection, orderBy('createdAt', 'desc'));
        const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
            if (isFromCache(snapshot)) return;
            const loadedGoals: Goal[] = [];
            snapshot.forEach((doc) => {
                loadedGoals.push(doc.data() as Goal);
            });
            applyServerPatch('goals', { goals: loadedGoals });
        });

        return () => {
            unsubscribeUser();
            unsubscribeItems();
            unsubscribeGoals();
        };
    }, [user, commitServerView, commitSettled, commitEchoedInFlight, persist]);

    useEffect(() => {
        // Migración puntual de savedCount: solo con datos reales del servidor (nunca con la caché
        // ni con la superposición de la cola).
        if (!user || !hasItemsLoaded || !hasUserDocLoaded || serverView.savedCount !== null) return;
        const computedSavedCount = serverView.items.filter(i => i.status === 'saved').length;
        setDoc(doc(db, 'users', user.uid), { savedCount: computedSavedCount }, { merge: true });
        // Refleja en local el contador recién escrito en Firestore. La condición
        // `savedCount !== null` de arriba evita que el efecto se repita, así que no hay cascada.
        commitServerView({ ...serverViewRef.current, savedCount: computedSavedCount });
    }, [user, hasItemsLoaded, hasUserDocLoaded, serverView, commitServerView]);

    // Al recuperar la red se reproduce la cola (y se refresca el espejo usado por el motor).
    useEffect(() => {
        isOnlineRef.current = isOnline;
        if (isOnline) void flush();
    }, [isOnline, flush]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            clearRetry();
        };
    }, [clearRetry]);

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

    // Encola la operación (visible al instante gracias a la superposición), espera a que termine
    // la hidratación y la reproduce. Con red, la promesa se resuelve cuando ya se ha ejecutado.
    const dispatch = (op: Op): Promise<void> => {
        if (!userRef.current) return Promise.resolve();
        const now = currentTimeMs();
        const queued = { ...op, opId: createOpId(now), createdAt: now } as QueuedOp;
        commitQueue([...queueRef.current, queued]);
        return hydrationRef.current.then(() => flush());
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
        };

        // La notificación local se programa sin red; su id viaja con el deseo (si la operación
        // se descarta de forma permanente, se cancela al procesar el descarte).
        if (Platform.OS !== 'web' && Notifications) {
            try {
                const notificationId = await Notifications.scheduleNotificationAsync({
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
                // Firestore rechaza campos `undefined`: solo se añade si hay id.
                if (notificationId) newItem.notificationId = notificationId;
            } catch (error) {
                console.warn('Error scheduling notification:', error);
            }
        }

        await dispatch({ type: 'addItem', item: newItem });
    };

    const resolveItem = async (id: string, decision: 'buy' | 'save') => {
        if (!user) return;
        // Racha previa calculada ANTES de encolar, sobre la vista superpuesta: incluye las
        // resoluciones que aún esperan en la cola (también las de este mismo tick).
        const localView = currentView();
        const streakBefore = computeCurrentStreak(localView.items);
        const notificationId = localView.items.find((item) => item.id === id)?.notificationId;
        const done = dispatch({ type: 'resolveItem', itemId: id, decision, resolvedAt: currentTimeMs(), streakBefore });
        // Se cancela ya si se conoce en local; al reproducirse se vuelve a cancelar la que
        // devuelva el servidor (cancelar dos veces es inofensivo).
        if (notificationId) void cancelNotification(notificationId);
        await done;
    };

    const deleteItem = async (id: string) => {
        if (!user) return;
        const notificationId = currentView().items.find((item) => item.id === id)?.notificationId;
        const done = dispatch({ type: 'deleteItem', itemId: id });
        if (notificationId) void cancelNotification(notificationId);
        await done;
    };

    const clearAllData = async () => {
        // Caution: This deletes everything for the user in Firestore
        // For simplicity, we just reset stats and delete items one by one
        if (!user) return;
        const currentItems = currentView().items;
        const done = dispatch({ type: 'clearAll', itemIds: currentItems.map((item) => item.id) });
        for (const item of currentItems) {
            if (item.notificationId) await cancelNotification(item.notificationId);
        }
        await done;
    };

    const toggleTheme = async () => {
        if (!user) return;
        const newTheme: Theme = currentView().theme === 'light' ? 'dark' : 'light';
        await dispatch({ type: 'setTheme', theme: newTheme });
    };

    const setHourlyWage = async (wage: number | null) => {
        if (!user) return;
        if (wage !== null && (!Number.isFinite(wage) || wage <= 0 || wage > 100000)) {
            showNotice({ type: 'error', message: 'Sueldo por hora inválido.', autoHide: true });
            return;
        }
        await dispatch({ type: 'setHourlyWage', wage });
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
        const newGoal: Goal = {
            id: generateId(),
            name: cleanName,
            targetAmount,
            currentAmount: 0,
            icon,
            color,
            createdAt: currentTimeMs(),
        };
        await dispatch({ type: 'addGoal', goal: newGoal });
    };

    const deleteGoal = async (id: string) => {
        if (!user) return;
        await dispatch({ type: 'deleteGoal', goalId: id });
    };

    const allocateSavings = async (goalId: string, amount: number) => {
        if (!user) return;
        if (amount <= 0) {
            showNotice({ type: 'error', message: 'Monto inválido.', autoHide: true });
            return;
        }
        await dispatch({ type: 'allocateSavings', goalId, amount });
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
            items: view.items,
            moneySaved: view.moneySaved,
            moneySpent: view.moneySpent,
            user,
            theme: view.theme,
            hourlyWage: view.hourlyWage,
            isLoading,
            notice,
            showNotice,
            clearNotice,
            newAchievementSignal,
            syncStatus: { isOnline, pendingCount: queue.length, isSyncing },
            addItem,
            resolveItem,
            deleteItem,
            clearAllData,
            signIn,
            signUp,
            signOut,
            toggleTheme,
            setHourlyWage,
            goals: view.goals,
            userAchievements: view.achievements,
            addGoal,
            deleteGoal,
            allocateSavings
        }}>
            {children}
        </StoreContext.Provider>
    );
};
