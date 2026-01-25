import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, KeyboardAvoidingView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';
import { ThemedButton } from '../components/ThemedButton';

export default function AddScreen() {
    const router = useRouter();
    const { addItem } = useStore();
    const colorScheme = useColorScheme() ?? 'light';
    const AppTheme = Colors[colorScheme];

    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState(30);
    const [unit, setUnit] = useState<'days' | 'minutes'>('days');
    const [category, setCategory] = useState('Otros');
    const [categoryIcon, setCategoryIcon] = useState('pricetag-outline');
    const [categoryColor, setCategoryColor] = useState('#9E9E9E');

    const CATEGORIES = [
        { name: 'Tecnología', icon: 'laptop-outline', color: '#2196F3' },
        { name: 'Ropa', icon: 'shirt-outline', color: '#E91E63' },
        { name: 'Hogar', icon: 'home-outline', color: '#4CAF50' },
        { name: 'Ocio', icon: 'game-controller-outline', color: '#FFC107' },
        { name: 'Comida', icon: 'restaurant-outline', color: '#FF5722' },
        { name: 'Viajes', icon: 'airplane-outline', color: '#00BCD4' },
        { name: 'Otros', icon: 'pricetag-outline', color: '#9E9E9E' },
    ];

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Por favor ingresa un nombre');
            return;
        }
        if (!price || isNaN(parseFloat(price))) {
            Alert.alert('Error', 'Por favor ingresa un precio válido');
            return;
        }

        try {
            await addItem(name, parseFloat(price), duration, unit, category, categoryIcon, categoryColor);
            router.back();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el item');
        }
    };

    const toggleUnit = () => {
        if (unit === 'days') {
            setUnit('minutes');
            setDuration(30);
        } else {
            setUnit('days');
            setDuration(30);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={AppTheme.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={{ color: AppTheme.text }}>Nuevo Deseo</ThemedText>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>¿Qué quieres comprar?</ThemedText>
                            <TextInput
                                style={[styles.input, { color: AppTheme.text, borderBottomColor: AppTheme.border }]}
                                placeholder="Ej. Auriculares Nuevos"
                                placeholderTextColor={AppTheme.subtext}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Precio</ThemedText>
                            <TextInput
                                style={[styles.input, { color: AppTheme.text, borderBottomColor: AppTheme.border }]}
                                placeholder="0.00"
                                placeholderTextColor={AppTheme.subtext}
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="decimal-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Categoría</ThemedText>
                            <View style={styles.categoriesContainer}>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.name}
                                        style={[
                                            styles.categoryChip,
                                            {
                                                backgroundColor: category === cat.name ? cat.color + '20' : AppTheme.surface,
                                                borderColor: category === cat.name ? cat.color : 'transparent',
                                                borderWidth: 1,
                                            }
                                        ]}
                                        onPress={() => {
                                            setCategory(cat.name);
                                            setCategoryIcon(cat.icon);
                                            setCategoryColor(cat.color);
                                        }}
                                    >
                                        <Ionicons name={cat.icon as any} size={18} color={category === cat.name ? cat.color : AppTheme.text} style={{ marginRight: 6 }} />
                                        <ThemedText style={[
                                            styles.categoryText,
                                            { color: category === cat.name ? cat.color : AppTheme.text }
                                        ]}>
                                            {cat.name}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.sliderHeader}>
                                <ThemedText style={styles.label}>Tiempo de espera</ThemedText>
                                <TouchableOpacity onPress={toggleUnit} style={[styles.unitToggle, { backgroundColor: AppTheme.surface }]}>
                                    <ThemedText style={[styles.unitText, { color: AppTheme.text }]}>{unit === 'days' ? 'Días' : 'Minutos'}</ThemedText>
                                    <Ionicons name="swap-vertical" size={16} color={AppTheme.subtext} />
                                </TouchableOpacity>
                            </View>

                            <ThemedText type="title" style={{ fontSize: 40, marginVertical: 10, color: AppTheme.text }}>
                                {duration} <ThemedText style={{ fontSize: 20, color: AppTheme.subtext }}>{unit === 'days' ? (duration === 1 ? 'día' : 'días') : (duration === 1 ? 'minuto' : 'minutos')}</ThemedText>
                            </ThemedText>

                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={1}
                                maximumValue={60}
                                step={1}
                                value={duration}
                                onValueChange={setDuration}
                                minimumTrackTintColor={AppTheme.primary}
                                maximumTrackTintColor={AppTheme.border}
                                thumbTintColor={AppTheme.primary}
                            />
                            <ThemedText style={styles.helperText}>
                                Te preguntaremos de nuevo en {duration} {unit === 'days' ? 'días' : 'minutos'}.
                            </ThemedText>
                        </View>

                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: AppTheme.background, borderTopColor: AppTheme.border }]}>
                    <ThemedButton title="Guardar en Really" variant="primary" onPress={handleSave} />
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: Platform.OS === 'android' ? 40 : 10,
    },
    closeButton: {
        padding: 4,
        marginLeft: -4,
    },
    form: {
        gap: 32,
    },
    inputGroup: {
        gap: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.7,
    },
    input: {
        fontSize: 28,
        fontWeight: '500',
        fontFamily: 'Outfit_500Medium',
        borderBottomWidth: 1,
        paddingVertical: 12,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    unitToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    unitText: {
        fontSize: 14,
        fontWeight: '600',
    },
    helperText: {
        color: '#999',
        fontSize: 14,
        marginTop: 8,
    },
    footer: {
        paddingVertical: 20,
        paddingHorizontal: 0,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    categoriesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
