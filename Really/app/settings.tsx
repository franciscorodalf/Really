import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

export default function SettingsScreen() {
    const router = useRouter();
    const { clearAllData, theme, toggleTheme, signOut, user } = useStore();

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#f8f9fa';
    const headerBg = isDark ? '#1a1a1a' : '#fff';
    const text = isDark ? '#fff' : '#000';
    const optionBg = isDark ? '#1a1a1a' : '#fff';
    const border = isDark ? '#333' : '#f0f0f0';

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

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: text }]}>Ajustes</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cuenta</Text>
                    <Text style={[styles.emailText, { color: isDark ? '#999' : '#666' }]}>{user?.email}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>General</Text>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: optionBg }]}
                        onPress={() => router.push('/history' as any)}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                                <Ionicons name="time" size={20} color="#1565C0" />
                            </View>
                            <Text style={[styles.optionText, { color: text }]}>Historial</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    <View style={[styles.option, { backgroundColor: optionBg }]}>
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={text} />
                            </View>
                            <Text style={[styles.optionText, { color: text }]}>Tema Oscuro</Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#767577', true: '#81b0ff' }}
                            thumbColor={isDark ? '#f5dd4b' : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Zona de Peligro</Text>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: optionBg }]}
                        onPress={handleClearData}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
                                <Ionicons name="trash" size={20} color="#C62828" />
                            </View>
                            <Text style={[styles.optionText, { color: '#C62828' }]}>Borrar todos los datos</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.option, { backgroundColor: optionBg }]}
                        onPress={handleSignOut}
                    >
                        <View style={styles.optionLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: '#f5f5f5' }]}>
                                <Ionicons name="log-out-outline" size={20} color="#666" />
                            </View>
                            <Text style={[styles.optionText, { color: text }]}>Cerrar Sesión</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.version}>Really v1.0.0</Text>
                    <Text style={styles.build}>Build {Constants.expoConfig?.version || '1.0.0'}</Text>
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
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
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
    optionText: {
        fontSize: 16,
        fontWeight: '500',
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    version: {
        color: '#999',
        fontSize: 14,
        fontWeight: '500',
    },
    build: {
        color: '#ccc',
        fontSize: 12,
        marginTop: 4,
    },
});
