/**
 * הרג'יסטרי — מפתח תוכן-תא → קומפוננטת-רינדור.
 * ראו docs/plans/gridset-core-design.md §2. miss ⇒ UnsupportedCell.
 */
import type { Component } from 'svelte';
import type { Cell, RuntimeContext } from '$lib/gridset/types';
import type { SymbolResolver } from '$lib/gridset/symbols';
import type { WordListSlot } from '$lib/gridset/wordListPager';
import ButtonCell from './ButtonCell.svelte';
import ChatCell from './ChatCell.svelte';
import UnsupportedCell from './UnsupportedCell.svelte';
import WordListCell from './WordListCell.svelte';

export interface CellRendererProps {
	cell: Cell;
	/** Presentation result for measured caption-only text; never changes the model. */
	onCaptionFit?: (unfit: boolean) => void;
	ctx: RuntimeContext;
	/**
	 * פותר-הסמלים של הלוח (`createSymbolResolver`). ‏`null` = בלי סמלים
	 * (‏SSR, בדיקות, ורינדור תא בודד) — ‏4 מכל 10 תאים מגיעים בלי סמל גם
	 * כשיש פותר, ולכן ה-fallback הוא המסלול הראשי ולא מצב-שגיאה.
	 */
	symbols?: SymbolResolver | null;
	/**
	 * מה מוצג בתא `AutoContent/WordList` או `Prediction` בעמוד הנוכחי —
	 * מחושב ברמת הדף ב-`wordListPager`, כי העימוד תלוי בכל תאי-הדף.
	 */
	slot?: WordListSlot;
}

export type CellRendererComponent = Component<CellRendererProps>;

/** contentType ? `${contentType}/${contentSubType ?? ''}` : 'default' */
export function cellRendererKey(cell: Pick<Cell, 'contentType' | 'contentSubType'>): string {
	return cell.contentType ? `${cell.contentType}/${cell.contentSubType ?? ''}` : 'default';
}

export const cellRenderers: Record<string, CellRendererComponent> = {
	default: ButtonCell,
	'Workspace/Chat': ChatCell,
	'AutoContent/WordList': WordListCell,
	'AutoContent/Prediction': WordListCell
};

export function resolveCellRenderer(cell: Cell): CellRendererComponent {
	return cellRenderers[cellRendererKey(cell)] ?? UnsupportedCell;
}
