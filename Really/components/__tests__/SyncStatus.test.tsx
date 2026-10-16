import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import SyncStatus from '../SyncStatus';
import { useStore } from '../../context/StoreContext';
import { Colors } from '../../constants/Colors';

// Se sustituye todo el módulo: SyncStatus (y ThemedText) solo consumen useStore,
// así no hace falta arrastrar Firebase al test.
jest.mock('../../context/StoreContext', () => ({
    useStore: jest.fn(),
}));

const mockUseStore = useStore as jest.Mock;

const setSyncStatus = (syncStatus: { isOnline: boolean; pendingCount: number; isSyncing: boolean }, theme = 'light') => {
    mockUseStore.mockReturnValue({ theme, syncStatus });
};

describe('SyncStatus', () => {
    it('no renderiza nada con red y sin pendientes', () => {
        setSyncStatus({ isOnline: true, pendingCount: 0, isSyncing: false });
        const { toJSON } = render(<SyncStatus />);
        expect(toJSON()).toBeNull();
    });

    it('muestra «Sin conexión» sin pendientes', () => {
        setSyncStatus({ isOnline: false, pendingCount: 0, isSyncing: false });
        const { getByText } = render(<SyncStatus />);
        expect(getByText('Sin conexión')).toBeTruthy();
    });

    it('pluraliza los pendientes sin conexión', () => {
        setSyncStatus({ isOnline: false, pendingCount: 1, isSyncing: false });
        const first = render(<SyncStatus />);
        expect(first.getByText('Sin conexión · 1 cambio pendiente')).toBeTruthy();
        first.unmount();

        setSyncStatus({ isOnline: false, pendingCount: 3, isSyncing: false }, 'dark');
        const second = render(<SyncStatus />);
        expect(second.getByText('Sin conexión · 3 cambios pendientes')).toBeTruthy();
    });

    it('muestra «Sincronizando · 1 cambio» con red y una operación pendiente', () => {
        setSyncStatus({ isOnline: true, pendingCount: 1, isSyncing: true });
        const { getByText } = render(<SyncStatus />);
        expect(getByText('Sincronizando · 1 cambio')).toBeTruthy();
    });

    it('pluraliza «Sincronizando» con varias operaciones', () => {
        setSyncStatus({ isOnline: true, pendingCount: 4, isSyncing: false });
        const { getByText } = render(<SyncStatus />);
        expect(getByText('Sincronizando · 4 cambios')).toBeTruthy();
    });

    it.each(['light', 'dark'] as const)('el texto usa el color de texto del tema (%s), no el acento', (theme) => {
        setSyncStatus({ isOnline: true, pendingCount: 2, isSyncing: true }, theme);
        const { getByText } = render(<SyncStatus />);
        const style = StyleSheet.flatten(getByText('Sincronizando · 2 cambios').props.style);
        expect(style.color).toBe(Colors[theme].text);
    });

    it('anuncia los cambios a lectores de pantalla y oculta el icono decorativo', () => {
        setSyncStatus({ isOnline: false, pendingCount: 1, isSyncing: false });
        const { getByTestId, UNSAFE_getByProps } = render(<SyncStatus />);
        const pill = getByTestId('sync-status');
        expect(pill.props.accessibilityRole).toBe('text');
        expect(pill.props.accessibilityLiveRegion).toBe('polite');
        const icon = UNSAFE_getByProps({ name: 'cloud-offline-outline' });
        expect(icon.props.accessibilityElementsHidden).toBe(true);
        expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
    });
});
