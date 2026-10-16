<div align="center">
  <img src="./Really/assets/images/icon.png" alt="Really Logo" width="120" height="120" style="border-radius: 24px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);" />
  <h1 style="font-size: 3rem; margin-top: 1rem;">Really</h1>
  <p style="font-size: 1.2rem; color: #666;"><strong>Stop Impulse Buying. Start Saving.</strong></p>

  [![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
  [![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
</div>

<div align="center">
  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
    <img src="./Really/assets/images/paginaInicial.png" alt="Página Inicial" width="22%" style="border-radius: 16px;" />
    <img src="./Really/assets/images/NuevoDeseo.png" alt="Nuevo Deseo" width="22%" style="border-radius: 16px;" />
    <img src="./Really/assets/images/Logros.png" alt="Logros" width="22%" style="border-radius: 16px;" />
    <img src="./Really/assets/images/Ajustes.png" alt="Ajustes" width="22%" style="border-radius: 16px;" />
  </div>
</div>

Una aplicación minimalista y estética diseñada para combatir las compras impulsivas mediante la psicología de la "espera obligatoria".

## 💡 Concepto

Cuando quieras comprar algo, regístralo en **Really**. La app iniciará una cuenta regresiva (tú decides cuánto tiempo, desde minutos hasta días). Al finalizar, te preguntará: "¿Realmente lo quieres?".

- Si la respuesta es **NO**: El precio se suma a tu "Dinero Ahorrado".
- Si la respuesta es **SÍ**: Se marca como comprado y se suma a "Dinero Gastado".

## ✨ Características Principales

### 🚀 Experiencia de Usuario (UX)
- **Onboarding Interactivo**: Guía de bienvenida para nuevos usuarios explicando la filosofía "Añadir -> Esperar -> Decidir".
- **Diseño Premium**: Interfaz limpia con soporte nativo para **Modo Oscuro/Claro**.
- **Gestión Intuitiva**:
    - Borrado de ítems erróneos directamente desde la tarjeta.
    - Acceso rápido al historial desde la pantalla principal.
    - Fecha y hora exacta de creación en cada deseo.

### 📊 Análisis Financiero Avanzado
- **Calendario de Actividad**: Visualiza tus días de gasto vs. ahorro con un calendario interactivo.
- **Estadísticas Detalladas**:
    - Gráficos de barras comparativos.
    - **Récords**: Descubre cuál ha sido tu mayor ahorro y tu mayor gasto.
    - **Promedios**: Analiza tu comportamiento medio por ítem.
- **Categorías Visuales**: Organiza tus deseos con iconos y colores personalizados.
- **Navegación Fluida**: Pestañas para alternar instantáneamente entre vistas de "Ahorrado" y "Gastado".

### 🏆 Gamificación y Metas
- **Metas de Ahorro**: Crea objetivos personalizados (ej. "Viaje a Japón") y asigna tus ahorros disponibles para ver tu progreso.
- **Sistema de Logros**: Desbloquea medallas y títulos (como "Coleccionista" o "Leyenda") a medida que ahorras más dinero y deseos.
- **Feedback Visual**: Barras de progreso animadas y celebraciones al desbloquear logros.

### 🛡️ Soporte y Seguridad
- **ID de Soporte Único**: Generación de un código de soporte basado en el UID para facilitar la asistencia técnica sin comprometer datos sensibles.
- **Copia al Portapapeles**: Facilidad para compartir el ID de soporte.

### ☁️ Nube & Tecnología
- **Sincronización en Tiempo Real**: Datos guardados en Firestore.
- **Notificaciones Locales**: Avisos cuando un deseo está listo para ser decidido.
- **Autenticación Robusta**: Login seguro con validación de contraseñas fuertes.

## 🛠️ Tecnologías

- **Core**: React Native, Expo (Managed Workflow), TypeScript.
- **Navegación**: Expo Router v3.
- **Backend**: Firebase (Auth & Firestore).
- **Componentes Clave**:
    - `react-native-calendars`: Para la visualización de actividad.
    - `expo-clipboard`: Para funcionalidades de soporte.
    - `@react-native-async-storage`: Para persistencia local de preferencias (Onboarding).

## 🚀 Cómo empezar

1.  Instala las dependencias:
    ```bash
    npm install
    ```

2.  Inicia la aplicación:
    ```bash
    npx expo start
    ```

3.  Escanea el código QR con tu móvil (usando Expo Go) o ejecuta en un simulador.

## 🔌 Arquitectura offline-first

La app sigue funcionando sin red: las acciones del usuario se aplican al instante en pantalla y se sincronizan con Firestore cuando vuelve la conexión.

**Qué se cachea.** Por usuario, en `AsyncStorage` (`really:cache:v1:<uid>`): deseos, metas, dinero ahorrado y gastado, contador de ahorros, logros, tema y sueldo por hora. Al arrancar se pinta la caché de inmediato y el listener de Firestore la va refrescando con cada instantánea del servidor.

**Cola de operaciones (outbox).** Cada acción (`addItem`, `resolveItem`, `deleteItem`, `clearAll`, `addGoal`, `deleteGoal`, `allocateSavings`, `setHourlyWage`, `setTheme`) se guarda como una operación con `opId` único en una cola persistente (`really:queue:v1:<uid>`). La interfaz muestra la última vista del servidor con las operaciones pendientes superpuestas (`applyOps`, pura e idempotente), por lo que el resultado es inmediato aunque no haya red. Al detectar conexión (NetInfo) el motor (`services/syncEngine.ts`) reproduce la cola en orden: un error transitorio (`unavailable`, sin red, tiempo de espera de 10 s) detiene el vaciado y se reintenta después; un error permanente descarta esa operación y se avisa al usuario. El componente `SyncStatus` de la pantalla principal muestra «Sin conexión» o «Sincronizando · N cambios» mientras haya algo pendiente.

**Estrategia de conflictos.** Las operaciones que tocan totales (`resolveItem`, `allocateSavings`) se ejecutan en una transacción de Firestore que lee el estado actual del servidor y recalcula los importes, en lugar de enviar valores calculados en el dispositivo. `resolveItem` además tiene una guarda de estado: solo se aplica si el deseo sigue en `waiting`, así que resolverlo dos veces (o desde otro dispositivo) no suma dos veces. `allocateSavings` se rechaza si el ahorro disponible ya no alcanza. En el resto de casos gana el servidor.

**Límites conocidos.**
- Las escrituras son *at-least-once*: una caída entre el commit de `allocateSavings` y el borrado de la operación de la cola podría reproducirla dos veces.
- La caché de un usuario permanece en el dispositivo tras cerrar sesión.
- No hay resolución multi-dispositivo más allá de «gana el servidor».
- Un listener que solo emite instantáneas de caché puede mantener datos obsoletos hasta su siguiente cambio (mejora futura: `includeMetadataChanges`).
- El orden de la cola usa el reloj del dispositivo (`createdAt`), por lo que un reloj desajustado puede alterar el orden relativo de las operaciones.

## 📂 Estructura del Proyecto

- `app/`: Pantallas y rutas (incluye `stats.tsx`, `onboarding.tsx`, `history.tsx`).
- `components/`: Componentes UI reutilizables (`ItemCard`, `SyncStatus`).
- `services/`: Motor de sincronización offline (`syncEngine`).
- `context/`: Estado global (`StoreContext`) y lógica de negocio.
- `assets/`: Imágenes e iconos personalizados.
