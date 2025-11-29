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
  <img src="./Really/assets/images/showcase.png" alt="Really App Showcase" width="100%" style="border-radius: 16px; margin: 2rem 0;" />
</div>

Una aplicación minimalista y estética para evitar compras impulsivas.

## Concepto

Cuando quieras comprar algo, regístralo en **Really**. La app iniciará una cuenta regresiva (tú decides cuánto tiempo, desde minutos hasta días). Al finalizar, te preguntará: "¿Realmente lo quieres?".

- Si la respuesta es **NO**: El precio se suma a tu "Dinero Ahorrado".
- Si la respuesta es **SÍ**: Se marca como comprado y se suma a "Dinero Gastado".

## Características

### 🎨 Diseño & Experiencia
- **Diseño Aesthetic**: Interfaz limpia, moderna y minimalista.
- **Tema Oscuro/Claro**: Se adapta automáticamente a tu preferencia o puedes cambiarlo manualmente.
- **Animaciones**: Transiciones suaves y feedback visual.

### ⚡ Funcionalidad
- **Temporizador Flexible**: Elige esperar desde 1 minuto hasta 60 días.
- **Historial**: Revisa todas tus decisiones pasadas (compras y ahorros).
- **Estadísticas**: Visualiza cuánto has ahorrado y cuánto has gastado.
- **Notificaciones**: Te avisamos cuando es hora de decidir.

### ☁️ Nube & Seguridad (Firebase)
- **Sincronización**: Tus datos se guardan en la nube (Firestore), accesibles desde cualquier dispositivo.
- **Autenticación Segura**: Registro y Login con Email/Contraseña.
- **Seguridad**:
    - Requisitos de contraseña fuerte (Mínimo 8 caracteres, mayúscula, número, símbolo).
    - Protección contra inyección de código en todos los campos de texto.

## Tecnologías

- **Frontend**: React Native con Expo (Managed Workflow), TypeScript, Expo Router.
- **Backend**: Firebase (Auth & Firestore).
- **Estado**: Context API.

## Cómo empezar

1.  Instala las dependencias:
    ```bash
    npm install
    ```

2.  Inicia la aplicación:
    ```bash
    npx expo start
    ```

3.  Escanea el código QR con tu móvil (usando Expo Go) o ejecuta en un simulador.

## Estructura del Proyecto

- `app/`: Pantallas y navegación (Expo Router).
- `components/`: Componentes reutilizables (ItemCard, etc.).
- `context/`: Lógica de estado global y conexión con Firebase.
- `firebaseConfig.ts`: Configuración de Firebase.
