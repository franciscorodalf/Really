import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { ItemCard } from '../components/ItemCard';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';

export default function HistoryScreen() {
    const router = useRouter();
    const { items, resolveItem } = useStore();
    const { theme: colorScheme } = useStore();
    const AppTheme = Colors[colorScheme];

    const historyItems = items.filter(
        (item) => item.status === 'bought' || item.status === 'saved'
    ).sort((a, b) => b.createdAt - a.createdAt);

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <View style={[styles.header, { backgroundColor: AppTheme.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={AppTheme.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={{ color: AppTheme.text }}>Historial</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {historyItems.length > 0 ? (
                    historyItems.map((item) => (
                        <ItemCard key={item.id} item={item} onResolve={resolveItem} theme={colorScheme as any} />
                        // Casting theme because context might define string vs our detailed theme. 
                        // Actually ItemCard takes 'light' | 'dark'.
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <View style={{ opacity: 0.5, marginBottom: 16 }}>
                            <Ionicons name="time-outline" size={64} color={AppTheme.text} />
                        </View>
                        <ThemedText type="defaultSemiBold">No hay historial aún.</ThemedText>
                        <ThemedText style={{ color: AppTheme.subtext, marginTop: 8 }}>Tus decisiones pasadas aparecerán aquí.</ThemedText>
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
        paddingBottom: 10,
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: 20,
        paddingBottom: 50,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
});
