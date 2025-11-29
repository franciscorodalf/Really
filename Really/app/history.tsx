import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { ItemCard } from '../components/ItemCard';
import { StatusBar } from 'expo-status-bar';

export default function HistoryScreen() {
    const router = useRouter();
    const { items, resolveItem, theme } = useStore();

    const historyItems = items.filter(
        (item) => item.status === 'bought' || item.status === 'saved'
    ).sort((a, b) => b.createdAt - a.createdAt);

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const headerBg = isDark ? '#1a1a1a' : '#fff';
    const text = isDark ? '#fff' : '#000';
    const border = isDark ? '#333' : '#f0f0f0';

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: text }]}>Historial</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {historyItems.length > 0 ? (
                    historyItems.map((item) => (
                        <ItemCard key={item.id} item={item} onResolve={resolveItem} theme={theme} />
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="time-outline" size={48} color={isDark ? '#333' : '#ddd'} />
                        <Text style={[styles.emptyText, { color: text }]}>No hay historial aún.</Text>
                        <Text style={styles.emptySubtext}>Tus decisiones pasadas aparecerán aquí.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        padding: 20,
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
});
