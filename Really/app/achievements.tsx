import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useStore, ACHIEVEMENTS } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AchievementsScreen() {
    const { userAchievements, theme } = useStore();

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const text = isDark ? '#fff' : '#000';
    const cardBg = isDark ? '#1a1a1a' : '#fff';

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <Stack.Screen options={{
                headerShown: true,
                title: 'Logros',
                headerStyle: { backgroundColor: bg },
                headerTintColor: text,
            }} />
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.subtitle, { color: text }]}>
                        {userAchievements.length} de {ACHIEVEMENTS.length} desbloqueados
                    </Text>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${(userAchievements.length / ACHIEVEMENTS.length) * 100}%` }]} />
                    </View>
                </View>

                <View style={styles.grid}>
                    {ACHIEVEMENTS.map((achievement) => {
                        const isUnlocked = userAchievements.includes(achievement.id);
                        return (
                            <View
                                key={achievement.id}
                                style={[
                                    styles.card,
                                    { backgroundColor: cardBg, opacity: isUnlocked ? 1 : 0.5 }
                                ]}
                            >
                                <View style={[
                                    styles.iconContainer,
                                    { backgroundColor: isUnlocked ? '#FFD700' : '#ccc' }
                                ]}>
                                    <Ionicons
                                        name={achievement.icon as any}
                                        size={32}
                                        color={isUnlocked ? '#000' : '#666'}
                                    />
                                </View>
                                <Text style={[styles.cardTitle, { color: text }]}>{achievement.title}</Text>
                                <Text style={styles.cardDescription}>{achievement.description}</Text>
                                {isUnlocked && (
                                    <View style={styles.checkBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
    },
    card: {
        width: '47%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        lineHeight: 16,
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
});
