/**
 * מדיה מוטמעת — שחזור הנתיב, פרישה עצלה, והגשה כ-`blob:`.
 *
 * 🛑 **הבדיקות בנויות על המבנה של `org-3`, לא על מבנה שהומצא כאן.** שמות
 * הקבצים והערכים השמורים הועתקו מהקובץ האמיתי:
 *
 * ```
 * Grids/לקרוא/2-2-0-text-0.jpeg           ← הקובץ בארכיון
 *   <Image>-0-text-0.jpeg</Image>         ← מה שהתא (X=2,Y=2) נושא
 *   <s Image="0.jpeg">                    ← מה שהמשפט בפרמטר `text` של פקודה 0 נושא
 * ```
 *
 * ‏🔑 שים לב שכל **שלושת** אלה מצביעים לאותו קובץ אחד, בשלוש צורות-קיצור
 * שונות. מי שמחפש בארכיון את הערך כפי שהוא לא מוצא דבר.
 *
 * ‏`.svelte.` כי הפרסר דורש `DOMParser` ו-`createObjectURL` — דפדפן, לא node.
 */

import { describe, it, expect, vi } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { parseGridSet } from './parse';
import { buildGridset } from './__fixtures__/buildGridset';
import { createSymbolResolver, type PictogramSearch } from './symbols';
import { isRenderableImage, mediaExtension, mimeOf } from './embeddedMedia';
import type { Cell, GridSet } from './types';

/** ‏1×1 PNG אמיתי — צריך בייטים, לא מציין-מקום, כדי ש-`Blob` יהיה בעל משמעות. */
const PNG_BYTES = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
);
const JPEG_BYTES = strToU8('not-a-real-jpeg-but-bytes-are-bytes');
const WMF_BYTES = strToU8('windows-metafile-bytes');

/** חיפוש שמחזיר ריק — כדי שהפתירה **לא** תוכל להצליח דרך ARASAAC. */
const noSearch: PictogramSearch = async () => [];

function resolverFor(gridSet: GridSet) {
	return createSymbolResolver(gridSet, { search: noSearch, cache: null });
}

/**
 * לוח במבנה `org-3`: תא ב-(2,2) עם כיתוב, ‏`<Image>` מקוצר, ופקודת
 * `Action.InsertText` שהמשפט שלה נושא `Image` מקוצר אחרת — ושני הקבצים בארכיון.
 */
function org3LikeGridset() {
	return buildGridset({
		language: 'he-IL',
		pages: [
			{
				name: 'לקרוא',
				columns: 6,
				rows: 5,
				media: {
					'2-2-0-text-0.jpeg': JPEG_BYTES,
					'4-0-0-text-0.png': PNG_BYTES,
					// 🛑 קיים בארכיון אבל **אינו ניתן להצגה** — Windows Metafile.
					'0-0-0-text-0.wmf': WMF_BYTES
				},
				cells: [
					{
						x: 2,
						y: 2,
						caption: 'ספר',
						image: '-0-text-0.jpeg',
						commands: [
							{
								id: 'Action.InsertText',
								params: {
									text: { shape: 'p/s/r', sentences: [{ image: '0.jpeg', runs: ['ספר'] }] }
								}
							}
						]
					},
					{ x: 4, y: 0, caption: 'בלון', image: '-0-text-0.png', commands: [] },
					{ x: 0, y: 0, caption: 'מטאפייל', image: '-0-text-0.wmf', commands: [] },
					// הפניית-ספרייה — לא נוגעת למדיה מוטמעת בכלל.
					{ x: 1, y: 0, caption: 'יש', image: '[widgit]widgit rebus\\h\\have.emf', commands: [] }
				]
			}
		]
	});
}

function cellAt(gridSet: GridSet, page: string, x: number, y: number): Cell {
	const cell = gridSet.pages[page].cells.find((c) => c.x === x && c.y === y);
	if (!cell) throw new Error(`אין תא ב-(${x},${y}) בדף ${page}`);
	return cell;
}

describe('שחזור נתיב המדיה המוטמעת', () => {
	it('‏`CaptionAndImage/Image` — התחילית היא `{X}-{Y}` של התא', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const cell = cellAt(gridSet, 'לקרוא', 2, 2);

		// 🛑 הערך השמור נשאר כפי שהוא — השחזור **מוסיף** שדה, לא משנה את `path`.
		expect(cell.image).toMatchObject({
			library: '',
			path: '-0-text-0.jpeg',
			embeddedPath: 'Grids/לקרוא/2-2-0-text-0.jpeg'
		});
	});

	it('‏`<s Image=…>` — התחילית היא `{X}-{Y}-{אינדקס הפקודה}-{מפתח הפרמטר}-`', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const cell = cellAt(gridSet, 'לקרוא', 2, 2);
		const text = cell.commands[0].params.text;
		if (typeof text !== 'object' || !('paragraphs' in text)) throw new Error('צפוי RichText');

		// 🔑 אותו קובץ בדיוק כמו ה-`<Image>` של התא, דרך שרשרת-מוצא אחרת.
		expect(text.paragraphs[0].sentences[0].image).toMatchObject({
			embeddedPath: 'Grids/לקרוא/2-2-0-text-0.jpeg'
		});
	});

	it('הפניית-ספרייה אינה מקבלת `embeddedPath` כלל', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const cell = cellAt(gridSet, 'לקרוא', 1, 0);
		expect(cell.image?.library).toBe('widgit');
		expect(cell.image?.embeddedPath).toBeUndefined();
	});

	it('‏`<data>` נושא סיומת ולא שם-קובץ — ובלי מקף נוסף', async () => {
		// 🔑 מבנה `org-1` מילה-במילה: שרשרת באורך 3, ‏`SpeechPlaySound` שלישית
		// ⇒ אינדקס 2, והערך הוא `.mp3` בלבד. המחולל אינו יודע לכתוב `<data>`,
		// ולכן ה-XML הזה נכתב ידנית — הועתק מ-`Grids/…/grid.xml` של org-1.
		const xml = [
			'<?xml version="1.0" encoding="utf-8"?><Grid>',
			'<ColumnDefinitions><ColumnDefinition /></ColumnDefinitions>',
			'<RowDefinitions><RowDefinition /></RowDefinitions>',
			'<Cells><Cell X="5" Y="1"><Content><Commands>',
			'<Command ID="CommandExecution.Wait" /><Command ID="Photos.Snapshot" />',
			'<Command ID="SpeechPlaySound"><Parameter Key="filedata"><data>.mp3</data></Parameter></Command>',
			'</Commands></Content></Cell></Cells>',
			'<WordList><Items /></WordList></Grid>'
		].join('');
		const zip = zipSync({
			'Settings0/settings.xml':
				strToU8('<?xml version="1.0" encoding="utf-8"?><GridSetSettings><StartGrid>דף</StartGrid><Language>he-IL</Language></GridSetSettings>'),
			'Grids/דף/grid.xml': strToU8(xml),
			'Grids/דף/5-1-2-filedata.mp3': strToU8('id3')
		});
		const gridSet = await parseGridSet(zip);
		const value = gridSet.pages['דף'].cells[0].commands[2].params.filedata;
		if (typeof value !== 'object' || !('data' in value)) throw new Error('צפוי ערך-data');
		// 🛑 בלי מקף בין `filedata` ל-`.mp3` — הנקודה באה מהערך עצמו.
		expect(value.embeddedPath).toBe('Grids/דף/5-1-2-filedata.mp3');
		// 🛑 **הטענה כאן התהפכה בסלייס 13, וזו אינה הרפיה.**
		//
		// בסלייס 12 הבייטים **לא** נפרשו, והנימוק היה נכון באותו רגע:
		// ‏`SpeechPlaySound` לא היה ממומש — "אין נגן, ואין למי להגיש אותם".
		// סלייס 13 מימש אותו (‏`commands.ts` · ‏`ctx.playSound`), ולכן
		// **התנאי שהצדיק את אי-הפרישה חדל להתקיים**: פרישה-לא של קובץ שיש
		// לו צרכן פירושה פקודה שמצליחה בשקט ולא משמיעה דבר.
		//
		// ⚠️ ‏`org-1` מכיל **קובץ-שמע מוטמע אחד בדיוק** —
		// ‏`Grids/מצלמה/5-1-2-filedata.mp3` — ולכן זו אינה הרחבה תיאורטית.
		expect(gridSet.media?.has('Grids/דף/5-1-2-filedata.mp3')).toBe(true);
	});

	it('פריט `page.wordList` — התחילית היא `wordlist-{אינדקס}`', async () => {
		const bytes = buildGridset({
			pages: [
				{
					name: 'ארוחת בוקר',
					columns: 3,
					rows: 2,
					cells: [{ x: 0, y: 0, contentType: 'AutoContent', contentSubType: 'WordList' }],
					wordList: [{ text: 'לחם' }, { text: 'חלב', image: '-0.png' }],
					media: { 'wordlist-1-0.png': PNG_BYTES }
				}
			]
		});
		const gridSet = await parseGridSet(bytes);
		const items = gridSet.pages['ארוחת בוקר'].wordList;
		expect(items[0].image).toBeUndefined();
		expect(items[1].image?.embeddedPath).toBe('Grids/ארוחת בוקר/wordlist-1-0.png');
		expect(gridSet.media?.has('Grids/ארוחת בוקר/wordlist-1-0.png')).toBe(true);
	});
});

describe('פרישה עצלה — מה נכנס ל-`media` ומה לא', () => {
	it('רק מה שיש אליו הפניה **וגם** ניתן להצגה', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const keys = [...(gridSet.media?.keys() ?? [])].sort();

		expect(keys).toEqual([
			'Grids/לקרוא/2-2-0-text-0.jpeg',
			'Grids/לקרוא/4-0-0-text-0.png'
		]);
		// 🛑 ה-`wmf` **קיים בארכיון ויש אליו הפניה** — ונדחה בגלל הפורמט בלבד.
		expect(gridSet.media?.has('Grids/לקרוא/0-0-0-text-0.wmf')).toBe(false);
	});

	it('🛑 קובץ שאין אליו הפניה אינו נפרש — גם כשהוא png', async () => {
		const bytes = buildGridset({
			pages: [
				{
					name: 'דף',
					columns: 2,
					rows: 1,
					// יתום: יושב בארכיון, אף תא אינו מפנה אליו.
					media: { '9-9-0-text-0.png': PNG_BYTES },
					cells: [{ x: 0, y: 0, caption: 'שלום' }]
				}
			]
		});
		const gridSet = await parseGridSet(bytes);
		expect(gridSet.media?.size).toBe(0);
	});

	it('‏`media` מחזיק תת-קבוצה ממשית של רשומות הארכיון', async () => {
		// ⚠️ **מה שהבדיקה הזאת כן מוכיחה ומה שלא.** היא מוכיחה שהמודל מחזיק 2
		// מתוך 6 הרשומות (‏settings · styles · grid.xml · 3 קובצי מדיה).
		// היא **אינה** מוכיחה שהסינון קרה ב-`filter` ולא אחריו
		// — שיא-הזיכרון אינו נצפה מ-JS. העוגן לזה הוא חוזה fflate (‏`filter`
		// נקרא לפני ההיפוך) ולא בדיקה, וזה מוצהר כאן במפורש.
		const bytes = org3LikeGridset();
		const gridSet = await parseGridSet(bytes);

		expect(Object.keys(unzipSync(bytes)).length).toBe(6);
		expect(gridSet.media?.size).toBe(2);
	});
});

describe('הגשה כ-`blob:` דרך פותר-הסמלים', () => {
	it('מדיה מוטמעת נפתרת ל-`blob:` ומדווחת כ-`embedded`', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const resolver = resolverFor(gridSet);

		const resolution = await resolver.resolve(cellAt(gridSet, 'לקרוא', 2, 2));

		expect(resolution.source).toBe('embedded');
		expect(resolution.url).toMatch(/^blob:/);
		expect(resolution.query).toBe('Grids/לקרוא/2-2-0-text-0.jpeg');
		expect(resolver.stats().resolvedBySource).toEqual({ embedded: 1 });
		resolver.dispose?.();
	});

	it('🛑 מדיה מוטמעת גוברת על ARASAAC — היא התמונה, לא מועמדת לה', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const search = vi.fn<PictogramSearch>(async () => [
			{ _id: 7, keywords: [{ keyword: 'ספר' }], imageUrl: 'x' }
		]);
		const resolver = createSymbolResolver(gridSet, { search, cache: null });

		const resolution = await resolver.resolve(cellAt(gridSet, 'לקרוא', 2, 2));

		expect(resolution.source).toBe('embedded');
		// 🔑 ולא נשלחה בקשת-רשת כלל: אין מה לשקול כשהקובץ עצמו קיים.
		expect(search).not.toHaveBeenCalled();
		resolver.dispose?.();
	});

	it('🛑 ‏`wmf` נופל לשכבה הבאה ואינו מחזיר `<img>` שבור', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const resolver = createSymbolResolver(gridSet, {
			search: async (keyword) =>
				keyword === 'מטאפייל' ? [{ _id: 42, keywords: [{ keyword: 'מטאפייל' }], imageUrl: 'x' }] : [],
			cache: null
		});

		const resolution = await resolver.resolve(cellAt(gridSet, 'לקרוא', 0, 0));

		// נפתר דרך הכתובית העברית — **לא** דרך ה-wmf, ולא נכשל.
		expect(resolution.source).toBe('arasaac');
		expect(resolution.url).not.toMatch(/^blob:/);
		// והדחייה נספרת, כדי שההיעדר יהיה נראה בדוח ולא שקט.
		expect(resolver.stats().embeddedUnsupported).toEqual({ wmf: 1 });
		resolver.dispose?.();
	});

	it('אותו נתיב מחזיר את אותו `blob:` — ולא URL חדש בכל קריאה', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const resolver = resolverFor(gridSet);
		const cell = cellAt(gridSet, 'לקרוא', 2, 2);

		const first = await resolver.resolve(cell);
		// תא-נגזר חדש על אותה הפניה — כך `WordListCell` בונה אותו בכל רינדור,
		// ולכן ה-WeakMap של perCell אינו פוגע וההגשה נעשית שוב.
		const second = await resolver.resolve({ ...cell });

		expect(second.url).toBe(first.url);
		resolver.dispose?.();
	});

	it('🛑 ‏`dispose` משחרר את ה-URL-ים, וקריאה אחריו בונה חדש ולא מבוטל', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const resolver = resolverFor(gridSet);
		const revoke = vi.spyOn(URL, 'revokeObjectURL');

		const before = await resolver.resolve(cellAt(gridSet, 'לקרוא', 2, 2));
		resolver.dispose?.();

		expect(revoke).toHaveBeenCalledWith(before.url);

		const after = await resolver.resolve({ ...cellAt(gridSet, 'לקרוא', 2, 2) });
		expect(after.url).toMatch(/^blob:/);
		expect(after.url).not.toBe(before.url);
		resolver.dispose?.();
		revoke.mockRestore();
	});

	it('‏`GridSet` בלי `media` (‏JSON / fixture) אינו קורס', async () => {
		const gridSet = await parseGridSet(org3LikeGridset());
		const withoutMedia: GridSet = { ...gridSet, media: undefined };
		const resolver = resolverFor(withoutMedia);

		const resolution = await resolver.resolve(cellAt(withoutMedia, 'לקרוא', 2, 2));

		expect(resolution.url).toBeNull();
		expect(resolution.source).toBe('none');
		resolver.dispose?.();
	});
});

describe('הכרעת-פורמט', () => {
	it('סיומת נקראת מהעלה ולא מהנתיב', () => {
		expect(mediaExtension('Grids/א.ב/2-0-0-text-0.JPG')).toBe('jpg');
		expect(mediaExtension('Grids/א.ב/בלי-סיומת')).toBe('');
	});

	it('רשימת-היתר: מה שלא נבדק אינו נתמך', () => {
		expect(isRenderableImage('a.png')).toBe(true);
		expect(isRenderableImage('a.jpeg')).toBe(true);
		expect(isRenderableImage('a.wmf')).toBe(false);
		expect(isRenderableImage('a.emf')).toBe(false);
		expect(isRenderableImage('a.gridbmp')).toBe(false);
		expect(isRenderableImage('a.mp3')).toBe(false);
	});

	it('🛑 ‏MIME נגזר מהסיומת — בלעדיו כרום מסרב להציג את ה-blob', () => {
		expect(mimeOf('a.jpg')).toBe('image/jpeg');
		expect(mimeOf('a.jpeg')).toBe('image/jpeg');
		expect(mimeOf('a.png')).toBe('image/png');
		expect(mimeOf('a.svg')).toBe('image/svg+xml');
		expect(mimeOf('a.wmf')).toBe('application/octet-stream');
	});
});
