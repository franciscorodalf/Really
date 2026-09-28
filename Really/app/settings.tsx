import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/themed-text';
import { parseWageInput } from '../utils/workHours';

export default function SettingsScreen() {
    const router = useRouter();
    const { clearAllData, toggleTheme, signOut, user, theme: colorScheme, hourlyWage, setHourlyWage, showNotice } = useStore();
    const AppTheme = Colors[colorScheme];

    const isDark = colorScheme === 'dark';

    const [wageInput, setWageInput] = useState(hourlyWage !== null ? String(hourlyWage) : '');

    useEffect(() => {
        setWageInput(hourlyWage !== null ? String(hourlyWage) : '');
    }, [hourlyWage]);

    const handleSaveWage = async () => {
        const result = parseWageInput(wageInput);
        if (result.kind === 'empty') {
            await setHourlyWage(null);
            return;
        }
        if (result.kind === 'invalid') {
            showNotice({ type: 'error', message: 'Sueldo por hora inválido.', autoHide: true });
            return;
        }
        await setHourlyWage(result.value);
    };

    const handleClearData = () => {
        Alert.alert(
            '¿Estás seguro?',
            'Esto borrará todos tus items y el dinero ahorrado. Esta acción no se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Borrar Todo',
                    style: 'destructive',
                    onPress: async () => {
                        await clearAllData();
                        Alert.alert('Datos borrados', 'Tus datos han sido reiniciados.');
                    }
                },
            ]
        );
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.replace('/login');
        } catch (e) {
            Alert.alert('Error', 'No se pudo cerrar sesión');
        }
    };

    const copySupportId = async () => {
        if (!user) return;
        const shortId = `#${user.uid.slice(-6).toUpperCase()}`;
        await Clipboard.setStringAsync(shortId);
        Alert.alert('Copiado', `ID de soporte ${shortId} copiado al portapapeles`);
    };

    return (
        <View style={[styles.container, { backgroundColor: AppTheme.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={[styles.header, { backgroundColor: AppTheme.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={AppTheme.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={{ color: AppTheme.text }}>Ajustes</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Cuenta</ThemedText>
                    <ThemedText style={[styles.emailText, { color: AppTheme.subtext }]}>{user?.email}</ThemedText>
                    <TouchableOpacity onPress={copySupportId} style={styles.supportIdContainer}>
                        <ThemedText style={[styles.supportIdLabel, { color: AppTheme.subtext }]}>ID de Soporte: </ThemedText>
                        <ThemedText style={[styles.supportIdValue, { color: AppTheme.text }]}>#{user?.uid.slice(-6).toUpperCase()}</ThemedText>
                        <Ionicons name="copy-outline" size={14} color={AppTheme.subtext} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Coste en Horas</ThemedText>
                    <View style={[styles.wageCard, { backgroundColor: AppTheme.surface }]}>
                        <ThemedText style={{ fontSize: 13, color: AppTheme.subtext, lineHeight: 18 }}>
                            Indica tu sueldo por hora para ver cuánto tiempo de trabajo representa cada deseo.
                        </ThemedText>
                        <View style={styles.wageInputRow}>
                            <ThemedText style={[styles.wageCurrency, { color: AppTheme.text }]}>$</ThemedText>
                            <TextInput
                                style={[styles.wageInput, { color: AppTheme.text, borderBottomColor: AppTheme.border }]}
                                placeholder="0.00"
                                placeholderTextColor={AppTheme.subtext}
                                keyboardType="decimal-pad"
                                value={wageInput}
                                onChangeText={setWageInput}
                                onEndEditing={handleSaveWage}
                            />
                            <ThemedText style={{ fontSize: 13, color: AppTheme.subtext, lineHeight: 16 }}>/ hora</ThemedText>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>General</ThemedText>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: AppTheme.surface }]}
                        onPress={() => router.push('/achievements' as any)}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: AppTheme.background }]}>
                                <Ionicons name="trophy-outline" size={20} color={AppTheme.text} />
                            </View>
                            <ThemedText style={{ fontSize: 16 }}>Logros</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={AppTheme.border} />
                    </TouchableOpacity>

                    <View style={[styles.option, { backgroundColor: AppTheme.surface }]}>
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: AppTheme.background }]}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={AppTheme.text} />
                            </View>
                            <ThemedText style={{ fontSize: 16 }}>Tema Oscuro</ThemedText>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#767577', true: AppTheme.primary }}
                            thumbColor={isDark ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Zona de Peligro</ThemedText>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: AppTheme.surface }]}
                        onPress={handleClearData}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: AppTheme.danger + '10' }]}>
                                <Ionicons name="trash" size={20} color={AppTheme.danger} />
                            </View>
                            <ThemedText style={{ color: AppTheme.danger, fontSize: 16 }}>Borrar todos los datos</ThemedText>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: AppTheme.surface }]}
                        onPress={handleSignOut}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: AppTheme.background }]}>
                                <Ionicons name="log-out-outline" size={20} color={AppTheme.subtext} />
                            </View>
                            <ThemedText style={{ fontSize: 16 }}>Cerrar Sesión</ThemedText>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <ThemedText style={styles.version}>Really v1.0.0</ThemedText>
                    <ThemedText style={styles.build}>Build {Constants.expoConfig?.version || '1.0.0'}</ThemedText>
                </View>
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
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
        opacity: 0.6,
    },
    emailText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
        marginLeft: 4,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        opacity: 0.5,
    },
    version: {
        fontSize: 14,
        fontWeight: '500',
    },
    build: {
        fontSize: 12,
        marginTop: 4,
    },
    supportIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 4,
        marginTop: 4,
    },
    supportIdLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    supportIdValue: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    wageCard: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    wageInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    wageCurrency: {
        fontSize: 20,
        lineHeight: 24,
        fontFamily: 'Poppins_500Medium',
    },
    wageInput: {
        flex: 1,
        fontSize: 20,
        fontFamily: 'Poppins_500Medium',
        borderBottomWidth: 1,
        paddingVertical: 6,
    },
});
