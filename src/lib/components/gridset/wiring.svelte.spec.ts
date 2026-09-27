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
					contentType: 'AutoContent',
					contentSubType: 'WordList'
				}
			]
		},
		{
			name: 'אוכל',
			columns: 2,
			rows: 1,
			cells: [
				{ x: 0, y: 0, contentType: 'Workspace', contentSubType: 'Chat' },
				{
					x: 1,
					y: 0,
					caption: 'תפוח',
					commands: [{ id: 'Action.InsertText', params: { text: 'תפוח' } }]
				}
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

		expect(getComputedStyle(cell).backgroundColor).toBe('rgb(17, 34, 51)');
	});

	it('סוג-תוכן לא-נתמך מציג כתובית בלבד — בלי מפתח-פיתוח באנגלית', async () => {
		const screen = await mount();

		const unsupported = screen.getByTestId('unsupported-cell').element();
		expect(unsupported.getAttribute('data-unsupported-type')).toBe('AutoContent/WordList');
		expect(unsupported.textContent?.trim()).toBe('רשימת מילים');
		expect(screen.getByTestId('unsupported-cell-type').elements()).toHaveLength(0);
	});
});
