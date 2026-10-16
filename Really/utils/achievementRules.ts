import { ACHIEVEMENTS } from '../context/types';

export interface SaveAchievementInput {
    current: string[];
    newSaved: number;
    newSavedCount: number;
    newStreak: number;
}

export interface SaveAchievementResult {
    achievements: string[];
    earned: string[];
}

interface AchievementRule {
    id: string;
    test: (input: SaveAchievementInput) => boolean;
}

// El orden de esta tabla es el orden en que se otorgan (y se notifican) los logros.
const SAVE_RULES: AchievementRule[] = [
    { id: 'first_save', test: () => true },
    { id: 'saver_10', test: (i) => i.newSavedCount >= 10 },
    { id: 'saver_100', test: (i) => i.newSaved >= 100 },
    { id: 'saver_200', test: (i) => i.newSaved >= 200 },
    { id: 'saver_1000', test: (i) => i.newSaved >= 1000 },
    { id: 'saver_2000', test: (i) => i.newSaved >= 2000 },
    { id: 'saver_5000', test: (i) => i.newSaved >= 5000 },
    { id: 'saver_10000', test: (i) => i.newSaved >= 10000 },
    { id: 'streak_3', test: (i) => i.newStreak >= 3 },
    { id: 'streak_5', test: (i) => i.newStreak >= 5 },
    { id: 'streak_10', test: (i) => i.newStreak >= 10 },
];

export function awardSaveAchievements(input: SaveAchievementInput): SaveAchievementResult {
    const achievements = [...input.current];
    const earned: string[] = [];

    for (const rule of SAVE_RULES) {
        if (achievements.includes(rule.id) || !rule.test(input)) continue;
        achievements.push(rule.id);
        earned.push(ACHIEVEMENTS.find((a) => a.id === rule.id)!.title);
    }

    return { achievements, earned };
}
