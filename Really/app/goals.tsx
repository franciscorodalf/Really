import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, useColorScheme } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useStore, Goal } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';
import { ThemedButton } from '../components/ThemedButton';

const GoalCard = ({ goal, onDelete, onDeposit, theme }: { goal: Goal, onDelete: (id: string) => void, onDeposit: (id: string) => void, theme: any }) => {
    const progress = Math.min(goal.currentAmount / goal.targetAmount, 1);
    const progressStyle = useAnimatedStyle(() => {
        return {
            width: withTiming(`${progress * 100}%`, { duration: 1000 }),
        };
    });

    return (
        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            <LinearGradient
                colors={[theme.surface, theme.surface]} // Or a subtle gradient? Let's stick to clean surface for now, maybe gradient on progress.
                style={{ borderRadius: 24, padding: 20 }}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: goal.color + '20' }]}>
                        <Ionicons name={goal.icon as any} size={24} color={goal.color} />
                    </View>
                    <View style={styles.cardInfo}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{goal.name}</ThemedText>
                        <ThemedText style={{ color: theme.subtext, fontSize: 14 }}>
                            ${goal.currentAmount.toFixed(0)} / ${goal.targetAmount.toFixed(0)}
                        </ThemedText>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => onDeposit(goal.id)} style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}>
                            <Ionicons name="add" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete(goal.id)} style={[styles.actionButton, { backgroundColor: theme.danger + '20' }]}>
                            <Ionicons name="trash-outline" size={18} color={theme.danger} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                    <Animated.View style={[styles.progressBarFill, { backgroundColor: goal.color }, progressStyle]} />
                </View>
                <ThemedText style={[styles.percentage, { color: theme.subtext }]}>{(progress * 100).toFixed(0)}%</ThemedText>
            </LinearGradient>
        </View>
    );
};

export default function GoalsScreen() {
    const router = useRouter();
    const { goals, addGoal, deleteGoal, allocateSavings, moneySaved } = useStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [depositModalVisible, setDepositModalVisible] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');

    const [newGoalName, setNewGoalName] = useState('');
    const [newGoalAmount, setNewGoalAmount] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('airplane');
    const [selectedColor, setSelectedColor] = useState('#2196F3');

    const colorScheme = useColorScheme() ?? 'light';
    const AppTheme = Colors[colorScheme];

    const handleAddGoal = async () => {
        if (!newGoalName || !newGoalAmount) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }
        await addGoal(newGoalName, parseFloat(newGoalAmount), selectedIcon, selectedColor);
        setModalVisible(false);
        setNewGoalName('');
        setNewGoalAmount('');
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Eliminar Meta",
            "¿Estás seguro? El dinero asignado volverá a tus ahorros generales.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => deleteGoal(id) }
            ]
        );
    };

    const handleOpenDeposit = (id: string) => {
        setSelectedGoalId(id);
        setDepositModalVisible(true);
    };

    const handleDeposit = async () => {
        if (!selectedGoalId || !depositAmount) return;
        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Ingresa una cantidad válida');
            return;
        }
        if (amount > moneySaved) {
            Alert.alert('Error', `No tienes suficientes ahorros. Disponible: $${moneySaved.toFixed(0)}`);
            return;
        }
        await allocateSavings(selectedGoalId, amount);
        setDepositModalVisible(false);
        setDepositAmount('');
        setSelectedGoalId(null);
    };

    const ICONS = ['airplane', 'car', 'home', 'laptop', 'game-controller', 'gift', 'school', 'bicycle'];
    const COLORS = ['#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#F44336', '#E91E63', '#00BCD4', '#FF5722'];

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <Stack.Screen options={{
                headerShown: true,
                title: 'Metas de Ahorro',
                headerStyle: { backgroundColor: AppTheme.background },
                headerTintColor: AppTheme.text,
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <Ionicons name="arrow-back" size={24} color={AppTheme.text} />
                    </TouchableOpacity>
                ),
                headerShadowVisible: false, // Cleaner
            }} />
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.savingsCard}>
                    <LinearGradient
                        colors={[AppTheme.secondary, '#00b894']}
                        style={styles.savingsGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <ThemedText style={styles.savingsLabel}>Ahorros Disponibles</ThemedText>
                        <ThemedText type="title" style={{ color: '#fff', fontSize: 36 }}>${moneySaved.toFixed(0)}</ThemedText>
                    </LinearGradient>
                </View>

                {goals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} onDeposit={handleOpenDeposit} theme={AppTheme} />
                ))}

                {goals.length === 0 && (
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIconBg, { backgroundColor: AppTheme.primary + '10' }]}>
                            <Ionicons name="flag-outline" size={64} color={AppTheme.primary} />
                        </View>
                        <ThemedText type="defaultSemiBold" style={{ marginTop: 16 }}>No tienes metas aún</ThemedText>
                        <ThemedText style={{ color: AppTheme.subtext, marginTop: 8 }}>Crea una meta para motivarte a ahorrar</ThemedText>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
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

            {/* CREAR META MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: AppTheme.surface }]}>
                        <ThemedText type="subtitle" style={{ marginBottom: 20 }}>Nueva Meta</ThemedText>

                        <TextInput
                            style={[styles.input, { color: AppTheme.text, borderColor: AppTheme.border, backgroundColor: AppTheme.background }]}
                            placeholder="Nombre (ej: Viaje a Japón)"
                            placeholderTextColor={AppTheme.subtext}
                            value={newGoalName}
                            onChangeText={setNewGoalName}
                        />

                        <TextInput
                            style={[styles.input, { color: AppTheme.text, borderColor: AppTheme.border, backgroundColor: AppTheme.background }]}
                            placeholder="Cantidad Objetivo ($)"
                            placeholderTextColor={AppTheme.subtext}
                            value={newGoalAmount}
                            onChangeText={setNewGoalAmount}
                            keyboardType="numeric"
                        />

                        <ThemedText style={[styles.label, { color: AppTheme.text }]}>Icono</ThemedText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
                            {ICONS.map(icon => (
                                <TouchableOpacity
                                    key={icon}
                                    onPress={() => setSelectedIcon(icon)}
                                    style={[
                                        styles.iconOption,
                                        selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }
                                    ]}
                                >
                                    <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : AppTheme.subtext} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <ThemedText style={[styles.label, { color: AppTheme.text }]}>Color</ThemedText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
                            {COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    onPress={() => setSelectedColor(color)}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && { borderWidth: 3, borderColor: AppTheme.text }
                                    ]}
                                />
                            ))}
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <ThemedButton title="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                            <ThemedButton title="Crear Meta" variant="primary" onPress={handleAddGoal} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DEPOSIT MODAL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={depositModalVisible}
                onRequestClose={() => setDepositModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: AppTheme.surface, marginHorizontal: 20, borderRadius: 24 }]}>
                        {/* Re-using modalContent style but modifying for center popup */}
                        <ThemedText type="subtitle">Asignar Ahorros</ThemedText>
                        <ThemedText style={{ color: AppTheme.subtext, marginBottom: 16 }}>Disponible: ${moneySaved.toFixed(0)}</ThemedText>

                        <TextInput
                            style={[styles.input, { color: AppTheme.text, borderColor: AppTheme.border, backgroundColor: AppTheme.background }]}
                            placeholder="Cantidad a asignar ($)"
                            placeholderTextColor={AppTheme.subtext}
                            value={depositAmount}
                            onChangeText={setDepositAmount}
                            keyboardType="numeric"
                            autoFocus
                        />

                        <View style={styles.modalButtons}>
                            <ThemedButton title="Cancelar" variant="ghost" onPress={() => setDepositModalVisible(false)} style={{ flex: 1 }} />
                            <ThemedButton title="Asignar" variant="secondary" onPress={handleDeposit} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    savingsCard: {
        marginBottom: 24,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    savingsGradient: {
        padding: 24,
        alignItems: 'center',
    },
    savingsLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    card: {
        borderRadius: 20,
        marginBottom: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    percentage: {
        alignSelf: 'flex-end',
        fontSize: 12,
        fontWeight: '600',
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
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 8,
    },
    selector: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    iconOption: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 16,
    },
});
