# Really — Fase 0: Salud del Proyecto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el código de "Really" en un estado sano — sin código muerto, sin el bug del tema oscuro, con dependencias al día y un pipeline de CI — antes de construir ninguna feature nueva de producto.

**Architecture:** No se toca la arquitectura existente (Expo Router + Context API + Firebase Auth/Firestore). El trabajo es de higiene: eliminar boilerplate de Expo nunca limpiado, unificar la fuente de verdad del tema visual en el estado que ya expone `StoreContext` (en vez de leer el tema del sistema operativo pantalla por pantalla), actualizar el SDK de Expo/React Native, y añadir verificación automática con GitHub Actions.

**Tech Stack:** React Native 0.81→última, Expo SDK 54→última, Expo Router, TypeScript, Firebase (Auth/Firestore), Jest + `@testing-library/react-native`, GitHub Actions.

**Spec:** No existe un documento de spec separado. Este plan resume y ejecuta el análisis de código (estructura real del repo, historial git, inventario de dependencias/uso por archivo) e investigación de mercado realizados en esta conversación el 2026-09-27. El plan hace de spec y de plan a la vez para esta Fase 0.

## Global Constraints

- No modificar la lógica de negocio de `Really/context/StoreContext.tsx` — esta fase solo consume su API pública existente (`theme: 'light' | 'dark'`, `useStore()`).
- No tocar `Really/firebaseConfig.ts` ni `Really/firestore.rules` en esta fase.
- Ninguna pantalla debe cambiar de comportamiento visual salvo la corrección explícita del bug de tema oscuro (Task 3).
- Node 20 LTS como versión base para desarrollo local y CI.
- Cada task debe dejar `npx tsc --noEmit`, `npm run lint` y `npm test` en verde (ejecutados desde `Really/`) antes de pasar a la siguiente task.
- No arrancar ninguna feature de producto (coste en horas, Defense Rate, offline-first, dashboard avanzado — Fases 1-3) hasta que las 5 tasks de esta Fase 0 estén mergeadas.
- Código limpio: nombres de variables/funciones descriptivos (ya se sigue en el código existente — mantenerlo, no introducir abreviaturas nuevas), funciones pequeñas con una sola responsabilidad, sin lógica duplicada entre pantallas cuando el propio task ya centraliza algo (ej. Task 2 centraliza la resolución de color; no reintroducir lecturas de tema ad-hoc en Task 3).
- Comentarios: por defecto no se añaden. Solo se escribe un comentario cuando el motivo de una línea no es obvio leyendo el código (una decisión no evidente, una limitación de una librería, un valor mágico sin explicación) — nunca para describir qué hace el código línea a línea. No dejar comentarios de "código eliminado" ni marcar cambios con referencias a este plan o a esta tarea.

## Review Focus

- Pantallas montadas antes de que `StoreProvider` resuelva el `theme` real (usuario nuevo sin documento en Firestore todavía) deben caer a `'light'` por defecto sin lanzar error — cubierto por el primer test de `use-theme-color.test.ts` en Task 2, que corre contra el mock de Firestore con `exists: () => false`.
- Los tests ya existentes (`ItemCard.test.tsx`, `StoreContext.test.tsx`) no deben empezar a fallar por "useStore must be used within a StoreProvider" al cambiar `useThemeColor` para depender del contexto — cubierto explícitamente en el Step 5 de Task 2.
- Borrar boilerplate no debe eliminar por error un archivo con un consumidor real oculto — cubierto por correr `tsc --noEmit` + `lint` + `test` completos (no solo `grep`) después de cada borrado en Task 1 y Task 2.
- El upgrade de Expo SDK (Task 4) no debe romper paquetes sensibles a versión exacta (`expo-notifications`, `react-native-reanimated`, `react-native-worklets`) — cubierto por el diagnóstico `expo-doctor` antes/después y por correr el suite de tests completo tras el upgrade.
- El workflow de CI (Task 5) debe apuntar al subdirectorio correcto: el proyecto Node vive en `Really/`, no en la raíz del repo — un workflow mal configurado pasaría en verde sin ejecutar nada real. Cubierto por `defaults.run.working-directory: Really` y por el Step 3 de Task 5, que ejecuta en local exactamente los comandos que correrá GitHub Actions.

---

### Task 1: Baseline y limpieza de boilerplate de Expo sin usar

**Files:**
- Delete: `Really/app/(tabs)/_layout.tsx`
- Delete: `Really/app/(tabs)/index.tsx`
- Delete: `Really/app/(tabs)/explore.tsx`
- Delete: `Really/app/modal.tsx`
- Delete: `Really/components/hello-wave.tsx`
- Delete: `Really/components/external-link.tsx`
- Delete: `Really/components/haptic-tab.tsx`
- Delete: `Really/components/parallax-scroll-view.tsx`
- Delete: `Really/components/themed-view.tsx`
- Delete: `Really/components/ui/collapsible.tsx`
- Delete: `Really/components/ui/icon-symbol.tsx`
- Delete: `Really/components/ui/icon-symbol.ios.tsx`
- Delete: `Really/assets/images/react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png`, `partial-react-logo.png`
- Delete: `package-lock.json` (huérfano en la raíz del repo, sin `package.json` que lo acompañe)

**Interfaces:**
- Consumes: nada — es la primera task.
- Produces: un árbol de archivos sin ninguna referencia a las pantallas/ejemplo de `create-expo-app`. Las tasks siguientes (2 y 3) dependen de que estos archivos ya no existan para poder borrar `constants/theme.ts` y `hooks/use-color-scheme*.ts` sin dejar imports rotos.

- [ ] **Step 1: Confirmar el baseline antes de tocar nada**

Run: `cd Really && npm install`

Run: `npx tsc --noEmit`
Expected: anota el resultado tal cual (probablemente sin errores); es tu punto de comparación para los siguientes steps.

Run: `npm run lint && npm test`
Expected: `lint` sin errores; `npm test` en PASS con 2 suites (`ItemCard.test.tsx`, `StoreContext.test.tsx`).

- [ ] **Step 2: Borrar el árbol `(tabs)` y `modal.tsx`**

```bash
git rm -r "Really/app/(tabs)" Really/app/modal.tsx
```

- [ ] **Step 3: Borrar los componentes exclusivos del boilerplate**

```bash
git rm Really/components/hello-wave.tsx \
       Really/components/external-link.tsx \
       Really/components/haptic-tab.tsx \
       Really/components/parallax-scroll-view.tsx \
       Really/components/themed-view.tsx \
       Really/components/ui/collapsible.tsx \
       Really/components/ui/icon-symbol.tsx \
       Really/components/ui/icon-symbol.ios.tsx
```

- [ ] **Step 4: Borrar assets sin uso real y el lockfile huérfano de la raíz**

```bash
git rm Really/assets/images/react-logo.png \
       Really/assets/images/react-logo@2x.png \
       Really/assets/images/react-logo@3x.png \
       Really/assets/images/partial-react-logo.png
git rm package-lock.json
```

- [ ] **Step 5: Verificar que nada quedó roto**

Run: `cd Really && npx tsc --noEmit`
Expected: mismo resultado que el Step 1 (sin errores nuevos por imports faltantes — `themed-view.tsx`, `constants/theme.ts` y `hooks/use-color-scheme*.ts` siguen existiendo todavía y siguen siendo válidos en este punto).

Run: `npm run lint && npm test`
Expected: sin errores nuevos de lint; los mismos 2 suites de tests en PASS (no dependen de nada del boilerplate borrado).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove unused Expo boilerplate and orphan root lockfile"
```

---

### Task 2: Unificar el theming en la fuente de verdad de la app

**Files:**
- Create: `Really/test-utils/renderWithStore.tsx`
- Create: `Really/hooks/__tests__/use-theme-color.test.tsx`
- Modify: `Really/hooks/use-theme-color.ts`
- Modify: `Really/components/__tests__/ItemCard.test.tsx`
- Delete: `Really/constants/theme.ts`
- Delete: `Really/hooks/use-color-scheme.ts`
- Delete: `Really/hooks/use-color-scheme.web.ts`

**Interfaces:**
- Consumes: `StoreProvider` / `useStore()` de `Really/context/StoreContext.tsx` (ya existente, expone `theme: 'light' | 'dark'`).
- Produces: `useThemeColor(props, colorName)` — misma firma pública que antes, pero ahora resuelta contra `@/constants/Colors` y `useStore().theme` en vez de contra `@/constants/theme` y el `useColorScheme()` del sistema operativo. También produce `renderWithStore(ui)`, un helper de test reutilizable por cualquier test futuro que necesite montar un componente dentro de `StoreProvider` con Firebase mockeado — Task 3 no lo necesita, pero queda disponible para las Fases 1-3.

- [ ] **Step 1: Crear el helper de test `renderWithStore`**

Create `Really/test-utils/renderWithStore.tsx`:

```tsx
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
    doc: jest.fn(),
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

export function renderWithStore(ui: React.ReactElement) {
    return render(<StoreProvider>{ui}</StoreProvider>);
}

export { StoreProvider };
```

Nota: este archivo no tiene ningún `test()` propio. Los `jest.mock(...)` que contiene se hoistean al principio del módulo (Babel + `jest-expo`), así que se registran en cuanto cualquier test lo importa — antes de que `StoreProvider` llegue a requerir el Firebase real.

- [ ] **Step 2: Escribir el test que falla para `useThemeColor`**

Create `Really/hooks/__tests__/use-theme-color.test.tsx`:

```tsx
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useThemeColor } from '../use-theme-color';
import { StoreProvider } from '../../test-utils/renderWithStore';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StoreProvider>{children}</StoreProvider>
);

describe('useThemeColor', () => {
    it('devuelve el color "light" de constants/Colors cuando no hay override de props', () => {
        const { result } = renderHook(() => useThemeColor({}, 'primary'), { wrapper });
        expect(result.current).toBe('#6C5CE7');
    });

    it('prioriza el color pasado por props sobre el de constants/Colors', () => {
        const { result } = renderHook(
            () => useThemeColor({ light: '#123456', dark: '#654321' }, 'primary'),
            { wrapper }
        );
        expect(result.current).toBe('#123456');
    });
});
```

Run: `cd Really && npx jest hooks/__tests__/use-theme-color.test.tsx`
Expected: **FAIL**. Hoy `use-theme-color.ts` resuelve `colorName` contra `Colors` de `constants/theme.ts`, que no tiene una clave `primary` — el primer test recibe `undefined` en vez de `'#6C5CE7'`.

- [ ] **Step 3: Implementar el cambio mínimo en `use-theme-color.ts`**

Modify `Really/hooks/use-theme-color.ts` — reemplazar todo el contenido por:

```ts
import { Colors } from '@/constants/Colors';
import { useStore } from '@/context/StoreContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { theme } = useStore();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `cd Really && npx jest hooks/__tests__/use-theme-color.test.tsx`
Expected: **PASS** (2 tests).

- [ ] **Step 5: Arreglar `ItemCard.test.tsx`, que ahora rompe por falta de `StoreProvider`**

`ItemCard` usa `ThemedText`, que ahora llama a `useThemeColor` → `useStore()`, que lanza si no hay `StoreProvider` en el árbol.

Run primero para confirmarlo: `cd Really && npx jest components/__tests__/ItemCard.test.tsx`
Expected: **FAIL** con el error `useStore must be used within a StoreProvider`.

Modify `Really/components/__tests__/ItemCard.test.tsx` — reemplazar todo el contenido por:

```tsx
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithStore } from '../../test-utils/renderWithStore';
import { ItemCard } from '../ItemCard';
import { Item } from '../../context/StoreContext';

const mockItem: Item = {
    id: '1',
    name: 'Test Item',
    price: 100,
    createdAt: Date.now(),
    unlockAt: Date.now() + 10000, // Future
    status: 'waiting',
    category: 'Test',
};

describe('ItemCard', () => {
    it('renders item details correctly', () => {
        const { getByText } = renderWithStore(
            <ItemCard item={mockItem} onResolve={() => { }} onDelete={() => { }} />
        );

        expect(getByText('Test Item')).toBeTruthy();
        expect(getByText('$100.00')).toBeTruthy();
    });

    it('shows buy/save buttons when ready', () => {
        const readyItem: Item = {
            ...mockItem,
            unlockAt: Date.now() - 1000, // Past
        };

        const { getByText } = renderWithStore(
            <ItemCard item={readyItem} onResolve={() => { }} onDelete={() => { }} />
        );

        expect(getByText('¡Es hora de decidir!')).toBeTruthy();
        expect(getByText('Comprar')).toBeTruthy();
        expect(getByText('Ahorrar')).toBeTruthy();
    });

    it('calls onResolve when buttons are pressed', () => {
        const readyItem: Item = {
            ...mockItem,
            unlockAt: Date.now() - 1000, // Past
        };
        const onResolveMock = jest.fn();

        const { getByText } = renderWithStore(
            <ItemCard item={readyItem} onResolve={onResolveMock} onDelete={() => { }} />
        );

        fireEvent.press(getByText('Comprar'));
        expect(onResolveMock).toHaveBeenCalledWith('1', 'buy');

        fireEvent.press(getByText('Ahorrar'));
        expect(onResolveMock).toHaveBeenCalledWith('1', 'save');
    });
});
```

- [ ] **Step 6: Confirmar que todo el suite pasa**

Run: `cd Really && npm test`
Expected: **PASS** — 3 suites (`ItemCard`, `StoreContext`, `use-theme-color`).

- [ ] **Step 7: Borrar lo que quedó huérfano**

`constants/theme.ts` solo lo importaban `app/(tabs)/_layout.tsx`, `app/(tabs)/explore.tsx`, `components/ui/collapsible.tsx` (borrados en Task 1) y `hooks/use-theme-color.ts` (arreglado en el Step 3). `hooks/use-color-scheme.ts` / `.web.ts` solo los importaban esos mismos archivos borrados más `use-theme-color.ts`. Ambos quedan sin ningún consumidor real.

```bash
git rm Really/constants/theme.ts Really/hooks/use-color-scheme.ts Really/hooks/use-color-scheme.web.ts
```

Run: `cd Really && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: unify theme resolution on StoreContext instead of OS color scheme"
```

---

### Task 3: Migrar pantallas restantes al tema unificado (fix del bug de Ajustes)

**Files:**
- Create: `Really/__tests__/theme-consistency.test.ts`
- Modify: `Really/app/add.tsx`
- Modify: `Really/app/goals.tsx`
- Modify: `Really/app/history.tsx`
- Modify: `Really/app/onboarding.tsx`
- Modify: `Really/app/stats.tsx`
- Modify: `Really/app/settings.tsx`
- Modify: `Really/components/ThemedButton.tsx`

**Interfaces:**
- Consumes: `theme: Theme` de `useStore()` (de `context/StoreContext.tsx`, sin cambios — ya lo produce Task 2 como fuente de verdad única).
- Produces: ninguna API nueva. El contrato "el switch de tema oscuro de Ajustes cambia visualmente todas las pantallas, no solo Home/Login" queda garantizado por el test de este task, que corre en CI (Task 5) para siempre.

- [ ] **Step 1: Escribir el test de regresión que falla**

Create `Really/__tests__/theme-consistency.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const FILES_THAT_MUST_NOT_USE_OS_COLOR_SCHEME = [
    'app/add.tsx',
    'app/goals.tsx',
    'app/history.tsx',
    'app/onboarding.tsx',
    'app/stats.tsx',
    'app/settings.tsx',
    'components/ThemedButton.tsx',
];

describe('consistencia del tema en toda la app', () => {
    it.each(FILES_THAT_MUST_NOT_USE_OS_COLOR_SCHEME)(
        '%s no debe derivar AppTheme de useColorScheme() del sistema operativo',
        (relativePath) => {
            const source = fs.readFileSync(
                path.join(__dirname, '..', relativePath),
                'utf-8'
            );
            expect(source).not.toMatch(/useColorScheme\(\)/);
        }
    );
});
```

Run: `cd Really && npx jest __tests__/theme-consistency.test.ts`
Expected: **FAIL** en los 7 casos — hoy los 7 archivos llaman a `useColorScheme()`.

- [ ] **Step 2: Migrar `app/history.tsx` (el más simple, sirve de plantilla)**

Modify `Really/app/history.tsx`. Cambiar:

```tsx
import { View, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
```

por:

```tsx
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
```

Y cambiar:

```tsx
    const colorScheme = useColorScheme() ?? 'light';
    const AppTheme = Colors[colorScheme];
```

por:

```tsx
    const { theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];
```

(se mantiene el nombre de variable `colorScheme` a propósito para no tener que tocar el resto del archivo, que ya lo usa en el JSX).

- [ ] **Step 3: Migrar `app/add.tsx`, `app/goals.tsx` y `app/stats.tsx` con el mismo patrón**

En cada uno de los tres archivos:
1. Quitar `useColorScheme` del import de `'react-native'`.
2. Borrar la línea `const colorScheme = useColorScheme() ?? 'light';`.
3. Añadir `theme: colorScheme` a la desestructuración de `useStore()` que el archivo ya tiene (ej. en `add.tsx`, que ya hace `const { addItem } = useStore();`, pasa a ser `const { addItem, theme: colorScheme } = useStore();`; en `goals.tsx`, `const { goals, addGoal, deleteGoal, allocateSavings, moneySaved } = useStore();` pasa a incluir `theme: colorScheme`; en `stats.tsx`, `const { items, moneySaved, moneySpent } = useStore();` igual).

La línea `const AppTheme = Colors[colorScheme];` no cambia en ninguno de los tres.

- [ ] **Step 4: Migrar `app/onboarding.tsx` (dos usos: el subcomponente `Slide` y la pantalla principal)**

Modify `Really/app/onboarding.tsx`:
1. Añadir el import: `import { useStore } from '../context/StoreContext';`
2. Quitar `useColorScheme` del import de `'react-native'`.
3. En el subcomponente `Slide` (línea 35-37 actual), cambiar:

```tsx
const Slide = ({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: SharedValue<number> }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const AppTheme = Colors[colorScheme];
```

por:

```tsx
const Slide = ({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: SharedValue<number> }) => {
    const { theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];
```

4. En `OnboardingScreen` (línea 85-86 actual), el mismo cambio: reemplazar `const colorScheme = useColorScheme() ?? 'light';` por `const { theme: colorScheme } = useStore();` (esta función ya tiene otras variables locales — solo se añade esta línea, no hace falta desestructurar nada más de `useStore()` porque `onboarding.tsx` no lo usaba antes).

- [ ] **Step 5: Migrar `app/settings.tsx` — aquí está el bug visible que reportó el usuario**

Modify `Really/app/settings.tsx`. Cambiar:

```tsx
    const { clearAllData, toggleTheme, signOut, user } = useStore();
    const colorScheme = useColorScheme() ?? 'light';
    const AppTheme = Colors[colorScheme];

    const isDark = colorScheme === 'dark';
```

por:

```tsx
    const { clearAllData, toggleTheme, signOut, user, theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];

    const isDark = colorScheme === 'dark';
```

Y quitar `useColorScheme` del import de `'react-native'`.

Con esto, `isDark` (usado por el `<Switch value={isDark} onValueChange={toggleTheme} />`) refleja el valor real guardado en Firestore en vez del tema del sistema operativo — el switch deja de aparecer desincronizado respecto a lo que `toggleTheme` cambia de verdad.

- [ ] **Step 6: Migrar `components/ThemedButton.tsx`**

Modify `Really/components/ThemedButton.tsx`. Quitar estas dos líneas del bloque de imports:

```tsx
import { useColorScheme } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
```

(la segunda ya era un import muerto — nunca se llamaba). Añadir:

```tsx
import { useStore } from '@/context/StoreContext';
```

Y cambiar:

```tsx
    const scale = useSharedValue(1);
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
```

por:

```tsx
    const scale = useSharedValue(1);
    const { theme: colorScheme } = useStore();
    const theme = Colors[colorScheme];
```

- [ ] **Step 7: Confirmar que el test de regresión pasa y que nada más se rompió**

Run: `cd Really && npx jest __tests__/theme-consistency.test.ts`
Expected: **PASS** (7/7).

Run: `cd Really && npm test`
Expected: **PASS** — 4 suites (`ItemCard`, `StoreContext`, `use-theme-color`, `theme-consistency`).

Run: `cd Really && npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: make dark mode toggle apply to every screen, not just Home/Login"
```

---

### Task 4: Actualizar el SDK de Expo/React Native

**Files:**
- Modify: `Really/package.json`
- Modify: `Really/package-lock.json`

**Interfaces:**
- Consumes: el suite de tests de las Tasks 2-3 (`ItemCard`, `StoreContext`, `use-theme-color`, `theme-consistency`) como red de seguridad para detectar regresiones del upgrade.
- Produces: la base de dependencias vigente sobre la que se construirán las features de producto de las Fases 1-3.

- [ ] **Step 1: Diagnóstico antes de tocar nada**

Run: `cd Really && npx expo-doctor`
Expected: anota cualquier aviso existente (puede que ya haya alguno por ir 3 SDKs por detrás) — es tu punto de comparación para el Step 4.

- [ ] **Step 2: Actualizar el SDK de Expo y alinear el resto de paquetes gestionados**

Run: `cd Really && npx expo install expo@latest`
Run: `cd Really && npx expo install --fix`

Esto reescribe `package.json`/`package-lock.json` alineando cada paquete gestionado por Expo (`react`, `react-native`, `expo-router`, `expo-notifications`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, etc.) a las versiones que exige el nuevo SDK.

- [ ] **Step 3: Reinstalar limpio**

Run: `cd Really && rm -rf node_modules && npm install`

- [ ] **Step 4: Verificar salud post-upgrade**

Run: `cd Really && npx expo-doctor`
Expected: sin avisos nuevos respecto al Step 1 (si aparece alguno nuevo, revisarlo antes de continuar — no ignorarlo).

- [ ] **Step 5: Confirmar que nada se rompió**

Run: `cd Really && npx tsc --noEmit`
Run: `cd Really && npm run lint`
Run: `cd Really && npm test`
Expected: los 4 suites de test siguen en **PASS**, sin errores de tipo ni de lint.

- [ ] **Step 6: Smoke test manual**

Esto no es automatizable dentro de este plan — requiere un simulador/dispositivo real:

Run: `cd Really && npx expo start`

Verificar a mano: la app arranca, el login funciona, se puede añadir un ítem nuevo y el contador de espera corre, el switch de tema oscuro en Ajustes cambia visualmente todas las pantallas (confirmación visual del fix de Task 3).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: upgrade Expo SDK and aligned dependencies to latest"
```

---

### Task 5: CI/CD con GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: los scripts `npm run lint`, `npm test` y `npx tsc --noEmit`, ya validados manualmente en las 4 tasks anteriores.
- Produces: un pipeline verde/rojo visible en cada push y PR — la señal de "salud del proyecto" que protege el trabajo de las Fases 1-3.

- [ ] **Step 1: Crear el workflow**

Create `.github/workflows/ci.yml` (en la raíz del repo, no dentro de `Really/` — GitHub solo lee workflows desde `.github/workflows` en la raíz):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

defaults:
  run:
    working-directory: Really

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: Really/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test -- --ci
```

- [ ] **Step 2: Validar que el YAML es sintácticamente correcto**

Run (desde la raíz del repo): `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: sin excepción — el YAML parsea correctamente.

- [ ] **Step 3: Validar que los comandos del workflow funcionan tal cual están escritos**

Run: `cd Really && npm ci && npx tsc --noEmit && npm run lint && npm test -- --ci`
Expected: los cuatro comandos terminan en éxito, en ese orden — exactamente como los ejecutará GitHub Actions.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline for typecheck, lint and tests"
```

- [ ] **Step 5: Push y verificar en GitHub**

Paso manual, fuera del alcance de este entorno local: hacer push de la rama, abrir el PR y confirmar que el workflow "CI" aparece y termina en verde.

---

## Después de la Fase 0

Con estas 5 tasks mergeadas, el proyecto queda en un estado limpio y protegido por CI para empezar la Fase 1 (features diferenciadoras: coste en horas de trabajo, Defense Rate, cooldown configurable por categoría, cuestionario de reflexión al añadir un ítem). Cada una de esas features merece su propio plan — son un subsistema de producto independiente de esta limpieza, y se planificarán por separado cuando arranque esa fase.
