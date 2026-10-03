import { expect, it } from 'vitest';
import { applyCellEditXml } from '$lib/gridset/xmlEdit';

it('preserves nil and target shell for a colour-only edit, and converts nil for intentional caption text', () => {
	const xml =
		'<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Cells>' +
		'<Cell X="0" Y="0"><Visibility>Hidden</Visibility><Content><CaptionAndImage xsi:nil="true" /><Style><BasedOnStyle>base</BasedOnStyle></Style></Content></Cell>' +
		'<Cell X="1" Y="0" ColumnSpan="2"><Visibility>Disabled</Visibility><Content><CaptionAndImage><Caption>full</Caption></CaptionAndImage></Content></Cell>' +
		'</Cells><Unknown flag="keep"/></Grid>';
	const colourOnly = { page: 'P', x: 0, y: 0, colours: { BackColour: '#11223344' } };
	const result = applyCellEditXml(xml, 0, 0, colourOnly);
	expect(result).toContain('xsi:nil="true"');
	expect(result).toContain('<BackColour>#11223344</BackColour>');
	expect(result).toContain('<BasedOnStyle>base</BasedOnStyle>');
	expect(result).toContain('ColumnSpan="2"');
	expect(result).toContain('<Visibility>Disabled</Visibility>');
	expect(result).toContain('<Unknown flag="keep"/>');
	const converted = applyCellEditXml(xml, 0, 0, { ...colourOnly, caption: 'converted' });
	expect(converted).not.toContain('xsi:nil="true"');
	expect(converted).toContain('<Caption>converted</Caption>');
});
