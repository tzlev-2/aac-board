/**
 * אימות מבני מול קבצי `.gridset` אמיתיים (‏~/work/grid-mapping/raw/) — לא
 * ריצה ב-CI, ולכן מדלגת בעדינות כשהתיקייה לא קיימת. לא מעתיקה תוכן
 * (כיתובים, סגנונות, שמות דפים) לריפו — כל ההשוואות הן מבניות בלבד.
 *
 * הרצה בסביבת node (לא `.svelte.`) כי היא צריכה `fs`/`path`, לא DOMParser —
 * כל ההשוואות הן regex, לא פרסור DOM מלא.
 *
 * שלוש שכבות-בדיקה, מהחלשה לחזקה:
 * 1. קבוצות-תגים (שמות אלמנטים) — תופס אלמנט שהומצא, לא תופס אלמנט אמיתי
 *    שהושם במקום/הקשר לא-נכון (זו הייתה הבעיה בסבב 2 — ראו למטה).
 * 2. מיקום-בשרשרת: פקודה שבפועל **תמיד** אחרונה בשרשראות מרובות-פקודות —
 *    ה-fixtures חייבים למקם אותה אחרונה גם הם. 🛑 **מחושב רק מ-`org-1..4`**
 *    (לוחות-דגימה מלאים, כמו gridset-core-design.md §1), לא מ-`bundled/`:
 *    ‏`Settings.RequiredFeature` הוא 126/126 אחרון ב-org-1..4, אבל 96.6% בלבד
 *    בכל 116 הקבצים (חלק מ-`bundled/` — תבניות-אפליקציה של Grid עצמו, כמו
 *    Netflix/ComputerControl — חורגות). "תמיד" על הקורפוס המלא ריק-כמעט
 *    מתוקף רעש, ולא היה תופס את הממצא שהוביל לבדיקה הזו.
 * 3. קיום (Command,Parameter Key): מפתח-פרמטר שה-fixtures כותבים לפקודה
 *    נתונה חייב להופיע בפועל לאותה פקודה **בכל הקורפוס** (כאן דווקא רוצים
 *    את הטווח הרחב, כדי לא לפסול מפתח נדיר-אך-אמיתי).
 *
 * 🛑 **מה זה עדיין לא תופס:** תדירות-ערך. `feature=ComputerControl` הוא ערך
 * **אמיתי** (קיים בפועל), רק לא-מייצג (1.7% מול Dwell ב-92.4%) — קיום-ערך
 * לא יכול להבדיל בין "קיים אך נדיר" ל"קיים ונפוץ". זו הייתה טעות סבב 2,
 * והיא נבדקת ידנית מול `commands.tsv`/gridset-core-design.md, לא כאן.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { unzipSync, strFromU8 } from 'fflate';
import { buildGridset } from './buildGridset';
import { fixtures } from './fixtures';

const RAW_DIR = join(homedir(), 'work', 'grid-mapping', 'raw');
const REFERENCE_FILE = join(RAW_DIR, 'org-1.gridset');
const hasRealFiles = existsSync(REFERENCE_FILE);

function tagNames(xml: string): Set<string> {
	const tags = new Set<string>();
	const re = /<\/?([A-Za-z][\w.]*)(?:[\s/>])/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml))) {
		if (m[1] !== 'xml') tags.add(m[1]);
	}
	return tags;
}

/** כל שרשרת <Commands>...</Commands>, כרשימת ה-ID-ים המסודרת שבתוכה. */
function extractCommandChains(xml: string): string[][] {
	const chains: string[][] = [];
	const blockRe = /<Commands>([\s\S]*?)<\/Commands>/g;
	let block: RegExpExecArray | null;
	while ((block = blockRe.exec(xml))) {
		const ids: string[] = [];
		const idRe = /<Command ID="([^"]+)"/g;
		let idMatch: RegExpExecArray | null;
		while ((idMatch = idRe.exec(block[1]))) ids.push(idMatch[1]);
		if (ids.length) chains.push(ids);
	}
	return chains;
}

/** מפתחות-פרמטר לכל מזהה-פקודה. הרסן: פקודה מקוננת בתוך Parameter של פקודה
 * אחרת (CommandCollectionParameterValue, נדיר — 197 מופעים בקורפוס) עלולה
 * להיקרא כשגויה לפקודת-האב; זה מרחיב את אוצר-המילים "האמיתי" מדי בגבול הזה,
 * לא מצמצם אותו — ולכן לא גורם לכישלון-שווא בבדיקה שמשתמשת בו כתת-קבוצה. */
function extractCommandParamKeys(xml: string): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	const commandRe = /<Command ID="([^"]+)"(?:\s*\/>|>([\s\S]*?)<\/Command>)/g;
	let m: RegExpExecArray | null;
	while ((m = commandRe.exec(xml))) {
		const id = m[1];
		const body = m[2] ?? '';
		const keys = map.get(id) ?? new Set<string>();
		const paramRe = /<Parameter Key="([^"]+)"/g;
		let p: RegExpExecArray | null;
		while ((p = paramRe.exec(body))) keys.add(p[1]);
		map.set(id, keys);
	}
	return map;
}

function orgOnlyFiles(): string[] {
	return ['org-1', 'org-2', 'org-3', 'org-4']
		.map((n) => join(RAW_DIR, `${n}.gridset`))
		.filter(existsSync);
}

function allGridsetFiles(): string[] {
	const bundledDir = join(RAW_DIR, 'bundled');
	const bundledFiles = existsSync(bundledDir)
		? readdirSync(bundledDir)
				.filter((f) => f.endsWith('.gridset'))
				.map((f) => join(bundledDir, f))
		: [];
	return [...orgOnlyFiles(), ...bundledFiles];
}

interface RealVocabulary {
	settings: Set<string>;
	styles: Set<string>;
	grid: Set<string>;
	/** מפתחות-פרמטר אמיתיים לכל מזהה-פקודה — נבנה מהקורפוס המלא (רחב במכוון). */
	commandParamKeys: Map<string, Set<string>>;
}

/** עובר על כל קובץ אמיתי **פעם אחת** (לא פעם לכל סוג קובץ), ומדלג על
 * פענוח קבצים לא-רלוונטיים (תמונות, אודיו) דרך `filter`. */
function collectRealVocabulary(gridsetFiles: string[]): RealVocabulary {
	const vocab: RealVocabulary = {
		settings: new Set(),
		styles: new Set(),
		grid: new Set(),
		commandParamKeys: new Map()
	};

	for (const file of gridsetFiles) {
		const zipped = unzipSync(readFileSync(file), {
			filter: (info) =>
				info.name === 'Settings0/settings.xml' ||
				info.name === 'Settings0/Styles/styles.xml' ||
				(info.name.startsWith('Grids/') && info.name.endsWith('/grid.xml'))
		});
		for (const path of Object.keys(zipped)) {
			const xml = strFromU8(zipped[path]);
			const bucket =
				path === 'Settings0/settings.xml'
					? vocab.settings
					: path === 'Settings0/Styles/styles.xml'
						? vocab.styles
						: vocab.grid;
			for (const tag of tagNames(xml)) bucket.add(tag);

			if (!path.startsWith('Grids/')) continue;

			for (const [id, keys] of extractCommandParamKeys(xml)) {
				const existing = vocab.commandParamKeys.get(id) ?? new Set<string>();
				for (const key of keys) existing.add(key);
				vocab.commandParamKeys.set(id, existing);
			}
		}
	}

	return vocab;
}

/** 🛑 מחושב רק מ-org-1..4 (לוחות-דגימה מלאים) — לא מהקורפוס המלא. ראו
 * ההסבר בראש הקובץ: על כל 116-117 הקבצים ל"תמיד" כמעט אין משמעות. */
function collectAlwaysLastCommands(orgFiles: string[]): Set<string> {
	const sawAsNonLast = new Set<string>();
	const sawInMultiCommandChain = new Set<string>();

	for (const file of orgFiles) {
		const zipped = unzipSync(readFileSync(file), {
			filter: (info) => info.name.startsWith('Grids/') && info.name.endsWith('/grid.xml')
		});
		for (const path of Object.keys(zipped)) {
			for (const chain of extractCommandChains(strFromU8(zipped[path]))) {
				if (chain.length < 2) continue;
				chain.forEach((id, i) => {
					sawInMultiCommandChain.add(id);
					if (i !== chain.length - 1) sawAsNonLast.add(id);
				});
			}
		}
	}

	const alwaysLast = new Set<string>();
	for (const id of sawInMultiCommandChain) {
		if (!sawAsNonLast.has(id)) alwaysLast.add(id);
	}
	return alwaysLast;
}

describe.skipIf(!hasRealFiles)('אימות מבני מול .gridset אמיתי (~/work/grid-mapping/raw)', () => {
	let vocab: RealVocabulary;
	let alwaysLastCommands: Set<string>;

	beforeAll(() => {
		vocab = collectRealVocabulary(allGridsetFiles());
		alwaysLastCommands = collectAlwaysLastCommands(orgOnlyFiles());
	}, 30000);

	it('settings.xml — כל תג שהמחולל מייצר קיים גם בקבצים אמיתיים', () => {
		const ourXml = strFromU8(unzipSync(buildGridset(fixtures.minimal))['Settings0/settings.xml']);
		for (const tag of tagNames(ourXml)) {
			expect(vocab.settings.has(tag), `תג "${tag}" לא נמצא באף settings.xml אמיתי`).toBe(true);
		}
	});

	it('styles.xml — כל תג בכל ה-fixtures (כולל TileColour מ-styleTwoLevel) קיים בפועל', () => {
		for (const [name, spec] of Object.entries(fixtures)) {
			const ourXml = strFromU8(unzipSync(buildGridset(spec))['Settings0/Styles/styles.xml']);
			for (const tag of tagNames(ourXml)) {
				expect(
					vocab.styles.has(tag),
					`fixture "${name}": תג "${tag}" לא נמצא באף styles.xml אמיתי`
				).toBe(true);
			}
		}
	});

	it('grid.xml — כל תג בכל 12 ה-fixtures קיים בקבצי grid.xml אמיתיים', () => {
		for (const [name, spec] of Object.entries(fixtures)) {
			const zipped = unzipSync(buildGridset(spec));
			for (const path of Object.keys(zipped).filter((p) => p.startsWith('Grids/'))) {
				for (const tag of tagNames(strFromU8(zipped[path]))) {
					expect(
						vocab.grid.has(tag),
						`fixture "${name}": תג "${tag}" לא נמצא באף grid.xml אמיתי`
					).toBe(true);
				}
			}
		}
	});

	it('מיקום-בשרשרת: פקודה שבפועל תמיד-אחרונה (ב-org-1..4) מוצבת אחרונה גם בכל ה-fixtures', () => {
		expect(
			alwaysLastCommands.size,
			'לא נמצאה אף פקודה עם דפוס "תמיד אחרון" ב-org-1..4 — הבדיקה לא ישימה'
		).toBeGreaterThan(0);
		expect(alwaysLastCommands.has('Settings.RequiredFeature')).toBe(true);

		for (const [name, spec] of Object.entries(fixtures)) {
			const zipped = unzipSync(buildGridset(spec));
			for (const path of Object.keys(zipped).filter((p) => p.startsWith('Grids/'))) {
				for (const chain of extractCommandChains(strFromU8(zipped[path]))) {
					for (let i = 0; i < chain.length - 1; i++) {
						expect(
							alwaysLastCommands.has(chain[i]),
							`fixture "${name}": "${chain[i]}" הוא תמיד-אחרון ב-org-1..4, אבל כאן ב-index ${i} מתוך [${chain.join(', ')}]`
						).toBe(false);
					}
				}
			}
		}
	});

	it('כל (Command, Parameter Key) שה-fixtures מייצרים קיים בפועל לאותה פקודה', () => {
		for (const [name, spec] of Object.entries(fixtures)) {
			const zipped = unzipSync(buildGridset(spec));
			for (const path of Object.keys(zipped).filter((p) => p.startsWith('Grids/'))) {
				for (const [commandId, keys] of extractCommandParamKeys(strFromU8(zipped[path]))) {
					const realKeys = vocab.commandParamKeys.get(commandId);
					for (const key of keys) {
						expect(
							realKeys?.has(key),
							`fixture "${name}": (${commandId}, ${key}) לא נמצא בקורפוס האמיתי`
						).toBe(true);
					}
				}
			}
		}
	});

	it('orgHome — קבוצת-התגים היא תת-קבוצה של "דף ראשי" האמיתי המקביל (org-1)', () => {
		const realPageZip = unzipSync(readFileSync(REFERENCE_FILE), {
			filter: (info) => info.name === 'Grids/דף ראשי/grid.xml'
		});
		const realPagePath = Object.keys(realPageZip)[0];
		expect(realPagePath, 'לא נמצא "Grids/דף ראשי/grid.xml" ב-org-1.gridset').toBeTruthy();
		const realTags = tagNames(strFromU8(realPageZip[realPagePath]));

		const ourPageZip = unzipSync(buildGridset(fixtures.orgHome));
		const ourTags = tagNames(strFromU8(ourPageZip['Grids/דף ראשי/grid.xml']));

		for (const tag of ourTags) {
			expect(realTags.has(tag), `תג "${tag}" ב-orgHome לא קיים ב-"דף ראשי" האמיתי`).toBe(true);
		}
	});
});
