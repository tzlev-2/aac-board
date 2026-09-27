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

	it('פורס BasedOnStyle כתג-ילד', () => {
		const xml = `<Styles><Style Key="Jump cell 1"><BasedOnStyle>Default</BasedOnStyle><FontSize>24</FontSize></Style></Styles>`;

		const styles = parseStyles(xml);

		expect(styles['Jump cell 1'].basedOnStyle).toBe('Default');
		expect(styles['Jump cell 1'].fontSize).toBe(24);
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
	it('שרשרת בעומק 3: A מבוסס על B מבוסס על C — C נפתר ראשון, A אחרון', () => {
		const styles: Record<string, Style> = {
			C: { name: 'C', backColour: '#111111FF', fontName: 'Arial' },
			B: { name: 'B', basedOnStyle: 'C', fontColour: '#222222FF' },
			A: { name: 'A', basedOnStyle: 'B', fontSize: 40 }
		};
		const resolve = createStyleResolver(styles);

		const resolved = resolve({ basedOnStyle: 'A', overrides: {} });

		expect(resolved.backColour).toBe('#111111FF'); // מ-C
		expect(resolved.fontColour).toBe('#222222FF'); // מ-B
		expect(resolved.fontSize).toBe(40); // מ-A (הסגנון הנקוב)
		expect(resolved.fontName).toBe('Arial'); // ירש מ-C, לא נדרס
	});

	it('עקיפה מקומית של התא גוברת על כל שרשרת המורשת', () => {
		const styles: Record<string, Style> = {
			X: { name: 'X', backColour: '#000000FF' }
		};
		const resolve = createStyleResolver(styles);

		const resolved = resolve({ basedOnStyle: 'X', overrides: { backColour: '#00000000' } });

		expect(resolved.backColour).toBe('#00000000');
	});

	it('מעגל ב-BasedOnStyle אינו תולה — נעצר עם אזהרה ומחזיר תוצאה', () => {
		const styles: Record<string, Style> = {
			A: { name: 'A', basedOnStyle: 'B', fontSize: 10 },
			B: { name: 'B', basedOnStyle: 'A', fontSize: 20 }
		};
		const resolve = createStyleResolver(styles);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const resolved = resolve({ basedOnStyle: 'A', overrides: {} });

		expect(resolved).toBeDefined();
		expect(warn).toHaveBeenCalled();

		warn.mockRestore();
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
