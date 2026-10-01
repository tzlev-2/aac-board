import { describe, expect, it } from 'vitest';
import {
	escapeXmlText,
	findCellRange,
	setCellCaption,
	setCellStyleColour,
	type CellColourField
} from './xmlEdit';

const wrap = (content: string) =>
	`<Grid><Cells><Cell Y="4"><Content>${content}</Content></Cell><Cell X="1" Y="4"><Content><Style><BasedOnStyle>Default</BasedOnStyle></Style></Content></Cell></Cells></Grid>`;
const style = '<Style><BasedOnStyle>Default</BasedOnStyle></Style>';

describe('עריכת XML כירורגית', () => {
	it('מיקום חסר=0, טווח מדויק, שגיאה בעברית והימלטות טקסט בלבד', () => {
		const xml = wrap(style);
		const range = findCellRange(xml, 0, 4)!;
		expect(xml.slice(range.start, range.end)).toBe(
			`<Cell Y="4"><Content>${style}</Content></Cell>`
		);
		expect(findCellRange(xml, 99, 99)).toBeUndefined();
		expect(() => setCellCaption(xml, 99, 99, 'x')).toThrow(/התא/);
		expect(() => setCellStyleColour(xml, 99, 99, 'TileColour', '#11223344')).toThrow(/התא/);
		expect(escapeXmlText('&<>"\'')).toBe('&amp;&lt;&gt;"\'');
	});
	it.each([
		[
			'<CaptionAndImage><Caption>old</Caption><AudioDescription>keep</AudioDescription><Image>keep</Image><Tooltip>keep</Tooltip></CaptionAndImage>',
			'<CaptionAndImage><Caption>new &amp;&lt;&gt;</Caption><AudioDescription>keep</AudioDescription><Image>keep</Image><Tooltip>keep</Tooltip></CaptionAndImage>'
		],
		[
			'<CaptionAndImage><Image>keep</Image><Tooltip>keep</Tooltip></CaptionAndImage>',
			'<CaptionAndImage><Caption>new &amp;&lt;&gt;</Caption><Image>keep</Image><Tooltip>keep</Tooltip></CaptionAndImage>'
		],
		[
			'<CaptionAndImage xsi:nil="true" />',
			'<CaptionAndImage><Caption>new &amp;&lt;&gt;</Caption></CaptionAndImage>'
		],
		['', '<CaptionAndImage><Caption>new &amp;&lt;&gt;</Caption></CaptionAndImage>']
	])('כל צורות Caption: %s', (before, after) => {
		expect(setCellCaption(wrap(before + style), 0, 4, 'new &<>')).toBe(wrap(after + style));
	});
	it('שומר BOM, סופי שורה מעורבים, רווחים, תג ריק ואלמנטים לא מוכרים', () => {
		const before =
			'\uFEFF<Grid>\r\n <Cells>\n  <Cell Y="4"><Content>\r\n    <Unknown a="1" />\n    <CaptionAndImage>\r\n      <Image>keep</Image>\r\n    </CaptionAndImage>\n    <Style>\r\n      <BasedOnStyle>Default</BasedOnStyle>\r\n      <FontName>Keep</FontName>\r\n    </Style>\n  </Content></Cell>\n </Cells>\r\n</Grid>';
		expect(setCellCaption(before, 0, 4, ' ')).toBe(
			before.replace('<Image>', '<Caption> </Caption>\r\n      <Image>')
		);
		expect(setCellStyleColour(before, 0, 4, 'TileColour', '#12345678')).toBe(
			before.replace('<FontName>', '<TileColour>#12345678</TileColour>\r\n      <FontName>')
		);
	});
	it('ארבעת הצבעים בסדר המדוד; החלפה לא מוסיפה אלמנט', () => {
		let xml = wrap(style);
		for (const f of ['FontColour', 'BorderColour', 'TileColour', 'BackColour'] as CellColourField[])
			xml = setCellStyleColour(xml, 0, 4, f, '#11223344');
		const firstStyle = /<Style>(.*?)<\/Style>/.exec(xml)![1];
		expect([...firstStyle.matchAll(/<([A-Za-z]+)>/g)].map((m) => m[1])).toEqual([
			'BasedOnStyle',
			'BackColour',
			'TileColour',
			'BorderColour',
			'FontColour'
		]);
		for (const f of [
			'BackColour',
			'TileColour',
			'BorderColour',
			'FontColour'
		] as CellColourField[]) {
			const changed = setCellStyleColour(xml, 0, 4, f, '#AABBCCDD');
			expect(changed.match(new RegExp(`<${f}>`, 'g'))).toHaveLength(1);
			expect(changed).toBe(xml.replace(`<${f}>#11223344</${f}>`, `<${f}>#AABBCCDD</${f}>`));
		}
	});
	it('יצירת כתובית נגזרת מהזחת Style וסוף השורה המקומי', () => {
		const xml = wrap(
			'\r\n    <CaptionAndImage xsi:nil="true" />\r\n    <Style>\r\n      <BasedOnStyle>Default</BasedOnStyle>\r\n    </Style>'
		);
		expect(setCellCaption(xml, 0, 4, 'new')).toBe(
			xml.replace(
				'<CaptionAndImage xsi:nil="true" />',
				'<CaptionAndImage>\r\n      <Caption>new</Caption>\r\n    </CaptionAndImage>'
			)
		);
		const absent = xml.replace('    <CaptionAndImage xsi:nil="true" />\r\n', '');
		expect(setCellCaption(absent, 0, 4, 'new')).toBe(
			xml.replace(
				'<CaptionAndImage xsi:nil="true" />',
				'<CaptionAndImage>\r\n      <Caption>new</Caption>\r\n    </CaptionAndImage>'
			)
		);
	});
	it('לא מזהה תגיות בתוך הערה או CDATA כתא אמיתי', () => {
		const xml = wrap(
			'<!-- <Caption>fake</Caption> --><![CDATA[<Cell X="99">]]><CaptionAndImage><Caption>real</Caption></CaptionAndImage>' +
				style
		);
		expect(setCellCaption(xml, 0, 4, '')).toBe(
			xml.replace('<Caption>real</Caption>', '<Caption></Caption>')
		);
	});
});
