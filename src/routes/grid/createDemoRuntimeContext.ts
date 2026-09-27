/**
 * הקשר-ריצה מינימלי לתצוגה בלבד. ביצוע פקודות ולחיצות הוא slice/commands-engine
 * (בריף 5) — מחוץ להיקף כאן. output.items קבוע; להזרקת מריץ אמיתי כשהסלייס
 * ההוא יתמזג — GridBoard/GridCell כבר מקבלים RuntimeContext כפרופ, כך שאין
 * שינוי חוזה נדרש בקומפוננטות עצמן.
 */
import type { GridSet, OutputItem, Page, RuntimeContext } from '$lib/gridset/types';

export function createDemoRuntimeContext(gridSet: GridSet, page: Page): RuntimeContext {
	const items: OutputItem[] = [];

	return {
		gridSet,
		page,
		features: new Set(),
		navigate: () => {},
		back: () => {},
		home: () => {},
		output: {
			insert: () => {},
			insertLetter: () => {},
			clear: () => {},
			deleteWord: () => {},
			deleteLetter: () => {},
			items
		},
		speak: () => {},
		stopSpeaking: () => {},
		reportUnimplemented: (id) => console.debug('[grid] פקודה לא ממומשת:', id)
	};
}
