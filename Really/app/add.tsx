import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AddScreen() {
    const router = useRouter();
    const { addItem, theme } = useStore();

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

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#fff';
    const text = isDark ? '#fff' : '#000';
    const inputBorder = isDark ? '#333' : '#eee';
    const toggleBg = isDark ? '#1a1a1a' : '#f5f5f5';

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
        <View style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: text }]}>Nuevo Deseo</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>¿Qué quieres comprar?</Text>
                            <TextInput
                                style={[styles.input, { color: text, borderBottomColor: inputBorder }]}
                                placeholder="Ej. Auriculares Nuevos"
                                placeholderTextColor="#666"
                                value={name}
                                onChangeText={setName}
                                autoFocus
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Precio</Text>
                            <TextInput
                                style={[styles.input, { color: text, borderBottomColor: inputBorder }]}
                                placeholder="0.00"
                                placeholderTextColor="#666"
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="decimal-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Categoría</Text>
                            <View style={styles.categoriesContainer}>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.name}
                                        style={[
                                            styles.categoryChip,
                                            {
                                                backgroundColor: category === cat.name ? cat.color + '20' : (isDark ? '#333' : '#f5f5f5'),
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
                                        <Ionicons name={cat.icon as any} size={18} color={category === cat.name ? cat.color : text} style={{ marginRight: 6 }} />
                                        <Text style={[
                                            styles.categoryText,
                                            { color: category === cat.name ? cat.color : text }
                                        ]}>
                                            {cat.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.sliderHeader}>
                                <Text style={styles.label}>Tiempo de espera</Text>
                                <TouchableOpacity onPress={toggleUnit} style={[styles.unitToggle, { backgroundColor: toggleBg }]}>
                                    <Text style={[styles.unitText, { color: text }]}>{unit === 'days' ? 'Días' : 'Minutos'}</Text>
                                    <Ionicons name="swap-vertical" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.daysValue, { color: text }]}>
                                {duration} {unit === 'days' ? (duration === 1 ? 'día' : 'días') : (duration === 1 ? 'minuto' : 'minutos')}
                            </Text>

                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={1}
                                maximumValue={60}
                                step={1}
                                value={duration}
                                onValueChange={setDuration}
                                minimumTrackTintColor={isDark ? '#fff' : '#000'}
                                maximumTrackTintColor={isDark ? '#333' : '#e0e0e0'}
                                thumbTintColor={isDark ? '#fff' : '#000'}
                            />
                            <Text style={styles.helperText}>
                                Te preguntaremos de nuevo en {duration} {unit === 'days' ? 'días' : 'minutos'}.
                            </Text>
                        </View>

                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: bg, borderTopColor: isDark ? '#333' : '#eee' }]}>
                    <TouchableOpacity style={[styles.button, { backgroundColor: isDark ? '#fff' : '#000' }]} onPress={handleSave}>
                        <Text style={[styles.buttonText, { color: isDark ? '#000' : '#fff' }]}>Guardar en Really</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
        marginTop: Platform.OS === 'android' ? 40 : 0,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
        marginLeft: -8,
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
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        fontSize: 28,
        fontWeight: '500',
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
    daysValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    helperText: {
        color: '#999',
        fontSize: 14,
        marginTop: 8,
    },
    button: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        borderTopWidth: 1,
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
