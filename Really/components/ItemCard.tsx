import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Item, Theme } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';

interface ItemCardProps {
    item: Item;
    onResolve: (id: string, decision: 'buy' | 'save') => void;
    onDelete?: (id: string) => void;
    theme?: Theme;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onResolve, onDelete, theme = 'light' }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isReady, setIsReady] = useState(false);

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
    const isDark = theme === 'dark';

    const bg = isDark ? '#1a1a1a' : '#fff';
    const text = isDark ? '#fff' : '#000';
    const timerBg = isDark ? '#333' : '#f5f5f5';
    const timerText = isDark ? '#ccc' : '#666';
    const readyBorder = isDark ? '#fff' : '#000';

    return (
        <View style={[styles.card, { backgroundColor: bg }, isReady && isWaiting && { borderColor: readyBorder, borderWidth: 2 }]}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: item.categoryColor ? item.categoryColor + '20' : '#eee' }]}>
                        <Ionicons name={item.categoryIcon as any || 'pricetag-outline'} size={24} color={item.categoryColor || '#666'} />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={[styles.name, { color: text }]}>{item.name}</Text>
                        <Text style={[styles.date, { color: isDark ? '#666' : '#999' }]}>
                            {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <Text style={[styles.price, { color: text }]}>${item.price.toFixed(2)}</Text>
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
                            <Ionicons name="trash-outline" size={20} color={isDark ? '#666' : '#ccc'} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.statusContainer}>
                    {isWaiting ? (
                        isReady ? (
                            <Text style={[styles.readyText, { color: text }]}>¡Es hora de decidir!</Text>
                        ) : (
                            <View style={[styles.timerContainer, { backgroundColor: timerBg }]}>
                                <Ionicons name="hourglass-outline" size={14} color={timerText} />
                                <Text style={[styles.timerText, { color: timerText }]}>{timeLeft}</Text>
                            </View>
                        )
                    ) : (
                        <View style={[styles.badge, item.status === 'saved' ? styles.savedBadge : styles.boughtBadge]}>
                            <Text style={[styles.badgeText, item.status === 'saved' ? styles.savedText : styles.boughtText]}>
                                {item.status === 'saved' ? 'Ahorrado' : 'Comprado'}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {isWaiting && isReady && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}
                        onPress={() => onResolve(item.id, 'buy')}
                    >
                        <Text style={[styles.buyButtonText, { color: text }]}>Comprar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: isDark ? '#fff' : '#000' }]}
                        onPress={() => onResolve(item.id, 'save')}
                    >
                        <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>Ahorrar</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    content: {
        gap: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    name: {
        fontSize: 18,
        fontWeight: '600',
    },
    date: {
        fontSize: 12,
        marginTop: 2,
    },
    price: {
        fontSize: 18,
        fontWeight: '700',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    timerText: {
        fontSize: 13,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
    },
    readyText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    savedBadge: {
        backgroundColor: '#E8F5E9',
    },
    boughtBadge: {
        backgroundColor: '#FFEBEE',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    savedText: {
        color: '#2E7D32',
    },
    boughtText: {
        color: '#C62828',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        fontWeight: '600',
        fontSize: 16,
    },
    saveButtonText: {
        fontWeight: '600',
        fontSize: 16,
    },
});
