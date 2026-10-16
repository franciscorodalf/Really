import React from 'react';
import { renderWithStore } from '../../test-utils/renderWithStore';
import { TrendCharts } from '../TrendCharts';
import type { TrendItem } from '../../utils/trendStats';

jest.mock('react-native-gifted-charts', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        BarChart: () => React.createElement(View, { testID: 'bar-chart' }),
        PieChart: () => React.createElement(View, { testID: 'pie-chart' }),
    };
});

const NOW = new Date(2026, 9, 15, 12).getTime();
const RESOLVED_THIS_MONTH = new Date(2026, 9, 10, 12).getTime();
const RESOLVED_LONG_AGO = new Date(2026, 0, 10, 12).getTime();

function makeItem(overrides: Partial<TrendItem> = {}): TrendItem {
    return {
        status: 'saved',
        price: 50,
        createdAt: RESOLVED_THIS_MONTH,
        resolvedAt: RESOLVED_THIS_MONTH,
        category: 'Ropa',
        categoryColor: '#FF0000',
        ...overrides,
    };
}

describe('TrendCharts', () => {
    it('muestra el estado vacío de ahorro cuando no hay ítems', () => {
        const { getByText, queryByTestId } = renderWithStore(
            <TrendCharts items={[]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(getByText('Todavía no hay datos de ahorro para mostrar tendencias.')).toBeTruthy();
        expect(queryByTestId('bar-chart')).toBeNull();
        expect(queryByTestId('pie-chart')).toBeNull();
    });

    it('muestra el estado vacío de gasto cuando no hay ítems', () => {
        const { getByText } = renderWithStore(
            <TrendCharts items={[]} type="bought" accentColor="#FF7675" now={NOW} />
        );

        expect(getByText('Todavía no hay datos de gasto para mostrar tendencias.')).toBeTruthy();
    });

    it('filtra por tipo: ítems comprados con type="saved" dan estado vacío', () => {
        const { getByText, queryByTestId } = renderWithStore(
            <TrendCharts items={[makeItem({ status: 'bought' })]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(getByText('Todavía no hay datos de ahorro para mostrar tendencias.')).toBeTruthy();
        expect(queryByTestId('bar-chart')).toBeNull();
    });

    it('renderiza las tres tarjetas con 2 gráficas de barras y 1 circular', () => {
        const { getByText, getAllByTestId } = renderWithStore(
            <TrendCharts items={[makeItem()]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(getByText('Evolución mensual')).toBeTruthy();
        expect(getByText('Por día de la semana')).toBeTruthy();
        expect(getByText('Por categoría')).toBeTruthy();
        expect(getAllByTestId('bar-chart')).toHaveLength(2);
        expect(getAllByTestId('pie-chart')).toHaveLength(1);
        expect(getByText('Total 6 meses: $50')).toBeTruthy();
    });

    it('muestra la leyenda de categorías con importe y porcentaje', () => {
        const { getByText } = renderWithStore(
            <TrendCharts
                items={[makeItem({ price: 75 }), makeItem({ price: 25, category: 'Tech' })]}
                type="saved"
                accentColor="#00B894"
                now={NOW}
            />
        );

        expect(getByText('Ropa')).toBeTruthy();
        expect(getByText('$75 · 75%')).toBeTruthy();
        expect(getByText('Tech')).toBeTruthy();
        expect(getByText('$25 · 25%')).toBeTruthy();
    });

    it('sin actividad en 6 meses muestra el aviso y conserva las otras gráficas', () => {
        const old = makeItem({ createdAt: RESOLVED_LONG_AGO, resolvedAt: RESOLVED_LONG_AGO });
        const { getByText, getAllByTestId } = renderWithStore(
            <TrendCharts items={[old]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(getByText('Sin actividad en los últimos 6 meses.')).toBeTruthy();
        // Solo queda la gráfica semanal (la mensual se sustituye por el aviso).
        expect(getAllByTestId('bar-chart')).toHaveLength(1);
        expect(getAllByTestId('pie-chart')).toHaveLength(1);
        expect(getByText('Por día de la semana')).toBeTruthy();
        expect(getByText('Por categoría')).toBeTruthy();
    });

    it('muestra el equivalente en horas de trabajo cuando hay sueldo configurado', () => {
        const { getByText } = renderWithStore(
            <TrendCharts items={[makeItem({ price: 100 })]} type="saved" accentColor="#00B894" now={NOW} />,
            { hourlyWage: 10 }
        );

        expect(getByText('≈ 10.0h de trabajo')).toBeTruthy();
    });

    it('no muestra horas de trabajo sin sueldo configurado', () => {
        const { queryByText } = renderWithStore(
            <TrendCharts items={[makeItem({ price: 100 })]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(queryByText(/de trabajo/)).toBeNull();
    });

    it('un ítem sin categoría, color ni resolvedAt no lanza y aparece en Otros', () => {
        const bare: TrendItem = {
            status: 'saved',
            price: 30,
            createdAt: RESOLVED_THIS_MONTH,
        };

        const { getByText } = renderWithStore(
            <TrendCharts items={[bare]} type="saved" accentColor="#00B894" now={NOW} />
        );

        expect(getByText('Otros')).toBeTruthy();
    });
});
