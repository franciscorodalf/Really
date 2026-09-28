import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Item, Theme, useStore } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './themed-text'; // Updated import
import { ThemedButton } from './ThemedButton';
import { Colors } from '../constants/Colors';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { formatWorkHours } from '../utils/workHours';

interface ItemCardProps {
    item: Item;
    onResolve: (id: string, decision: 'buy' | 'save') => void;
    onDelete?: (id: string) => void;
    theme?: Theme;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onResolve, onDelete, theme = 'light' }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isReady, setIsReady] = useState(false);
    const { theme: colorScheme, hourlyWage } = useStore();
    const AppTheme = Colors[colorScheme];

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const diff = item.unlockAt - now;

            if (diff <= 0) {
                setIsReady(true);
                setTimeLeft('Listo');
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                if (days > 0) {
                    setTimeLeft(`${days}d ${hours}h`);
                } else if (hours > 0) {
                    setTimeLeft(`${hours}h ${minutes}m`);
                } else {
                    setTimeLeft(`${minutes}m ${seconds}s`);
                }
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [item.unlockAt]);

    const isWaiting = item.status === 'waiting';

    const bg = AppTheme.surface;
    const workHoursLabel = formatWorkHours(item.price, hourlyWage);

    return (
        <Animated.View
            entering={FadeInDown.springify().duration(220)}
            exiting={FadeOutUp.duration(180)}
            layout={Layout.springify()}
            style={[styles.card, { backgroundColor: bg, borderColor: AppTheme.border }]}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: item.categoryColor ? item.categoryColor + '20' : AppTheme.border }]}>
                        <Ionicons name={item.categoryIcon as any || 'pricetag-outline'} size={24} color={item.categoryColor || AppTheme.subtext} />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>{item.name}</ThemedText>
                        <ThemedText style={{ fontSize: 12, color: AppTheme.subtext }}>
                            {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>${item.price.toFixed(2)}</ThemedText>
                        {workHoursLabel && (
                            <ThemedText style={{ fontSize: 11, color: AppTheme.subtext, marginTop: 2 }}>{workHoursLabel}</ThemedText>
                        )}
                    </View>

                    {isWaiting && onDelete && (
                        <TouchableOpacity onPress={() => {
                            Alert.alert(
                                'Eliminar deseo',
                                '¿Estás seguro de que quieres eliminar este deseo?',
                                [
                                    { text: 'Cancelar', style: 'cancel' },
                                    { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(item.id) }
                                ]
                            );
                        }} style={{ marginLeft: 8 }}>
                            <Ionicons name="trash-outline" size={20} color={AppTheme.subtext} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.statusContainer}>
                    {isWaiting ? (
                        isReady ? (
                            <ThemedText style={{ color: AppTheme.primary, fontWeight: 'bold' }}>¡Es hora de decidir!</ThemedText>
                        ) : (
                            <View style={[styles.timerContainer, { backgroundColor: AppTheme.background }]}>
                                <Ionicons name="hourglass-outline" size={14} color={AppTheme.subtext} />
                                <ThemedText style={[styles.timerText, { color: AppTheme.subtext }]}>{timeLeft}</ThemedText>
                            </View>
                        )
                    ) : (
                        <View style={[styles.badge, item.status === 'saved' ? { backgroundColor: AppTheme.success + '20' } : { backgroundColor: AppTheme.danger + '20' }]}>
                            <ThemedText style={[styles.badgeText, { color: item.status === 'saved' ? AppTheme.success : AppTheme.danger }]}>
                                {item.status === 'saved' ? 'Ahorrado' : 'Comprado'}
                            </ThemedText>
                        </View>
                    )}
                </View>
            </View>

            {isWaiting && isReady && (
                <View style={styles.actions}>
                    <ThemedButton
                        title="Comprar"
                        variant="ghost"
                        containerStyle={{ flex: 1 }}
                        onPress={async () => {
                            try {
                                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            } catch (error) {
                                // No-op if haptics unavailable
                            }
                            onResolve(item.id, 'buy');
                        }}
                        style={{ flex: 1, backgroundColor: AppTheme.background, borderWidth: 1, borderColor: AppTheme.border }}
                        textStyle={{ color: AppTheme.danger }}
                    />
                    <ThemedButton
                        title="Ahorrar"
                        variant="primary"
                        containerStyle={{ flex: 1 }}
                        onPress={async () => {
                            try {
                                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch (error) {
                                // No-op if haptics unavailable
                            }
                            onResolve(item.id, 'save');
                        }}
                        style={{ flex: 1 }}
                    />
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        borderWidth: 1,
    },
    content: {
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    timerText: {
        fontSize: 13,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
});
