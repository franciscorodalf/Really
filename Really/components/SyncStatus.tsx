import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './themed-text';
import { Colors } from '../constants/Colors';
import { useStore } from '../context/StoreContext';

const pendingLabel = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

export default function SyncStatus() {
    const { theme: colorScheme, syncStatus } = useStore();
    const { isOnline, pendingCount } = syncStatus;

    if (isOnline && pendingCount === 0) return null;

    const theme = Colors[colorScheme];
    const offline = !isOnline;
    // El acento (gris sin conexión, primario sincronizando) solo tiñe borde, fondo e icono; el texto
    // usa el color de texto del tema para mantener el contraste sobre el tinte.
    const accent = offline ? theme.subtext : theme.primary;
    const iconName = offline ? 'cloud-offline-outline' : 'sync-outline';

    let label: string;
    if (offline) {
        label =
            pendingCount > 0
                ? `Sin conexión · ${pendingLabel(pendingCount, 'cambio pendiente', 'cambios pendientes')}`
                : 'Sin conexión';
    } else {
        label = `Sincronizando · ${pendingLabel(pendingCount, 'cambio', 'cambios')}`;
    }

    return (
        <View style={styles.wrapper}>
            <View
                testID="sync-status"
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                style={[styles.pill, { backgroundColor: `${accent}1A`, borderColor: accent }]}
            >
                <Ionicons
                    name={iconName}
                    size={14}
                    color={accent}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                />
                <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // La cabecera ya deja 24 de margen inferior: -8 arriba y 16 abajo dejan 16 a cada lado.
    wrapper: {
        alignItems: 'center',
        marginTop: -8,
        marginBottom: 16,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 100,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    label: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
});
