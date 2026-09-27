/**
 * מדידת אחוז-הפתירה של `createSymbolResolver` מול קובץ `.gridset` **אמיתי**.
 *
 * 🛑 זה אינו חלק מהאפליקציה ואינו בדיקה. זהו כלי-מדידה חד-פעמי שמריץ את קוד
 * הייצור מול ARASAAC **דרך הרשת**, ולכן לא יכול לרוץ ב-CI. בדיקות הסלייס
 * מזייפות את הרשת; המספרים שבדוח באים מכאן.
 *
 * ```sh
 * bun run src/lib/gridset/symbols.measure.ts ~/work/grid-mapping/raw/org-1.gridset
 * ```
 *
 * 🛑 **אין להכניס לריפו שום פלט של הכלי הזה שמכיל מחרוזות מהקובץ** — תוכן
 * Smartbox מורשה. המספרים המצרפיים מותרים; שמות דפים וכתוביות אינם.
 *
 * הפרסור כאן מכוון-מדידה ומבוסס ביטויים רגולריים בכוונה: הפרסר האמיתי
 * (`fflate` + `DOMParser`, סלייס 2) טרם מוזג, והכלי הזה אינו מחכה לו.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchPictograms } from '$lib/services/arasaac';
import { createSymbolCache } from './symbol-cache';
import {
	collectImageRefs,
	createSymbolResolver,
	normalizeSearchTerm,
	pickPictogram,
	primaryLanguage,
	rankImageRefs,
	symbolBaseName,
	type MatchQuality
} from './symbols';
import type { Cell, GridSet, ImageRef, ResolvedStyle } from './types';

const DUMMY_STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 14,
	backgroundShape: 1,
	tileColour: '#00000000'
};

function stripCdata(xml: string): string {
	return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function parseImageRef(raw: string): ImageRef {
	const match = /^\[([^\]]*)\]([\s\S]*)$/.exec(raw);
	return match ? { library: match[1], path: match[2] } : { library: '', path: raw };
}

/**
 * כל קובצי ה-grid.xml תחת ספריית `.gridset` מחולצת.
 *
 * 🛑 שמות התיקיות עבריים ו-`unzip` כותב אותם **בלי דגל UTF-8**, ולכן הבייטים
 * על הדיסק אינם UTF-8 תקין. ‏`readdirSync` עם מחרוזות מחזיר שמות משובשים
 * שאי-אפשר להרכיב מהם נתיב פתיח. לכן עובדים ב-`Buffer` לכל האורך.
 */
function gridFiles(root: string): Buffer[] {
	const grids = Buffer.from(join(root, 'Grids') + '/');
	return readdirSync(grids, { encoding: 'buffer' })
		.map((dir) => Buffer.concat([grids, dir, Buffer.from('/grid.xml')]))
		.filter((file) => {
			try {
				return statSync(file).isFile();
			} catch {
				return false;
			}
		});
}

function readSettings(root: string): { symbolSearchKeys: string[]; language: string } {
	const dir = readdirSync(root).find((d) => d.toLowerCase().startsWith('settings'));
	if (!dir) return { symbolSearchKeys: [], language: 'he-IL' };
	const xml = stripCdata(readFileSync(join(root, dir, 'settings.xml'), 'utf-8'));
	return {
		symbolSearchKeys: [...xml.matchAll(/<PictureSearchKey>(.*?)<\/PictureSearchKey>/g)].map(
			(m) => m[1]
		),
		language: /<Language>(.*?)<\/Language>/.exec(xml)?.[1] ?? 'he-IL'
	};
}

function readCells(root: string): Cell[] {
	const cells: Cell[] = [];
	for (const file of gridFiles(root)) {
		const xml = stripCdata(readFileSync(file, 'utf-8'));
		for (const block of xml.match(/<Cell\b[\s\S]*?<\/Cell>/g) ?? []) {
			const caption = /<Caption>([\s\S]*?)<\/Caption>/.exec(block)?.[1]?.trim();
			const cellImage = /<Image>([\s\S]*?)<\/Image>/.exec(block)?.[1];
			const sentenceImages = [...block.matchAll(/<s Image="([^"]*)"/g)].map((m) => m[1]);
			if (!cellImage && sentenceImages.length === 0) continue;

			cells.push({
				x: 0,
				y: 0,
				columnSpan: 1,
				rowSpan: 1,
				caption,
				image: cellImage ? parseImageRef(cellImage) : undefined,
				commands: sentenceImages.length
					? [
							{
								id: 'Action.InsertText',
								params: {
									text: {
										paragraphs: [
											{
												sentences: sentenceImages.map((raw) => ({
													image: parseImageRef(raw),
													runs: []
												}))
											}
										]
									}
								}
							}
						]
					: [],
				style: DUMMY_STYLE
			});
		}
	}
	return cells;
}

/** תאים ייחודיים לפי (כתובית, refs) — ‏`want.emf` חוזר 20 פעם באותו לוח. */
function unique(cells: Cell[]): Cell[] {
	const seen = new Set<string>();
	return cells.filter((cell) => {
		const key = JSON.stringify([cell.caption ?? '', cell.image, cell.commands]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function inBatches<T>(items: T[], size: number, task: (item: T) => Promise<unknown>) {
	for (let i = 0; i < items.length; i += size) {
		await Promise.all(items.slice(i, i + size).map(task));
	}
}

interface RunResult {
	resolved: number;
	total: number;
	byLibrary: Record<string, number>;
	resolvedByLibrary: Record<string, number>;
	byMatch: Record<MatchQuality, number>;
}

function pctOf(result: RunResult): string {
	const pct = result.total ? Math.round((result.resolved / result.total) * 100) : 0;
	return `${result.resolved}/${result.total} = ${pct}%`;
}

async function run(
	label: string,
	gridSet: GridSet,
	cells: Cell[],
	minMatch: MatchQuality,
	cache: ReturnType<typeof createSymbolCache>
): Promise<RunResult> {
	const resolver = createSymbolResolver(gridSet, { minMatch, cache });
	await inBatches(cells, 6, (cell) => resolver.resolve(cell));
	const stats = resolver.stats();
	const total = stats.resolved + stats.unresolved;
	const pct = total ? Math.round((stats.resolved / total) * 100) : 0;
	console.log(`${label.padEnd(34)} ${stats.resolved}/${total} = ${pct}%`);
	return { ...stats, total };
}

function withoutCaptions(cells: Cell[]): Cell[] {
	return cells.map((cell) => ({ ...cell, caption: undefined }));
}

function withoutImages(cells: Cell[]): Cell[] {
	return cells.map((cell) => ({ ...cell, image: undefined, commands: [] }));
}

// ── מעבר ב: הרעש של `results[0]` ─────────────────────────────────────────

/**
 * כמה מהחיפושים שהחזירו תוצאות **אינן נושאות אף מילת-מפתח זהה למפתח-החיפוש**.
 * אלה בדיוק המקרים שבהם מימוש תמים (`results[0].imageUrl`) היה מציג סמל
 * שאינו המושג שחיפשנו.
 *
 * 🛑 זה **אינו** מדד-נכונות: הוא אינו יודע מה הסמל הנכון, ואינו שולל שדווקא
 * `results[0]` מתאים במקרה. מה שהוא מודד הוא **חוסר-עיגון** — שה-API החזיר
 * תוצאה על סמך התאמה-חלקית, ולא על סמך המושג.
 */
async function measureNaiveNoise(queries: { query: string; lang: string }[]) {
	const perLang = new Map<string, { nonEmpty: number; withoutExact: number; worst: number }>();
	for (const { query, lang } of queries) {
		const results = await searchPictograms(query, lang);
		if (results.length === 0) continue;
		const bucket = perLang.get(lang) ?? { nonEmpty: 0, withoutExact: 0, worst: 0 };
		bucket.nonEmpty += 1;
		if (pickPictogram(results, query).exact === null) {
			bucket.withoutExact += 1;
			bucket.worst = Math.max(bucket.worst, results.length);
		}
		perLang.set(lang, bucket);
	}

	console.log('-- הרעש של results[0] — חיפושים שהחזירו תוצאות בלי אף מילת-מפתח זהה');
	console.log('   (מדד חוסר-עיגון, לא מדד נכונות)');
	for (const [lang, b] of [...perLang].sort()) {
		const pct = Math.round((b.withoutExact / b.nonEmpty) * 100);
		console.log(
			`   ${lang}   ${b.withoutExact}/${b.nonEmpty} = ${pct}%` +
				`   · הגדול שבהם החזיר ${b.worst} תוצאות`
		);
	}
	console.log('');
}

// ── מעבר ג: מה קורה כששני המפתחות חולקים ─────────────────────────────────

/**
 * בכמה תאים **שני** המפתחות מחזירים התאמה מדויקת, ובכמה מהם הם מצביעים על
 * פיקטוגרם **שונה**. שם ההכרעה של הפותר (שם-בסיס קודם) היא הכרעה שרירותית.
 *
 * 🛑 גם זה אינו מדד-נכונות — הוא מודד **סתירה**. לדעת מי צדק צריך שיפוט אנושי
 * על כל מקרה, ואין לזה מדידה אוטומטית. מה שהמספר כן אומר: על כמה תאים
 * ההכרעה השרירותית בכלל משנה משהו.
 */
async function measureKeyDivergence(cells: Cell[], captionLang: string) {
	let both = 0;
	let differ = 0;
	for (const cell of cells) {
		const base = symbolBaseName(rankImageRefs(collectImageRefs(cell), [])[0]);
		const caption = normalizeSearchTerm(cell.caption ?? '');
		if (!base || caption.length < 2) continue;

		const [fromBase, fromCaption] = await Promise.all([
			searchPictograms(base, 'en').then((r) => pickPictogram(r, base).exact),
			searchPictograms(caption, captionLang).then((r) => pickPictogram(r, caption).exact)
		]);
		if (fromBase === null || fromCaption === null) continue;
		both += 1;
		if (fromBase !== fromCaption) differ += 1;
	}

	const pct = both ? Math.round((differ / both) * 100) : 0;
	console.log('-- שני המפתחות מול זה: חפיפה וסתירה (מדד סתירה, לא נכונות)');
	console.log(`   שניהם exact: ${both} תאים · מצביעים על פיקטוגרם שונה: ${differ} = ${pct}%`);
	console.log('');
}

async function main() {
	const arg = process.argv[2];
	if (!arg) {
		console.error('usage: bun run src/lib/gridset/symbols.measure.ts <path to .gridset or dir>');
		process.exit(1);
	}

	let root = arg;
	if (statSync(arg).isFile()) {
		root = mkdtempSync(join(tmpdir(), 'gridset-measure-'));
		try {
			execFileSync('unzip', ['-o', '-q', arg, '-d', root], { stdio: 'ignore' });
		} catch {
			// יציאה 1 מ-unzip היא *אזהרה*, לא כשל: ב-org-2..4 שמות הקבצים
			// ב-"local header" אינם זהים ל-"central directory" (עברית בלי דגל
			// UTF-8). החילוץ מצליח. מה שקובע הוא אם Grids/ נוצרה.
		}
		statSync(join(root, 'Grids'));
	}

	const { symbolSearchKeys, language } = readSettings(root);
	const gridSet: GridSet = { startGrid: '', language, symbolSearchKeys, pages: {}, styles: {} };
	const all = readCells(root);
	const cells = unique(all);

	console.log(`# ${arg}`);
	console.log(`language=${language} symbolSearchKeys=[${symbolSearchKeys.join(', ')}]`);
	console.log(
		`cells carrying an ImageRef: ${all.length} · unique (caption, refs): ${cells.length}`
	);
	console.log('');

	// קאש אחד לכל ההרצות — חיפוש שכבר רץ אינו חוזר לרשת.
	const cache = createSymbolCache({ persist: false });

	console.log('-- כיסוי, בסיס: תאים ייחודיים (מדד להשוואה בין מפתחות)');
	await run('(1) שם-בסיס מ-ImageRef (en)', gridSet, withoutCaptions(cells), 'exact', cache);
	await run(`(2) כתובית (${language})`, gridSet, withoutImages(cells), 'exact', cache);
	const strict = await run('(3) שניהם, exact — ברירת המחדל', gridSet, cells, 'exact', cache);
	const loose = await run('(3b) שניהם, exact + loose', gridSet, cells, 'loose', cache);
	console.log('');
	// 🛑 זהו הבסיס שקובע מה המורה תראה, והוא נמוך מהייחודיים: אייקון חוזר
	// בעשרות תאים נספר פעם אחת בייחודיים, ודווקא הוא נפתר רע. דה-דופליקציה
	// מייפה את החלק הגרוע, ולכן שני המספרים יוצאים תמיד יחד.
	console.log('-- כיסוי, בסיס: כל התאים (מה שבאמת על המסך)');
	const weighted = await run('exact — ברירת המחדל', gridSet, all, 'exact', cache);
	const weightedLoose = await run('exact + loose', gridSet, all, 'loose', cache);
	console.log('');
	console.log(
		`🔑 שני המספרים יחד: exact ${pctOf(strict)} מהתאים הייחודיים · ` +
			`${pctOf(weighted)} מכל התאים.`
	);
	console.log(
		`   ‏loose מוסיף כיסוי (${pctOf(loose)} ייחודיים · ${pctOf(weightedLoose)} כל התאים) ` +
			`— 🛑 כיסוי, לא דיוק. נכונות ההתאמות הרופפות לא נמדדה.`
	);
	console.log('');

	for (const [label, result] of [
		['exact, ייחודיים', strict],
		['exact+loose, ייחודיים', loose],
		['exact, משוקלל', weighted]
	] as const) {
		console.log(`-- ${label}: לפי ספרייה (נפתרו/נוסו)`);
		for (const library of Object.keys(result.byLibrary).sort()) {
			const tried = result.byLibrary[library];
			const ok = result.resolvedByLibrary[library] ?? 0;
			console.log(
				`   ${library.padEnd(10)} ${ok}/${tried} = ${Math.round((ok / tried) * 100)}%`.padEnd(30) +
					''
			);
		}
		console.log(`   דרגות: ${JSON.stringify(result.byMatch)}`);
		console.log('');
	}

	// שני המעברים שמודדים את מה שהכיסוי אינו מודד.
	const queries = new Map<string, { query: string; lang: string }>();
	for (const cell of cells) {
		for (const ref of collectImageRefs(cell)) {
			const base = symbolBaseName(ref);
			if (base) queries.set(`en:${normalizeSearchTerm(base)}`, { query: base, lang: 'en' });
		}
		const caption = normalizeSearchTerm(cell.caption ?? '');
		if (caption.length >= 2) {
			queries.set(`${primaryLanguage(language)}:${caption}`, {
				query: caption,
				lang: primaryLanguage(language)
			});
		}
	}
	await measureNaiveNoise([...queries.values()]);
	await measureKeyDivergence(cells, primaryLanguage(language));
}

main();
