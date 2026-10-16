# Arquitectura offline-first Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Really funcione sin conexión (arranque en frío incluido): los datos se leen de una caché local y todas las acciones del usuario se guardan en una cola persistente que se reproduce contra Firestore al volver la red.

**Architecture:** Patrón *outbox*. Toda mutación del `StoreContext` pasa a ser una `Op` serializable que se añade a una cola persistida en AsyncStorage y se muestra al instante mediante una *superposición* pura (`applyOps(vistaServidor, cola)`). Un motor de sincronización (`services/syncEngine.ts`) reproduce la cola en orden FIFO (single-flight): las transacciones (`resolveItem`, `allocateSavings`) releen el estado del servidor al reproducirse, así que los contadores se suman bien y el guard `status === 'waiting'` evita resolver dos veces. La última vista recibida del servidor se cachea en AsyncStorage por usuario para arrancar sin red.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, Firebase JS SDK 12 (Firestore sin persistencia propia en RN), `@react-native-async-storage/async-storage` (ya instalado), `@react-native-community/netinfo` (nuevo), Jest + `@testing-library/react-native`.

**Spec:** GitHub issue #9 «Fase 1 · Arquitectura offline-first» (franciscorodalf/Really). Decisión de arquitectura (opción A: caché + cola sobre AsyncStorage) confirmada por el usuario en el chat.

## Global Constraints

- Todo el texto visible, mensajes de commit y descripciones de PR en **español**.
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; la PR termina con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **No se tocan `firestore.rules` ni el modelo de datos de Firestore.** Las rutas y campos son exactamente los actuales: `users/{uid}` (`moneySaved`, `moneySpent`, `theme`, `supportId`, `achievements`, `savedCount`, `hourlyWage`), `users/{uid}/items/{id}`, `users/{uid}/goals/{id}`.
- Cada `ThemedText` con `fontSize` propio lleva `lineHeight` explícito (el tipo por defecto hereda `lineHeight: 24`).
- Prohibido `Date.now()` / `Math.random()` durante el render (usar los helpers a nivel de módulo o `useState(() => …)`). `react-hooks/set-state-in-effect` está activo en CI.
- Puertas de calidad antes de cada commit de código: `npx tsc --noEmit`, `npm run lint`, `npm test`.
- `npm run lint` pasa a cubrir también `services` (Task 4).
- Tras instalar dependencias: regenerar el lockfile con `npx npm@10 install --package-lock-only` y comprobar que `npm ci` (npm 10) funciona (CI usa Node 20 / npm 10; npm 11 deja el lockfile desincronizado).
- Prefijo de claves de AsyncStorage: `really:` (versionadas `v1`).
- Valores fijos: timeout de escritura de Firestore 10 000 ms; reintento automático de la cola cada 15 000 ms mientras queden operaciones y la red no esté marcada como caída.
- La API pública de `useStore()` se mantiene (todos los campos y firmas actuales) y solo se **añade** `syncStatus`.

## Review Focus

Cada línea lleva su test en la tarea indicada.

1. Arranque en frío sin red: la caché se hidrata y la cola pendiente se conserva y se reanuda (Task 6).
2. Dos resoluciones en el mismo tick estando offline: la racha de la segunda cuenta la primera (Task 6).
3. Resolver dos veces el mismo deseo (p. ej. desde otro dispositivo): el servidor lo ignora y la reproducción no muestra error ni duplica contadores (Tasks 2, 4 y 6).
4. Operación rechazada de forma permanente (`permission-denied`) durante la reproducción: se descarta con aviso y la cola sigue avanzando, sin bucle infinito (Tasks 4 y 6).
5. `allocateSavings` reproducido sin fondos en el servidor: se descarta con el aviso «Fondos insuficientes.» (Tasks 4 y 6).
6. JSON corrupto o de forma inesperada en AsyncStorage: se ignora sin romper el arranque (Task 3).
7. Cambio de cuenta: la cola y la caché van por `uid`; no se mezclan entre usuarios (Tasks 3 y 6).
8. Una escritura de Firestore que se queda colgada sin red (`setDoc` no rechaza) cuenta como fallo transitorio y la operación sigue en cola (Task 4).

## File Structure

- Create `context/types.ts` — `Item`, `Goal`, `Achievement`, `Theme`, `ACHIEVEMENTS` (movidos desde `StoreContext.tsx`, que los reexporta).
- Create `utils/achievementRules.ts` — regla pura de logros al ahorrar (extraída de `resolveItem`).
- Create `utils/offlineOps.ts` — tipos `Op`/`QueuedOp`/`SyncView` y superposición pura `applyOps`.
- Create `utils/offlineStorage.ts` — caché y cola persistidas en AsyncStorage.
- Create `services/syncEngine.ts` — `executeOp`, `classifyError`, `flushQueue`.
- Create `hooks/use-network-status.ts` — estado de red con NetInfo.
- Create `components/SyncStatus.tsx` — indicador «Sin conexión · N cambios pendientes».
- Modify `context/StoreContext.tsx` — outbox, hidratación, superposición, flush, `syncStatus`.
- Modify `jest.setup.js`, `package.json`, `package-lock.json`, `app/index.tsx`, `__tests__/theme-consistency.test.ts`, `README.md`.

---

### Task 1: Extraer tipos/logros y reglas de logro puras

**Files:**
- Create: `context/types.ts`, `utils/achievementRules.ts`
- Modify: `context/StoreContext.tsx` (importa y reexporta; sin cambio de comportamiento)
- Test: `utils/__tests__/achievementRules.test.ts`

**Interfaces:**
- Produces:
  - `context/types.ts`: `export interface Item`, `Goal`, `Achievement`; `export type Theme = 'light' | 'dark'`; `export const ACHIEVEMENTS: Achievement[]` — contenido idéntico al actual de `StoreContext.tsx`. `StoreContext.tsx` hace `export { ACHIEVEMENTS } from './types'` y `export type { Item, Goal, Achievement, Theme } from './types'` para que ningún import existente cambie.
  - `utils/achievementRules.ts`: `export function awardSaveAchievements(input: { current: string[]; newSaved: number; newSavedCount: number; newStreak: number }): { achievements: string[]; earned: string[] }` — `achievements` es `current` más los ids nuevos (sin duplicados, orden de la lista de reglas); `earned` son los **títulos** (campo `title` de `ACHIEVEMENTS`) de los recién ganados, en el mismo orden.

- [ ] **Step 1: Escribir los tests de `awardSaveAchievements`** en `utils/__tests__/achievementRules.test.ts`:
  - `otorga first_save en el primer ahorro`: `{current: [], newSaved: 10, newSavedCount: 1, newStreak: 1}` → `achievements` `['first_save']`, `earned` `['Primer Ahorro']`.
  - `no repite logros ya conseguidos`: `current: ['first_save']` con los mismos valores → `earned` `[]`.
  - `umbrales de dinero`: `newSaved: 1000, newSavedCount: 2, newStreak: 1`, `current: ['first_save']` → `earned` `['Ahorrador Novato','Buen Comienzo','Gran Ahorrador']`.
  - `saver_10 con 10 ahorros`: `newSavedCount: 10`, `current: ['first_save']`, `newSaved: 1` → `earned` `['Coleccionista']`.
  - `rachas de golpe`: `{current: ['first_save'], newSaved: 1, newSavedCount: 2, newStreak: 10}` → `earned` `['Racha de Defensa','Disciplina de Hierro','Inquebrantable']` y `achievements` sin duplicados.
  - `no muta la entrada`: `current` queda igual tras la llamada.
- [ ] **Step 2: Ejecutar** `npx jest utils/__tests__/achievementRules.test.ts` → falla (módulo inexistente).
- [ ] **Step 3: Crear `context/types.ts`** moviendo `Item`, `Goal`, `Achievement`, `Theme`, `ACHIEVEMENTS` tal cual desde `StoreContext.tsx`, y reexportarlos desde ahí.
- [ ] **Step 4: Implementar `awardSaveAchievements`** en `utils/achievementRules.ts` con una tabla de reglas `{ id, test(input) }` en el orden: `first_save` (siempre), `saver_10` (`newSavedCount >= 10`), `saver_100/200/1000/2000/5000/10000` (`newSaved >=` umbral), `streak_3/5/10` (`newStreak >=` umbral). Los títulos se resuelven con `ACHIEVEMENTS.find(a => a.id === id)!.title`.
- [ ] **Step 5: Sustituir** en `resolveItem` (rama `save`) el bloque de `if (...) { newAchievements.push(...) }` por una llamada a `awardSaveAchievements`; el resto del método no cambia.
- [ ] **Step 6: Verificar** `npx tsc --noEmit && npm run lint && npm test` → todo en verde (los tests existentes de `StoreContext` demuestran que no hay cambio de comportamiento).
- [ ] **Step 7: Commit** `refactor: extraer tipos y reglas de logros de StoreContext`.

---

### Task 2: Superposición pura de operaciones (`applyOps`)

**Files:**
- Create: `utils/offlineOps.ts`
- Test: `utils/__tests__/offlineOps.test.ts`

**Interfaces:**
- Consumes: `Item`, `Goal`, `Theme` de `context/types.ts`.
- Produces (todo en `utils/offlineOps.ts`):
```ts
export interface SyncView {
  items: Item[]; goals: Goal[];
  moneySaved: number; moneySpent: number; savedCount: number | null;
  achievements: string[]; theme: Theme; hourlyWage: number | null;
}
export type Op =
  | { type: 'addItem'; item: Item }
  | { type: 'resolveItem'; itemId: string; decision: 'buy' | 'save'; resolvedAt: number; streakBefore: number }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'clearAll'; itemIds: string[] }
  | { type: 'addGoal'; goal: Goal }
  | { type: 'deleteGoal'; goalId: string }
  | { type: 'allocateSavings'; goalId: string; amount: number }
  | { type: 'setHourlyWage'; wage: number | null }
  | { type: 'setTheme'; theme: Theme };
export type QueuedOp = Op & { opId: string; createdAt: number };
export const EMPTY_VIEW: SyncView; // items [], goals [], 0, 0, savedCount null, achievements [], 'light', null
export function applyOps(view: SyncView, ops: QueuedOp[]): SyncView; // pura, no muta, aplica en orden
export function createOpId(now: number): string; // `${now}-${random base36 de 6}`
```
- Reglas de `applyOps` (reflejan lo que hará el servidor; las operaciones son idempotentes frente a una vista que ya las contiene):
  - `addItem`/`addGoal`: si el id ya existe se ignora; si no, se inserta y la lista queda ordenada por `createdAt` descendente.
  - `resolveItem`: solo actúa si el deseo existe y está `waiting`. `save` → `status 'saved'`, `resolvedAt`, `moneySaved += price`, `savedCount += 1` (si `savedCount !== null`). `buy` → `status 'bought'`, `resolvedAt`, `moneySpent += price`.
  - `deleteItem`/`deleteGoal`: filtran por id (idempotente).
  - `clearAll`: `moneySaved = 0`, `moneySpent = 0`, elimina los `itemIds`.
  - `allocateSavings`: ignora si la meta no existe o `moneySaved < amount`; si no, `goal.currentAmount += amount`, `moneySaved -= amount`.
  - `setHourlyWage` / `setTheme`: asignan.
  - Los logros no se superponen (los decide el servidor al reproducir).

- [ ] **Step 1: Escribir los tests** (un `makeItem`/`makeGoal` auxiliar con `Partial`):
  - `addItem inserta ordenado por createdAt descendente` y `addItem ignora ids ya presentes`.
  - `resolveItem save suma ahorro y contador` (items `waiting` price 40, `savedCount: 2` → `moneySaved +40`, `savedCount 3`, status `saved`, `resolvedAt`).
  - `resolveItem save con savedCount null lo deja en null`.
  - `resolveItem buy suma gasto y no toca savedCount`.
  - `resolveItem sobre un deseo ya resuelto no cambia nada` (Review Focus 3: el servidor ya lo tiene resuelto → sin doble conteo).
  - `resolveItem sobre un deseo inexistente no cambia nada`.
  - `deleteItem y deleteGoal son idempotentes`.
  - `clearAll pone los totales a 0 y quita los deseos indicados`.
  - `allocateSavings mueve dinero a la meta` y `allocateSavings sin fondos no cambia nada`.
  - `setHourlyWage y setTheme asignan`.
  - `aplica las operaciones en orden` (add + resolve del mismo deseo en una sola lista).
  - `no muta la vista de entrada` (`Object.freeze` profundo de la entrada o comparación con copia previa).
  - `createOpId devuelve ids distintos para llamadas consecutivas`.
- [ ] **Step 2: Ejecutar** `npx jest utils/__tests__/offlineOps.test.ts` → falla.
- [ ] **Step 3: Implementar** `utils/offlineOps.ts` según la interfaz de arriba (`applyOps` como `reduce` con una función `applyOne` por tipo; `createOpId` usa `Math.random` — es un helper de módulo invocado solo desde handlers).
- [ ] **Step 4: Ejecutar** los tests → verde; después `npx tsc --noEmit && npm run lint && npm test`.
- [ ] **Step 5: Commit** `feat: añadir la superposición pura de operaciones offline`.

---

### Task 3: Persistencia local (caché y cola)

**Files:**
- Create: `utils/offlineStorage.ts`
- Modify: `jest.setup.js` (mock global de AsyncStorage)
- Test: `utils/__tests__/offlineStorage.test.ts`

**Interfaces:**
- Consumes: `SyncView`, `QueuedOp`, `EMPTY_VIEW` de `utils/offlineOps.ts`.
- Produces (`utils/offlineStorage.ts`):
```ts
export const cacheKey = (uid: string) => `really:cache:v1:${uid}`;
export const queueKey = (uid: string) => `really:queue:v1:${uid}`;
export async function loadCache(uid: string): Promise<SyncView | null>;
export async function saveCache(uid: string, view: SyncView): Promise<void>;
export async function loadQueue(uid: string): Promise<QueuedOp[]>;
export async function saveQueue(uid: string, ops: QueuedOp[]): Promise<void>;
```
  Nunca lanzan: los errores de AsyncStorage se registran con `console.warn` y se devuelve `null` / `[]` / se ignora la escritura. Una caché o cola con JSON inválido, forma inesperada (`items`/`goals` no son arrays, la cola no es un array, un elemento sin `opId`/`type`) devuelve `null` / `[]` (se descartan los elementos inválidos de la cola, no toda la cola).

- [ ] **Step 1: En `jest.setup.js`** añadir `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));` y un `afterEach` global que llame `require('@react-native-async-storage/async-storage').clear()` si existe, para aislar tests.
- [ ] **Step 2: Escribir los tests**:
  - `saveCache/loadCache hacen ida y vuelta` con una vista completa.
  - `loadCache devuelve null si no hay nada`.
  - `loadCache ignora JSON corrupto` (`AsyncStorage.setItem(cacheKey('u'), '{no json')`) (Review Focus 6).
  - `loadCache ignora una vista con forma inesperada` (`{"items": 3}`).
  - `saveQueue/loadQueue hacen ida y vuelta conservando el orden`.
  - `loadQueue descarta elementos inválidos y conserva los válidos`.
  - `loadQueue devuelve [] si el JSON no es un array`.
  - `las claves van separadas por uid` (guardar para `a` y `b`; cada uno lee lo suyo) (Review Focus 7).
  - `un fallo de AsyncStorage no lanza` (`AsyncStorage.setItem.mockRejectedValueOnce`; `saveQueue` resuelve; `getItem` rechazado → `loadQueue` devuelve `[]`).
- [ ] **Step 3: Ejecutar** `npx jest utils/__tests__/offlineStorage.test.ts` → falla.
- [ ] **Step 4: Implementar** `utils/offlineStorage.ts`; la validación de forma es una función local `isSyncView` / `isQueuedOp` (comprobaciones de tipo básicas, sin librería).
- [ ] **Step 5: Verificar** `npx tsc --noEmit && npm run lint && npm test` (comprobar que el mock global no rompe los tests existentes).
- [ ] **Step 6: Commit** `feat: persistir la caché y la cola de operaciones en AsyncStorage`.

---

### Task 4: Motor de sincronización

**Files:**
- Create: `services/syncEngine.ts`
- Modify: `package.json` (script `lint` pasa a `expo lint app components context utils hooks services test-utils`)
- Test: `services/__tests__/syncEngine.test.ts`

**Interfaces:**
- Consumes: `QueuedOp` (Task 2), `awardSaveAchievements` (Task 1), `Item`/`Goal` de `context/types.ts`, `computeCurrentStreak` no se usa aquí (la racha llega en `streakBefore`).
- Produces (`services/syncEngine.ts`):
```ts
import type { Firestore } from 'firebase/firestore';
export type OpResult =
  | { type: 'resolveItem'; earned: string[]; notificationId: string | null; applied: boolean }
  | { type: 'allocateSavings'; insufficient: boolean }
  | { type: 'other' };
export const WRITE_TIMEOUT_MS = 10_000;
export function classifyError(error: unknown): 'transient' | 'permanent';
export async function executeOp(db: Firestore, uid: string, op: QueuedOp): Promise<OpResult>;
export type SettleOutcome =
  | { status: 'done'; result: OpResult }
  | { status: 'dropped'; error: unknown };
export async function flushQueue(args: {
  peek: () => QueuedOp | undefined;
  remove: (opId: string) => void;
  execute: (op: QueuedOp) => Promise<OpResult>;
  onSettled: (op: QueuedOp, outcome: SettleOutcome) => void;
}): Promise<'drained' | 'offline'>;
```
- Comportamiento:
  - `classifyError`: `'transient'` si `error.code` ∈ `unavailable`, `network-request-failed`, `deadline-exceeded`, o `error.message` contiene `offline`; en otro caso `'permanent'`.
  - `executeOp` por tipo (rutas exactas del modelo actual): `addItem` → `setDoc(users/uid/items/item.id, item)`; `deleteItem` → `deleteDoc`; `addGoal` → `setDoc(goals/…)`; `deleteGoal` → `deleteDoc`; `setHourlyWage` → `updateDoc(users/uid, {hourlyWage: wage})`; `setTheme` → `updateDoc(users/uid, {theme})`; `clearAll` → `updateDoc(users/uid, {moneySaved: 0, moneySpent: 0})` y luego `deleteDoc` de cada `itemIds`. Todas las escrituras no transaccionales van envueltas en `withTimeout(promise, WRITE_TIMEOUT_MS)`: si vence, lanza un error con `code: 'unavailable'` (el SDK web no rechaza `setDoc` sin red, se queda colgado).
  - `resolveItem`: la misma `runTransaction` que hoy (lee deseo y usuario; si el deseo no existe o `status !== 'waiting'` → `{type:'resolveItem', earned: [], notificationId: null, applied: false}`; rama `save` usa `awardSaveAchievements({ current, newSaved, newSavedCount, newStreak: op.streakBefore + 1 })` y escribe `status`/`resolvedAt` en el deseo y `moneySaved`/`savedCount`/`achievements` en el usuario con `{merge:true}`; rama `buy` actualiza `moneySpent`), devolviendo `applied: true`, `earned` y `item.notificationId`.
  - `allocateSavings`: la misma transacción que hoy (`insufficient: true` si `moneySaved < amount`).
  - `flushQueue`: bucle `while (op = peek())`; `execute` ok → `remove` + `onSettled(done)`; error `transient` → devuelve `'offline'` sin quitar la operación; error `permanent` → `remove` + `onSettled(dropped)` y sigue; cuando `peek()` es `undefined` devuelve `'drained'`.

- [ ] **Step 1: Escribir los tests** (`firebase/firestore` mockeado como en `context/__tests__/StoreContext.test.tsx`; `jest.useFakeTimers()` para el timeout):
  - `classifyError`: `unavailable`, `network-request-failed`, `deadline-exceeded` y mensaje «Failed to get document because the client is offline.» → `transient`; `permission-denied` y un `Error` sin código → `permanent`.
  - `executeOp addItem` llama `setDoc` con el item; `deleteItem` llama `deleteDoc`; `setHourlyWage` y `setTheme` llaman `updateDoc` con el payload exacto; `clearAll` pone totales a 0 y borra cada id.
  - `executeOp: una escritura colgada acaba como error transitorio` (`setDoc` devuelve `new Promise(() => {})`, avanzar `WRITE_TIMEOUT_MS`; el error resultante se clasifica `transient`) (Review Focus 8).
  - `executeOp resolveItem save`: transacción simulada con deseo `waiting` y usuario `{moneySaved: 90, savedCount: 0, achievements: []}`, `streakBefore: 2`, precio 10 → escribe `moneySaved 100`, `savedCount 1`, logros `first_save`, `saver_100`, `streak_3`; `earned` los títulos; `notificationId` del deseo.
  - `executeOp resolveItem sobre un deseo ya resuelto` → `applied: false`, sin `transaction.update/set` (Review Focus 3).
  - `executeOp resolveItem buy` suma `moneySpent` y no concede logros.
  - `executeOp allocateSavings` con fondos suficientes escribe meta y usuario; sin fondos → `insufficient: true` sin escribir (Review Focus 5).
  - `flushQueue`: drena en orden FIFO; se detiene con `'offline'` en el primer error transitorio dejando la operación en la cola y sin ejecutar las siguientes; descarta una operación con error permanente, llama `onSettled(dropped)` y continúa con la siguiente (Review Focus 4); acepta operaciones añadidas mientras corre (el `peek` devuelve una nueva tras la primera).
- [ ] **Step 2: Ejecutar** `npx jest services/__tests__/syncEngine.test.ts` → falla.
- [ ] **Step 3: Implementar** `services/syncEngine.ts` según la interfaz, moviendo literalmente la lógica de las transacciones de `StoreContext.tsx` (no se borra aún del contexto: eso es la Task 6).
- [ ] **Step 4: Actualizar el script `lint`** en `package.json`.
- [ ] **Step 5: Verificar** `npx tsc --noEmit && npm run lint && npm test`.
- [ ] **Step 6: Commit** `feat: añadir el motor de sincronización de la cola offline`.

---

### Task 5: Estado de red (NetInfo)

**Files:**
- Create: `hooks/use-network-status.ts`
- Modify: `package.json`, `package-lock.json`, `jest.setup.js`
- Test: `hooks/__tests__/use-network-status.test.ts`

**Interfaces:**
- Produces: `export function useNetworkStatus(): boolean | null` — `null` hasta conocer el estado; `true` si `isConnected !== false && isInternetReachable !== false`; `false` en otro caso. Se suscribe con `NetInfo.addEventListener` y limpia al desmontar.

- [ ] **Step 1: Instalar** `npx expo install @react-native-community/netinfo`; regenerar con `npx npm@10 install --package-lock-only` y comprobar `npm ci` en un directorio limpio de comprobación (por ejemplo `npm ci --dry-run` o una copia temporal en el scratchpad).
- [ ] **Step 2: En `jest.setup.js`** añadir `jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));`.
- [ ] **Step 3: Escribir los tests** con el mock de NetInfo: `devuelve null antes de la primera lectura`, `true con conexión`, `false con isConnected false`, `false con isInternetReachable false`, `se actualiza cuando cambia la red`, `cancela la suscripción al desmontar`.
- [ ] **Step 4: Ejecutar** el test → falla; **implementar** `useNetworkStatus` (estado inicial `null`, `useEffect` con `addEventListener` que llama `setState` desde el callback — nunca de forma síncrona en el cuerpo del efecto).
- [ ] **Step 5: Verificar** `npx tsc --noEmit && npm run lint && npm test`.
- [ ] **Step 6: Commit** `feat: detectar el estado de la red con NetInfo`.

---

### Task 6: Integración en `StoreContext` (outbox, hidratación, superposición)

**Files:**
- Modify: `context/StoreContext.tsx`, `test-utils/renderWithStore.tsx` (solo si hace falta para el mock de red)
- Test: `context/__tests__/StoreContext.test.tsx` (los 15 tests actuales se adaptan, sin perder aserciones) y `context/__tests__/StoreContext.offline.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `applyOps`, `createOpId`, `EMPTY_VIEW`, `Op`, `QueuedOp`, `SyncView` (Task 2); `loadCache/saveCache/loadQueue/saveQueue` (Task 3); `executeOp`, `flushQueue`, `classifyError`, `OpResult` (Task 4); `useNetworkStatus` (Task 5); `computeCurrentStreak`.
- Produces: en `useStore()` el campo nuevo `syncStatus: { isOnline: boolean; pendingCount: number; isSyncing: boolean }` (`isOnline` es `true` cuando `useNetworkStatus()` es `null` o `true`). Todo lo demás conserva su firma.

Diseño del contexto:
- Estado del servidor: `serverView: SyncView` (state) con espejo síncrono `serverViewRef`; cola: `queue: QueuedOp[]` (state) con espejo síncrono `queueRef`. Valores expuestos (`items`, `goals`, `moneySaved`, `moneySpent`, `theme`, `hourlyWage`, `userAchievements`) salen de `useMemo(() => applyOps(serverView, queue))`. Los tres `onSnapshot` actualizan `serverView` (fusionando por campos), con `hasItemsLoaded` solo cuando llega un snapshot real de deseos.
- Hidratación: al haber `user`, se cargan `loadCache(uid)` y `loadQueue(uid)`; la caché solo se aplica si todavía no ha llegado ningún snapshot real de ese usuario; la cola cargada se **fusiona** (por `opId`) con la que ya exista en `queueRef`. El efecto de migración de `savedCount` y la escritura de caché usan siempre la vista del servidor, nunca la superposición.
- Caché: cada cambio de `serverView` provocado por un snapshot real se guarda con `saveCache`. La cola se guarda con `saveQueue` en cada cambio.
- `dispatch(op)`: crea `QueuedOp` (`opId: createOpId(now)`), la añade a `queueRef` + estado, persiste y llama a `flush()`; `await`-ea el flush para que los handlers existentes sigan resolviéndose cuando la operación se ha ejecutado con red.
- Validaciones y avisos de entrada (`Escribe un nombre.`, `Precio inválido.`, etc.) se quedan en cada handler **antes** de `dispatch`, con los textos actuales.
- `addItem`: programa la notificación local como hoy (funciona sin red) y guarda su id en el `Item`; si se cancela porque la operación se descarta de forma permanente, se cancela la notificación.
- `resolveItem`: calcula `streakBefore = computeCurrentStreak(applyOps(serverViewRef.current, queueRef.current).items)` **antes** de encolar (sustituye a `pendingResolutionsRef`, que se elimina); cancela de inmediato la notificación del deseo si se conoce en local.
- `deleteItem`, `clearAllData`, `toggleTheme`, `setHourlyWage`, `addGoal`, `deleteGoal`, `allocateSavings` → `dispatch` con la `Op` correspondiente (`clearAllData` cancela las notificaciones locales y encola `clearAll` con los ids actuales).
- `flush()` (single-flight con `flushingRef`): si `isOnline === false` o no hay `user`, no hace nada; en otro caso `flushQueue({ peek: () => queueRef.current[0], remove, execute: (op) => executeOp(db, user.uid, op), onSettled })`. `onSettled`: `done` + `resolveItem` con `earned.length > 0` → `setNewAchievementSignal(s => s + 1)`; con `earned` vacío y `applied` → aviso `¡Ahorro sumado!` / `Compra registrada.` (como hoy); `applied: false` → sin aviso; si `result.notificationId` → cancelar la notificación; `allocateSavings` con `insufficient` → aviso `Fondos insuficientes.`; `dropped` → aviso de error con el mensaje actual de cada acción (`No se pudo actualizar el deseo.`, etc., sin botón Reintentar) y, si era `addItem`, cancelar su notificación. Resultado `'offline'` → programar un reintento a los `15 000 ms` (`setTimeout` guardado en ref y limpiado al desmontar o al vaciarse la cola).
- Disparadores de `flush`: tras hidratar, tras cada `dispatch`, cuando `isOnline` pasa de `false` a `true`, y el reintento temporizado.
- `onAuthStateChanged` sin usuario: además de lo actual, vacía `serverView`, `queue`, refs y cancela el reintento. Los avisos «offline» antiguos (`showOfflineNotice`/`hasOfflineNotice`) se eliminan: el estado offline lo comunica `syncStatus` (Task 7); `clearNotice` se simplifica en consecuencia.

- [ ] **Step 1: Adaptar la suite existente** a la nueva arquitectura sin borrar aserciones: los mocks de `runTransaction` pasan a invocarse desde `executeOp` (mismo mock global); `await act(async () => { await result.current.resolveItem(...) })` sigue valiendo porque `dispatch` espera al flush. Ajustar las expectativas de `setDoc/updateDoc` si el payload cambia de forma observable (no debería).
- [ ] **Step 2: Escribir los tests nuevos** en `StoreContext.offline.test.tsx` (AsyncStorage mockeado; `useNetworkStatus` mockeado con `jest.mock('../../hooks/use-network-status')` para controlar `true/false`):
  - `arranque en frío sin red: muestra los datos de la caché` (cache con 2 deseos y `moneySaved 50` → `items.length 2`, `moneySaved 50`, sin snapshots reales) (Review Focus 1).
  - `arranque en frío sin red: reanuda la cola persistida` (cola con un `addItem` en AsyncStorage → aparece en `items` y `syncStatus.pendingCount 1`) (Review Focus 1).
  - `sin red, addItem aparece al instante y queda en la cola` (`isOnline false`: `setDoc` no se llama; `items` contiene el deseo; `pendingCount 1`).
  - `al volver la red se reproduce la cola en orden` (cambiar el mock de red a `true` y re-renderizar → `setDoc` llamado con el deseo y `pendingCount 0`).
  - `sin red, resolver dos deseos seguidos cuenta la racha en cadena` (dos `resolveItem` en el mismo `act` con tres ahorros previos → la segunda op lleva `streakBefore` +1; al reproducir se concede `streak_5`) (Review Focus 2).
  - `sin red, resolver actualiza la vista al instante` (`moneySaved` sube y el deseo pasa a `saved`).
  - `un fallo permanente descarta la operación y avisa` (`runTransaction` rechaza con `{code:'permission-denied'}` → `notice.type 'error'`, cola vacía, la vista vuelve al estado del servidor) (Review Focus 4).
  - `un fallo transitorio mantiene la operación en la cola` (`{code:'unavailable'}` → `pendingCount 1`, sin aviso de error).
  - `allocateSavings reproducido sin fondos avisa Fondos insuficientes.` (Review Focus 5).
  - `resolver un deseo que el servidor ya tenía resuelto no avisa ni suma` (transacción devuelve `applied:false`) (Review Focus 3).
  - `la caché y la cola van por uid`: cola/caché de otro uid no aparecen para `test-user` (Review Focus 7).
  - `cerrar sesión vacía la vista y la cola en memoria`.
  - `la caché solo se escribe con snapshots reales, no con la superposición`.
- [ ] **Step 3: Ejecutar** la suite → falla donde corresponde.
- [ ] **Step 4: Refactorizar `StoreContext.tsx`** según el diseño de arriba; eliminar del contexto las transacciones ya movidas a `services/syncEngine.ts`, `pendingResolutionsRef`, `showOfflineNotice`, `hasOfflineNotice` e `isOfflineError`.
- [ ] **Step 5: Ejecutar** `npx tsc --noEmit && npm run lint && npm test` → todo en verde (incluidos los 15 tests previos adaptados).
- [ ] **Step 6: Commit** `feat: pasar StoreContext a una cola de operaciones con caché local`.

---

### Task 7: Indicador de sincronización, documentación y verificación

**Files:**
- Create: `components/SyncStatus.tsx`
- Modify: `app/index.tsx`, `__tests__/theme-consistency.test.ts`, `README.md`
- Test: `components/__tests__/SyncStatus.test.tsx`

**Interfaces:**
- Consumes: `syncStatus` de `useStore()` (Task 6).
- Produces: `export default function SyncStatus()` — sin props, lee `useStore()`. Render:
  - `isOnline` y `pendingCount === 0` → `null`.
  - `!isOnline` → pastilla con icono `cloud-offline-outline` y texto `Sin conexión` (si `pendingCount > 0`: `Sin conexión · 1 cambio pendiente` / `Sin conexión · N cambios pendientes`).
  - `isOnline` y `pendingCount > 0` → icono `sync-outline` y `Sincronizando · N cambios` (`1 cambio`).
  - Todos los `ThemedText` con `fontSize` propio llevan `lineHeight` explícito; colores desde el tema (modo claro y oscuro legibles).

- [ ] **Step 1: Escribir los tests** de `SyncStatus` (`renderWithStore` con red mockeada): `no renderiza nada con red y sin pendientes`, `muestra «Sin conexión» sin pendientes`, `pluraliza los pendientes sin conexión`, `muestra «Sincronizando · 1 cambio» con red y una operación pendiente`. Añadir `SyncStatus` a la lista de `__tests__/theme-consistency.test.ts`.
- [ ] **Step 2: Ejecutar** → falla; **implementar** `components/SyncStatus.tsx`.
- [ ] **Step 3: Montar** `<SyncStatus />` en `app/index.tsx` bajo la cabecera, antes del bloque de estadísticas, centrado, con margen vertical pequeño.
- [ ] **Step 4: Documentar** en `README.md` una sección «Arquitectura offline-first» (qué se cachea, cómo funciona la cola, estrategia de conflictos, límites conocidos: escrituras *at-least-once* — una caída entre el commit de `allocateSavings` y el borrado de la operación de la cola podría reproducirla dos veces; la caché de un usuario permanece en el dispositivo tras cerrar sesión; sin resolución multi-dispositivo más allá de «gana el servidor»).
- [ ] **Step 5: Verificar** `npx tsc --noEmit && npm run lint && npm test`.
- [ ] **Step 6: Commit** `feat: mostrar el estado de sincronización y documentar la arquitectura offline`.
