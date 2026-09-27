/**
 * בדיקות הפרסר. רצות בפרויקט `client` (chromium) ולא ב-`server`, כי
 * ‏`DOMParser` אינו קיים ב-Node — ולכן הסיומת `.svelte.spec.ts`, כמו
 * ‏`hash.svelte.spec.ts` בריפו הזה. אין כאן קומפוננטת Svelte.
 *
 * 🛑 ה-fixtures מסלייס 1 (`__fixtures__/`) עדיין לא במיזוג, ולכן ה-XML כתוב
 * כאן inline לפי `gridset-schema.tsv` — בדיוק כפי שהבריף מנחה.
 */

import { describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { DEFAULT_RESOLVED_STYLE, parseGridSet } from './parse';
import { richTextToString } from './richText';
import type {
	CellStyleSource,
	ResolvedStyle,
	RichText,
	StyleResolver,
	WordListItem
} from './types';

// ── בוני XML ─────────────────────────────────────────────────────────────

const SETTINGS_MIN = `<?xml version="1.0" encoding="utf-8"?><GridSetSettings><StartGrid>דף ראשי</StartGrid></GridSetSettings>`;

function gridsetZip(parts: {
	settings?: string;
	styles?: string;
	grids?: Record<string, string>;
	extraFiles?: Record<string, string>;
}): Uint8Array {
	const files: Record<string, Uint8Array> = {
		'Settings0/settings.xml': strToU8(parts.settings ?? SETTINGS_MIN)
	};
	if (parts.styles) files['Settings0/Styles/styles.xml'] = strToU8(parts.styles);
	for (const [name, xml] of Object.entries(parts.grids ?? {})) {
		files[`Grids/${name}/grid.xml`] = strToU8(xml);
	}
	for (const [path, body] of Object.entries(parts.extraFiles ?? {})) {
		files[path] = strToU8(body);
	}
	return zipSync(files);
}

function grid(opts: { columns?: number; rows?: number; cells?: string; extra?: string }): string {
	const columns = '<ColumnDefinition />'.repeat(opts.columns ?? 2);
	const rows = '<RowDefinition />'.repeat(opts.rows ?? 2);
	return (
		`<?xml version="1.0" encoding="utf-8"?><Grid>` +
		`<ColumnDefinitions>${columns}</ColumnDefinitions>` +
		`<RowDefinitions>${rows}</RowDefinitions>` +
		`${opts.extra ?? ''}` +
		`<Cells>${opts.cells ?? ''}</Cells>` +
		`</Grid>`
	);
}

/** תא מינימלי חוקי: לכל תא בנתונים יש Content ו-Style. */
function cell(attrs: string, inner = ''): string {
	return `<Cell ${attrs}><Content>${inner}<Style><BasedOnStyle>Default</BasedOnStyle></Style></Content></Cell>`;
}

async function parseSinglePage(gridXml: string, opts?: { resolveStyle?: StyleResolver }) {
	const set = await parseGridSet(gridsetZip({ grids: { 'Page 1': gridXml } }), opts);
	const page = set.pages['Page 1'];
	expect(page).toBeDefined();
	return page;
}

// ── מלכודת 1 ─────────────────────────────────────────────────────────────

describe('מלכודת 1 — X=0 הוא הימני, והקואורדינטה נשמרת כפי שהיא', () => {
	it('שומר X ו-Y בדיוק כפי שהם, בלי היפוך ל-columns-1-x', async () => {
		const page = await parseSinglePage(
			grid({
				columns: 6,
				rows: 4,
				cells: cell('X="0" Y="0"') + cell('X="5" Y="3"')
			})
		);
		expect(page.cells.map((c) => [c.x, c.y])).toEqual([
			[0, 0],
			[5, 3]
		]);
	});

	it('היפוך היה נשבר על ColumnSpan — ולכן ה-span נשמר לצד ה-x המקורי', async () => {
		const page = await parseSinglePage(
			grid({ columns: 6, rows: 4, cells: cell('X="0" Y="0" ColumnSpan="3" RowSpan="2"') })
		);
		expect(page.cells[0]).toMatchObject({ x: 0, y: 0, columnSpan: 3, rowSpan: 2 });
	});
});

// ── מלכודת 2 ─────────────────────────────────────────────────────────────

describe('מלכודת 2 — מאפיין חסר', () => {
	it('X או Y חסרים = 0 (X חסר ב-38,287 תאים, Y ב-35,431)', async () => {
		const page = await parseSinglePage(
			grid({ columns: 3, rows: 3, cells: cell('') + cell('X="2"') + cell('Y="1"') })
		);
		expect(page.cells.map((c) => [c.x, c.y])).toEqual([
			[0, 0],
			[2, 0],
			[0, 1]
		]);
	});

	it('ColumnSpan/RowSpan חסרים = 1, לא 0', async () => {
		const page = await parseSinglePage(grid({ cells: cell('X="1"') }));
		expect(page.cells[0]).toMatchObject({ columnSpan: 1, rowSpan: 1 });
	});

	it('מאפיין ריק או לא-מספרי נופל לברירת-המחדל ולא ל-NaN', async () => {
		const page = await parseSinglePage(grid({ cells: cell('X="" Y="abc" ColumnSpan=""') }));
		expect(page.cells[0]).toMatchObject({ x: 0, y: 0, columnSpan: 1 });
	});
});

// ── מלכודת 3 ─────────────────────────────────────────────────────────────

describe('מלכודת 3 — columns/rows הם ספירת אלמנטים', () => {
	it('נספרים מ-ColumnDefinitions/RowDefinitions ולא ממאפיין', async () => {
		const page = await parseSinglePage(grid({ columns: 6, rows: 4 }));
		expect([page.columns, page.rows]).toEqual([6, 4]);
	});

	it('Width/Height על ההגדרות אינם משנים את הספירה', async () => {
		const gridXml =
			`<?xml version="1.0" encoding="utf-8"?><Grid>` +
			`<ColumnDefinitions><ColumnDefinition Width="Large" /><ColumnDefinition /><ColumnDefinition Width="ExtraSmall" /></ColumnDefinitions>` +
			`<RowDefinitions><RowDefinition Height="Small" /></RowDefinitions>` +
			`<Cells /></Grid>`;
		const page = await parseSinglePage(gridXml);
		expect([page.columns, page.rows]).toEqual([3, 1]);
	});

	it('🛑 המאפיין Width/Height נשמר ב-columnWidths/rowHeights, null = רגיל', async () => {
		const gridXml =
			`<?xml version="1.0" encoding="utf-8"?><Grid>` +
			`<ColumnDefinitions><ColumnDefinition Width="Large" /><ColumnDefinition /><ColumnDefinition Width="ExtraSmall" /></ColumnDefinitions>` +
			`<RowDefinitions><RowDefinition Height="ExtraLarge" /><RowDefinition /></RowDefinitions>` +
			`<Cells /></Grid>`;
		const page = await parseSinglePage(gridXml);
		expect(page.columnWidths).toEqual(['Large', null, 'ExtraSmall']);
		expect(page.rowHeights).toEqual(['ExtraLarge', null]);
	});

	it('מידה לא מוכרת נופלת ל-null, ורשת אחידה מקבלת מערך null-ים באורך הנכון', async () => {
		const gridXml =
			`<?xml version="1.0" encoding="utf-8"?><Grid>` +
			`<ColumnDefinitions><ColumnDefinition Width="Gigantic" /><ColumnDefinition /></ColumnDefinitions>` +
			`<RowDefinitions><RowDefinition /></RowDefinitions><Cells /></Grid>`;
		const page = await parseSinglePage(gridXml);
		expect(page.columnWidths).toEqual([null, null]);
		expect(page.rowHeights).toEqual([null]);
	});

	it('דף בלי הגדרות בכלל מחזיר 0 ולא קורס', async () => {
		const page = await parseSinglePage(`<?xml version="1.0"?><Grid><Cells /></Grid>`);
		expect([page.columns, page.rows]).toEqual([0, 0]);
		expect([page.columnWidths, page.rowHeights]).toEqual([[], []]);
	});
});

// ── מלכודת 4 ─────────────────────────────────────────────────────────────

describe('מלכודת 4 — טקסט עשיר בשלוש צורות, מנורמל לצורה אחת', () => {
	const wordListXml =
		`<WordList><Items>` +
		// Text/p/s/r — 28,078
		`<WordListItem><Text><p><s Image="[widgit]widgit rebus\\h\\have.emf"><r>יש</r><r> לי</r></s></p></Text></WordListItem>` +
		// Text/s/r — 27,927 (בלי <p>)
		`<WordListItem><Text><s Image="[WIDGIT]a\\b.emf"><r>רוצה</r></s></Text></WordListItem>` +
		// Text/r — 206 (ישיר)
		`<WordListItem><Text><r>Cheerios</r></Text></WordListItem>` +
		// Text/d/p/s/r — 2,060, אינה בבריף
		`<WordListItem><Text><d><p><s><r>שורה</r></s></p><p><s><r>שנייה</r></s></p></d></Text></WordListItem>` +
		`</Items></WordList>`;

	async function items(): Promise<WordListItem[]> {
		const page = await parseSinglePage(grid({ extra: wordListXml }));
		return page.wordList;
	}

	it('Text/p/s/r — פסקה אחת, משפט אחד, שתי ריצות', async () => {
		const [first] = await items();
		expect(first.text).toEqual({
			paragraphs: [
				{
					sentences: [
						{ image: { library: 'widgit', path: 'widgit rebus\\h\\have.emf' }, runs: ['יש', ' לי'] }
					]
				}
			]
		});
	});

	it('Text/s/r בלי <p> — נעטף במרומז בפסקה אחת', async () => {
		const [, second] = await items();
		expect(second.text.paragraphs).toHaveLength(1);
		expect(second.text.paragraphs[0].sentences[0].runs).toEqual(['רוצה']);
	});

	it('Text/r ישיר — נעטף במרומז בפסקה ובמשפט', async () => {
		const [, , third] = await items();
		expect(third.text).toEqual({ paragraphs: [{ sentences: [{ runs: ['Cheerios'] }] }] });
	});

	it('Text/d/p/s/r — <d> שקוף, ושתי הפסקאות שבתוכו עולות לרמה אחת', async () => {
		const [, , , fourth] = await items();
		expect(fourth.text.paragraphs).toHaveLength(2);
		expect(richTextToString(fourth.text)).toBe('שורה\nשנייה');
	});

	it('🛑 <p/> ריק אינו מייצר פסקה ריקה — בלי שורה ריקה מובילה', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="Action.InsertText">` +
						`<Parameter Key="text"><p /><p><s><r>א</r></s></p></Parameter>` +
						`</Command></Commands>`
				)
			})
		);
		const value = page.cells[0].commands[0].params.text as RichText;
		expect(value.paragraphs).toHaveLength(1);
		expect(richTextToString(value)).toBe('א');
	});

	it('🔑 הסמל יושב על ה-<s>, ולא על התא ולא על הפריט', async () => {
		const [first, second, third] = await items();
		expect(first.text.paragraphs[0].sentences[0].image?.library).toBe('widgit');
		// אותה ספרייה בדיוק, למרות [WIDGIT] באותיות גדולות
		expect(second.text.paragraphs[0].sentences[0].image?.library).toBe('widgit');
		expect(third.text.paragraphs[0].sentences[0].image).toBeUndefined();
	});

	it('אותן צורות חלות גם על ערך של פרמטר-פקודה', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="Action.InsertText">` +
						`<Parameter Key="text"><p><s Image="[MJPCS#]3269.wmf"><r>אני</r></s></p></Parameter>` +
						`</Command></Commands>`
				)
			})
		);
		expect(page.cells[0].commands[0].params.text).toEqual({
			paragraphs: [
				{ sentences: [{ image: { library: 'mjpcs#', path: '3269.wmf' }, runs: ['אני'] }] }
			]
		});
	});
});

// ── מלכודת 5 ─────────────────────────────────────────────────────────────

describe('מלכודת 5 — <CaptionAndImage nil="true"/>', () => {
	it('תא ריק אינו מפיל את הפרסור, ונשאר ברשימת התאים', async () => {
		const page = await parseSinglePage(
			grid({
				cells:
					cell('X="0"', '<CaptionAndImage nil="true" />') +
					cell('X="1"', '<CaptionAndImage><Caption>אני רוצה</Caption></CaptionAndImage>')
			})
		);
		expect(page.cells).toHaveLength(2);
		expect(page.cells[0].caption).toBeUndefined();
		expect(page.cells[1].caption).toBe('אני רוצה');
	});

	it('🛑 כתובית של רווח בודד נשמרת — מקש-הרווח במקלדת AAC', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell('X="0"', '<CaptionAndImage><Caption> </Caption></CaptionAndImage>')
			})
		);
		expect(page.cells[0].caption).toBe(' ');
	});

	it('גם בצורה המוסמכת xsi:nil — ולכן ההשוואה על localName ולא על השם המלא', async () => {
		const gridXml = grid({
			cells: `<Cell X="0"><Content><CaptionAndImage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" /><Style><BasedOnStyle>Default</BasedOnStyle></Style></Content></Cell>`
		});
		const page = await parseSinglePage(gridXml);
		expect(page.cells[0]).toMatchObject({ x: 0 });
		expect(page.cells[0].caption).toBeUndefined();
		expect(page.cells[0].image).toBeUndefined();
	});
});

// ── מלכודת 6 ─────────────────────────────────────────────────────────────

describe('מלכודת 6 — הדף מחזיק מנועים', () => {
	it('WordList ו-PredictionSource נקראים לרמת הדף', async () => {
		const page = await parseSinglePage(
			grid({
				extra:
					`<PredictionSource>WordListAndPredictor</PredictionSource>` +
					`<WordList><Sorting>Alphabetical</Sorting><Items>` +
					`<WordListItem><Image>-0.emf</Image><PartOfSpeech>Pronoun</PartOfSpeech><Number>plural</Number><Person>second</Person><Text><s><r>אתם</r></s></Text></WordListItem>` +
					`</Items></WordList>`
			})
		);
		expect(page.predictionSource).toBe('WordListAndPredictor');
		expect(page.wordList).toEqual([
			{
				text: { paragraphs: [{ sentences: [{ runs: ['אתם'] }] }] },
				image: { library: '', path: '-0.emf' },
				partOfSpeech: 'Pronoun',
				grammar: { number: 'plural', person: 'second' }
			}
		]);
	});

	it('בלי PredictionSource — None, ורשימה ריקה ולא undefined', async () => {
		const page = await parseSinglePage(grid({}));
		expect(page.predictionSource).toBe('None');
		expect(page.wordList).toEqual([]);
	});

	it('ערך לא מוכר ב-PredictionSource נופל ל-None', async () => {
		const page = await parseSinglePage(
			grid({ extra: '<PredictionSource>Whatever</PredictionSource>' })
		);
		expect(page.predictionSource).toBe('None');
	});

	it('🛑 /Grid/WordList אינו מתבלבל עם WordList שבתוך פרמטר של תא', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="Prediction.ChangeWordList">` +
						`<Parameter Key="wordlist"><WordList><Items>` +
						`<WordListItem><Text><s><r>מי</r></s></Text></WordListItem>` +
						`</Items></WordList></Parameter></Command></Commands>`
				)
			})
		);
		// הדף עצמו ריק; הפריט חי רק בתוך הפרמטר
		expect(page.wordList).toEqual([]);
		expect(page.cells[0].commands[0].params.wordlist).toHaveLength(1);
	});
});

// ── מלכודת 7 ─────────────────────────────────────────────────────────────

describe('מלכודת 7 — AutoContentCommands ברמת הדף', () => {
	const extra =
		`<AutoContentCommands>` +
		`<AutoContentCommandCollection AutoContentType="Chat.History">` +
		`<Commands><Command ID="Action.InsertText"><Parameter Key="text"><p><s><r>היסטוריה</r></s></p></Parameter></Command>` +
		`<Command ID="Action.Speak" /></Commands>` +
		`</AutoContentCommandCollection>` +
		`<AutoContentCommandCollection AutoContentType="Contacts.Contacts"><Commands><Command ID="Jump.To"><Parameter Key="grid">אנשי קשר</Parameter></Command></Commands></AutoContentCommandCollection>` +
		`</AutoContentCommands>`;

	it('האוסף נקרא לפי AutoContentType, עם השרשרת המלאה בסדרה', async () => {
		const page = await parseSinglePage(grid({ extra }));
		expect(Object.keys(page.autoContentCommands)).toEqual(['Chat.History', 'Contacts.Contacts']);
		expect(page.autoContentCommands['Chat.History'].map((c) => c.id)).toEqual([
			'Action.InsertText',
			'Action.Speak'
		]);
	});

	it('🔑 תא AutoContent עצמו ריק מפקודות — מי שיחפש בתוכו ימצא ריק', async () => {
		const page = await parseSinglePage(
			grid({
				extra,
				cells: cell(
					'X="0"',
					'<ContentType>AutoContent</ContentType><ContentSubType>WordList</ContentSubType>'
				)
			})
		);
		expect(page.cells[0].commands).toEqual([]);
		expect(page.cells[0].contentType).toBe('AutoContent');
		// המקור האמיתי לשרשרת שלו הוא טבלת הדף
		expect(page.autoContentCommands['Chat.History']).toHaveLength(2);
	});

	it('בלי AutoContentCommands — אובייקט ריק ולא undefined', async () => {
		const page = await parseSinglePage(grid({}));
		expect(page.autoContentCommands).toEqual({});
	});
});

// ── פקודות ופרמטרים ──────────────────────────────────────────────────────

describe('פקודות ופרמטרים', () => {
	it('שומר את סדר השרשרת ואת מזהי הפקודות', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands>` +
						`<Command ID="Settings.RequiredFeature"><Parameter Key="feature">ComputerControl</Parameter></Command>` +
						`<Command ID="Action.InsertText"><Parameter Key="text"><p><s><r>שלום</r></s></p></Parameter><Parameter Key="gender">זכר</Parameter></Command>` +
						`<Command ID="Action.Speak"><Parameter Key="unit">All</Parameter></Command>` +
						`</Commands>`
				)
			})
		);
		expect(page.cells[0].commands.map((c) => c.id)).toEqual([
			'Settings.RequiredFeature',
			'Action.InsertText',
			'Action.Speak'
		]);
		expect(page.cells[0].commands[0].params.feature).toBe('ComputerControl');
		expect(page.cells[0].commands[1].params.gender).toBe('זכר');
	});

	it('רישיות המפתח נשמרת כפי שהיא — בנתונים יש גם text וגם FileName', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="ComputerControl.Run"><Parameter Key="FileName">notepad</Parameter><Parameter Key="AllowSwitchTo">1</Parameter></Command></Commands>`
				)
			})
		);
		expect(Object.keys(page.cells[0].commands[0].params)).toEqual(['FileName', 'AllowSwitchTo']);
	});

	it('<data> → { data } (SpeechPlaySound Key="filedata")', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="SpeechPlaySound"><Parameter Key="filedata"><data>SUQzBAA=</data></Parameter><Parameter Key="wait">0</Parameter></Command></Commands>`
				)
			})
		);
		expect(page.cells[0].commands[0].params.filedata).toEqual({ data: 'SUQzBAA=' });
		expect(page.cells[0].commands[0].params.wait).toBe('0');
	});

	it('🛑 צורת-ערך שאינה נתמכת מושמטת מהמפתחות ואינה הופכת למחרוזת ריקה', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="Jump.To">` +
						`<Parameter Key="gridimageref"><gridimageref /></Parameter>` +
						`<Parameter Key="nested"><CommandCollectionParameterValue><Items><Command ID="ComputerControl.Keyboard" /></Items></CommandCollectionParameterValue></Parameter>` +
						`<Parameter Key="grid">דף ראשי</Parameter>` +
						`</Command></Commands>`
				)
			})
		);
		// '' היה אומר שקר — הצרכן לא יכול להבחין בו בין "לא נתמך" ל"ריק"
		expect(Object.keys(page.cells[0].commands[0].params)).toEqual(['grid']);
	});

	it('xml:space="preserve" שומר רווחים; בלעדיו הרווח מקוצץ', async () => {
		const page = await parseSinglePage(
			grid({
				cells: cell(
					'X="0"',
					`<Commands><Command ID="Action.Letter"><Parameter Key="letter" xml:space="preserve"> </Parameter></Command>` +
						`<Command ID="Jump.To"><Parameter Key="grid">  .00 Index  </Parameter></Command></Commands>`
				)
			})
		);
		expect(page.cells[0].commands[0].params.letter).toBe(' ');
		expect(page.cells[0].commands[1].params.grid).toBe('.00 Index');
	});

	it('🛑 /Grid/Commands (פקודות דף) אינן מתערבבות עם פקודות התא', async () => {
		const page = await parseSinglePage(
			grid({
				extra: `<Commands><Command ID="Interactive.Restart" /></Commands>`,
				cells: cell('X="0"', `<Commands><Command ID="Jump.Back" /></Commands>`)
			})
		);
		expect(page.commands?.map((c) => c.id)).toEqual(['Interactive.Restart']);
		expect(page.cells[0].commands.map((c) => c.id)).toEqual(['Jump.Back']);
	});

	it('בלי /Grid/Commands — השדה נשאר undefined ולא מערך ריק', async () => {
		const page = await parseSinglePage(grid({}));
		expect(page.commands).toBeUndefined();
	});
});

// ── ImageRef ─────────────────────────────────────────────────────────────

describe('ImageRef', () => {
	it('מפריד ספרייה מנתיב, ומנרמל את שם הספרייה לאותיות קטנות', async () => {
		const page = await parseSinglePage(
			grid({
				cells:
					cell(
						'X="0"',
						'<CaptionAndImage><Image>[widgit]widgit rebus\\h\\have.emf</Image></CaptionAndImage>'
					) +
					cell(
						'X="1"',
						'<CaptionAndImage><Image>[WIDGIT]england\\uk wrebus\\1 pound.emf</Image></CaptionAndImage>'
					) +
					cell('X="2"', '<CaptionAndImage><Image>-0-text-0.png</Image></CaptionAndImage>') +
					cell(
						'X="3"',
						'<CaptionAndImage><Image>[grid3x]align_left.wmf?tone=2</Image></CaptionAndImage>'
					)
			})
		);
		expect(page.cells.map((c) => c.image)).toEqual([
			{ library: 'widgit', path: 'widgit rebus\\h\\have.emf' },
			{ library: 'widgit', path: 'england\\uk wrebus\\1 pound.emf' },
			{ library: '', path: '-0-text-0.png' },
			{ library: 'grid3x', path: 'align_left.wmf?tone=2' }
		]);
	});

	it('הפניה ריקה אינה יוצרת ImageRef', async () => {
		const page = await parseSinglePage(
			grid({ cells: cell('X="0"', '<CaptionAndImage><Image></Image></CaptionAndImage>') })
		);
		expect(page.cells[0].image).toBeUndefined();
	});
});

// ── שדות תא נוספים ───────────────────────────────────────────────────────

describe('שדות תא נוספים', () => {
	it('Visibility · ScanBlock · ContentSubSubType · Content/Parameters', async () => {
		const page = await parseSinglePage(
			grid({
				cells:
					cell(
						'X="0" ScanBlock="3"',
						'<ContentType>Workspace</ContentType><ContentSubType>Chat</ContentSubType>'
					) +
					`<Cell X="1"><Visibility>Disabled</Visibility><Content><ContentType>LiveCell</ContentType><ContentSubType>Animation</ContentSubType><ContentSubSubType>4inarow</ContentSubSubType><Style /></Content></Cell>` +
					`<Cell X="2"><Content><Parameters ID="Settings.EyeGazeMonitor"><Parameter Key="EyeType">Left</Parameter></Parameters><Style /></Content></Cell>` +
					`<Cell X="3"><ScanBlocks><ScanBlock>1</ScanBlock></ScanBlocks><Content><Style /></Content></Cell>`
			})
		);
		expect(page.cells[0]).toMatchObject({
			scanBlock: 3,
			contentType: 'Workspace',
			contentSubType: 'Chat'
		});
		expect(page.cells[1]).toMatchObject({
			visibility: 'Disabled',
			contentType: 'LiveCell',
			contentSubSubType: '4inarow'
		});
		expect(page.cells[2].contentParameters).toEqual({
			ID: 'Settings.EyeGazeMonitor',
			EyeType: 'Left'
		});
		// ScanBlock כאלמנט (212 מופעים) נקרא כגיבוי למאפיין
		expect(page.cells[3].scanBlock).toBe(1);
	});

	it('Visibility לא מוכר או ContentType לא מוכר אינם נכנסים למודל', async () => {
		const page = await parseSinglePage(
			grid({
				cells: `<Cell X="0"><Visibility>Nonsense</Visibility><Content><ContentType>Bogus</ContentType><Style /></Content></Cell>`
			})
		);
		expect(page.cells[0].visibility).toBeUndefined();
		expect(page.cells[0].contentType).toBeUndefined();
	});
});

// ── הדף כמכלול ───────────────────────────────────────────────────────────

describe('מאפייני דף', () => {
	it('GridGuid · רקע · יישורים · SelfClosing', async () => {
		const page = await parseSinglePage(
			grid({
				extra:
					`<GridGuid>000563b5-579f-4924-8991-917cfe7e0414</GridGuid>` +
					`<BackgroundStyle>SolidColor</BackgroundStyle><BackgroundColour>#162F3BFF</BackgroundColour>` +
					`<BackgroundImage>bg.png</BackgroundImage>` +
					`<HorizontalAlignment>Right</HorizontalAlignment><VerticalAlignment>Top</VerticalAlignment>` +
					`<SelfClosing>1</SelfClosing>`
			})
		);
		expect(page.guid).toBe('000563b5-579f-4924-8991-917cfe7e0414');
		expect(page.background).toEqual({
			style: 'SolidColor',
			colour: '#162F3BFF',
			image: 'bg.png'
		});
		expect(page.horizontalAlignment).toBe('Right');
		expect(page.verticalAlignment).toBe('Top');
		expect(page.selfClosing).toBe(true);
	});

	it('בלי רקע — אובייקט ריק, ובלי SelfClosing — undefined', async () => {
		const page = await parseSinglePage(grid({}));
		expect(page.background).toEqual({});
		expect(page.selfClosing).toBeUndefined();
	});

	it('שם הדף הוא שם התיקייה ב-ZIP — כולל עברית ורווחים', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: {
					'דף ראשי': grid({ columns: 6, rows: 4 }),
					'00 Grids - 01 - Home A': grid({})
				}
			})
		);
		expect(Object.keys(set.pages).sort()).toEqual(['00 Grids - 01 - Home A', 'דף ראשי']);
		expect(set.pages['דף ראשי'].name).toBe('דף ראשי');
	});
});

// ── settings.xml ─────────────────────────────────────────────────────────

describe('settings.xml', () => {
	it('StartGrid · Language · Theme · סדר מפתחות הסמלים', async () => {
		const set = await parseGridSet(
			gridsetZip({
				settings:
					`<?xml version="1.0" encoding="utf-8"?><GridSetSettings>` +
					`<StartGrid>00 בחירת גירסה</StartGrid><Language>he-IL</Language>` +
					`<Appearance><Theme>Kids</Theme><CellSpacing>Large</CellSpacing></Appearance>` +
					`<PictureSearch><PictureSearchKeys>` +
					`<PictureSearchKey>widgit</PictureSearchKey><PictureSearchKey>sstix#</PictureSearchKey><PictureSearchKey>dbr#he</PictureSearchKey>` +
					`</PictureSearchKeys></PictureSearch>` +
					`</GridSetSettings>`,
				grids: { 'Page 1': grid({}) }
			})
		);
		expect(set.startGrid).toBe('00 בחירת גירסה');
		expect(set.language).toBe('he-IL');
		expect(set.theme).toBe('Kids');
		expect(set.symbolSearchKeys).toEqual(['widgit', 'sstix#', 'dbr#he']);
	});

	it('ZIP בלי settings.xml — שגיאה מפורשת, לא מודל חצי-בנוי', async () => {
		const zip = zipSync({ 'Grids/Page 1/grid.xml': strToU8(grid({})) });
		await expect(parseGridSet(zip)).rejects.toThrow(/settings\.xml/);
	});

	it('XML פגום — שגיאה שמזהה את הקובץ', async () => {
		const zip = gridsetZip({ settings: '<GridSetSettings><StartGrid>לא נסגר' });
		await expect(parseGridSet(zip)).rejects.toThrow(/settings\.xml/);
	});

	it('קבצים שאינם XML ב-ZIP (סמלים, mp3) אינם נפרשים ואינם מפריעים', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: { 'Page 1': grid({ cells: cell('X="0"') }) },
				extraFiles: {
					'Grids/Page 1/-0-text-0.png': 'לא-XML בכלל',
					'Settings0/Styles/notes.txt': 'בלגן'
				}
			})
		);
		expect(Object.keys(set.pages)).toEqual(['Page 1']);
		expect(set.pages['Page 1'].cells).toHaveLength(1);
	});

	it('ArrayBuffer ו-Uint8Array מקבלים אותו טיפול', async () => {
		const bytes = gridsetZip({ grids: { 'Page 1': grid({}) } });
		const fromBytes = await parseGridSet(bytes);
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		const fromBuffer = await parseGridSet(buffer as ArrayBuffer);
		expect(fromBuffer).toEqual(fromBytes);
	});
});

// ── הזרקת פותר הסגנונות ──────────────────────────────────────────────────

describe('הפרדת התלות בסגנונות', () => {
	const cellsXml =
		`<Cell X="0"><Content><Style><BasedOnStyle>Navigation category style</BasedOnStyle>` +
		`<BackColour>#00A885FF</BackColour><FontSize>18</FontSize><BackgroundShape>2</BackgroundShape>` +
		`<TileColour>#000000FF</TileColour></Style></Content></Cell>`;

	// 🛑 שונה בסלייס 7 (חיווט): עד אז "בלי פותר" פירושו היה DEFAULT_RESOLVED_STYLE
	// לכל תא — כלומר כל לוח אמיתי מרודד ללבן-על-לבן, כי הקורא אינו יכול לבנות
	// פותר לפני הפרסור (הקטלוג יושב בתוך ה-ZIP). ברירת-המחדל היא כעת הפותר של
	// סלייס 3 על הקטלוג שנקרא מאותו קובץ; הזרקה מפורשת ממשיכה לגבור.
	it('בלי פותר — ברירת המחדל היא createStyleResolver על הקטלוג של הקובץ', async () => {
		const page = await parseSinglePage(grid({ cells: cellsXml }));
		// הסגנון הנקוב אינו בקטלוג (styles.xml ריק בעזר הזה) ⇒ בסיס ברירת-מחדל,
		// אבל עקיפות התא **כן** מוחלות — וזה כל ההבדל מול הבדל הקודם.
		expect(page.cells[0].style).toEqual({
			...DEFAULT_RESOLVED_STYLE,
			backColour: '#00A885FF',
			fontSize: 18,
			backgroundShape: 2,
			tileColour: '#000000FF'
		});
	});

	it('סגנון נקוב שקיים בקטלוג נפתר בלי שהקורא יזריק דבר', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: {
					'Page 1': grid({
						cells: `<Cell X="0"><Content><Style><BasedOnStyle>כחול</BasedOnStyle></Style></Content></Cell>`
					})
				},
				styles:
					`<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>` +
					`<Style Key="כחול"><BackColour>#112233FF</BackColour><FontSize>31</FontSize></Style>` +
					`</Styles></StyleData>`
			})
		);
		const style = set.pages['Page 1'].cells[0].style;
		expect(style.backColour).toBe('#112233FF');
		expect(style.fontSize).toBe(31);
	});

	it('הפרסר מרכיב CellStyleSource ומעביר אותו לפותר — ואינו פותר ירושה בעצמו', async () => {
		const seen: CellStyleSource[] = [];
		const resolveStyle = vi.fn((source: CellStyleSource): ResolvedStyle => {
			seen.push(source);
			return { ...DEFAULT_RESOLVED_STYLE, backColour: String(source.overrides.backColour) };
		});
		const page = await parseSinglePage(grid({ cells: cellsXml }), { resolveStyle });
		expect(resolveStyle).toHaveBeenCalledTimes(1);
		expect(seen[0]).toEqual({
			basedOnStyle: 'Navigation category style',
			overrides: {
				backColour: '#00A885FF',
				fontSize: 18,
				backgroundShape: 2,
				tileColour: '#000000FF'
			}
		});
		expect(page.cells[0].style.backColour).toBe('#00A885FF');
	});

	it('קטלוג הסגנונות נקרא מ-styles.xml לפי מאפיין Key, ו-<Name> נשמר בנפרד', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: { 'Page 1': grid({}) },
				styles:
					`<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>` +
					`<Style Key="Access category style"><BackColour>#A38F84FF</BackColour><BorderColour>#A38F84FF</BorderColour><FontColour>#FFFFFFFF</FontColour><FontSize>12</FontSize><Name>ACTIONS</Name></Style>` +
					`<Style Key="Action cell 1"><FontName>Arial</FontName></Style>` +
					`</Styles></StyleData>`
			})
		);
		expect(Object.keys(set.styles)).toEqual(['Access category style', 'Action cell 1']);
		expect(set.styles['Access category style']).toEqual({
			name: 'Access category style',
			backColour: '#A38F84FF',
			borderColour: '#A38F84FF',
			fontColour: '#FFFFFFFF',
			fontSize: 12,
			Name: 'ACTIONS'
		});
	});

	it('🛑 FontSize שברי נשמר, ו-14.666 אינו מתמזג עם 14', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: {
					'Page 1': grid({
						cells: `<Cell X="0"><Content><Style><FontSize>18.666666666666668</FontSize></Style></Content></Cell>`
					})
				},
				styles:
					`<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>` +
					`<Style Key="שברי"><FontSize>14.666666666666666</FontSize></Style>` +
					`<Style Key="שלם"><FontSize>14</FontSize></Style>` +
					`</Styles></StyleData>`
			}),
			{ resolveStyle: (source) => ({ ...DEFAULT_RESOLVED_STYLE, ...source.overrides }) }
		);
		// 132 מ-2,221 הסגנונות שבריים — המרות pt→px
		expect(set.styles['שברי'].fontSize).toBeCloseTo(14.666666666666666, 12);
		expect(set.styles['שברי'].fontSize).not.toBe(set.styles['שלם'].fontSize);
		// אותו readStyleProps משרת גם את רמת התא — 17,325 מופעים
		expect(set.pages['Page 1'].cells[0].style.fontSize).toBeCloseTo(18.666666666666668, 12);
	});

	it('🛑 BasedOnStyle אינו נקרא לסגנון-קטלוג — הוא קיים רק על סגנון של תא', async () => {
		const set = await parseGridSet(
			gridsetZip({
				grids: { 'Page 1': grid({}) },
				styles:
					`<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>` +
					`<Style Key="ק"><BasedOnStyle>אחר</BasedOnStyle><FontName>Arial</FontName></Style>` +
					`</Styles></StyleData>`
			})
		);
		// לא כשדה ממופה, וגם לא כאלמנט "טרם מופה" שנשמר בשמו
		expect(set.styles['ק'].basedOnStyle).toBeUndefined();
		expect(set.styles['ק'].BasedOnStyle).toBeUndefined();
		expect(set.styles['ק']).toEqual({ name: 'ק', fontName: 'Arial' });
	});

	it('BasedOnStyle של תא אינו נשפך ל-overrides', async () => {
		const seen: CellStyleSource[] = [];
		await parseSinglePage(
			grid({
				cells: `<Cell X="0"><Content><Style><BasedOnStyle>Navigation category style</BasedOnStyle><FontName>Arial</FontName></Style></Content></Cell>`
			}),
			{
				resolveStyle: (source) => {
					seen.push(source);
					return DEFAULT_RESOLVED_STYLE;
				}
			}
		);
		expect(seen[0]).toEqual({
			basedOnStyle: 'Navigation category style',
			overrides: { fontName: 'Arial' }
		});
	});

	it('בלי styles.xml — קטלוג ריק, בלי שגיאה', async () => {
		const set = await parseGridSet(gridsetZip({ grids: { 'Page 1': grid({}) } }));
		expect(set.styles).toEqual({});
	});
});

// ── snapshot ─────────────────────────────────────────────────────────────

/**
 * מידות אמיתיות של `דף ראשי` מ-`pages.tsv`: 6 עמודות · 4 שורות ·
 * 21 תאים מוגדרים · 20 מלאים (האחרון nil).
 */
function orgHomeGridset(): Uint8Array {
	const cells: string[] = [];
	for (let i = 0; i < 21; i++) {
		const x = i % 6;
		const y = Math.floor(i / 6);
		if (i === 20) {
			cells.push(cell(`X="${x}" Y="${y}" ScanBlock="4"`, '<CaptionAndImage nil="true" />'));
			continue;
		}
		if (i === 0) {
			cells.push(
				cell(
					`X="${x}" Y="${y}" ColumnSpan="2" ScanBlock="1"`,
					`<CaptionAndImage><Caption>פלט</Caption></CaptionAndImage>` +
						`<ContentType>Workspace</ContentType><ContentSubType>Chat</ContentSubType>`
				)
			);
			continue;
		}
		if (i === 5) {
			cells.push(
				cell(
					`X="${x}" Y="${y}" ScanBlock="2"`,
					`<CaptionAndImage><Caption>עוד</Caption><Image>[GRID3X]jump_back.wmf</Image></CaptionAndImage>` +
						`<Commands><Command ID="Jump.To"><Parameter Key="grid">דף ראשי - עוד</Parameter></Command></Commands>`
				)
			);
			continue;
		}
		cells.push(
			cell(
				`X="${x}" Y="${y}" ScanBlock="${(i % 4) + 1}"`,
				`<CaptionAndImage><Caption>מילה ${i}</Caption><Image>[widgit]widgit rebus\\w\\word ${i}.emf</Image></CaptionAndImage>` +
					`<Commands><Command ID="Action.InsertText"><Parameter Key="text"><p><s Image="[widgit]widgit rebus\\w\\word ${i}.emf"><r>מילה ${i}</r></s></p></Parameter></Command>` +
					`<Command ID="Action.Speak"><Parameter Key="unit">All</Parameter></Command></Commands>`
			)
		);
	}
	return gridsetZip({
		settings:
			`<?xml version="1.0" encoding="utf-8"?><GridSetSettings><StartGrid>דף ראשי</StartGrid>` +
			`<Language>he-IL</Language><PictureSearch><PictureSearchKeys><PictureSearchKey>widgit</PictureSearchKey></PictureSearchKeys></PictureSearch>` +
			`</GridSetSettings>`,
		styles:
			`<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>` +
			`<Style Key="Default"><BackColour>#FFFFFFFF</BackColour><FontSize>14</FontSize></Style>` +
			`</Styles></StyleData>`,
		grids: {
			'דף ראשי': grid({
				columns: 6,
				rows: 4,
				extra:
					`<GridGuid>000563b5-579f-4924-8991-917cfe7e0414</GridGuid>` +
					`<BackgroundColour>#162F3BFF</BackgroundColour>` +
					`<PredictionSource>WordList</PredictionSource>` +
					`<WordList><Items><WordListItem><PartOfSpeech>Pronoun</PartOfSpeech><Text><s><r>אני</r></s></Text></WordListItem></Items></WordList>` +
					`<AutoContentCommands><AutoContentCommandCollection AutoContentType="Chat.History"><Commands><Command ID="Action.Speak" /></Commands></AutoContentCommandCollection></AutoContentCommands>`,
				cells: cells.join('')
			})
		}
	});
}

describe('snapshot', () => {
	it('parseGridSet על דף בגודל orgHome — 6×4, 21 תאים, 20 מלאים', async () => {
		const set = await parseGridSet(orgHomeGridset());
		const page = set.pages['דף ראשי'];
		expect([page.columns, page.rows, page.cells.length]).toEqual([6, 4, 21]);
		expect(page.cells.filter((c) => c.caption !== undefined)).toHaveLength(20);
		expect(set).toMatchSnapshot();
	});
});

// ── קובץ .gridset אמיתי ──────────────────────────────────────────────────

/**
 * 🛑 תוכן Smartbox מורשה — הקובץ **אינו** בריפו (`*.gridset` ב-.gitignore),
 * ולכן הבדיקה מדלגת בעדינות כשהוא חסר, כמו ב-CI.
 *
 * להפעלה מקומית: ‏`cp <משהו>.gridset src/lib/gridset/__local__/real.gridset`
 * (ראו `__local__/README.md`).
 *
 * 🔑 ‏`import.meta.glob` ולא `fetch`: בלי התאמה זה `{}` בזמן-טרנספורם, ואין
 * בקשת-רשת תלויה. ‏`fetch` על נתיב שאינו קיים תחת `/src` השאיר חיבור פתוח
 * ועיכב את סגירת vitest ב-10 שניות.
 */
const LOCAL_GRIDSETS = import.meta.glob('./__local__/*.gridset', {
	query: '?url',
	import: 'default',
	eager: true
}) as Record<string, string>;

describe('קובץ .gridset אמיתי', () => {
	// timeout נדיב: הלוח המובנה הגדול (b098, 6.6MB) נפרס ב-~3.8 שניות בכרומיום
	it('נפרס בשלמותו, וכל השדות המספריים תקינים', { timeout: 30_000 }, async (ctx) => {
		const url = Object.values(LOCAL_GRIDSETS)[0];
		if (!url) {
			ctx.skip('אין קובץ ב-src/lib/gridset/__local__/*.gridset — ראו __local__/README.md');
			return;
		}

		const set = await parseGridSet(await (await fetch(url)).arrayBuffer());
		const pages = Object.values(set.pages);
		expect(pages.length).toBeGreaterThan(0);

		// 🔑 יעד Jump.To הוא **מפתח** ב-pages, ולכן זה גם מאמת את פענוח שמות
		// התיקיות בעברית מתוך ה-ZIP: שם שנקרא שגוי היה מפיל את ההתאמה.
		expect(set.startGrid in set.pages).toBe(true);

		// 🛑 הפרות נאספות ונבדקות **פעם אחת**. expect לכל תא הוא מאות אלפי
		// קריאות על לוח גדול (b098: 6.6MB) וחורג מ-timeout הבדיקה.
		const problems: string[] = [];
		let cells = 0;
		for (const page of pages) {
			if (page.columnWidths.length !== page.columns) problems.push(`${page.name}: columnWidths`);
			if (page.rowHeights.length !== page.rows) problems.push(`${page.name}: rowHeights`);
			for (const cell of page.cells) {
				cells++;
				const numbers = [cell.x, cell.y, cell.columnSpan, cell.rowSpan, cell.style.fontSize];
				if (!numbers.every(Number.isFinite)) {
					problems.push(`${page.name} (${cell.x},${cell.y}): ${numbers.join()}`);
				}
				for (const inv of cell.commands) {
					if (inv.id === '') problems.push(`${page.name} (${cell.x},${cell.y}): פקודה בלי ID`);
					for (const [key, value] of Object.entries(inv.params)) {
						if (value === undefined) problems.push(`${page.name}: ${inv.id}.${key} undefined`);
					}
				}
			}
		}
		expect(problems.slice(0, 5)).toEqual([]);
		expect(cells).toBeGreaterThan(0);
	});
});
