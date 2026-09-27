/**
 * Fixtures בעלי-שם — כל אחד מכוון למלכודת ידועה בסכימת `.gridset` האמפירית
 * (gridset-schema.tsv). ראו __fixtures__/README.md לטבלת fixture ↔ מלכודת.
 */

import type { FixtureCell, GridsetSpec } from './spec';

export const minimal: GridsetSpec = {
	pages: [
		{
			name: 'בית',
			columns: 2,
			rows: 2,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'בית',
					commands: [{ id: 'Jump.To', params: { grid: 'בית' } }]
				},
				{
					x: 1,
					y: 0,
					caption: 'שלום',
					commands: [{ id: 'Action.InsertText', params: { text: 'שלום' } }]
				}
			]
		}
	]
};

// מידות אמיתיות של "דף ראשי" מ-pages.tsv (org-1): 6×4, 21 תאים מוגדרים,
// 20 מלאים — תא אחד מוגדר (מיקום ברשת) בלי תוכן.
function buildOrgHomeCells(): FixtureCell[] {
	const coreCommands = [
		'Action.InsertText',
		'Jump.To',
		'Jump.Back',
		'Jump.Home',
		'Action.Clear',
		'Action.Speak',
		'Action.DeleteWord',
		'Settings.RequiredFeature',
		'Action.Letter'
	];
	const positions: Array<{ x: number; y: number }> = [];
	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 6; x++) {
			positions.push({ x, y });
		}
	}
	// 24 מיקומים ברשת; 21 מוגדרים (שלושה נשארים ריקים לגמרי — בלי <Cell>).
	const defined = positions.slice(0, 21);

	return defined.map(({ x, y }, i) => {
		// תא אחד מוגדר בלי תוכן (cells_defined=21, cells_filled=20).
		if (i === 20) return { x, y };

		const commandId = coreCommands[i % coreCommands.length];
		const cell: FixtureCell = {
			x,
			y,
			caption: `תא ${i + 1}`,
			commands:
				commandId === 'Jump.To'
					? [{ id: commandId, params: { grid: 'דף ראשי' } }]
					: commandId === 'Action.InsertText'
						? [{ id: commandId, params: { text: `תא ${i + 1}` } }]
						: [{ id: commandId }]
		};
		return cell;
	});
}

export const orgHome: GridsetSpec = {
	pages: [
		{
			name: 'דף ראשי',
			columns: 6,
			rows: 4,
			cells: buildOrgHomeCells()
		}
	]
};

export const spans: GridsetSpec = {
	pages: [
		{
			name: 'spans',
			columns: 6,
			rows: 6,
			cells: [
				{ x: 0, y: 0, columnSpan: 4, rowSpan: 3, caption: 'תא גדול' },
				{ x: 4, y: 0, caption: 'רגיל 1' },
				{ x: 5, y: 0, caption: 'רגיל 2' },
				{ x: 4, y: 1, caption: 'רגיל 3' },
				{ x: 5, y: 1, caption: 'רגיל 4' },
				{ x: 0, y: 3, caption: 'רגיל 5' },
				{ x: 1, y: 3, caption: 'רגיל 6' }
			]
		}
	]
};

export const sparseCoords: GridsetSpec = {
	pages: [
		{
			name: 'sparse',
			columns: 2,
			rows: 2,
			cells: [
				// בלי X — ברירת מחדל 0.
				{ y: 0, caption: 'בלי X' },
				// בלי Y — ברירת מחדל 0.
				{ x: 1, caption: 'בלי Y' },
				// בלי X וגם בלי Y.
				{ caption: 'בלי שניהם' }
			]
		}
	]
};

// 🛑 טקסט עשיר חי בשני נשאים, וההתפלגות ביניהם הפוכה (design §4): כאן —
// ארבע הצורות תחת Parameter ישיר (בלי עטיפת <Text>), וגם תחת WordListItem/Text
// (עם העטיפה). `d/p/s/r` הוא עטיפת <d> שקופה — קיימת בשני הנשאים.
export const richTextShapes: GridsetSpec = {
	pages: [
		{
			name: 'richText',
			columns: 4,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'p/s/r',
					commands: [
						{
							id: 'Action.InsertText',
							params: { text: { shape: 'p/s/r', sentences: [{ runs: ['שלום'] }] } }
						}
					]
				},
				{
					x: 1,
					y: 0,
					caption: 's/r',
					commands: [
						{
							id: 'Action.InsertText',
							params: { text: { shape: 's/r', sentences: [{ runs: ['עולם'] }] } }
						}
					]
				},
				{
					x: 2,
					y: 0,
					caption: 'r',
					commands: [
						{
							id: 'Action.InsertText',
							params: { text: { shape: 'r', runs: ['!'] } }
						}
					]
				},
				{
					x: 3,
					y: 0,
					caption: 'd/p/s/r',
					commands: [
						{
							id: 'Action.InsertText',
							params: { text: { shape: 'd/p/s/r', sentences: [{ runs: ['מוגן'] }] } }
						}
					]
				}
			],
			wordList: [
				{ text: { shape: 'p/s/r', sentences: [{ runs: ['טוב'] }] }, partOfSpeech: 'Noun' },
				{ text: { shape: 's/r', sentences: [{ runs: ['רע'] }] }, partOfSpeech: 'Noun' },
				{ text: { shape: 'r', runs: ['אולי'] } },
				{ text: { shape: 'd/p/s/r', sentences: [{ runs: ['בטח'] }] } }
			]
		}
	]
};

// 🛑 אין שרשרת BasedOnStyle בין סגנונות — ראו gridset-core-design.md §5.
// סגנון נקוב הוא רשומה שטוחה תחת StyleData/Styles/Style; התא מפנה אליה
// בשם (BasedOnStyle) ומוסיף עקיפות מקומיות משלו.
export const styleTwoLevel: GridsetSpec = {
	styles: [
		{ key: 'Default', backColour: '#FFFFFFFF', fontColour: '#000000FF' },
		{
			key: 'Action cell 1',
			name: 'Action cell 1',
			backColour: '#0078D4FF',
			fontColour: '#FFFFFFFF',
			borderColour: '#00000000',
			fontName: 'Arial',
			fontSize: 14,
			backgroundShape: 1,
			tileColour: '#0078D4FF'
		}
	],
	pages: [
		{
			name: 'style',
			columns: 1,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'עקיפה מקומית',
					basedOnStyle: 'Action cell 1',
					// עקיפה מקומית: הרקע שונה מזה של הסגנון הנקוב.
					styleOverrides: { backColour: '#FF0000FF' }
				}
			]
		}
	]
};

export const contentTypes: GridsetSpec = {
	pages: [
		{
			name: 'content',
			columns: 4,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'פס פלט',
					contentType: 'Workspace',
					contentSubType: 'Chat'
				},
				{
					x: 1,
					y: 0,
					caption: 'רשימת מילים',
					contentType: 'AutoContent',
					contentSubType: 'WordList'
				},
				{
					x: 2,
					y: 0,
					caption: 'תא חי',
					contentType: 'LiveCell'
				},
				{
					x: 3,
					y: 0,
					caption: 'משחק',
					contentType: 'AutoContent',
					contentSubType: 'Animation',
					contentSubSubType: '4inarow'
				}
			]
		}
	]
};

// 🛑 Settings.RequiredFeature: 126/126 בלוחות-הדגימה היא **אחרונה** בשרשרת —
// היא הצהרת-דרישה של התא (שער-רינדור), לא שומר-הרצה שעוצר לפניה (design §1).
// שלושה fixtures, לא אחד — כל אחד תבנית אמיתית שנמדדה, לא דמיון:

/** 126/126 — הצורה האמיתית: השומר תמיד אחרון. */
export const guardLast: GridsetSpec = {
	pages: [
		{
			name: 'guardLast',
			columns: 1,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'מבט',
					commands: [
						{ id: 'Action.InsertText', params: { text: 'מבט' } },
						{ id: 'Settings.RequiredFeature', params: { feature: 'EyeGazeAccess' } }
					]
				}
			]
		}
	]
};

/** 56 מ-126 — התבנית הנפוצה ביותר: אחרי Settings.RestAll. */
export const guardAfterRest: GridsetSpec = {
	pages: [
		{
			name: 'guardAfterRest',
			columns: 1,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'מגע',
					commands: [
						{ id: 'Settings.RestAll' },
						{ id: 'Settings.RequiredFeature', params: { feature: 'TouchAccess' } }
					]
				}
			]
		}
	]
};

/** 56 מ-126 (44%) — בלי <Parameter> כלל. הוכרע במפורש (design §1): "אין
 * דרישה" (התא זמין) + reportUnimplemented, לא false ולא זריקה. */
export const guardNoParam: GridsetSpec = {
	pages: [
		{
			name: 'guardNoParam',
			columns: 1,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'בלי דרישה',
					commands: [{ id: 'Settings.RequiredFeature' }]
				}
			]
		}
	]
};

export const visibility: GridsetSpec = {
	pages: [
		{
			name: 'visibility',
			columns: 3,
			rows: 1,
			cells: [
				{ x: 0, y: 0, caption: 'מוסתר', visibility: 'Hidden' },
				{ x: 1, y: 0, caption: 'מנוטרל', visibility: 'Disabled' },
				{ x: 2, y: 0, caption: 'מגע בלבד', visibility: 'PointerAndTouchOnly' }
			]
		}
	]
};

export const nilCaption: GridsetSpec = {
	pages: [
		{
			name: 'nil',
			columns: 2,
			rows: 1,
			cells: [
				{ x: 0, y: 0, caption: null },
				{ x: 1, y: 0, caption: 'כיתוב רגיל' }
			]
		}
	]
};

export const pageEngines: GridsetSpec = {
	pages: [
		{
			name: 'engines',
			columns: 2,
			rows: 2,
			cells: [{ x: 0, y: 0, caption: 'תא' }],
			wordList: [
				{ text: 'כלב', partOfSpeech: 'Noun' },
				{ text: 'רץ', partOfSpeech: 'Verb' }
			],
			predictionSource: 'WordListAndPredictor'
		}
	]
};

export const autoContent: GridsetSpec = {
	pages: [
		{
			name: 'autoContent',
			columns: 1,
			rows: 1,
			cells: [
				{
					x: 0,
					y: 0,
					caption: 'שיחה',
					contentType: 'AutoContent',
					contentSubType: 'Chat.History'
				}
			],
			autoContentCommands: {
				'Chat.History': [{ id: 'Action.Speak' }, { id: 'Jump.Back' }]
			}
		}
	]
};

export const fixtures = {
	minimal,
	orgHome,
	spans,
	sparseCoords,
	richTextShapes,
	styleTwoLevel,
	contentTypes,
	guardLast,
	guardAfterRest,
	guardNoParam,
	visibility,
	nilCaption,
	pageEngines,
	autoContent
} satisfies Record<string, GridsetSpec>;

export type FixtureName = keyof typeof fixtures;
