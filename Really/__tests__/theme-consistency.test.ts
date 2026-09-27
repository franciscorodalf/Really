import fs from 'fs';
import path from 'path';

const FILES_THAT_MUST_NOT_USE_OS_COLOR_SCHEME = [
    'app/add.tsx',
    'app/goals.tsx',
    'app/history.tsx',
    'app/onboarding.tsx',
    'app/stats.tsx',
    'app/settings.tsx',
    'components/ThemedButton.tsx',
    'components/ItemCard.tsx',
    'components/NoticeBanner.tsx',
];

describe('consistencia del tema en toda la app', () => {
    it.each(FILES_THAT_MUST_NOT_USE_OS_COLOR_SCHEME)(
        '%s no debe derivar AppTheme de useColorScheme() del sistema operativo',
        (relativePath) => {
            const source = fs.readFileSync(
                path.join(__dirname, '..', relativePath),
                'utf-8'
            );
            expect(source).not.toMatch(/useColorScheme\(\)/);
        }
    );
});
