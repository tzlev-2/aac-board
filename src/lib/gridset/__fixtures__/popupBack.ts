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

/** Original C6 repair variant: add observable suffix effects and owned silent WAV. */
export function buildPopupBackWaitFixture(cancellable?: string, startGrid = 'P'): Uint8Array {
	const files = unzipSync(buildPopupBackFixture(startGrid));
	const text = (value: string) =>
		`<Command ID="Action.InsertText"><Parameter Key="text">${value}</Parameter></Command>`;
	const speak = '<Command ID="Action.Speak" />';
	const sound =
		'<Command ID="SpeechPlaySound"><Parameter Key="filedata"><data>.wav</data></Parameter></Command>';
	const flag =
		cancellable === undefined ? '' : `<Parameter Key="cancellable">${cancellable}</Parameter>`;
	const commands = [
		text('המתנה'),
		speak,
		sound,
		`<Command ID="CommandExecution.Wait"><Parameter Key="waittime">00:00:02</Parameter>${flag}</Command>`,
		text('מאוחר-לפני'),
		speak,
		sound,
		'<Command ID="Jump.To"><Parameter Key="grid">P</Parameter></Command>',
		text('מאוחר-אחרי'),
		speak,
		sound
	];
	// A valid, original silent mono PCM WAV, not a licensed recording.
	const wav = new Uint8Array(46);
	const data = new DataView(wav.buffer);
	wav.set(strToU8('RIFF'), 0);
	data.setUint32(4, 38, true);
	wav.set(strToU8('WAVEfmt '), 8);
	data.setUint32(16, 16, true);
	data.setUint16(20, 1, true);
	data.setUint16(22, 1, true);
	data.setUint32(24, 8000, true);
	data.setUint32(28, 16000, true);
	data.setUint16(32, 2, true);
	data.setUint16(34, 16, true);
	wav.set(strToU8('data'), 36);
	data.setUint32(40, 2, true);
	for (const name of ['Q', 'R']) {
		const path = `Grids/${name}/grid.xml`;
		files[path] = strToU8(
			strFromU8(files[path]).replace(
				/(<Cell X="2" Y="1">[\s\S]*?<Commands>)[\s\S]*?(<\/Commands>)/,
				`$1${commands.join('')}$2`
			)
		);
		for (const index of [2, 6, 10]) files[`Grids/${name}/2-1-${index}-filedata.wav`] = wav;
	}
	files['C6-delay-provenance.txt'] = strToU8(
		'Original repair variant: owned silent WAV, prefix and complete suffix sentinels; no licensed assets.'
	);
	return zipSync(
		Object.fromEntries(
			Object.entries(files).map(([name, bytes]) => [
				name,
				[bytes, { mtime: new Date('2020-01-01T00:00:00Z') }]
			])
		)
	);
}
