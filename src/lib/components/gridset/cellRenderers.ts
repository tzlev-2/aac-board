/**
 * הרג'יסטרי — מפתח תוכן-תא → קומפוננטת-רינדור.
 * ראו docs/plans/gridset-core-design.md §2. miss ⇒ UnsupportedCell.
 */
import type { Component } from 'svelte';
import type { Cell, RuntimeContext } from '$lib/gridset/types';
import type { SymbolResolver } from '$lib/gridset/symbols';
import ButtonCell from './ButtonCell.svelte';
import ChatCell from './ChatCell.svelte';
import UnsupportedCell from './UnsupportedCell.svelte';

export interface CellRendererProps {
	cell: Cell;
	ctx: RuntimeContext;
	/**
	 * פותר-הסמלים של הלוח (`createSymbolResolver`). ‏`null` = בלי סמלים
	 * (‏SSR, בדיקות, ורינדור תא בודד) — ‏4 מכל 10 תאים מגיעים בלי סמל גם
	 * כשיש פותר, ולכן ה-fallback הוא המסלול הראשי ולא מצב-שגיאה.
	 */
	symbols?: SymbolResolver | null;
}

export type CellRendererComponent = Component<CellRendererProps>;

/** contentType ? `${contentType}/${contentSubType ?? ''}` : 'default' */
export function cellRendererKey(cell: Pick<Cell, 'contentType' | 'contentSubType'>): string {
	return cell.contentType ? `${cell.contentType}/${cell.contentSubType ?? ''}` : 'default';
}

export const cellRenderers: Record<string, CellRendererComponent> = {
	default: ButtonCell,
	'Workspace/Chat': ChatCell
};

export function resolveCellRenderer(cell: Cell): CellRendererComponent {
	return cellRenderers[cellRendererKey(cell)] ?? UnsupportedCell;
}
