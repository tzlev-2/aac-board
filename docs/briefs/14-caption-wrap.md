# סלייס 14 — כתובית לבדה נשברת לשורות (פער 2)

**ענף:** `slice/14-caption-wrap` · **בסיס:** `integration/run-grid-gaps-23` (`e09fdc7`)
**מפרט:** `tzlev-docs-repo/aac-board/GRID-GAPS.md` §2 · **פקודת-משימה:** `plans/missions/grid-gaps-23.md`
**מורכבות:** 2/10 (‏CSS + בדיקות · בלי לוגיקה) · **תלויות:** אין
**שער כניסה שנמדד לפני כתיבת הבריף:** ‏391 עברו · 1 דולג · ‏`bun run check` ‏0 שגיאות
(‏אזהרה אחת קיימת ב-`TileEditor.svelte` על `a11y_no_static_element_interactions` — **קיימת
בבסיס, לא לתקן**).

---

## §0 — הרצה

```bash
cd /home/user/Projects/aac-board-app
git worktree add .worktrees/14-caption-wrap -b slice/14-caption-wrap integration/run-grid-gaps-23
cd .worktrees/14-caption-wrap
bun install
```

```bash
# 🛑 בדיקות **לא** ב-tmux — TTY מפעיל watch mode והסשן לא נגמר.
CI=1 bunx vitest run                      # השער: 391 + הבדיקות החדשות
CI=1 bunx vitest run --project client src/lib/components/gridset/visualFidelity.svelte.spec.ts
bun run check                              # 0 שגיאות
bun run build
```

‏`set -o pipefail` בכל pipeline. ‏`rm -f` לקובץ-פלט לפני כל השקה מחדש.

**קריאה לפני התחלה:** ‏`src/lib/components/gridset/ButtonCell.svelte` (כולו — 130 שורות) ·
‏`UnsupportedCell.svelte` · ‏`src/lib/components/gridset/visualFidelity.svelte.spec.ts`
(העוזר `renderCell` הוא מה שתשתמש בו).

---

## §1 — המטרה

מורה שפותחת לוח עם תא-הנחיה ארוך רואה את **כל** ההוראה, פרושה על כמה שורות
וממורכזת אנכית בתא — במקום שורה אחת שנחתכת בשלוש נקודות ושאר ההוראה נעלם.

---

## §2 — Scope

| | בפנים | בחוץ |
|---|---|---|
| ‏`ButtonCell` — מסלול `captionOnly` (תא **בלי** `Image`) | ✅ שבירת-שורות | — |
| ‏`UnsupportedCell` — כתובית-בלבד מעצם הגדרתו | ✅ אותו כלל | — |
| תא **עם** סמל | — | ❌ `nowrap` **נמדד כנכון** שם (המפרט §2) |
| שלוש-הנקודות (`text-overflow: ellipsis`) בתא **עם** סמל | — | ❌ המפרט אומר ש-Grid אינו מוסיף אותן, אבל התא-עם-סמל **מחוץ להיקף**. לא לגעת |
| ‏`.output-text` ב-`ChatCell` | — | ❌ פס-הפלט הוא סלייס 15 |
| גודל-גופן, יחסים, ריווח, צורות | — | ❌ לא נמדדו |

🛑 **הקובץ היחיד שבו נוגעים בלוגיקה: אף אחד.** ‏`captionOnly` **כבר קיים**
ומחושב נכון (`const captionOnly = $derived(...)`, וגם `class:caption-only` על
ה-`<span>` וגם על העוטף). הפער הוא **שכלל ה-`white-space` לא הלך אחרי ההבחנה
שהקומפוננטה כבר עושה.**

---

## §3 — מה משתנה

```
ButtonCell.svelte  <style>
  .caption            ← נשאר nowrap + ellipsis (מסלול סמל+כתובית)
  .caption.caption-only  ← חדש: נשבר לשורות
UnsupportedCell.svelte <style>
  .caption            ← נשבר לשורות (אין לו מסלול שני)
visualFidelity.svelte.spec.ts ← describe חדש, 3 בדיקות
```

---

## §4 — קומיטים בסדר

### קומיט 0 — הבדיקות, אדומות (approach: tdd)

**קובץ שמשתנה:** ‏`src/lib/components/gridset/visualFidelity.svelte.spec.ts` — ‏`describe`
חדש. אל תיגע בשלושת ה-`describe` הקיימים.

🔑 **מדידת-השורות — נמדדה ונקבעה כאן, אל תמציא אחרת.** הרצתי probe על הבסיס:

| מה ניסיתי | מה יצא |
|---|---|
| ‏`getComputedStyle(caption).display` | **`block`** — ה-`<span>` הוא flex item ולכן מובלק |
| ‏`Range.selectNodeContents` + `getClientRects().length` | 🛑 **2 גם עם `nowrap`** — הוא מונה ריצות-דו-כיווניות, **לא שורות**. גלאי-שורות שגוי בשקט |
| ‏`height / lineHeight` | ‏`nowrap` → ‏58.9/58.93 = **1** · ‏`white-space: normal` → ‏176.7/58.93 = **3** ✅ |
| ‏`scrollWidth` מול `clientWidth` | ‏`nowrap` → ‏1511 מול 505 (גלישה חבויה) · אחרי → שווים |

**לכן שתי המדידות המחייבות:** ‏`Math.round(rect.height / lineHeightPx)` ו-
‏`scrollWidth <= clientWidth + 1`.

שלוש הבדיקות:

1. **`🔑 כתובית לבדה נשברת לשורות וממלאת את התא`** — ‏`renderCell(makeCell({ caption: LONG }), 309, 509)`,
   כש-`LONG` הוא מחרוזת עברית בת ~60 תווים. שתי טענות: מספר-השורות ≥ 2, ואין
   גלישה אופקית חבויה. **נכשלת על הבסיס** (‏1 שורה · scrollWidth ≈ 3× clientWidth).
2. **`תא עם סמל נשאר שורה אחת — ההבחנה של captionOnly`** — אותו `LONG`, אותו גודל,
   ‏`image: { library: 'widgit', path: 'food.emf' }`. ‏`whiteSpace === 'nowrap'` ומספר
   השורות = 1. **ירוקה לפני ואחרי** — היא ההגנה מפני כלל רחב מדי.
3. **`UnsupportedCell — כתובית ארוכה נשברת`** — ‏`makeCell({ caption: LONG, contentType: 'LiveCell', contentSubType: 'Camera' })`,
   הכתובית היא `[data-testid=unsupported-cell] .caption`. **נכשלת על הבסיס.**

**אימות הקומיט:** להריץ את הקובץ לפני שינוי ה-CSS ו**להעתיק לגוף הקומיט את שורות
הכשל** של 1 ו-3. ‏🛑 בדיקה שלא ראית אדומה אינה בדיקה.

### קומיט 1 — כלל ה-CSS

**קבצים:** ‏`ButtonCell.svelte` · `UnsupportedCell.svelte` — **בלוק `<style>` בלבד.**

ב-`ButtonCell` להוסיף כלל **אחרי** `.caption` (ולא לשנות את `.caption` עצמו):

```css
/**
 * כתובית לבדה נשברת לשורות וממלאת את התא; כתובית **מתחת לסמל** נשארת שורה
 * אחת — וזו ההבחנה ש-`captionOnly` כבר עושה (GRID-GAPS §2).
 * `overflow-wrap` — לא-מאומת מול Grid: שבירה **בתוך מילה** לא נמדדה, והיא
 * כאן רק כדי שמילה בודדת ארוכה מ-התא לא תגלוש אופקית.
 */
.caption.caption-only {
	white-space: normal;
	overflow-wrap: break-word;
}
```

‏`text-overflow: ellipsis` נשאר בכלל הבסיס ונעשה חסר-תוקף במסלול העוטף (אין
גלישה בשורה אחת) — **לא להסיר אותו מ-`.caption`**, המסלול עם הסמל תלוי בו.

ב-`UnsupportedCell` — אותו שינוי על `.caption` שלו **במקום** `white-space: nowrap`
(אין לו מסלול-סמל, ולכן אין למה לגדר).

**אימות:** שלוש הבדיקות ירוקות · `CI=1 bunx vitest run` = ‏391 + 3 · `bun run check`
‏0 שגיאות · `bun run build` עובר.

---

## §5 — DoD

| # | בדיקה | איך |
|---|---|---|
| 1 | כל הבדיקות | `CI=1 bunx vitest run` — ‏394 עברו (‏391 + 3), ‏1 דולג |
| 2 | טיפוסים | `bun run check` — ‏0 שגיאות (האזהרה על `TileEditor` נשארת) |
| 3 | בילד | `bun run build` — יוצא 0 |
| 4 | אדום-לפני | גוף קומיט 0 מכיל את פלט-הכשל של בדיקות 1 ו-3 |
| 5 | רגרסיה — הכתובית אינה נגזרת אנכית | הבדיקה הקיימת בשם `הכותרת אינה נגזרת אנכית` עוברת על תא **בלי** סמל, כלומר היא במסלול שהשתנה. חייבת להישאר ירוקה |
| 6 | בעין | `bun run dev`, פתח `/grid`, לחץ על כפתור `org-3`, ‏screenshot של דף עם תאי-הנחיה. הכתובית נשברת ולא נחתכת |

## §5.1 — מה ה-DoD **אינו** טוען

- ‏**לא** נטען שהפריסה זהה ל-Grid. נמדד ש**נשבר**, לא כמה שורות, לא הריווח, לא הגודל.
- ‏**לא** נטען שכל 1,207 התאים הארוכים נבדקו. נבדק דפוס אחד בשני מסלולים.
- ‏`overflow-wrap: break-word` **אינו מעוגן במפרט** — הוא הכרעת-הבריף.

---

## §6 — סיכונים

| סיכון | מיטיגציה |
|---|---|
| גלאי-שורות שגוי (‏`getClientRects`) | נמדד ונדחה — ראו הטבלה בקומיט 0. ‏`height / lineHeight` בלבד |
| הכלל יזלוג לתא-עם-סמל | בדיקה 2 היא השער, והיא ירוקה גם לפני |
| ‏`lineHeight` מחרוזתי (`normal`) יפיל את החישוב | ‏`captionLineHeight` מוגדר ב-`VISUAL_DEFAULTS` ונמדד כ-`58.926px` — מספרי. אם `getComputedStyle` מחזיר `normal`, **עצור ודווח**, אל תמציא מקדם |
| ‏`bun install` יבנה מחדש דפדפני Playwright | הם כבר מותקנים במכונה; אם חסר — `bunx playwright install chromium` |

---

## §7 — עצור ודווח (‏`AskUserQuestion` אינו עובד — לכתוב בטקסט ולסיים תור)

- המפרט שותק על משהו שאתה צריך כדי להמשיך.
- בדיקה קיימת נשברת ולא הצלחת לתקן **בלי** לשנות את הטענה שלה.
- אתה רוצה לגעת בקובץ שאינו `ButtonCell.svelte` · `UnsupportedCell.svelte` ·
  ‏`visualFidelity.svelte.spec.ts`.
- ‏🛑 אתה מגיע למסקנה שדרוש שינוי ב-`ChatCell` או בפס-הפלט — **זה סלייס 15, לא שלך.**

## §8 — בסיום

קמט אחרי כל קומיט (‏עברית בהודעה). דוח ל-
`/home/user/Projects/brief-driven-slices/main/reports/aac-board/14-caption-wrap-eliezer.md`
— מה מומש · פלט השערים כפי שהוא · מה לא נבדק. ואז `notify_parent`.
**אל תמזג בעצמך** לענף-ההרצה; מרדכי ממזג.

## סטיות מהתכנון (‏ממלא המממש)

- ...
