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

---

# סבב 2 — תיקונים אחרי אימות (27.9.2026)

המאמת נתן `GO` עם שבעה ממצאים, ואישר בדיקה גאומטרית ב-DOM ששלושת שערי ה-🛑
עומדים: ‏`ChatCell` הוא **ילד ישיר** של הרשת עם `grid-column: 1 / span 4`,
אפס היפוך `x` בקוד, ואפס נגיעה בקבצים האסורים. מה שלמטה הוא מה שכן חסר.

## 1 · 🛑 `fontName` נזרק — לוח אמיתי ייראה אחיד-גופן ושגוי

‏`GridCell.svelte:23-29` מחיל `backColour`, `fontColour`, `borderColour`
ו-`fontSize` — **אבל לא `font-family`**. ‏2,150 מ-3,283 הסגנונות נושאים
`FontName`, בשמונה גופנים (‏Booster 1,343 · Medrano 388 · Roboto 224 · Arial 96
· Sassoon Infant 77). הבריף דרש "לצרוך `cell.style` כפי שהוא".

## 2 · 🛑 `border: 2px solid` קשיח — הערך היחיד שמשפיע על כל תא

‏`GridCell.svelte:40`. ‏§5 בתכנון מונה במפורש רדיוס-פינה ומרווח-פנימי כערכים
שאינם ב-XML וחייבים להיות מרוכזים — **רוחב-מסגרת מאותה משפחה בדיוק**.
‏`visualDefaults.ts:12-19` לא מכיל אותו, ולכן הוא לא יתחלף בשורה אחת כשסלייס 3
יתמזג. להעביר לשם.

בחומרה נמוכה יותר, אותו טיפול: ‏`UnsupportedCell.svelte:23,38-42`
(`gap: 2px`, ‏`font-size: .7em`, ‏`opacity: .7`, ‏`border-radius: 4px`)
ו-`ButtonCell.svelte:43`.

## 3 · 🛑 עמעום `Disabled` נשבר בשקט בלי האב

‏`GridCell.svelte:46` כותב `opacity: var(--disabled-opacity)`, והמשתנה מוגדר
**רק** על מכולת ה-grid (`GridBoard.svelte:25`). המאמת מדד: בלי האב אותו תא עובר
ל-`opacity: 1`, ‏`padding: 0`, ‏`border-radius: 0` — **הנגישות נשברת בלי שגיאה**.
הבדיקה הקיימת (`spec:117-125`) בודקת `aria-disabled` ו-`pointer-events` בלבד.

‏🔑 זה רלוונטי **מיָדית**: תא נהיה בלתי-זמין מ-`Settings.RequiredFeature`, ובלוחות
שלנו זה 126 תאים. ‏`var(--disabled-opacity, 0.4)` — fallback לכל המשתנים.

## 4 · 🛑 אין בדיקת-DOM ש-`ChatCell` באמת בתוך הרשת

‏`GridBoard.svelte.spec.ts:142-146` בודקת רק את הרג'יסטרי
(`resolveCellRenderer(cell) === ChatCell`) — היא תמשיך לעבור גם אם מישהו יעקוף
את `GridCell` ויציב את הפס כרצועה. **זהו הסעיף שהפרויקט נפסל עליו והוא לא
מגודר בטסט.** בדיקה שמרנדרת דף עם `Workspace/Chat` ומאמתת `grid-column`,
`span`, ושהאלמנט הוא צאצא של `[data-testid=grid-board]`.

## 5 · אין בדיקה ל-`PointerAndTouchOnly`
ההתנהגות נכונה היום (`GridCell.svelte:13` בודק `=== 'Disabled'`), אבל אין מה
שיעצור רגרסיה שתעמעם גם אותו. ערך אמיתי מתוך 1,555 מופעי `Visibility`.

## 6 · הרשת אינה ממלאת את הגובה — **והפער בבריף שלי**

‏`GridBoard.svelte:34-41` נותן `width: 100%` בלי `height`, ולכן
`grid-template-rows: repeat(var(--rows), 1fr)` חסר-אפקט: נמדד `.grid-page`
בגובה 700px והרשת 236px. לוח AAC אמור למלא מסך.
‏🛑 **ה-CSS הועתק מילולית מהבריף שלי** — הפער שלי, לא שלך. ‏`height: 100%`
והמכולה צריכה גובה מוגדר.

## 7 · מידות עמודה ושורה — נוספו לחוזה

`types.ts` הורחב: ‏`Page.columnWidths: (SizeName|null)[]` ו-`rowHeights`
(`ExtraSmall|Small|Large|ExtraLarge`, ‏`null` = רגיל). ‏`grid-template-columns`
צריך לכבד אותן במקום `repeat(n, 1fr)` אחיד. המיפוי מ-שם-מידה ל-`fr` הוא
**ערך לא-מאומת** → ‏`visualDefaults.ts`.
🔑 בלוחות-הדגימה כל ההגדרות הן `null`, ולכן ההתנהגות הנוכחית נכונה עבורן —
זו הכנה ללוחות מורה.

## 8 · הערה שעוברת לסלייס 5
‏`ChatCell.svelte:11` קורא `ctx.output.items` ב-`$derived` מעל מערך רגיל
(`createDemoRuntimeContext.ts:10`). אם `RuntimeContext` של סלייס 5 לא יעטוף
ב-`$state`, הפס לא יתעדכן. **אל תתקן כאן** — נכנס לבריף 5.

## DoD
`bun run check` · `bun run test:unit --run` ירוקים · קומיט בעברית · לא לדחוף ולא למזג.
