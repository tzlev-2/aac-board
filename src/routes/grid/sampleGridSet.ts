/**
 * דוגמה מוטבעת ל-/grid — לא fixture-בדיקה (ראו __fixtures__/sample-gridset.json
 * ל-E2E) ולא פרסור אמיתי של .gridset (slice/gridset-parser, מחוץ להיקף כאן).
 * מדגימה: פס-פלט כתא Workspace/Chat, span, RTL (X=0 ימני), Hidden, Disabled,
 * וסוג-תוכן לא-נתמך שנופל ל-UnsupportedCell.
 */
import type { Cell, GridSet, Page, ResolvedStyle } from '$lib/gridset/types';

const style: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#CCCCCCFF',
	fontName: 'Arial',
	fontSize: 22,
	backgroundShape: 1
};

const cells: Cell[] = [
	{
		x: 0,
		y: 0,
		columnSpan: 4,
		rowSpan: 1,
		commands: [],
		style: { ...style, backColour: '#E8F0FEFF' },
		contentType: 'Workspace',
		contentSubType: 'Chat'
	},
	{
		x: 0,
		y: 1,
		columnSpan: 1,
		rowSpan: 1,
		caption: 'שלום',
		commands: [{ id: 'Action.InsertText', params: { text: 'שלום' } }],
		style
	},
	{
		x: 1,
		y: 1,
		columnSpan: 1,
		rowSpan: 1,
		caption: 'תפוח',
		commands: [{ id: 'Action.InsertText', params: { text: 'תפוח' } }],
		style
	},
	{
		x: 2,
		y: 1,
		columnSpan: 2,
		rowSpan: 1,
		caption: 'עוד דוגמה (span)',
		commands: [{ id: 'Action.InsertText', params: { text: 'עוד דוגמה' } }],
		style
	},
	{
		x: 0,
		y: 2,
		columnSpan: 1,
		rowSpan: 1,
		caption: 'מוסתר',
		visibility: 'Hidden',
		commands: [],
		style
	},
	{
		x: 1,
		y: 2,
		columnSpan: 1,
		rowSpan: 1,
		caption: 'מושבת',
		visibility: 'Disabled',
		commands: [{ id: 'Settings.RequiredFeature', params: { feature: 'ComputerControl' } }],
		style
	},
	{
		x: 2,
		y: 2,
		columnSpan: 2,
		rowSpan: 1,
		caption: 'רשימת מילים',
		contentType: 'AutoContent',
		contentSubType: 'WordList',
		commands: [],
		style
	}
];

const page: Page = {
	name: 'ראשי',
	columns: 4,
	rows: 3,
	columnWidths: [null, null, null, null],
	rowHeights: [null, null, null],
	cells,
	wordList: [],
	predictionSource: 'None',
	autoContentCommands: {},
	background: {}
};

export const SAMPLE_GRID_SET: GridSet = {
	startGrid: page.name,
	language: 'he-IL',
	symbolSearchKeys: [],
	pages: { [page.name]: page },
	styles: {}
};
