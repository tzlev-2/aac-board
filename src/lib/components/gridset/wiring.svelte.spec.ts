/**
 * הפרוסה האנכית — בייטים של `.gridset` → מודל → מריץ חי → רשת → **לחיצה**.
 *
 * 🔑 למה בדיקה נפרדת ולא הרחבה של `GridBoard.svelte.spec.ts`: זו אינה בדיקת
 * קומפוננטה אלא בדיקת **חיבור**. ששת המנגנונים של הסבב עברו כל אחד את
 * הבדיקות שלו, ואימות-האינטגרציה בכל זאת החזיר NO-GO — כי אף בדיקה לא עברה
 * דרך כולם בזה אחר זה. הקובץ הזה הוא זו.
 *
 * דפדפן אמיתי (`*.svelte.spec.ts`) נדרש מכיוון ש-`parseGridSet` מסתמך על
 * `DOMParser`, והריאקטיביות של ה-runes אינרטית ב-SSR.
 */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { buildGridset } from '$lib/gridset/__fixtures__/buildGridset';
import type { GridsetSpec } from '$lib/gridset/__fixtures__/spec';
import { parseGridSet } from '$lib/gridset/parse';
import type { SpeechAdapter } from '$lib/gridset/runtime.svelte';
import GridSetView from './GridSetView.svelte';

/**
 * שני דפים, פס-פלט כתא, תא-תיקייה, תא-מילה, תא-דיבור, ותא שהצהרת-הדרישה שלו
 * אינה מתקיימת ב-WEB_FEATURES (‏`EyeGazeAccess`) — וסגנון נקוב אחד, שכל
 * תפקידו להוכיח שהפרסר מחווט לפותר-הסגנונות.
 */
const spec: GridsetSpec = {
	startGrid: 'בית',
	language: 'he-IL',
	styles: [{ key: 'רקע כחול', backColour: '#112233FF' }],
	pages: [
		{
			name: 'בית',
			columns: 5,
			rows: 2,
			cells: [
				{ x: 0, y: 0, columnSpan: 5, contentType: 'Workspace', contentSubType: 'Chat' },
				{
					x: 0,
					y: 1,
					caption: 'אוכל',
					basedOnStyle: 'רקע כחול',
					commands: [{ id: 'Jump.To', params: { grid: 'אוכל' } }]
				},
				{
					x: 1,
					y: 1,
					caption: 'שלום',
					commands: [{ id: 'Action.InsertText', params: { text: 'שלום' } }]
				},
				{ x: 2, y: 1, caption: 'דבר', commands: [{ id: 'Action.Speak', params: { unit: 'All' } }] },
				{
					x: 3,
					y: 1,
					caption: 'עיניים',
					commands: [{ id: 'Settings.RequiredFeature', params: { feature: 'EyeGazeAccess' } }]
				},
				{
					x: 4,
					y: 1,
					caption: 'רשימת מילים',
					contentType: 'LiveCell',
					contentSubType: 'Camera'
				}
			]
		},
		{
			name: 'אוכל',
			columns: 3,
			rows: 1,
			cells: [
				{ x: 0, y: 0, contentType: 'Workspace', contentSubType: 'Chat' },
				{
					x: 1,
					y: 0,
					caption: 'תפוח',
					commands: [{ id: 'Action.InsertText', params: { text: 'תפוח' } }]
				},
				{
					x: 2,
					y: 0,
					caption: 'לבגדים',
					commands: [{ id: 'Jump.To', params: { grid: 'בגדים' } }]
				}
			]
		},
		/**
		 * 🔑 דף-`WordList` כפי שהוא באמת יוצא מ-Grid: שלושת תאי ה-`AutoContent`
		 * **ריקים מפקודות**, והשרשרת יושבת אחת לדף כולו. עד סלייס 10 הם צוירו
		 * כ-`<div>` ולא הגיבו ללחיצה.
		 */
		{
			name: 'בגדים',
			columns: 4,
			rows: 1,
			wordList: [{ text: 'שמלה' }, { text: 'נעליים', partOfSpeech: 'Noun' }, { text: 'כובע' }],
			autoContentCommands: { WordList: [{ id: 'AutoContent.Activate', params: {} }] },
			cells: [
				{ x: 0, y: 0, contentType: 'Workspace', contentSubType: 'Chat' },
				{ x: 1, y: 0, contentType: 'AutoContent', contentSubType: 'WordList' },
				{ x: 2, y: 0, contentType: 'AutoContent', contentSubType: 'WordList' },
				{ x: 3, y: 0, contentType: 'AutoContent', contentSubType: 'WordList' }
			]
		}
	]
};

const spoken: string[] = [];
const recordingSpeech: SpeechAdapter = {
	speak: (text) => spoken.push(text),
	stop: () => {}
};

async function mount() {
	const gridSet = await parseGridSet(buildGridset(spec));
	// symbols=null — בלי רשת בבדיקות. הסמלים נבדקים ב-symbols.spec.ts.
	return render(GridSetView, {
		gridSet,
		symbols: null,
		runtimeOptions: { speech: recordingSpeech }
	});
}

describe('הפרוסה האנכית — קובץ → מסך → לחיצה', () => {
	it('בייטים של .gridset מגיעים לרשת מצוירת', async () => {
		const screen = await mount();

		await expect.element(screen.getByTestId('grid-board')).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'אוכל' })).toBeInTheDocument();
		await expect.element(screen.getByTestId('chat-cell')).toBeInTheDocument();
	});

	it('🔑 לחיצה על תא Jump.To מחליפה דף ב-DOM', async () => {
		const screen = await mount();

		await expect.element(screen.getByText('שלום')).toBeInTheDocument();

		await screen.getByRole('button', { name: 'אוכל' }).click();

		await expect.element(screen.getByText('תפוח')).toBeInTheDocument();
		await expect.element(screen.getByText('שלום')).not.toBeInTheDocument();
	});

	it('🔑 לחיצה על תא Action.InsertText מוסיפה לפס-הפלט', async () => {
		const screen = await mount();
		const chat = screen.getByTestId('chat-cell');

		expect(chat.element().textContent).toBe('');

		await screen.getByRole('button', { name: 'שלום' }).click();

		await expect.element(chat).toHaveTextContent('שלום');
	});

	it('🔑 Action.Speak מקריא את מה שנצבר בחוצץ', async () => {
		spoken.length = 0;
		const screen = await mount();

		await screen.getByRole('button', { name: 'שלום' }).click();
		await screen.getByRole('button', { name: 'דבר' }).click();

		expect(spoken).toEqual(['שלום']);
	});

	it('🔑 מה שנראה בפס-הפלט זהה למה שנאמר', async () => {
		spoken.length = 0;
		const screen = await mount();

		await screen.getByRole('button', { name: 'שלום' }).click();
		await screen.getByRole('button', { name: 'שלום' }).click();
		await screen.getByRole('button', { name: 'דבר' }).click();

		const chat = screen.getByTestId('chat-cell').element();
		expect(chat.textContent).toBe(spoken.at(-1));
	});

	it('הפלט נצבר בין דפים — המריץ חי לאורך הניווט', async () => {
		const screen = await mount();

		await screen.getByRole('button', { name: 'שלום' }).click();
		await screen.getByRole('button', { name: 'אוכל' }).click();
		await screen.getByRole('button', { name: 'תפוח' }).click();

		await expect.element(screen.getByTestId('chat-cell')).toHaveTextContent('שלום תפוח');
	});

	it('תא שדרישתו אינה מתקיימת אינו מצויר — ושאר התאים כן', async () => {
		const screen = await mount();

		await expect.element(screen.getByText('עיניים')).not.toBeInTheDocument();
		// פס-הפלט + ארבעת התאים הזמינים; החסום אינו ב-DOM כלל.
		expect(screen.getByTestId('grid-cell').elements()).toHaveLength(5);
	});

	it('סגנון נקוב מ-styles.xml מגיע לתא — הפרסר מחווט לפותר', async () => {
		const screen = await mount();
		const cell = screen.getByRole('button', { name: 'אוכל' }).element();

		const bg = getComputedStyle(cell).backgroundImage;
		expect(bg).toContain('linear-gradient');
		expect(bg).toContain('rgb(17, 34, 51)');
	});

	/**
	 * 🛑 הפער של סלייס 10, כפי שנמדד על `org-1/בגדים`: ‏11 תאי `WordList`
	 * מלאים במילים — ו-`— ריק —` פקודות בכל אחד מהם, ולכן אף אחד מהם לא היה
	 * `<button>`. הבדיקה הזאת נכשלת על הקוד שלפני הסלייס.
	 */
	it('🔑 תא WordList **בלי פקודות משלו** הוא button לחיץ', async () => {
		const screen = await mount();
		await screen.getByRole('button', { name: 'אוכל' }).click();
		await screen.getByRole('button', { name: 'לבגדים' }).click();

		const cells = screen.getByTestId('grid-cell').elements();
		expect(cells).toHaveLength(4);
		// שלושת תאי ה-WordList לחיצים; מי שאינו button הוא פס-הפלט, שאין לו
		// שרשרת בשום רמה — וזה נכון.
		const notButtons = cells.filter((el) => el.tagName !== 'BUTTON');
		expect(notButtons).toHaveLength(1);
		expect(notButtons[0].querySelector('[data-testid="chat-cell"]')).not.toBeNull();
		await expect.element(screen.getByRole('button', { name: 'שמלה' })).toBeInTheDocument();
	});

	it('🔑 לחיצה על מילה מהרשימה מרכיבה משפט בפס-הפלט', async () => {
		const screen = await mount();
		await screen.getByRole('button', { name: 'אוכל' }).click();
		await screen.getByRole('button', { name: 'לבגדים' }).click();

		await screen.getByRole('button', { name: 'שמלה' }).click();
		await screen.getByRole('button', { name: 'נעליים' }).click();
		await screen.getByRole('button', { name: 'כובע' }).click();

		await expect.element(screen.getByTestId('chat-cell')).toHaveTextContent('שמלה נעליים כובע');
	});

	it('סוג-תוכן לא-נתמך מציג כתובית בלבד — בלי מפתח-פיתוח באנגלית', async () => {
		const screen = await mount();

		const unsupported = screen.getByTestId('unsupported-cell').element();
		expect(unsupported.getAttribute('data-unsupported-type')).toBe('LiveCell/Camera');
		expect(unsupported.textContent?.trim()).toBe('רשימת מילים');
		expect(screen.getByTestId('unsupported-cell-type').elements()).toHaveLength(0);
	});
});

/**
 * 🛑 סלייס 11 — המחשבון האמיתי של `org-1`, ולא ספק שהומצא.
 *
 * בדף "מקלדת פשוטה - ספרות וסימנים" כל תא-סימן נושא שרשרת של **שלוש**
 * פקודות: ‏`Action.Space → Action.Punctuation → Action.Space` (‏5 תאים כאלה,
 * נמדד). זה המקרה שחשף שכיווץ-הרווחים ב-`ChatCell` אינו קוסמטיקה: בלעדיו
 * התוצאה היא ‏"1 +  2 =  3" עם רווח כפול, כי `Action.Space` מצרפת רווח
 * **לתוך** הפריט וה-`join` מוסיף רווח **בין** פריטים.
 */
const calcSpec: GridsetSpec = {
	startGrid: 'מחשבון',
	language: 'he-IL',
	pages: [
		{
			name: 'מחשבון',
			columns: 4,
			rows: 2,
			cells: [
				{ x: 0, y: 0, columnSpan: 4, contentType: 'Workspace', contentSubType: 'Chat' },
				{
					x: 0,
					y: 1,
					caption: 'אחת',
					commands: [{ id: 'Action.Number', params: { letter: '1' } }]
				},
				{
					x: 1,
					y: 1,
					caption: 'ועוד',
					commands: [
						{ id: 'Action.Space', params: {} },
						{ id: 'Action.Punctuation', params: { letter: '+' } },
						{ id: 'Action.Space', params: {} }
					]
				},
				{
					x: 2,
					y: 1,
					caption: 'שתיים',
					commands: [{ id: 'Action.Number', params: { letter: '2' } }]
				},
				{
					x: 3,
					y: 1,
					caption: 'מחק אות',
					commands: [{ id: 'Action.DeleteLetter', params: {} }]
				}
			]
		}
	]
};

describe('סלייס 11 — השרשרת Space→Punctuation→Space על המסך', () => {
	async function mountCalc() {
		const gridSet = await parseGridSet(buildGridset(calcSpec));
		return render(GridSetView, {
			gridSet,
			symbols: null,
			runtimeOptions: { speech: recordingSpeech }
		});
	}

	it('🛑 `textContent` מדויק — רווח **בודד** סביב הסימן, בלי כפל', async () => {
		const screen = await mountCalc();
		await screen.getByRole('button', { name: 'אחת' }).click();
		await screen.getByRole('button', { name: 'ועוד' }).click();
		await screen.getByRole('button', { name: 'שתיים' }).click();

		// 🔑 `toHaveTextContent` מנרמל רווחים ולכן **לא היה תופס** את הבאג.
		expect(screen.getByTestId('chat-cell').element().textContent).toBe('1 + 2');
	});

	it('Action.DeleteLetter מוחקת תו אחד מהמסך', async () => {
		const screen = await mountCalc();
		await screen.getByRole('button', { name: 'אחת' }).click();
		await screen.getByRole('button', { name: 'ועוד' }).click();
		await screen.getByRole('button', { name: 'שתיים' }).click();
		await screen.getByRole('button', { name: 'מחק אות' }).click();

		expect(screen.getByTestId('chat-cell').element().textContent).toBe('1 +');
	});
});

describe('edit isolation', () => {
	it('selects hidden/disabled/required/dynamic cells without commands, keeps one runtime and resumes Jump', async () => {
		const { tick } = await import('svelte');
		const { openGridSet } = await import('$lib/gridset/gridSetSource');
		const { createGridSetEditSession } = await import('../../../routes/grid/gridset-edit-session');
		const { gridSet, source } = await openGridSet(buildGridset(spec));
		const session = createGridSetEditSession(source, gridSet.styles);
		let runtime: import('$lib/gridset/runtime.svelte').GridRuntime | undefined;
		let mounts = 0;
		const selected: string[] = [];
		spoken.length = 0;
		const screen = render(GridSetView, {
			gridSet,
			symbols: null,
			editing: true,
			runtimeOptions: { speech: recordingSpeech },
			onRuntimeReady: (r) => {
				runtime = r;
				mounts++;
			},
			onSelectCell: (p, c) => selected.push(`${p.name}:${c.x},${c.y}`)
		});
		await tick();
		expect(screen.getByTestId('edit-cell').elements()).toHaveLength(6);
		await screen.getByTestId('edit-cell').nth(1).click();
		await screen.getByTestId('edit-cell').nth(2).click();
		await screen.getByTestId('edit-cell').nth(4).click();
		expect(selected).toEqual(['בית:0,1', 'בית:1,1', 'בית:3,1']);
		expect(runtime!.pageName).toBe('בית');
		expect(runtime!.output.items).toEqual([]);
		expect(spoken).toEqual([]);
		expect(
			screen
				.getByTestId('grid-cell')
				.elements()
				.every((el) => (el as HTMLElement).inert)
		).toBe(true);
		runtime!.navigate('אוכל');
		for (const word of ['one', 'two', 'three', 'four'])
			runtime!.output.insert({
				text: word,
				pos: 'Noun',
				gender: 'female',
				number: 'singular',
				image: { library: 'test', path: word + '.svg' }
			});
		const history = [...runtime!.history];
		const items = [...runtime!.output.items];
		const identity = runtime;
		gridSet.pages['אוכל'] = session.preview('אוכל', [
			{ page: 'אוכל', x: 1, y: 0, caption: 'preview' }
		]);
		await screen.rerender({ gridSet, editing: true });
		await expect.element(screen.getByText('preview')).toBeVisible();
		gridSet.pages['אוכל'] = session.preview('אוכל', []);
		await screen.rerender({ gridSet, editing: false });
		expect(runtime).toBe(identity);
		expect(mounts).toBe(1);
		expect(runtime!.history).toEqual(history);
		expect(runtime!.output.items).toEqual(items);
		await screen.getByRole('button', { name: 'לבגדים' }).click();
		expect(runtime!.pageName).toBe('בגדים');
	});
	it('org-1 pager keeps second-page DOM through same-name preview, cancel, apply and mode changes', async () => {
		const { tick } = await import('svelte');
		const { openGridSet, writeGridSet } = await import('$lib/gridset/gridSetSource');
		const { createGridSetEditSession } = await import('../../../routes/grid/gridset-edit-session');
		const { gridSet, source } = await openGridSet(
			new Uint8Array(await (await fetch('/org-1.gridset')).arrayBuffer())
		);
		const { createRuntime } = await import('$lib/gridset/runtime.svelte');
		const runtime = createRuntime(gridSet, { speech: recordingSpeech });
		runtime.navigate('בגדים - עוד');
		const { default: GridBoard } = await import('./GridBoard.svelte');
		const screen = render(GridBoard, { page: runtime.page, ctx: runtime, symbols: null });
		await tick();
		const at = (x: number, y: number) =>
			screen
				.getByTestId('grid-cell')
				.elements()
				.find(
					(el) =>
						el.getAttribute('data-cell-x') === String(x) &&
						el.getAttribute('data-cell-y') === String(y)
				)!;
		(at(3, 3) as HTMLElement).click();
		await tick();
		expect(at(2, 1).textContent).toContain('כפכפים');
		expect(at(1, 2).textContent).toContain('תכשיטים');
		expect(at(3, 3).textContent).toContain('חזור');
		const session = createGridSetEditSession(source, gridSet.styles);
		const edit = { page: runtime.pageName, x: 2, y: 1, colours: { BackColour: '#123456FF' } };
		for (const edits of [[edit], [], [edit]]) {
			gridSet.pages[runtime.pageName] = session.preview(runtime.pageName, edits);
			await screen.rerender({ page: runtime.page, editing: true });
			await tick();
			expect(at(2, 1).textContent).toContain('כפכפים');
			expect(at(1, 2).textContent).toContain('תכשיטים');
			expect(at(3, 3).textContent).toContain('חזור');
		}
		expect(writeGridSet(source, [edit]).length).toBeGreaterThan(0);
		await screen.rerender({ editing: false });
		expect(at(3, 3).textContent).toContain('חזור');
		runtime.navigate(gridSet.startGrid);
		await screen.rerender({ page: runtime.page });
		await tick();
		runtime.navigate('בגדים - עוד');
		await screen.rerender({ page: runtime.page });
		await tick();
		expect(at(3, 3).textContent).toContain('עוד');
	});
});
