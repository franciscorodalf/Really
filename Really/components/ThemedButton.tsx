import React from 'react';
import { Text, StyleSheet, TouchableOpacityProps, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

const AnimatedTouchable = Animated.createAnimatedComponent(LinearGradient);
const AnimatedView = Animated.createAnimatedComponent(React.Fragment); // Simplified for now, actually we need a wrapper

interface ThemedButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    onPress: () => void;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
}

export function ThemedButton({ title, variant = 'primary', onPress, style, textStyle, icon, ...props }: ThemedButtonProps) {
    const scale = useSharedValue(1);
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.96);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    let bgColors: readonly [string, string, ...string[]] = ['transparent', 'transparent'];
    let textColor = '#fff';
    let borderWidth = 0;
    let borderColor = 'transparent';

    switch (variant) {
        case 'primary':
            bgColors = [theme.primary, '#8257E5']; // Electric Violet Gradient
            break;
        case 'secondary':
            bgColors = [theme.secondary, '#00b894']; // Mint Green Gradient
            break;
        case 'outline':
            bgColors = ['transparent', 'transparent'];
            textColor = theme.primary;
            borderWidth = 2;
            borderColor = theme.primary;
            break;
        case 'ghost':
            bgColors = ['transparent', 'transparent'];
            textColor = theme.subtext;
            break;
    }

    // If outline/ghost, we can't really use LinearGradient for border easily without masking, 
    // so for outline we just use the container style.
    // Actually LinearGradient requires colors.

    return (
        <Animated.View style={[animatedStyle, { width: '100%' }]}>
            <LinearGradient
                colors={bgColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.button,
                    {
                        borderWidth,
                        borderColor,
                    },
                    style,
                ]}
                onTouchStart={handlePressIn}
                onTouchEnd={handlePressOut}
            // Basic touch handling. ideally upgrade to Pressable or TouchableOpacity wrapping
            >
                {/* We need a Pressable/Touchable for the actual press event if we want standard behavior */}
                <Text style={[styles.text, { color: textColor, fontFamily: 'Outfit_700Bold' }, textStyle]} onPress={onPress}>
                    {icon && <>{icon}  </>}
                    {title}
                </Text>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
    },
    text: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
