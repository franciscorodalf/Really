import {
    getCategoryTotals,
    getMonthlyTotals,
    getWeekdayTotals,
    sumTotals,
    TrendItem,
} from '../trendStats';

const NOW = new Date(2026, 9, 15, 12).getTime();

const item = (overrides: Partial<TrendItem> & { at: Date }): TrendItem => {
    const { at, ...rest } = overrides;
    return {
        status: 'saved',
        price: 10,
        createdAt: at.getTime() - 1000,
        resolvedAt: at.getTime(),
        ...rest,
    };
};

describe('getMonthlyTotals', () => {
    it('devuelve 6 entradas, la más antigua primero, con keys y labels en español', () => {
        const result = getMonthlyTotals([], 'saved', NOW);
        expect(result).toHaveLength(6);
        expect(result.map((r) => r.key)).toEqual([
            '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
        ]);
        expect(result.map((r) => r.label)).toEqual(['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']);
    });

    it('suma el precio y cuenta los ítems de cada mes', () => {
        const items = [
            item({ at: new Date(2026, 9, 3), price: 20 }),
            item({ at: new Date(2026, 9, 10), price: 5.5 }),
            item({ at: new Date(2026, 7, 20), price: 100 }),
        ];
        const result = getMonthlyTotals(items, 'saved', NOW);
        expect(result[5]).toMatchObject({ key: '2026-10', total: 25.5, count: 2 });
        expect(result[3]).toMatchObject({ key: '2026-08', total: 100, count: 1 });
    });

    it('rellena con 0 los meses sin ítems', () => {
        const result = getMonthlyTotals([item({ at: new Date(2026, 9, 3) })], 'saved', NOW);
        expect(result.slice(0, 5).every((r) => r.total === 0 && r.count === 0)).toBe(true);
    });

    it('cruza el cambio de año hacia atrás', () => {
        const result = getMonthlyTotals([], 'saved', new Date(2026, 0, 15).getTime());
        expect(result.map((r) => r.key)).toEqual([
            '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
        ]);
        expect(result.map((r) => r.label)).toEqual(['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene']);
    });

    it('ignora los ítems fuera de la ventana', () => {
        const items = [
            item({ at: new Date(2026, 3, 30, 23, 59) }),
            item({ at: new Date(2026, 10, 1, 0, 0) }),
            item({ at: new Date(2025, 9, 15) }),
        ];
        const result = getMonthlyTotals(items, 'saved', NOW);
        expect(result.every((r) => r.total === 0 && r.count === 0)).toBe(true);
    });

    it('filtra por tipo e ignora los ítems en espera', () => {
        const items = [
            item({ at: new Date(2026, 9, 3), status: 'saved', price: 10 }),
            item({ at: new Date(2026, 9, 4), status: 'bought', price: 30 }),
            item({ at: new Date(2026, 9, 5), status: 'waiting', price: 99 }),
        ];
        expect(getMonthlyTotals(items, 'saved', NOW)[5]).toMatchObject({ total: 10, count: 1 });
        expect(getMonthlyTotals(items, 'bought', NOW)[5]).toMatchObject({ total: 30, count: 1 });
    });

    it('usa createdAt cuando falta resolvedAt', () => {
        const items: TrendItem[] = [
            { status: 'saved', price: 12, createdAt: new Date(2026, 8, 10).getTime() },
        ];
        const result = getMonthlyTotals(items, 'saved', NOW);
        expect(result[4]).toMatchObject({ key: '2026-09', total: 12, count: 1 });
    });

    it('respeta la frontera local entre meses', () => {
        const items = [
            item({ at: new Date(2026, 9, 1, 0, 0), price: 1 }),
            item({ at: new Date(2026, 8, 30, 23, 59), price: 2 }),
        ];
        const result = getMonthlyTotals(items, 'saved', NOW);
        expect(result[5]).toMatchObject({ key: '2026-10', total: 1, count: 1 });
        expect(result[4]).toMatchObject({ key: '2026-09', total: 2, count: 1 });
    });

    it('respeta el argumento months', () => {
        const result = getMonthlyTotals([], 'saved', NOW, 3);
        expect(result.map((r) => r.key)).toEqual(['2026-08', '2026-09', '2026-10']);
    });

    it('no muta el array recibido', () => {
        const items = [item({ at: new Date(2026, 9, 3) })];
        const copy = JSON.parse(JSON.stringify(items));
        getMonthlyTotals(items, 'saved', NOW);
        expect(items).toEqual(copy);
    });
});

describe('getWeekdayTotals', () => {
    it('devuelve 7 entradas con lunes primero', () => {
        const result = getWeekdayTotals([], 'saved');
        expect(result).toHaveLength(7);
        expect(result.map((r) => r.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
        expect(result.map((r) => r.key)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    });

    it('sin ítems devuelve 7 entradas a 0', () => {
        const result = getWeekdayTotals([], 'bought');
        expect(result.every((r) => r.total === 0 && r.count === 0)).toBe(true);
    });

    it('coloca el lunes en el índice 0 y el domingo en el 6', () => {
        const items = [
            item({ at: new Date(2026, 9, 5, 0, 30), price: 7 }),
            item({ at: new Date(2026, 9, 4, 23, 30), price: 3 }),
        ];
        const result = getWeekdayTotals(items, 'saved');
        expect(result[0]).toMatchObject({ total: 7, count: 1 });
        expect(result[6]).toMatchObject({ total: 3, count: 1 });
    });

    it('filtra por tipo e ignora los ítems en espera', () => {
        const items = [
            item({ at: new Date(2026, 9, 5), status: 'saved', price: 10 }),
            item({ at: new Date(2026, 9, 5), status: 'bought', price: 20 }),
            item({ at: new Date(2026, 9, 5), status: 'waiting', price: 40 }),
        ];
        expect(getWeekdayTotals(items, 'saved')[0]).toMatchObject({ total: 10, count: 1 });
        expect(getWeekdayTotals(items, 'bought')[0]).toMatchObject({ total: 20, count: 1 });
    });
});

describe('getCategoryTotals', () => {
    it('devuelve [] sin ítems', () => {
        expect(getCategoryTotals([], 'saved')).toEqual([]);
    });

    it('agrupa por categoría sumando total y count', () => {
        const items = [
            item({ at: new Date(2026, 9, 1), category: 'Ropa', price: 10 }),
            item({ at: new Date(2026, 9, 2), category: 'Ropa', price: 15 }),
            item({ at: new Date(2026, 9, 3), category: 'Tech', price: 5 }),
        ];
        expect(getCategoryTotals(items, 'saved')).toEqual([
            { name: 'Ropa', total: 25, count: 2, color: undefined, icon: undefined },
            { name: 'Tech', total: 5, count: 1, color: undefined, icon: undefined },
        ]);
    });

    it('agrupa en Otros las categorías ausentes o en blanco', () => {
        const items = [
            item({ at: new Date(2026, 9, 1), price: 4 }),
            item({ at: new Date(2026, 9, 2), category: '  ', price: 6 }),
        ];
        const result = getCategoryTotals(items, 'saved');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: 'Otros', total: 10, count: 2 });
    });

    it('ordena por total descendente y desempata por nombre', () => {
        const items = [
            item({ at: new Date(2026, 9, 1), category: 'Zeta', price: 10 }),
            item({ at: new Date(2026, 9, 1), category: 'Alfa', price: 10 }),
            item({ at: new Date(2026, 9, 1), category: 'Mayor', price: 50 }),
        ];
        expect(getCategoryTotals(items, 'saved').map((c) => c.name)).toEqual(['Mayor', 'Alfa', 'Zeta']);
    });

    it('conserva el primer color e icono definidos de cada categoría', () => {
        const items = [
            item({ at: new Date(2026, 9, 1), category: 'Ropa' }),
            item({ at: new Date(2026, 9, 2), category: 'Ropa', categoryColor: '#111', categoryIcon: 'shirt' }),
            item({ at: new Date(2026, 9, 3), category: 'Ropa', categoryColor: '#222', categoryIcon: 'bag' }),
        ];
        const result = getCategoryTotals(items, 'saved');
        expect(result[0].color).toBe('#111');
        expect(result[0].icon).toBe('shirt');
    });

    it('filtra por tipo e ignora los ítems en espera', () => {
        const items = [
            item({ at: new Date(2026, 9, 1), status: 'saved', category: 'A', price: 10 }),
            item({ at: new Date(2026, 9, 1), status: 'bought', category: 'B', price: 20 }),
            item({ at: new Date(2026, 9, 1), status: 'waiting', category: 'C', price: 30 }),
        ];
        expect(getCategoryTotals(items, 'saved').map((c) => c.name)).toEqual(['A']);
        expect(getCategoryTotals(items, 'bought').map((c) => c.name)).toEqual(['B']);
    });
});

describe('sumTotals', () => {
    it('suma los totales de la lista', () => {
        expect(sumTotals([{ total: 1.5 }, { total: 2 }, { total: 0 }])).toBe(3.5);
    });

    it('devuelve 0 con una lista vacía', () => {
        expect(sumTotals([])).toBe(0);
    });
});
