export type TrendType = 'saved' | 'bought';

export interface TrendItem {
    status: 'waiting' | 'bought' | 'saved';
    price: number;
    createdAt: number;
    resolvedAt?: number;
    category?: string;
    categoryColor?: string;
    categoryIcon?: string;
}

export interface PeriodTotal {
    key: string;
    label: string;
    total: number;
    count: number;
}

export interface CategoryTotal {
    name: string;
    total: number;
    count: number;
    color?: string;
    icon?: string;
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DEFAULT_CATEGORY = 'Otros';

function itemTime(item: TrendItem): number {
    return item.resolvedAt ?? item.createdAt;
}

function monthKey(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getMonthlyTotals(
    items: TrendItem[],
    type: TrendType,
    now: number,
    months: number = 6
): PeriodTotal[] {
    const reference = new Date(now);
    const year = reference.getFullYear();
    const month = reference.getMonth();

    const buckets: PeriodTotal[] = [];
    const indexByKey = new Map<string, number>();
    for (let offset = months - 1; offset >= 0; offset--) {
        const date = new Date(year, month - offset, 1);
        const key = monthKey(date.getFullYear(), date.getMonth());
        indexByKey.set(key, buckets.length);
        buckets.push({ key, label: MONTH_LABELS[date.getMonth()], total: 0, count: 0 });
    }

    for (const item of items) {
        if (item.status !== type) continue;
        const date = new Date(itemTime(item));
        const index = indexByKey.get(monthKey(date.getFullYear(), date.getMonth()));
        if (index === undefined) continue;
        buckets[index].total += item.price;
        buckets[index].count += 1;
    }

    return buckets;
}

export function getWeekdayTotals(items: TrendItem[], type: TrendType): PeriodTotal[] {
    const buckets: PeriodTotal[] = WEEKDAY_LABELS.map((label, index) => ({
        key: String(index),
        label,
        total: 0,
        count: 0,
    }));

    for (const item of items) {
        if (item.status !== type) continue;
        const index = (new Date(itemTime(item)).getDay() + 6) % 7;
        buckets[index].total += item.price;
        buckets[index].count += 1;
    }

    return buckets;
}

export function getCategoryTotals(items: TrendItem[], type: TrendType): CategoryTotal[] {
    const byName = new Map<string, CategoryTotal>();

    for (const item of items) {
        if (item.status !== type) continue;
        const trimmed = item.category?.trim();
        const name = trimmed ? trimmed : DEFAULT_CATEGORY;
        let entry = byName.get(name);
        if (!entry) {
            entry = { name, total: 0, count: 0, color: undefined, icon: undefined };
            byName.set(name, entry);
        }
        entry.total += item.price;
        entry.count += 1;
        if (entry.color === undefined && item.categoryColor) entry.color = item.categoryColor;
        if (entry.icon === undefined && item.categoryIcon) entry.icon = item.categoryIcon;
    }

    return Array.from(byName.values()).sort(
        (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );
}

export function sumTotals(list: { total: number }[]): number {
    return list.reduce((sum, entry) => sum + entry.total, 0);
}
