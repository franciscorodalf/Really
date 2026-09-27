import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '../components/themed-text';
import { Colors } from '../constants/Colors';
import { useStore } from '../context/StoreContext';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Domina tus\nImpulsos',
        description: 'Registra lo que quieres comprar y dale un tiempo de espera. La mayoría de los deseos desaparecen solos.',
        icon: 'shield-checkmark-outline' as const,
    },
    {
        id: '2',
        title: 'Ahorra con\nPropósito',
        description: 'Convierte esas compras evitadas en ahorros reales para lo que verdaderamente importa.',
        icon: 'trending-up-outline' as const,
    },
    {
        id: '3',
        title: 'Visualiza tu\nProgreso',
        description: 'Observa cómo crece tu patrimonio y desbloquea logros por tu disciplina financiera.',
        icon: 'trophy-outline' as const,
    }
];

const Slide = ({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: SharedValue<number> }) => {
    const { theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];

    const rnStyle = useAnimatedStyle(() => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.8, 1, 0.8],
            Extrapolation.CLAMP
        );

        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.5, 1, 0.5],
            Extrapolation.CLAMP
        );

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <View style={styles.slide}>
            <Animated.View style={[styles.slideContent, rnStyle]}>
                <LinearGradient
                    colors={[AppTheme.primary, '#8257E5']} // Vibrant gradient for icon background
                    style={styles.iconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name={item.icon} size={64} color="#fff" />
                </LinearGradient>
                <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 16 }}>{item.title}</ThemedText>
                <ThemedText style={{ textAlign: 'center', color: AppTheme.subtext, paddingHorizontal: 32 }}>{item.description}</ThemedText>
            </Animated.View>
        </View>
    );
};

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<Animated.FlatList<any>>(null);
    const scrollX = useSharedValue(0);
    const { theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            router.replace('/login');
        } catch (error) {
            console.error('Error saving onboarding status:', error);
            router.replace('/login');
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true
            });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleFinish();
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={({ item, index }) => <Slide item={item} index={index} scrollX={scrollX} />}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                keyExtractor={(item) => item.id}
                style={styles.list}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => {
                        const animatedDotStyle = useAnimatedStyle(() => {
                            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
                            const widthDot = interpolate(
                                scrollX.value,
                                inputRange,
                                [8, 24, 8],
                                Extrapolation.CLAMP
                            );
                            const opacity = interpolate(
                                scrollX.value,
                                inputRange,
                                [0.5, 1, 0.5],
                                Extrapolation.CLAMP
                            );
                            return {
                                width: widthDot,
                                opacity,
                                backgroundColor: AppTheme.text
                            };
                        });

                        return (
                            <Animated.View
                                key={index}
                                style={[styles.dot, animatedDotStyle]}
                            />
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[AppTheme.primary, '#8257E5']}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow-forward"}
                            size={24}
                            color="#fff"
                        />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    slide: {
        width,
        height: height,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    slideContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: -100, // Visual adjustment
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        shadowColor: '#6C5CE7',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        paddingHorizontal: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    button: {
        borderRadius: 30,
        overflow: 'hidden',
    },
    buttonGradient: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
