/**
 * הרג'יסטרי — מפתח תוכן-תא → קומפוננטת-רינדור.
 * ראו docs/plans/gridset-core-design.md §2. miss ⇒ UnsupportedCell.
 */
import type { Component } from 'svelte';
import type { Cell, RuntimeContext } from '$lib/gridset/types';
import ButtonCell from './ButtonCell.svelte';
import ChatCell from './ChatCell.svelte';
import UnsupportedCell from './UnsupportedCell.svelte';

export interface CellRendererProps {
	cell: Cell;
	ctx: RuntimeContext;
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
