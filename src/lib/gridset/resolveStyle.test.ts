import { describe, expect, it, vi } from 'vitest';
import { createStyleResolver, parseStyles, toCssColor } from './resolveStyle';
import { DEFAULT_RESOLVED_STYLE } from './visualDefaults';
import type { Style } from './types';

describe('parseStyles', () => {
	it('פורס Style שטוח עם Key כתכונה', () => {
		const xml = `
			<StyleData><Styles>
				<Style Key="Netflix 3">
					<BackColour>#C81420FF</BackColour>
					<BorderColour>#FFFFFFFF</BorderColour>
					<FontColour>#FFFFFFFF</FontColour>
					<FontName>Booster</FontName>
					<FontSize>20</FontSize>
					<Name>Netflix 3</Name>
				</Style>
			</Styles></StyleData>`;

		const styles = parseStyles(xml);

		expect(styles['Netflix 3']).toEqual({
			name: 'Netflix 3',
			backColour: '#C81420FF',
			borderColour: '#FFFFFFFF',
			fontColour: '#FFFFFFFF',
			fontName: 'Booster',
			fontSize: 20,
			Name: 'Netflix 3'
		});
	});

	it('Key מול Name: השם שאליו מפנה BasedOnStyle הוא Key, לא Name — ואינו על כל סגנון', () => {
		const xml = `<Styles>
			<Style Key="Access category style">
				<Name>Access category style</Name>
				<BackColour>#A38F84FF</BackColour>
			</Style>
			<Style Key="Default">
				<BackColour>#FFFFFFFF</BackColour>
			</Style>
		</Styles>`;

		const styles = parseStyles(xml);

		expect(styles['Access category style'].name).toBe('Access category style');
		expect(styles['Access category style'].Name).toBe('Access category style');
		// b002/Default בנתונים האמיתיים: לסגנון אין <Name> כלל — 2,587/3,282 בלבד נושאים אותו.
		expect(styles['Default'].name).toBe('Default');
		expect(styles['Default'].Name).toBeUndefined();
	});

	it('פורס TileColour כשדה לא-ממופה (נשמר, לא נזרק)', () => {
		const xml = `<Styles><Style Key="Spotify Keyboard"><TileColour>#0078D4FF</TileColour></Style></Styles>`;

		const styles = parseStyles(xml);

		expect(styles['Spotify Keyboard'].TileColour).toBe('#0078D4FF');
	});

	it('סגנון ריק לגמרי (כמו b002 Default בנתונים האמיתיים) לא נזרק', () => {
		const xml = `<Styles><Style Key="Default"></Style></Styles>`;

		const styles = parseStyles(xml);

		expect(styles['Default']).toEqual({ name: 'Default' });
	});
});

describe('toCssColor', () => {
	it('#RRGGBBAA תקין עובר ללא שינוי (אותו סדר-בתים כמו CSS)', () => {
		expect(toCssColor('#FFFFFF00')).toBe('#FFFFFF00');
	});

	it('פורמט לא צפוי מוחזר כמו שהוא, עם אזהרה — לא נזרקת שגיאה', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(toCssColor('not-a-color')).toBe('not-a-color');
		expect(warn).toHaveBeenCalledOnce();

		warn.mockRestore();
	});
});

describe('createStyleResolver', () => {
	it('הסגנון הנקוב גובר על ברירת-המחדל', () => {
		const styles: Record<string, Style> = {
			'Jump cell 1': { name: 'Jump cell 1', backColour: '#475577FF', fontSize: 32 }
		};
		const resolve = createStyleResolver(styles);

		const resolved = resolve({ basedOnStyle: 'Jump cell 1', overrides: {} });

		expect(resolved.backColour).toBe('#475577FF');
		expect(resolved.fontSize).toBe(32);
		// שדה שהסגנון הנקוב לא הגדיר — ממשיך מברירת-המחדל.
		expect(resolved.fontName).toBe(DEFAULT_RESOLVED_STYLE.fontName);
	});

	it('עקיפה מקומית של התא גוברת על הסגנון הנקוב', () => {
		const styles: Record<string, Style> = {
			X: { name: 'X', backColour: '#000000FF' }
		};
		const resolve = createStyleResolver(styles);

		const resolved = resolve({ basedOnStyle: 'X', overrides: { backColour: '#00000000' } });

		expect(resolved.backColour).toBe('#00000000');
	});

	it('שם סגנון שאינו קיים נופל לברירת המחדל ומדווח, לא זורק', () => {
		const resolve = createStyleResolver({});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const resolved = resolve({ basedOnStyle: 'Ghost', overrides: {} });

		expect(resolved).toEqual(DEFAULT_RESOLVED_STYLE);
		expect(warn).toHaveBeenCalledOnce();

		warn.mockRestore();
	});

	it('בלי basedOnStyle כלל — ברירת המחדל עם עקיפות מקומיות בלבד', () => {
		const resolve = createStyleResolver({});

		const resolved = resolve({ overrides: { fontSize: 48 } });

		expect(resolved).toEqual({ ...DEFAULT_RESOLVED_STYLE, fontSize: 48 });
	});
});
