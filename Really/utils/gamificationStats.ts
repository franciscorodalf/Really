export interface GamificationItem {
    status: 'waiting' | 'bought' | 'saved';
    resolvedAt?: number;
    createdAt: number;
}

export function calculateDefenseRate(items: GamificationItem[]): number | null {
    const resolved = items.filter((item) => item.status === 'saved' || item.status === 'bought');
    if (resolved.length === 0) {
        return null;
    }
    const savedCount = resolved.filter((item) => item.status === 'saved').length;
    return (savedCount / resolved.length) * 100;
}

export function computeCurrentStreak(items: GamificationItem[]): number {
    const resolved = items
        .filter((item) => item.status === 'saved' || item.status === 'bought')
        .slice()
        .sort((a, b) => (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt));

    let streak = 0;
    for (const item of resolved) {
        if (item.status === 'saved') {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}
