import { describe, expect, it, vi } from 'vitest';
import { pictogramUrl, type ArasaacResult } from '$lib/services/arasaac';
import {
	collectImageRefs,
	createSymbolResolver,
	normalizeSearchTerm,
	pickPictogram,
	primaryLanguage,
	rankImageRefs,
	symbolBaseName,
	type PictogramSearch
} from './symbols';
import type { Cell, GridSet, ImageRef, ResolvedStyle, RichText } from './types';

// ── עזרי-בנייה ───────────────────────────────────────────────────────────

const STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 14,
	backgroundShape: 1,
	tileColour: '#00000000'
};

function ref(library: string, path: string): ImageRef {
	return { library, path };
}

function cell(partial: Partial<Cell> = {}): Cell {
	return {
		x: 0,
		y: 0,
		columnSpan: 1,
		rowSpan: 1,
		commands: [],
		style: STYLE,
		...partial
	};
}

function richText(image: ImageRef | undefined, ...runs: string[]): RichText {
	return { paragraphs: [{ sentences: [{ image, runs }] }] };
}

function gridSet(partial: Partial<GridSet> = {}): GridSet {
	return {
		startGrid: 'main',
		language: 'he-IL',
		symbolSearchKeys: ['widgit', 'sstix#', 'dbr#he'],
		pages: {},
		styles: {},
		...partial
	};
}

/** תוצאת ARASAAC מזויפת. אין רשת בבדיקות. */
function result(id: number, ...keywords: string[]): ArasaacResult {
	return {
		_id: id,
		keywords: keywords.map((keyword) => ({ keyword })),
		imageUrl: pictogramUrl(id)
	};
}

/** חיפוש מזויף מטבלה: `"en:have"` → תוצאות. מה שאינו בטבלה מחזיר ריק. */
function fakeSearch(table: Record<string, ArasaacResult[]>): PictogramSearch & { calls: string[] } {
	const calls: string[] = [];
	const fn = vi.fn(async (keyword: string, lang: string) => {
		const key = `${lang}:${normalizeSearchTerm(keyword)}`;
		calls.push(key);
		return table[key] ?? [];
	});
	return Object.assign(fn as unknown as PictogramSearch, { calls });
}

// ── שם-הבסיס מ-`ImageRef.path` ───────────────────────────────────────────

describe('symbolBaseName', () => {
	it('שולף את המושג האנגלי מנתיב Widgit', () => {
		expect(symbolBaseName(ref('widgit', 'widgit rebus\\h\\have.emf'))).toBe('have');
	});

	it('מסיר מספר-הבחנה בזנב — הדוגמה מהבריף', () => {
		expect(symbolBaseName(ref('widgit', 'widgit rebus\\w\\what 1.emf'))).toBe('what');
		expect(symbolBaseName(ref('widgit', 'widgit rebus\\t\\turkey 1.emf'))).toBe('turkey');
	});

	it('ממיר קו-תחתי לרווח באייקוני הממשק של Grid', () => {
		expect(symbolBaseName(ref('GRID3X', 'jump_back.wmf'))).toBe('jump back');
		expect(symbolBaseName(ref('grid3x', 'delete_word.wmf'))).toBe('delete word');
	});

	it('סובל קדם-ספרייה שנשאר בתוך ה-path, ונתיב עם לוכסן קדמי', () => {
		expect(symbolBaseName(ref('widgit', '[widgit]widgit rebus/l/like.emf'))).toBe('like');
	});

	it('מחזיר null ל-ref בלי ספרייה — קובץ מוטמע ב-.gridset, לא חיפוש', () => {
		expect(symbolBaseName(ref('', '2-0-0-text-0.jpeg'))).toBeNull();
		expect(symbolBaseName(ref('   ', '0.jpg'))).toBeNull();
	});

	it('מחזיר null כשאין אות, או כשקצר מדי, או כשאין ref בכלל', () => {
		expect(symbolBaseName(ref('widgit', '0.jpg'))).toBeNull();
		expect(symbolBaseName(ref('widgit', 'a.emf'))).toBeNull();
		expect(symbolBaseName(undefined)).toBeNull();
	});

	it('🔑 ‏PCS נושא מזהה מספרי ולא מושג — אין מה לחפש, והכתובית תטפל', () => {
		// נמדד ב-org-3/org-4: כל 209 ההפניות ל-[MJPCS#] הן מספרים.
		expect(symbolBaseName(ref('MJPCS#', '10078.wmf'))).toBeNull();
		expect(symbolBaseName(ref('MJPCS#', '1089.wmf'))).toBeNull();
	});
});

// ── אסיפת מועמדים ודירוגם ────────────────────────────────────────────────

describe('collectImageRefs', () => {
	it('מקדים את סמל התא לסמלים שעל המשפטים, ובלי כפילויות', () => {
		const onCell = ref('widgit', 'a\\cell.emf');
		const onSentence = ref('widgit', 'a\\sentence.emf');
		const c = cell({
			image: onCell,
			commands: [
				{
					id: 'Action.InsertText',
					params: {
						text: {
							paragraphs: [
								{ sentences: [{ image: onSentence, runs: ['אני'] }, { runs: [' '] }] },
								{ sentences: [{ image: onCell, runs: ['שוב'] }] }
							]
						},
						pos: 'Unknown'
					}
				}
			]
		});
		expect(collectImageRefs(c)).toEqual([onCell, onSentence]);
	});

	it('מחזיר רשימה ריקה לתא בלי סמל, ומתעלם מפרמטרים שאינם טקסט-עשיר', () => {
		const c = cell({ commands: [{ id: 'Jump.To', params: { grid: 'דף ראשי' } }] });
		expect(collectImageRefs(c)).toEqual([]);
	});
});

describe('rankImageRefs', () => {
	const widgit = ref('WIDGIT', 'a\\want.emf');
	const grid3x = ref('GRID3X', 'jump_back.wmf');
	const dbr = ref('dbr#he', 'x\\y.emf');

	it('ממיין לפי symbolSearchKeys בלי רגישות לאות גדולה', () => {
		expect(rankImageRefs([dbr, widgit], ['widgit', 'sstix#', 'dbr#he'])).toEqual([widgit, dbr]);
	});

	it('דוחק ספרייה שאינה ברשימה לסוף — אבל אינו פוסל אותה', () => {
		expect(rankImageRefs([grid3x, widgit], ['widgit'])).toEqual([widgit, grid3x]);
		expect(rankImageRefs([grid3x], ['widgit'])).toEqual([grid3x]);
	});

	it('מיון יציב — בתיקו נשמר הסדר שנאסף, ולכן סמל התא ראשון', () => {
		const first = ref('widgit', 'a\\first.emf');
		const second = ref('widgit', 'a\\second.emf');
		expect(rankImageRefs([first, second], ['widgit'])).toEqual([first, second]);
	});

	it('בלי symbolSearchKeys כלל — הסדר נשמר', () => {
		expect(rankImageRefs([grid3x, widgit], [])).toEqual([grid3x, widgit]);
	});
});

// ── נרמול ובחירה ─────────────────────────────────────────────────────────

describe('normalizeSearchTerm', () => {
	it('מסיר ניקוד, מכווץ רווחים וגוזם פיסוק בקצוות', () => {
		expect(normalizeSearchTerm('בֶּ')).toBe('ב');
		expect(normalizeSearchTerm('  אני   רוצה ?')).toBe('אני רוצה');
		expect(normalizeSearchTerm('Have')).toBe('have');
	});
});

describe('pickPictogram', () => {
	it('בוחר התאמה מדויקת גם כשהיא אינה התוצאה הראשונה', () => {
		const picked = pickPictogram([result(1, 'rear-view mirror'), result(2, 'view')], 'view');
		expect(picked.exact).toBe(2);
	});

	it('אינו בוחר דבר כשכל התוצאות רק מכילות את המילה — זה הרעש של ה-API', () => {
		const picked = pickPictogram([result(381, 'flute', 'vertical flute')], 'art');
		expect(picked).toMatchObject({ exact: null, loose: null });
	});

	it('התאמה רופפת = כל מילות החיפוש מוכלות במילת-מפתח אחת', () => {
		const picked = pickPictogram([result(7, 'אפשר לעזור לך?')], 'אפשר לעזור');
		expect(picked).toMatchObject({ exact: null, loose: 7, looseKeyword: 'אפשר לעזור לך?' });
	});

	it('מתעלם מניקוד בהשוואה', () => {
		expect(pickPictogram([result(9, 'רגל')], 'רֶגֶל').exact).toBe(9);
	});
});

describe('primaryLanguage', () => {
	it('גוזר קוד דו-אותי מתג-שפה, ונופל ל-en כשאין', () => {
		expect(primaryLanguage('he-IL')).toBe('he');
		expect(primaryLanguage('en-GB')).toBe('en');
		expect(primaryLanguage(undefined)).toBe('en');
	});
});

// ── הפותר ────────────────────────────────────────────────────────────────

describe('createSymbolResolver', () => {
	const HAVE = ref('widgit', 'widgit rebus\\h\\have.emf');

	it('פותר דרך שם-הבסיס האנגלי, ומחזיר URL של ARASAAC', async () => {
		const search = fakeSearch({ 'en:have': [result(32761, 'have', 'own')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(cell({ image: HAVE, caption: 'יש לי' }));

		expect(resolution).toMatchObject({
			url: pictogramUrl(32761),
			source: 'arasaac',
			query: 'have',
			lang: 'en',
			match: 'exact',
			keyword: 'have',
			library: 'widgit'
		});
	});

	it('נופל לכתובית העברית כשלשם-הבסיס אין התאמה', async () => {
		const search = fakeSearch({ 'he:אני': [result(5441, 'אני', 'לי')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(
			cell({ image: ref('widgit', 'widgit rebus\\i\\i.emf'), caption: 'אני' })
		);

		expect(resolution).toMatchObject({ url: pictogramUrl(5441), query: 'אני', lang: 'he' });
	});

	it('ref של PCS — לא נשלח חיפוש באנגלית, והכתובית היא המפתח היחיד', async () => {
		const search = fakeSearch({ 'he:פירות': [result(2462, 'פירות')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(
			cell({ image: ref('MJPCS#', '10078.wmf'), caption: 'פירות' })
		);

		expect(resolution).toMatchObject({ url: pictogramUrl(2462), lang: 'he', library: 'mjpcs#' });
		expect(search.calls).toEqual(['he:פירות']);
	});

	it('התאמה מדויקת בעברית עדיפה על התאמה רופפת באנגלית', async () => {
		const search = fakeSearch({
			'en:view': [result(1, 'rear-view mirror')],
			'he:אני אוהב לראות': [result(2, 'אני אוהב לראות')]
		});
		const resolver = createSymbolResolver(gridSet(), {
			search,
			cache: null,
			minMatch: 'loose'
		});

		const resolution = await resolver.resolve(
			cell({ image: ref('widgit', 'a\\view.emf'), caption: 'אני אוהב לראות' })
		);

		expect(resolution).toMatchObject({ url: pictogramUrl(2), match: 'exact', lang: 'he' });
	});

	it('minMatch=loose מקבל התאמה חלקית; ברירת-המחדל exact דוחה אותה', async () => {
		const table = { 'he:אפשר לעזור': [result(7, 'אפשר לעזור לך?')] };
		const c = () => cell({ caption: 'אפשר לעזור' });

		const strict = createSymbolResolver(gridSet(), { search: fakeSearch(table), cache: null });
		await expect(strict.resolve(c())).resolves.toMatchObject({ url: null, source: 'none' });

		const loose = createSymbolResolver(gridSet(), {
			search: fakeSearch(table),
			cache: null,
			minMatch: 'loose'
		});
		await expect(loose.resolve(c())).resolves.toMatchObject({
			url: pictogramUrl(7),
			match: 'loose'
		});
	});

	it('כשלון מחזיר url:null ולא זורק — הרינדור נופל לצבע+צורה+תווית', async () => {
		const search = fakeSearch({});
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(
			cell({ image: ref('widgit', 'a\\havent.emf'), caption: 'אין לי' })
		);

		expect(resolution).toEqual({
			url: null,
			source: 'none',
			query: 'havent',
			library: 'widgit'
		});
	});

	it('חיפוש שזרק אינו מפיל את הפתירה — התא חוזר בלי סמל', async () => {
		const search = (async () => {
			throw new Error('boom');
		}) as unknown as PictogramSearch;
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(cell({ image: HAVE }));

		expect(resolution).toMatchObject({ url: null, source: 'none', query: 'have' });
	});

	it('תא בלי סמל ובלי כתובית אינו יוצר שום חיפוש', async () => {
		const search = fakeSearch({});
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(cell());

		expect(resolution).toEqual({ url: null, source: 'none', query: '', library: 'none' });
		expect(search.calls).toEqual([]);
	});

	it('ref לקובץ מוטמע אינו נשלח ל-ARASAAC, ונרשם כ-embedded', async () => {
		const search = fakeSearch({});
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		const resolution = await resolver.resolve(cell({ image: ref('', '2-0-0-text-0.jpeg') }));

		expect(resolution.library).toBe('embedded');
		expect(search.calls).toEqual([]);
	});

	it('בוחר בין שני ImageRef לפי symbolSearchKeys', async () => {
		const search = fakeSearch({
			'en:want': [result(10, 'want')],
			'en:jump back': [result(11, 'jump back')]
		});
		const resolver = createSymbolResolver(gridSet({ symbolSearchKeys: ['widgit'] }), {
			search,
			cache: null
		});

		// סמל התא הוא אייקון-ממשק של Grid; המשפט נושא סמל Widgit, שהוא המועדף.
		const resolution = await resolver.resolve(
			cell({
				image: ref('GRID3X', 'jump_back.wmf'),
				commands: [
					{
						id: 'Action.InsertText',
						params: { text: richText(ref('WIDGIT', 'widgit rebus\\w\\want.emf'), 'אני רוצה') }
					}
				]
			})
		);

		expect(resolution).toMatchObject({ url: pictogramUrl(10), query: 'want', library: 'widgit' });
	});

	it('אותו מפתח בכמה תאים — חיפוש אחד בלבד', async () => {
		const search = fakeSearch({ 'en:want': [result(10, 'want')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });
		const want = ref('widgit', 'widgit rebus\\w\\want.emf');

		await Promise.all([
			resolver.resolve(cell({ image: want, x: 0 })),
			resolver.resolve(cell({ image: want, x: 1 })),
			resolver.resolve(cell({ image: want, x: 2 }))
		]);

		expect(search.calls.filter((c) => c === 'en:want')).toHaveLength(1);
	});

	it('stats מונה נפתרים, כשלונות והתפלגות לפי ספרייה', async () => {
		const search = fakeSearch({ 'en:want': [result(10, 'want')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });

		await resolver.resolve(cell({ image: ref('widgit', 'a\\want.emf') }));
		await resolver.resolve(cell({ image: ref('widgit', 'a\\havent.emf') }));
		await resolver.resolve(cell({ image: ref('grid3x', 'clear.wmf') }));
		await resolver.resolve(cell());

		expect(resolver.stats()).toEqual({
			resolved: 1,
			unresolved: 3,
			byLibrary: { widgit: 2, grid3x: 1, none: 1 },
			resolvedByLibrary: { widgit: 1 },
			byMatch: { exact: 1, loose: 0 }
		});
	});

	it('אותו תא פעמיים — אותה תוצאה, ונספר פעם אחת', async () => {
		const search = fakeSearch({ 'en:want': [result(10, 'want')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null });
		const c = cell({ image: ref('widgit', 'a\\want.emf') });

		const first = await resolver.resolve(c);
		const second = await resolver.resolve(c);

		expect(second).toBe(first);
		expect(resolver.stats()).toMatchObject({ resolved: 1, unresolved: 0 });
	});

	it('גודל התמונה נשלט דרך size', async () => {
		const search = fakeSearch({ 'en:want': [result(10, 'want')] });
		const resolver = createSymbolResolver(gridSet(), { search, cache: null, size: 500 });

		const resolution = await resolver.resolve(cell({ image: ref('widgit', 'a\\want.emf') }));

		expect(resolution.url).toBe(pictogramUrl(10, 500));
	});
});

// ── אינטגרציה עם arasaac.ts דרך fetch מזויף ──────────────────────────────

describe('createSymbolResolver + searchPictograms האמיתי', () => {
	it('עובד מול ה-API של ARASAAC כשה-fetch מזויף', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			expect(url).toContain('/v1/pictograms/en/search/');
			return new Response(
				JSON.stringify([
					{ _id: 2462, keywords: [{ keyword: 'zebra crossing' }, { keyword: 'zebra' }] }
				]),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		try {
			const resolver = createSymbolResolver(gridSet(), { cache: null });
			const resolution = await resolver.resolve(
				cell({ image: ref('widgit', 'widgit rebus\\z\\zebra 2.emf') })
			);

			expect(resolution).toMatchObject({
				url: pictogramUrl(2462),
				source: 'arasaac',
				query: 'zebra',
				keyword: 'zebra'
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('נפילת רשת אינה זורקת — ARASAAC מחזיר ריק, והתא נשאר בלי סמל', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('network down');
			})
		);

		try {
			const resolver = createSymbolResolver(gridSet(), { cache: null });
			const resolution = await resolver.resolve(
				cell({ image: ref('widgit', 'widgit rebus\\o\\offline probe.emf') })
			);

			expect(resolution).toMatchObject({ url: null, source: 'none' });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
