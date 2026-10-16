import { awardSaveAchievements } from '../achievementRules';

describe('awardSaveAchievements', () => {
    it('otorga first_save en el primer ahorro', () => {
        const result = awardSaveAchievements({ current: [], newSaved: 10, newSavedCount: 1, newStreak: 1 });
        expect(result.achievements).toEqual(['first_save']);
        expect(result.earned).toEqual(['Primer Ahorro']);
    });

    it('no repite logros ya conseguidos', () => {
        const result = awardSaveAchievements({ current: ['first_save'], newSaved: 10, newSavedCount: 1, newStreak: 1 });
        expect(result.achievements).toEqual(['first_save']);
        expect(result.earned).toEqual([]);
    });

    it('otorga los logros de umbral de dinero', () => {
        const result = awardSaveAchievements({ current: ['first_save'], newSaved: 1000, newSavedCount: 2, newStreak: 1 });
        expect(result.earned).toEqual(['Ahorrador Novato', 'Buen Comienzo', 'Gran Ahorrador']);
        expect(result.achievements).toEqual(['first_save', 'saver_100', 'saver_200', 'saver_1000']);
    });

    it('otorga saver_10 con 10 ahorros', () => {
        const result = awardSaveAchievements({ current: ['first_save'], newSaved: 1, newSavedCount: 10, newStreak: 1 });
        expect(result.earned).toEqual(['Coleccionista']);
    });

    it('otorga los logros de racha de golpe sin duplicados', () => {
        const result = awardSaveAchievements({ current: ['first_save'], newSaved: 1, newSavedCount: 2, newStreak: 10 });
        expect(result.earned).toEqual(['Racha de Defensa', 'Disciplina de Hierro', 'Inquebrantable']);
        expect(result.achievements).toEqual(['first_save', 'streak_3', 'streak_5', 'streak_10']);
        expect(new Set(result.achievements).size).toBe(result.achievements.length);
    });

    it('no muta la entrada', () => {
        const current = ['first_save'];
        awardSaveAchievements({ current, newSaved: 10000, newSavedCount: 10, newStreak: 10 });
        expect(current).toEqual(['first_save']);
    });
});
