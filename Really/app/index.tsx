import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { ItemCard } from '../components/ItemCard';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { items, moneySaved, moneySpent, resolveItem, user, theme, isLoading } = useStore();
    const [now, setNow] = useState(Date.now());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [user, isLoading]);

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

    const waitingItems = items.filter(
        (item) => item.status === 'waiting' && item.unlockAt > now
    );

    const readyItems = items.filter(
        (item) => item.status === 'waiting' && item.unlockAt <= now
    );

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const text = isDark ? '#fff' : '#000';
    const subText = isDark ? '#ccc' : '#666';

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: bg }]}>
                <ActivityIndicator size="large" color={text} />
            </View>
        );
    }

    if (!user) return null;

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={text} />
                }
            >
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: subText }]}>Hola, {user.email?.split('@')[0]}</Text>
                        <Text style={[styles.headerTitle, { color: text }]}>Mis Deseos</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.settingsButton}>
                        <Ionicons name="settings-outline" size={24} color={text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsContainer}>
                    <View style={[styles.summaryCard, { backgroundColor: isDark ? '#333' : '#000', flex: 1, marginRight: 8 }]}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Ionicons name="wallet-outline" size={24} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>Ahorrado</Text>
                            <Text style={styles.summaryAmount}>${moneySaved.toFixed(0)}</Text>
                        </View>
                    </View>

                    <View style={[styles.summaryCard, { backgroundColor: isDark ? '#333' : '#fff', flex: 1, marginLeft: 8, borderWidth: isDark ? 0 : 1, borderColor: '#eee' }]}>
                        <View style={[styles.summaryIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5' }]}>
                            <Ionicons name="cart-outline" size={24} color={isDark ? '#fff' : '#000'} />
                        </View>
                        <View>
                            <Text style={[styles.summaryLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : '#666' }]}>Gastado</Text>
                            <Text style={[styles.summaryAmount, { color: isDark ? '#fff' : '#000' }]}>${moneySpent.toFixed(0)}</Text>
                        </View>
                    </View>
                </View>

                {readyItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="alert-circle-outline" size={20} color={text} />
                            <Text style={[styles.sectionTitle, { color: text }]}>Listos para decidir</Text>
                        </View>
                        {readyItems.map((item) => (
                            <ItemCard key={item.id} item={item} onResolve={resolveItem} theme={theme} />
                        ))}
                    </View>
                )}

                {waitingItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="time-outline" size={20} color={subText} />
                            <Text style={[styles.sectionTitle, { color: subText }]}>Pensándolo...</Text>
                        </View>
                        {waitingItems.map((item) => (
                            <ItemCard key={item.id} item={item} onResolve={resolveItem} theme={theme} />
                        ))}
                    </View>
                )}

                {items.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="cart-outline" size={48} color={isDark ? '#333' : '#ddd'} />
                        <Text style={[styles.emptyText, { color: text }]}>No tienes deseos pendientes.</Text>
                        <Text style={styles.emptySubtext}>¡Agrega algo que quieras comprar!</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: isDark ? '#fff' : '#000' }]}
                onPress={() => router.push('/add' as any)}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color={isDark ? '#000' : '#fff'} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 10,
    },
    greeting: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -1,
    },
    settingsButton: {
        padding: 8,
        marginRight: -8,
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 32,
    },
    summaryCard: {
        borderRadius: 24,
        padding: 20,
        flexDirection: 'column',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
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
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    summaryAmount: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
        opacity: 0.8,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#999',
        fontSize: 14,
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 40,
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
});
