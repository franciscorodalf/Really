import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { StoreProvider } from '../../test-utils/renderWithStore';
import { useThemeColor } from '../use-theme-color';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StoreProvider>{children}</StoreProvider>
);

describe('useThemeColor', () => {
    it('devuelve el color "light" de constants/Colors cuando no hay override de props', () => {
        const { result } = renderHook(() => useThemeColor({}, 'primary'), { wrapper });
        expect(result.current).toBe('#6C5CE7');
    });

    it('prioriza el color pasado por props sobre el de constants/Colors', () => {
        const { result } = renderHook(
            () => useThemeColor({ light: '#123456', dark: '#654321' }, 'primary'),
            { wrapper }
        );
        expect(result.current).toBe('#123456');
    });
});
