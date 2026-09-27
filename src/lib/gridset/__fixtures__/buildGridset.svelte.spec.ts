import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildGridset } from './buildGridset';
import { fixtures } from './fixtures';

function parseXml(xml: string): Document {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const error = doc.querySelector('parsererror');
	if (error) throw new Error(`parsererror: ${error.textContent}`);
	return doc;
}

describe('buildGridset', () => {
	for (const [name, spec] of Object.entries(fixtures)) {
		it(`${name} — ZIP תקין עם שלושת סוגי הקבצים, ו-XML תקין בכולם`, () => {
			const zip = buildGridset(spec);
			const files = unzipSync(zip);
			const paths = Object.keys(files);

			expect(paths).toContain('Settings0/settings.xml');
			expect(paths).toContain('Settings0/Styles/styles.xml');
			const gridPaths = paths.filter((p) => /^Grids\/.+\/grid\.xml$/.test(p));
			expect(gridPaths.length).toBeGreaterThan(0);

			for (const path of ['Settings0/settings.xml', 'Settings0/Styles/styles.xml', ...gridPaths]) {
				const xml = strFromU8(files[path]);
				const doc = parseXml(xml);
				expect(doc.documentElement).toBeTruthy();
			}
		});
	}

	it('minimal — הדף נושא Jump.To ו-Action.InsertText', () => {
		const files = unzipSync(buildGridset(fixtures.minimal));
		const doc = parseXml(strFromU8(files['Grids/בית/grid.xml']));
		const ids = [...doc.querySelectorAll('Cells > Cell Command')].map((c) => c.getAttribute('ID'));
		expect(ids).toEqual(['Jump.To', 'Action.InsertText']);
	});

	it('sparseCoords — תאים בלי X ו/או Y לא נכתבים כמאפיין', () => {
		const files = unzipSync(buildGridset(fixtures.sparseCoords));
		const doc = parseXml(strFromU8(files['Grids/sparse/grid.xml']));
		const cells = [...doc.querySelectorAll('Cells > Cell')];
		expect(cells[0].hasAttribute('X')).toBe(false);
		expect(cells[1].hasAttribute('Y')).toBe(false);
		expect(cells[2].hasAttribute('X')).toBe(false);
		expect(cells[2].hasAttribute('Y')).toBe(false);
	});

	it('nilCaption — <CaptionAndImage xsi:nil="true" /> בלי Caption/Image', () => {
		const files = unzipSync(buildGridset(fixtures.nilCaption));
		const doc = parseXml(strFromU8(files['Grids/nil/grid.xml']));
		const nilCell = doc.querySelectorAll('Cells > Cell')[0];
		const captionAndImage = nilCell.querySelector('CaptionAndImage');
		expect(
			captionAndImage?.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil')
		).toBe('true');
		expect(captionAndImage?.children.length).toBe(0);
	});

	it('richTextShapes — ארבע הצורות (כולל d/p/s/r) תחת Parameter ישיר', () => {
		const files = unzipSync(buildGridset(fixtures.richTextShapes));
		const doc = parseXml(strFromU8(files['Grids/richText/grid.xml']));
		const params = [...doc.querySelectorAll('Parameter[Key="text"]')];
		expect(params).toHaveLength(4);
		expect(params[0].querySelector('p > s > r')?.textContent).toBe('שלום');
		expect(params[1].querySelector(':scope > s > r')?.textContent).toBe('עולם');
		expect(params[1].querySelector('p')).toBeNull();
		expect(params[2].querySelector('r')?.textContent).toBe('!');
		expect(params[2].querySelector('s')).toBeNull();
		expect(params[3].querySelector('d > p > s > r')?.textContent).toBe('מוגן');
	});

	it('richTextShapes — ארבע הצורות תחת WordListItem/Text (הנשא השני)', () => {
		const files = unzipSync(buildGridset(fixtures.richTextShapes));
		const doc = parseXml(strFromU8(files['Grids/richText/grid.xml']));
		const items = [...doc.querySelectorAll('WordList > Items > WordListItem')];
		expect(items).toHaveLength(4);
		expect(items[0].querySelector('Text > p > s > r')?.textContent).toBe('טוב');
		expect(items[1].querySelector('Text > s > r')?.textContent).toBe('רע');
		expect(items[1].querySelector('Text > p')).toBeNull();
		expect(items[2].querySelector('Text > r')?.textContent).toBe('אולי');
		expect(items[3].querySelector('Text > d > p > s > r')?.textContent).toBe('בטח');
	});

	it('styleTwoLevel — הסגנון הנקוב שטוח, בלי BasedOnStyle משלו', () => {
		const files = unzipSync(buildGridset(fixtures.styleTwoLevel));
		const stylesDoc = parseXml(strFromU8(files['Settings0/Styles/styles.xml']));
		const namedStyle = [...stylesDoc.querySelectorAll('Style')].find(
			(s) => s.getAttribute('Key') === 'Action cell 1'
		);
		expect(namedStyle?.querySelector('BasedOnStyle')).toBeNull();

		const gridDoc = parseXml(strFromU8(files['Grids/style/grid.xml']));
		const cellStyle = gridDoc.querySelector('Cell > Content > Style');
		expect(cellStyle?.querySelector('BasedOnStyle')?.textContent).toBe('Action cell 1');
		expect(cellStyle?.querySelector('BackColour')?.textContent).toBe('#FF0000FF');
	});

	it('orgHome — 6×4, 21 תאים מוגדרים ו-20 מלאים', () => {
		const files = unzipSync(buildGridset(fixtures.orgHome));
		const doc = parseXml(strFromU8(files['Grids/דף ראשי/grid.xml']));
		const cells = [...doc.querySelectorAll('Cells > Cell')];
		expect(cells).toHaveLength(21);
		const filled = cells.filter((c) => (c.querySelector('Content')?.children.length ?? 0) > 0);
		expect(filled).toHaveLength(20);
	});

	it('guardLast — Settings.RequiredFeature נמצא אחרון בשרשרת (126/126 בפועל)', () => {
		const files = unzipSync(buildGridset(fixtures.guardLast));
		const doc = parseXml(strFromU8(files['Grids/guardLast/grid.xml']));
		const ids = [...doc.querySelectorAll('Cell Command')].map((c) => c.getAttribute('ID'));
		expect(ids.at(-1)).toBe('Settings.RequiredFeature');
		expect(doc.querySelector('Parameter[Key="feature"]')?.textContent).toBe('EyeGazeAccess');
	});

	it('guardAfterRest — אחרי Settings.RestAll (התבנית הנפוצה ביותר, 56/126)', () => {
		const files = unzipSync(buildGridset(fixtures.guardAfterRest));
		const doc = parseXml(strFromU8(files['Grids/guardAfterRest/grid.xml']));
		const ids = [...doc.querySelectorAll('Cell Command')].map((c) => c.getAttribute('ID'));
		expect(ids).toEqual(['Settings.RestAll', 'Settings.RequiredFeature']);
		expect(doc.querySelector('Parameter[Key="feature"]')?.textContent).toBe('TouchAccess');
	});

	it('guardNoParam — בלי <Parameter> כלל (56/126, 44%)', () => {
		const files = unzipSync(buildGridset(fixtures.guardNoParam));
		const doc = parseXml(strFromU8(files['Grids/guardNoParam/grid.xml']));
		const command = doc.querySelector('Cell Command');
		expect(command?.getAttribute('ID')).toBe('Settings.RequiredFeature');
		expect(command?.querySelector('Parameter')).toBeNull();
		expect(command?.children.length).toBe(0);
	});
});
