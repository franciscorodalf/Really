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
    // Sin conexión usa el color de aviso del tema; sincronizando, el primario.
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
            <View style={[styles.pill, { backgroundColor: `${accent}1A`, borderColor: accent }]}>
                <Ionicons name={iconName} size={14} color={accent} />
                <ThemedText style={[styles.label, { color: accent }]}>{label}</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        marginVertical: 8,
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
