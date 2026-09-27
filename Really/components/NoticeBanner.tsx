import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { Colors } from '../constants/Colors';
import { Notice, useStore } from '../context/StoreContext';

interface NoticeBannerProps {
    notice: Notice | null;
    onDismiss: () => void;
}

export function NoticeBanner({ notice, onDismiss }: NoticeBannerProps) {
    const insets = useSafeAreaInsets();
    const { theme: colorScheme } = useStore();
    const theme = Colors[colorScheme];

    useEffect(() => {
        if (!notice) return;
        if (notice.autoHide === false) return;
        const timeout = setTimeout(() => {
            onDismiss();
        }, 2500);
        return () => clearTimeout(timeout);
    }, [notice, onDismiss]);

    if (!notice) return null;
    const baseColor =
        notice.type === 'success'
            ? theme.success
            : notice.type === 'error'
                ? theme.danger
                : theme.primary;
    const bg = `${baseColor}1A`;
    const textColor = baseColor;

    return (
        <Animated.View
            entering={SlideInDown.duration(200)}
            exiting={SlideOutUp.duration(200)}
            style={[styles.container, { paddingTop: insets.top + 12 }]}
        >
            <View style={[styles.banner, { backgroundColor: bg, borderColor: textColor }]}>
                <ThemedText style={[styles.message, { color: textColor }]}>{notice.message}</ThemedText>
                <View style={styles.actions}>
                    {notice.actionLabel && notice.onAction && (
                        <Pressable onPress={notice.onAction} style={styles.actionButton}>
                            <ThemedText style={[styles.actionText, { color: textColor }]}>{notice.actionLabel}</ThemedText>
                        </Pressable>
                    )}
                    <Pressable onPress={onDismiss} style={styles.actionButton}>
                        <ThemedText style={[styles.actionText, { color: textColor }]}>Cerrar</ThemedText>
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    banner: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    message: {
        fontSize: 14,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        paddingVertical: 2,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
