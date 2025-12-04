import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeOutLeft, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Domina tus\nImpulsos',
        description: 'Registra lo que quieres comprar y dale un tiempo de espera. La mayoría de los deseos desaparecen solos.',
        icon: 'shield-checkmark-outline' as const,
        color: '#000000'
    },
    {
        id: '2',
        title: 'Ahorra con\nPropósito',
        description: 'Convierte esas compras evitadas en ahorros reales para lo que verdaderamente importa.',
        icon: 'trending-up-outline' as const,
        color: '#000000'
    },
    {
        id: '3',
        title: 'Visualiza tu\nProgreso',
        description: 'Observa cómo crece tu patrimonio y desbloquea logros por tu disciplina financiera.',
        icon: 'trophy-outline' as const,
        color: '#000000'
    }
];

const Slide = ({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: SharedValue<number> }) => {
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
                <View style={styles.iconContainer}>
                    <Ionicons name={item.icon} size={80} color="#fff" />
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </Animated.View>
        </View>
    );
};

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<Animated.FlatList<any>>(null);
    const scrollX = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            router.replace('/login'); // Redirect to login after onboarding
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
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

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
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}
                    </Text>
                    <Ionicons
                        name={currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow-forward"}
                        size={20}
                        color="#000"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    list: {
        flex: 1,
    },
    slide: {
        width,
        height: height,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    slideContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#333',
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
        color: '#fff',
        letterSpacing: -1,
        lineHeight: 48,
    },
    description: {
        fontSize: 18,
        textAlign: 'center',
        color: '#888',
        lineHeight: 28,
        maxWidth: '90%',
    },
    footer: {
        position: 'absolute',
        bottom: 50,
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
        backgroundColor: '#fff',
    },
    button: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
});
