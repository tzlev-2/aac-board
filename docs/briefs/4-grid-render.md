# סלייס 4 — `grid-render`: רשת, ‏span, ‏RTL, ורג'יסטרי מרנדרים

**ענף:** `slice/grid-render` · **בסיס:** `grid-clone` · **worktree:** `.worktrees/grid-render`

## 🛑 קודם כל — מה אסור לגעת בו

האפליקציה הזאת כבר מרנדרת לוחות. `src/lib/components/Board.svelte`,
`Tile.svelte`, `OutputBar.svelte`, `src/lib/types/board.ts` ו-`src/routes/s/…`
**שייכים למודל אחר וממשיכים לעבוד**. אסור לגעת בהם, אסור להרחיב אותם, ואסור
להמיר `GridSet` למודל שלהם.

הליבה החדשה חיה בנפרד: `src/lib/components/gridset/` ומסלול `/grid`.
ראו `docs/plans/gridset-core-design.md` §0 — זו ההכרעה המרכזית של הסבב.

## מה לבנות

| קובץ | תפקיד |
|---|---|
| `components/gridset/GridBoard.svelte` | הרשת — `display:grid` לפי `page.columns/rows` |
| `components/gridset/GridCell.svelte` | מעטפת תא: מיקום, span, סגנון, `Visibility` |
| `components/gridset/cellRenderers.ts` | **הרג'יסטרי** — מפתח → קומפוננטה |
| `components/gridset/ButtonCell.svelte` | ברירת מחדל: caption + סמל |
| `components/gridset/ChatCell.svelte` | 🔑 פס-הפלט — ראו למטה |
| `components/gridset/UnsupportedCell.svelte` | ‏placeholder גלוי לסוג שלא מומש |
| `routes/grid/+page.svelte` | טעינת קובץ (גרירה או `<input type=file>`) והצגה |

## 🔑 פס-הפלט הוא תא, לא chrome

ב-Grid ה-"Chat" הוא תא עם `ContentType=Workspace` ו-`ContentSubType=Chat`
(‏89–90 מופעים): הוא תופס תאים ברשת, יש לו span, יש לו סגנון, והלוח קובע
איפה הוא. **אסור** לממש אותו כרצועה קבועה בראש המסך — זה בדיוק הפלסטר
שהפרויקט נפסל עליו. הוא נכנס ל-`cellRenderers` כמו כל סוג אחר.

```ts
export const cellRenderers: Record<string, Component<CellProps>> = {
  default: ButtonCell,
  'Workspace/Chat': ChatCell,
};
// miss ⇒ UnsupportedCell — מציג את ה-caption ותג עם הסוג, לא קורס, נספר
```
המפתח: `contentType ? `${contentType}/${contentSubType ?? ''}`` : 'default'`.

## 🛑 RTL — בלי היפוך ידני

`X=0` הוא התא **הימני**. הפתרון הוא `direction: rtl` על מכולת ה-grid,
והדפדפן ממקם את `grid-column: 1` מימין. **אסור** `columns - 1 - x` — זה
נשבר על `ColumnSpan` (‏29,778 מופעים ב-`ColumnSpan` ו-24,030 ב-`RowSpan`;
הרשת אינה אחידה).

```css
.grid { display: grid; direction: rtl;
        grid-template-columns: repeat(var(--cols), 1fr);
        grid-template-rows: repeat(var(--rows), 1fr); }
```
```css
.cell { grid-column: calc(var(--x) + 1) / span var(--cspan);
        grid-row:    calc(var(--y) + 1) / span var(--rspan); }
```

## `Visibility` (1,555 מופעים)
`Hidden` → לא מרונדר · `Disabled` → מעומעם ולא לחיץ · `PointerAndTouchOnly` →
מרונדר רגיל (רלוונטי לסריקה, שאינה בהיקף).

## סגנון
לצרוך `cell.style: ResolvedStyle` כפי שהוא. כל ערך חזותי שאינו בו נלקח
מ-`visualDefaults.ts` (סלייס 3). 🛑 **אפס מספרי-קסם בקומפוננטה.** אם הקובץ
עדיין לא במיזוג — ליצור אותו מינימלי ולציין זאת.

## בדיקות
‏Vitest (‏`vitest-browser-svelte`, יש דוגמאות ב-`src/lib/vitest-examples/`):
רשת 6×4 מייצרת 24 מיקומים · תא עם span תופס את השטח הנכון · ‏`X=0` נוחת
בעמודה הימנית · `Hidden` לא ב-DOM · סוג לא-מוכר נותן `UnsupportedCell`.
‏E2E אחד ב-Playwright: טעינת fixture → רשת מוצגת.

## קריטריון קבלה
`bun run check` · `bun run test:unit` ירוקים · `/grid` מציג לוח.

## מחוץ להיקף
ביצוע פקודות ולחיצות (סלייס 5) · מנועי WordList/Prediction — ‏`UnsupportedCell`
מספיק · נאמנות פיקסלים · פתירת קבצי סמל אמיתיים (‏`arasaac.ts` בהמשך).
