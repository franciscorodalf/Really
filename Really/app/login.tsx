import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../context/StoreContext';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, signUp, theme } = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    const validatePassword = (pass: string) => {
        if (pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        if (!/[A-Z]/.test(pass)) return 'La contraseña debe tener al menos una mayúscula';
        if (!/[0-9]/.test(pass)) return 'La contraseña debe tener al menos un número';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return 'La contraseña debe tener al menos un carácter especial';
        return null;
    };

    const sanitizeInput = (text: string) => {
        // Remove potential script tags and trim
        return text.replace(/<[^>]*>/g, '').trim();
    };

    const handleAuth = async () => {
        const cleanEmail = sanitizeInput(email);
        const cleanPassword = password; // Don't sanitize password characters, just validate

        if (!cleanEmail || !cleanPassword) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        if (isRegistering) {
            const passwordError = validatePassword(cleanPassword);
            if (passwordError) {
                Alert.alert('Contraseña débil', passwordError);
                return;
            }
        }

        setLoading(true);
        try {
            if (isRegistering) {
                await signUp(cleanEmail, cleanPassword);
            } else {
                await signIn(cleanEmail, cleanPassword);
            }
            // Router will be handled by auth state listener in _layout or index
            router.replace('/');
        } catch (error: any) {
            let msg = error.message;
            if (error.code === 'auth/invalid-email') msg = 'Email inválido';
            if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
            if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
            if (error.code === 'auth/email-already-in-use') msg = 'El email ya está registrado';
            if (error.code === 'auth/weak-password') msg = 'La contraseña es muy débil';

            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const isDark = theme === 'dark';
    const bg = isDark ? '#000' : '#fff';
    const text = isDark ? '#fff' : '#000';
    const inputBg = isDark ? '#1a1a1a' : '#f5f5f5';

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: bg }]}
        >
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <View style={styles.content}>
                <Text style={[styles.title, { color: text }]}>Really</Text>
                <Text style={[styles.subtitle, { color: isDark ? '#ccc' : '#666' }]}>
                    {isRegistering ? 'Crea una cuenta' : 'Inicia sesión'}
                </Text>

                <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: text }]}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: text }]}
                    placeholder="Contraseña"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: isDark ? '#fff' : '#000' }]}
                    onPress={handleAuth}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={isDark ? '#000' : '#fff'} />
                    ) : (
                        <Text style={[styles.buttonText, { color: isDark ? '#000' : '#fff' }]}>
                            {isRegistering ? 'Registrarse' : 'Entrar'}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchButton}>
                    <Text style={[styles.switchText, { color: isDark ? '#ccc' : '#666' }]}>
                        {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    content: {
        gap: 16,
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        marginBottom: -8,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: '500',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        padding: 20,
        borderRadius: 16,
        marginBottom: 8,
    },
    button: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    switchButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    switchText: {
        fontSize: 14,
    },
});
