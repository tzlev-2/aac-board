import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { buildGridset } from './buildGridset';
import type { FixtureCell, FixtureCommand } from './spec';

// Original C6 test content: no licensed board, symbols, media or personal data.
export function buildPopupBackFixture(startGrid = 'P'): Uint8Array {
	const jump = (grid: string): FixtureCommand => ({ id: 'Jump.To', params: { grid } });
	const button = (x: number, caption: string, commands: FixtureCommand[]): FixtureCell => ({
		x,
		y: 1,
		caption,
		commands,
		basedOnStyle: 'base'
	});
	const delayed = [
		{ id: 'Action.InsertText', params: { text: 'המתנה' } },
		{ id: 'CommandExecution.Wait', params: { waittime: '00:00:02' } },
		jump('P')
	];
	const controls: Record<string, FixtureCell[]> = {
		P: [
			button(0, 'פתח קופץ Q', [jump('Q')]),
			button(1, 'פתח רגיל R', [jump('R')]),
			button(2, 'אותו דף', [jump('P')])
		],
		Q: [
			button(0, 'מילה בקופץ', [{ id: 'Action.InsertText', params: { text: 'שלום' } }]),
			button(1, 'פתח רגיל R', [jump('R')]),
			button(2, 'המתן ואז P', delayed)
		],
		R: [
			button(0, 'חזרה בתא', [{ id: 'Jump.Back' }]),
			button(1, 'פתח קופץ Q', [jump('Q')]),
			button(2, 'המתן ואז P', delayed)
		]
	};
	const raw = unzipSync(
		buildGridset({
			startGrid,
			language: 'he',
			styles: [{ key: 'base', fontSize: 20, backColour: '#FFFFFFFF', fontColour: '#000000FF' }],
			pages: Object.entries(controls).map(([name, cells]) => ({
				name,
				columns: 3,
				rows: 4,
				cells: [
					{ x: 0, y: 0, columnSpan: 3, contentType: 'Workspace', contentSubType: 'Chat' },
					...cells,
					...Array.from({ length: 3 }, (_, x) => ({
						x,
						y: 2,
						contentType: 'AutoContent',
						contentSubType: 'WordList',
						basedOnStyle: 'base'
					})),
					{ x: 0, y: 3, caption: 'בית', commands: [{ id: 'Jump.Home' }], basedOnStyle: 'base' },
					{ x: 1, y: 3, caption: 'יעד חסר', commands: [jump('MISSING')], basedOnStyle: 'base' },
					{ x: 2, y: 3, caption: 'דבר', commands: [{ id: 'Action.Speak' }], basedOnStyle: 'base' }
				],
				wordList: Array.from({ length: 8 }, (_, i) => ({ text: `${name}-מילה-${i}` })),
				autoContentCommands: { WordList: [{ id: 'AutoContent.Activate' }] }
			}))
		})
	);
	// The general builder has no SelfClosing field; patch only this synthetic XML.
	raw['Grids/Q/grid.xml'] = strToU8(
		strFromU8(raw['Grids/Q/grid.xml']).replace('</Grid>', '<SelfClosing>1</SelfClosing></Grid>')
	);
	raw['C6-provenance.txt'] = strToU8(
		'Original synthetic C6 fixture. P/Q/R, no licensed assets. Q SelfClosing=1, no Jump.Back cell.'
	);
	return zipSync(
		Object.fromEntries(
			Object.entries(raw).map(([name, bytes]) => [
				name,
				[bytes, { mtime: new Date('2020-01-01T00:00:00Z') }]
			])
		)
	);
}
