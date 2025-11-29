import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StoreProvider } from '../context/StoreContext';

SplashScreen.preventAutoHideAsync();
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#fff',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Really',
            headerLargeTitle: true,
          }}
        />
        <Stack.Screen
          name="add"
          options={{
            title: 'Add Item',
            presentation: 'modal',
          }}
        />
      </Stack>
    </StoreProvider>
  );
}
