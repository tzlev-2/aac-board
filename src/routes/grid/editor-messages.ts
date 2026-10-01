import type { CellColourField } from '$lib/gridset/xmlEdit';
export const messages = {
	load: 'טעינת לוח — גררו קובץ .gridset לכאן, או בחרו:',
	samples: [
		'טען לוח לדוגמה — ‏96 דפים',
		'לוח גדול יותר — ‏132 דפים',
		'לוח עם סמלי PCS — ‏34 דפים',
		'לוח b037 — מקלדת פשוטה (TileColour)'
	],
	save: 'שמור עותק',
	saving: 'מכין עותק…',
	loading: 'טוען את הלוח…',
	pages: 'דפים',
	edit: 'עריכה',
	use: 'שימוש',
	page: 'דף',
	sourceMissing: 'כדי לערוך ולשמור יש לטעון קובץ .gridset מקורי.',
	select: 'בחרו תא ברשת לעריכה',
	caption: 'כתובית',
	apply: 'החל',
	cancel: 'בטל שינוי זה',
	stay: 'הישאר',
	draftDecision: 'יש שינוי בתא הנבחר. כיצד להמשיך?',
	loadDecision: 'יש שינויים שלא הורדו. לטעון לוח אחר?',
	discardLoad: 'טען והשלך שינויים',
	dirty: 'יש שינויים',
	clean: 'ללא שינויים',
	downloaded: 'הוכן עותק להורדה:',
	dynamicCaption: 'הכיתוב בתא זה נגזר מתוכן דינמי. אפשר לערוך צבעים בלבד.',
	rgb: 'RGB',
	alpha: 'אטימות 0–255',
	transparent: 'שקוף',
	cell: 'תא',
	invalidFile: 'קובץ לא תקין:',
	loadFailed: 'טעינה נכשלה:',
	saveFailed: 'שמירה נכשלה:',
	errors: {
		'invalid-address': 'כתובת התא אינה תקינה.',
		'invalid-caption': 'הכתובית כוללת תו שאינו חוקי ב־XML.',
		'invalid-colour': 'יש להזין צבע מלא בצורה #RRGGBBAA.',
		'unknown-edit-field': 'שדה העריכה אינו נתמך.',
		'ambiguous-cell': 'במקור יש כמה תאים באותה כתובת.',
		'missing-cell': 'התא אינו קיים במקור.',
		'dynamic-caption': 'כתובית של תא דינמי אינה ניתנת לעריכה.',
		'invalid-grid-root': 'הדף אינו Grid תקין.',
		'invalid-json': 'חסרים pages או startGrid בקובץ JSON.'
	} as Record<string, string>
};
export const colourLabels: Record<CellColourField, string> = {
	BackColour: 'מילוי תא',
	BorderColour: 'מסגרת',
	TileColour: 'רקע אחורי של התא',
	FontColour: 'צבע כיתוב'
};
export function errorMessage(error: unknown): string {
	const code = error instanceof Error ? error.message : String(error);
	return messages.errors[code] ?? code;
}
export function cellLabel(page: string, x: number, y: number, caption?: string): string {
	return `${messages.cell} ${x},${y} · ${page}${caption ? ' · ' + caption : ''}`;
}
