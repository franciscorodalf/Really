import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useCallback } from 'react';
import { StoreProvider, useStore } from '../context/StoreContext';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NoticeBanner } from '../components/NoticeBanner';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <NoticeHost />
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
              presentation: 'fullScreenModal',
            }}
          />
        </Stack>
      </View>
    </StoreProvider>
  );
}

function NoticeHost() {
  const { notice, clearNotice } = useStore();
  return <NoticeBanner notice={notice} onDismiss={clearNotice} />;
}
