import { describe, expect, it, vi } from 'vitest';
import { createStore, get } from 'idb-keyval';
import { createSymbolCache, type CachedMatch } from './symbol-cache';
import { createSymbolResolver, type PictogramSearch } from './symbols';
import type { Cell, GridSet, ResolvedStyle } from './types';

/** store אמיתי בדפדפן, בשם ייחודי לכל ריצה — כמו ב-audio-cache.svelte.spec.ts. */
function freshStore() {
	return createStore(`test-symbols-${Date.now()}-${Math.random()}`, 'keyval');
}

const MATCH: CachedMatch = { exact: 32761, loose: null, keyword: 'have', looseKeyword: null };

const STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 14,
	backgroundShape: 1,
	tileColour: '#00000000'
};

function cell(): Cell {
	return {
		x: 0,
		y: 0,
		columnSpan: 1,
		rowSpan: 1,
		commands: [],
		style: STYLE,
		image: { library: 'widgit', path: 'widgit rebus\\h\\have.emf' }
	};
}

function gridSet(): GridSet {
	return {
		startGrid: 'main',
		language: 'he-IL',
		symbolSearchKeys: ['widgit'],
		pages: {},
		styles: {}
	};
}

describe('createSymbolCache', () => {
	it('שומר ומחזיר את שתי דרגות ההתאמה', async () => {
		const cache = createSymbolCache({ store: freshStore() });

		await cache.set('en', 'have', MATCH);

		expect(await cache.get('en', 'have')).toEqual(MATCH);
	});

	it('כותב ל-IDB תחת התחילית symbol:, בלי להתנגש בקאש האודיו', async () => {
		const store = freshStore();
		const cache = createSymbolCache({ store });

		await cache.set('he', 'רגל', MATCH);

		expect(await get('symbol:he:רגל', store)).toEqual(MATCH);
		expect(await get('audio:רגל', store)).toBeUndefined();
	});

	it('המפתח אינו תלוי באות גדולה או ברווחים בקצוות', async () => {
		const cache = createSymbolCache({ store: freshStore() });

		await cache.set('en', '  Have ', MATCH);

		expect(await cache.get('en', 'have')).toEqual(MATCH);
	});

	it('שפות שונות הן רשומות שונות', async () => {
		const cache = createSymbolCache({ store: freshStore() });

		await cache.set('en', 'have', MATCH);

		expect(await cache.get('he', 'have')).toBeUndefined();
	});

	it('מה שלא נשמר מחזיר undefined', async () => {
		const cache = createSymbolCache({ store: freshStore() });

		expect(await cache.get('en', 'nothing-here')).toBeUndefined();
	});

	it('persist:false — זיכרון בלבד, שום כתיבה ל-IDB', async () => {
		const store = freshStore();
		const cache = createSymbolCache({ persist: false });

		await cache.set('en', 'have', MATCH);

		expect(await cache.get('en', 'have')).toEqual(MATCH);
		expect(await get('symbol:en:have', store)).toBeUndefined();
	});
});

describe('הפותר מול קאש מתמיד', () => {
	it('פותר שני מפגשים נפרדים עם קריאת-רשת אחת', async () => {
		const store = freshStore();
		const search = vi.fn(async () => [
			{ _id: 32761, keywords: [{ keyword: 'have' }], imageUrl: '' }
		]) as unknown as PictogramSearch;

		const first = createSymbolResolver(gridSet(), {
			search,
			cache: createSymbolCache({ store })
		});
		const a = await first.resolve(cell());

		// מפגש חדש — פותר חדש, קאש בזיכרון ריק, אבל אותו store.
		const second = createSymbolResolver(gridSet(), {
			search,
			cache: createSymbolCache({ store })
		});
		const b = await second.resolve(cell());

		expect(b.url).toBe(a.url);
		expect(search).toHaveBeenCalledTimes(1);
	});
});
