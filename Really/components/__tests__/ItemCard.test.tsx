import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ItemCard } from '../ItemCard';
import { Item } from '../../context/StoreContext';

const mockItem: Item = {
    id: '1',
    name: 'Test Item',
    price: 100,
    createdAt: Date.now(),
    unlockAt: Date.now() + 10000, // Future
    status: 'waiting',
    category: 'Test',
};

describe('ItemCard', () => {
    it('renders item details correctly', () => {
        const { getByText } = render(
            <ItemCard item={mockItem} onResolve={() => { }} onDelete={() => { }} />
        );

        expect(getByText('Test Item')).toBeTruthy();
        expect(getByText('$100.00')).toBeTruthy();
    });

    it('shows buy/save buttons when ready', () => {
        const readyItem: Item = {
            ...mockItem,
            unlockAt: Date.now() - 1000, // Past
        };

        const { getByText } = render(
            <ItemCard item={readyItem} onResolve={() => { }} onDelete={() => { }} />
        );

        expect(getByText('¡Es hora de decidir!')).toBeTruthy();
        expect(getByText('Comprar')).toBeTruthy();
        expect(getByText('Ahorrar')).toBeTruthy();
    });

    it('calls onResolve when buttons are pressed', () => {
        const readyItem: Item = {
            ...mockItem,
            unlockAt: Date.now() - 1000, // Past
        };
        const onResolveMock = jest.fn();

        const { getByText } = render(
            <ItemCard item={readyItem} onResolve={onResolveMock} onDelete={() => { }} />
        );

        fireEvent.press(getByText('Comprar'));
        expect(onResolveMock).toHaveBeenCalledWith('1', 'buy');

        fireEvent.press(getByText('Ahorrar'));
        expect(onResolveMock).toHaveBeenCalledWith('1', 'save');
    });
});
