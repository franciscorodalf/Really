export interface WageInputEmpty {
    kind: 'empty';
}

export interface WageInputValid {
    kind: 'valid';
    value: number;
}

export interface WageInputInvalid {
    kind: 'invalid';
}

export type WageInputParseResult = WageInputEmpty | WageInputValid | WageInputInvalid;

export function parseWageInput(text: string): WageInputParseResult {
    const trimmed = text.trim();
    if (trimmed === '') {
        return { kind: 'empty' };
    }
    const normalized = trimmed.replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
        return { kind: 'invalid' };
    }
    return { kind: 'valid', value };
}

export function calculateWorkHours(price: number, hourlyWage: number | null | undefined): number | null {
    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }
    if (!hourlyWage || !Number.isFinite(hourlyWage) || hourlyWage <= 0) {
        return null;
    }
    return price / hourlyWage;
}

export function formatWorkHours(price: number, hourlyWage: number | null | undefined): string | null {
    const hours = calculateWorkHours(price, hourlyWage);
    if (hours === null) {
        return null;
    }
    if (hours < 1) {
        const minutes = Math.max(1, Math.round(hours * 60));
        return `≈ ${minutes} min de trabajo`;
    }
    if (hours < 100) {
        return `≈ ${hours.toFixed(1)}h de trabajo`;
    }
    return `≈ ${Math.round(hours)}h de trabajo`;
}
