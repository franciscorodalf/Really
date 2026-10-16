import { calculateDefenseRate, computeCurrentStreak, GamificationItem } from '../gamificationStats';

const saved = (resolvedAt: number): GamificationItem => ({ status: 'saved', resolvedAt, createdAt: resolvedAt - 1000 });
const bought = (resolvedAt: number): GamificationItem => ({ status: 'bought', resolvedAt, createdAt: resolvedAt - 1000 });
const waiting = (createdAt: number): GamificationItem => ({ status: 'waiting', createdAt });

describe('calculateDefenseRate', () => {
    it('devuelve null cuando no hay ningún ítem resuelto', () => {
        expect(calculateDefenseRate([])).toBeNull();
        expect(calculateDefenseRate([waiting(1)])).toBeNull();
    });

    it('calcula el porcentaje de ítems ahorrados sobre el total resuelto', () => {
        expect(calculateDefenseRate([saved(1), saved(2), bought(3)])).toBeCloseTo(66.6666, 3);
    });

    it('devuelve 100 cuando todos los resueltos están ahorrados', () => {
        expect(calculateDefenseRate([saved(1), saved(2)])).toBe(100);
    });

    it('devuelve 0 cuando todos los resueltos fueron comprados', () => {
        expect(calculateDefenseRate([bought(1), bought(2)])).toBe(0);
    });

    it('ignora los ítems todavía en espera', () => {
        expect(calculateDefenseRate([saved(1), waiting(2)])).toBe(100);
    });

    it('no depende del orden en el que llegan los ítems', () => {
        const inOrder = calculateDefenseRate([bought(1), saved(2), saved(3)]);
        const shuffled = calculateDefenseRate([saved(3), bought(1), saved(2)]);
        expect(shuffled).toBe(inOrder);
    });
});

describe('computeCurrentStreak', () => {
    it('devuelve 0 cuando no hay ítems resueltos', () => {
        expect(computeCurrentStreak([])).toBe(0);
        expect(computeCurrentStreak([waiting(1)])).toBe(0);
    });

    it('cuenta los ahorros consecutivos más recientes', () => {
        const items = [bought(1), saved(2), saved(3), saved(4)];
        expect(computeCurrentStreak(items)).toBe(3);
    });

    it('se reinicia a 0 cuando la resolución más reciente fue una compra', () => {
        const items = [saved(1), saved(2), saved(3), bought(4)];
        expect(computeCurrentStreak(items)).toBe(0);
    });

    it('no depende del orden en el que llegan los ítems', () => {
        // Cronológicamente: @2 saved, @3 bought, @4 saved, @5 saved -> racha actual = 2
        const items = [saved(5), bought(3), saved(4), saved(2)];
        expect(computeCurrentStreak(items)).toBe(2);
    });

    it('ignora los ítems todavía en espera', () => {
        const items = [saved(1), saved(2), waiting(3)];
        expect(computeCurrentStreak(items)).toBe(2);
    });
});
