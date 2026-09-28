import { calculateWorkHours, formatWorkHours, parseWageInput } from '../workHours';

describe('parseWageInput', () => {
    it('devuelve "empty" cuando el texto está vacío o solo tiene espacios', () => {
        expect(parseWageInput('')).toEqual({ kind: 'empty' });
        expect(parseWageInput('   ')).toEqual({ kind: 'empty' });
    });

    it('parsea números con punto decimal', () => {
        expect(parseWageInput('12.5')).toEqual({ kind: 'valid', value: 12.5 });
    });

    it('parsea números con coma decimal (formato español)', () => {
        expect(parseWageInput('12,5')).toEqual({ kind: 'valid', value: 12.5 });
    });

    it('devuelve "invalid" cuando el texto no es un número', () => {
        expect(parseWageInput('abc')).toEqual({ kind: 'invalid' });
        expect(parseWageInput('12.5abc')).toEqual({ kind: 'invalid' });
    });
});

describe('calculateWorkHours', () => {
    it('calcula las horas dividiendo el precio entre el sueldo por hora', () => {
        expect(calculateWorkHours(100, 10)).toBe(10);
    });

    it('devuelve null cuando no hay sueldo configurado', () => {
        expect(calculateWorkHours(100, null)).toBeNull();
        expect(calculateWorkHours(100, undefined)).toBeNull();
        expect(calculateWorkHours(100, 0)).toBeNull();
        expect(calculateWorkHours(100, -5)).toBeNull();
    });

    it('devuelve null cuando el precio no es válido', () => {
        expect(calculateWorkHours(0, 10)).toBeNull();
        expect(calculateWorkHours(-50, 10)).toBeNull();
        expect(calculateWorkHours(NaN, 10)).toBeNull();
    });
});

describe('formatWorkHours', () => {
    it('devuelve null cuando calculateWorkHours devuelve null', () => {
        expect(formatWorkHours(100, null)).toBeNull();
        expect(formatWorkHours(0, 10)).toBeNull();
    });

    it('muestra minutos cuando el resultado es menos de una hora', () => {
        expect(formatWorkHours(5, 60)).toBe('≈ 5 min de trabajo');
    });

    it('muestra horas con un decimal para valores típicos', () => {
        expect(formatWorkHours(100, 10)).toBe('≈ 10.0h de trabajo');
    });

    it('muestra horas redondeadas a entero para valores muy grandes', () => {
        expect(formatWorkHours(100000, 10)).toBe('≈ 10000h de trabajo');
    });
});
