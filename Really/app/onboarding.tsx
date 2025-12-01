import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Añade tu deseo',
        description: 'Evita la compra impulsiva registrando lo que quieres en el momento.',
        icon: 'add-circle-outline' as const,
        color: '#4CAF50'
    },
    {
        id: '2',
        title: 'Espera un tiempo',
        description: 'Deja que pase el tiempo de enfriamiento para ver si realmente lo necesitas.',
        icon: 'hourglass-outline' as const,
        color: '#2196F3'
    },
    {
        id: '3',
        title: 'Decide con claridad',
        description: '¿Sigues queriéndolo? Cómpralo. ¿Ya no? Ahórralo y mira crecer tu capital.',
        icon: 'checkmark-circle-outline' as const,
        color: '#9C27B0'
    }
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            router.replace('/');
        } catch (error) {
            console.error('Error saving onboarding status:', error);
            router.replace('/');
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true
            });
        } else {
            handleFinish();
        }
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={styles.slide}>
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={100} color={item.color} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index && styles.activeDot
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleNext}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Comenzar' : 'Siguiente'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    slide: {
        width,
        height: height * 0.75,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    iconContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 16,
        textAlign: 'center',
        color: '#000',
        letterSpacing: -1,
    },
    description: {
        fontSize: 18,
        textAlign: 'center',
        color: '#666',
        lineHeight: 28,
    },
    footer: {
        height: height * 0.25,
        justifyContent: 'space-between',
        paddingHorizontal: 40,
        paddingBottom: 60,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#eee',
    },
    activeDot: {
        backgroundColor: '#000',
        width: 24,
    },
    button: {
        backgroundColor: '#000',
        paddingVertical: 20,
        borderRadius: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
