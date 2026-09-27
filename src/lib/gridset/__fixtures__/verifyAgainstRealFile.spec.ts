/**
 * אימות מבני מול קבצי `.gridset` אמיתיים (‏~/work/grid-mapping/raw/) — לא
 * ריצה ב-CI, ולכן מדלגת בעדינות כשהתיקייה לא קיימת. משווה **קבוצות-תגים**
 * בלבד (שמות אלמנטים) — לא מעתיקה תוכן (כיתובים, סגנונות, שמות דפים) לריפו.
 *
 * הרצה בסביבת node (לא `.svelte.`) כי היא צריכה `fs`/`path`, לא DOMParser —
 * ההשוואה היא regex על שמות-תגים, לא פרסור DOM מלא.
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

function allGridsetFiles(): string[] {
	const orgFiles = ['org-1', 'org-2', 'org-3', 'org-4']
		.map((n) => join(RAW_DIR, `${n}.gridset`))
		.filter(existsSync);
	const bundledDir = join(RAW_DIR, 'bundled');
	const bundledFiles = existsSync(bundledDir)
		? readdirSync(bundledDir)
				.filter((f) => f.endsWith('.gridset'))
				.map((f) => join(bundledDir, f))
		: [];
	return [...orgFiles, ...bundledFiles];
}

interface RealVocabulary {
	settings: Set<string>;
	styles: Set<string>;
	grid: Set<string>;
}

/** עובר על כל קובץ אמיתי **פעם אחת** (לא פעם לכל סוג קובץ), ומדלג על
 * פענוח קבצים לא-רלוונטיים (תמונות, אודיו) דרך `filter`. */
function collectRealVocabulary(gridsetFiles: string[]): RealVocabulary {
	const vocab: RealVocabulary = { settings: new Set(), styles: new Set(), grid: new Set() };
	for (const file of gridsetFiles) {
		const zipped = unzipSync(readFileSync(file), {
			filter: (info) =>
				info.name === 'Settings0/settings.xml' ||
				info.name === 'Settings0/Styles/styles.xml' ||
				(info.name.startsWith('Grids/') && info.name.endsWith('/grid.xml'))
		});
		for (const path of Object.keys(zipped)) {
			const bucket =
				path === 'Settings0/settings.xml'
					? vocab.settings
					: path === 'Settings0/Styles/styles.xml'
						? vocab.styles
						: vocab.grid;
			for (const tag of tagNames(strFromU8(zipped[path]))) bucket.add(tag);
		}
	}
	return vocab;
}

describe.skipIf(!hasRealFiles)('אימות מבני מול .gridset אמיתי (~/work/grid-mapping/raw)', () => {
	let vocab: RealVocabulary;

	beforeAll(() => {
		vocab = collectRealVocabulary(allGridsetFiles());
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
