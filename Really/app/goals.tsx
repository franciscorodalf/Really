import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useStore, Goal } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';

const GoalCard = ({ goal, onDelete, onDeposit }: { goal: Goal, onDelete: (id: string) => void, onDeposit: (id: string) => void }) => {
    const progress = Math.min(goal.currentAmount / goal.targetAmount, 1);

    const progressStyle = useAnimatedStyle(() => {
        return {
            width: withTiming(`${progress * 100}%`, { duration: 1000 }),
        };
    });

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon as any} size={24} color={goal.color} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{goal.name}</Text>
                    <Text style={styles.cardSubtitle}>
                        ${goal.currentAmount.toFixed(0)} / ${goal.targetAmount.toFixed(0)}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => onDeposit(goal.id)} style={[styles.deleteButton, { marginRight: 4 }]}>
                        <Ionicons name="add-circle-outline" size={24} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(goal.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFill, { backgroundColor: goal.color }, progressStyle]} />
            </View>
            <Text style={styles.percentage}>{(progress * 100).toFixed(0)}%</Text>
        </View>
    );
};

export default function GoalsScreen() {
    const router = useRouter();
    const { goals, addGoal, deleteGoal, allocateSavings, moneySaved, theme } = useStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [depositModalVisible, setDepositModalVisible] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');

    const [newGoalName, setNewGoalName] = useState('');
    const [newGoalAmount, setNewGoalAmount] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('airplane');
    const [selectedColor, setSelectedColor] = useState('#2196F3');

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const text = isDark ? '#fff' : '#000';

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
            Alert.alert('Error', `No tienes suficientes ahorros. Disponible: $${moneySaved}`);
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
        <View style={[styles.container, { backgroundColor: bg }]}>
            <Stack.Screen options={{
                headerShown: true,
                title: 'Metas de Ahorro',
                headerStyle: { backgroundColor: bg },
                headerTintColor: text,
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <Ionicons name="arrow-back" size={24} color={text} />
                    </TouchableOpacity>
                ),
            }} />
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.savingsCard}>
                    <Text style={[styles.savingsLabel, { color: text }]}>Ahorros Disponibles</Text>
                    <Text style={[styles.savingsAmount, { color: text }]}>${moneySaved.toFixed(0)}</Text>
                </View>

                {goals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} onDeposit={handleOpenDeposit} />
                ))}

                {goals.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="flag-outline" size={64} color={isDark ? '#333' : '#ddd'} />
                        <Text style={[styles.emptyText, { color: text }]}>No tienes metas aún</Text>
                        <Text style={styles.emptySubtext}>Crea una meta para motivarte a ahorrar</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: isDark ? '#fff' : '#000' }]}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={32} color={isDark ? '#000' : '#fff'} />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#222' : '#fff' }]}>
                        <Text style={[styles.modalTitle, { color: text }]}>Nueva Meta</Text>

                        <TextInput
                            style={[styles.input, { color: text, borderColor: isDark ? '#444' : '#ddd' }]}
                            placeholder="Nombre (ej: Viaje a Japón)"
                            placeholderTextColor="#999"
                            value={newGoalName}
                            onChangeText={setNewGoalName}
                        />

                        <TextInput
                            style={[styles.input, { color: text, borderColor: isDark ? '#444' : '#ddd' }]}
                            placeholder="Cantidad Objetivo ($)"
                            placeholderTextColor="#999"
                            value={newGoalAmount}
                            onChangeText={setNewGoalAmount}
                            keyboardType="numeric"
                        />

                        <Text style={[styles.label, { color: text }]}>Icono</Text>
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
                                    <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : '#999'} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={[styles.label, { color: text }]}>Color</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
                            {COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    onPress={() => setSelectedColor(color)}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && { borderWidth: 2, borderColor: text }
                                    ]}
                                />
                            ))}
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalButton}>
                                <Text style={{ color: '#999' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddGoal} style={[styles.modalButton, { backgroundColor: '#000' }]}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Crear Meta</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="fade"
                transparent={true}
                visible={depositModalVisible}
                onRequestClose={() => setDepositModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#222' : '#fff' }]}>
                        <Text style={[styles.modalTitle, { color: text }]}>Asignar Ahorros</Text>
                        <Text style={{ color: '#999', marginBottom: 16 }}>Disponible: ${moneySaved}</Text>

                        <TextInput
                            style={[styles.input, { color: text, borderColor: isDark ? '#444' : '#ddd' }]}
                            placeholder="Cantidad a asignar ($)"
                            placeholderTextColor="#999"
                            value={depositAmount}
                            onChangeText={setDepositAmount}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setDepositModalVisible(false)} style={styles.modalButton}>
                                <Text style={{ color: '#999' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDeposit} style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Asignar</Text>
                            </TouchableOpacity>
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
        alignItems: 'center',
    },
    savingsLabel: {
        fontSize: 14,
        opacity: 0.7,
        marginBottom: 4,
    },
    savingsAmount: {
        fontSize: 32,
        fontWeight: '800',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    deleteButton: {
        padding: 8,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    percentage: {
        alignSelf: 'flex-end',
        fontSize: 12,
        color: '#666',
        marginTop: 4,
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
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 8,
    },
    selector: {
        flexDirection: 'row',
        marginBottom: 16,
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
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
