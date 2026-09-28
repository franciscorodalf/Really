import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../context/StoreContext';
import { ItemCard } from '../components/ItemCard';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

const ACHIEVEMENT_TROPHY_DURATION_MS = 4000;

export default function Index() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { items, moneySaved, moneySpent, resolveItem, deleteItem, user, theme, isLoading, newAchievementSignal } = useStore();
    const [now, setNow] = useState(() => Date.now());
    const [refreshing, setRefreshing] = useState(false);
    const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
    const [showAchievementTrophy, setShowAchievementTrophy] = useState(false);
    const trophyRotation = useSharedValue(0);
    const isFirstAchievementRender = useRef(true);

    useEffect(() => {
        if (isFirstAchievementRender.current) {
            isFirstAchievementRender.current = false;
            return;
        }
        setShowAchievementTrophy(true);
        trophyRotation.value = withSequence(
            withTiming(-18, { duration: 70 }),
            withTiming(18, { duration: 70 }),
            withTiming(-14, { duration: 70 }),
            withTiming(14, { duration: 70 }),
            withTiming(-8, { duration: 70 }),
            withTiming(8, { duration: 70 }),
            withTiming(0, { duration: 70 })
        );
        const timeout = setTimeout(() => setShowAchievementTrophy(false), ACHIEVEMENT_TROPHY_DURATION_MS);
        return () => clearTimeout(timeout);
    }, [newAchievementSignal, trophyRotation]);

    const trophyAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${trophyRotation.value}deg` }],
    }));

    useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
                if (!hasSeen) {
                    router.replace('/onboarding' as any);
                    return;
                }
                setIsCheckingOnboarding(false);
            } catch (e) {
                console.error(e);
                setIsCheckingOnboarding(false);
            }
        };
        checkOnboarding();
    }, []);

    useEffect(() => {
        if (!isCheckingOnboarding && !isLoading && !user) {
            router.replace('/login');
        }
    }, [user, isLoading, isCheckingOnboarding]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        setNow(Date.now());
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }, []);

    const waitingItems = useMemo(() => items.filter(
        (item) => item.status === 'waiting' && item.unlockAt > now
    ), [items, now]);

    const readyItems = useMemo(() => items.filter(
        (item) => item.status === 'waiting' && item.unlockAt <= now
    ), [items, now]);

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const text = isDark ? '#fff' : '#000';
    const subText = isDark ? '#ccc' : '#666';

    if (isLoading || isCheckingOnboarding) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: bg }]}>
                <ActivityIndicator size="large" color={text} />
            </View>
        );
    }

    if (!user) return null;

    const AppTheme = Colors[isDark ? 'dark' : 'light'];

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: AppTheme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.text} />
                }
            >
                <View style={styles.header}>
                    <View>
                        <ThemedText style={{ color: AppTheme.subtext, fontSize: 14 }}>Hola, {user.email?.split('@')[0]}</ThemedText>
                        <ThemedText type="title" style={{ color: AppTheme.text }}>Mis Deseos</ThemedText>
                    </View>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity onPress={() => router.push('/goals')} style={styles.iconButton}>
                            <Ionicons name="flag-outline" size={24} color={AppTheme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/history')} style={styles.iconButton}>
                            <Ionicons name="time-outline" size={24} color={AppTheme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconButton}>
                            <Animated.View style={trophyAnimatedStyle}>
                                <Ionicons
                                    name={showAchievementTrophy ? 'trophy' : 'settings-outline'}
                                    size={24}
                                    color={showAchievementTrophy ? '#FFC107' : AppTheme.text}
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <TouchableOpacity
                        style={[styles.summaryCard, { backgroundColor: AppTheme.surface, flex: 1, marginRight: 8 }]}
                        onPress={() => router.push('/stats?type=saved')}
                    >
                        <LinearGradient
                            colors={[AppTheme.secondary, '#00b894']}
                            style={styles.cardGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Ionicons name="wallet-outline" size={24} color="#fff" />
                            </View>
                            <View>
                                <ThemedText style={styles.summaryLabel}>Ahorrado</ThemedText>
                                <ThemedText style={styles.summaryAmount}>${moneySaved.toFixed(0)}</ThemedText>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.summaryCard, { backgroundColor: AppTheme.surface, flex: 1, marginLeft: 8 }]}
                        onPress={() => router.push('/stats?type=spent')}
                    >
                        <LinearGradient
                            colors={[AppTheme.surface, AppTheme.surface]} // Just surface for Spent
                            style={styles.cardGradient}
                        >
                            <View style={[styles.summaryIconContainer, { backgroundColor: AppTheme.background }]}>
                                <Ionicons name="cart-outline" size={24} color={AppTheme.text} />
                            </View>
                            <View>
                                <ThemedText style={[styles.summaryLabel, { color: AppTheme.subtext }]}>Gastado</ThemedText>
                                <ThemedText style={[styles.summaryAmount, { color: AppTheme.text }]}>${moneySpent.toFixed(0)}</ThemedText>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {readyItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="alert-circle-outline" size={20} color={AppTheme.primary} />
                            <ThemedText type="defaultSemiBold" style={{ color: AppTheme.text }}>Listos para decidir</ThemedText>
                        </View>
                        {readyItems.map((item) => (
                            <ItemCard key={item.id} item={item} onResolve={resolveItem} onDelete={deleteItem} theme={theme} />
                        ))}
                    </View>
                )}

                {waitingItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="time-outline" size={20} color={AppTheme.subtext} />
                            <ThemedText type="defaultSemiBold" style={{ color: AppTheme.subtext }}>Pensándolo...</ThemedText>
                        </View>
                        {waitingItems.map((item) => (
                            <ItemCard key={item.id} item={item} onResolve={resolveItem} onDelete={deleteItem} theme={theme} />
                        ))}
                    </View>
                )}

                {items.length === 0 && (
                    <Animated.View entering={FadeIn.duration(220)} style={styles.emptyState}>
                        <View style={[styles.emptyIconBg, { backgroundColor: AppTheme.primary + '10' }]}>
                            <Ionicons name="cart-outline" size={48} color={AppTheme.primary} />
                        </View>
                        <ThemedText type="defaultSemiBold" style={{ marginTop: 16 }}>No tienes deseos pendientes.</ThemedText>
                        <ThemedText style={{ color: AppTheme.subtext, marginTop: 8 }}>¡Agrega algo que quieras comprar!</ThemedText>
                    </Animated.View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={[styles.fab]}
                onPress={() => router.push('/add')}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[AppTheme.primary, '#8257E5']}
                    style={styles.fabGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 140,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 32,
    },
    summaryCard: {
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
        minHeight: 140,
    },
    cardGradient: {
        padding: 20,
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Important for layout
    },
    summaryIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    summaryAmount: {
        color: '#fff',
        fontSize: 24,
        lineHeight: 30,
        fontFamily: 'Poppins_700Bold', // Enforce specific bold
        letterSpacing: -0.5,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        borderRadius: 32,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
