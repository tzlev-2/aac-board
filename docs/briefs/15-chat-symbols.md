# סלייס 15 — סמל מעל מילה בפס-הפלט (פער 3)

**ענף:** `slice/15-chat-symbols` · **בסיס:** `integration/run-grid-gaps-23` (`e09fdc7`)
**מפרט:** `tzlev-docs-repo/aac-board/GRID-GAPS.md` §3 · **פקודת-משימה:** `plans/missions/grid-gaps-23.md`
**מורכבות:** 5/10 (‏קומפוננטה חדשה · פתירה אסינכרונית · משמרים חוזה-טקסט) · **תלויות:** אין
**שער כניסה שנמדד לפני כתיבת הבריף:** ‏391 עברו · 1 דולג · ‏`bun run check` ‏0 שגיאות
(‏אזהרה קיימת ב-`TileEditor.svelte` — **בבסיס, לא לתקן**).

---

## §0 — הרצה

```bash
cd /home/user/Projects/aac-board-app
git worktree add .worktrees/15-chat-symbols -b slice/15-chat-symbols integration/run-grid-gaps-23
cd .worktrees/15-chat-symbols
bun install
```

```bash
# 🛑 בדיקות **לא** ב-tmux — TTY מפעיל watch mode והסשן לא נגמר.
CI=1 bunx vitest run
CI=1 bunx vitest run --project client src/lib/components/gridset/wiring.svelte.spec.ts
bun run check
bun run build
```

**קריאה לפני התחלה (חובה):**
- ‏`src/lib/components/gridset/ChatCell.svelte` — ‏55 שורות, כולו.
- ‏`src/lib/components/gridset/WordListCell.svelte` — ‏**זו התבנית.** הוא מסנתז
  תא-נגזר מפריט ומעביר לפותר-הסמלים הרגיל. אתה עושה את אותו דבר לכל פריט-פלט.
- ‏`src/lib/components/gridset/ButtonCell.svelte` — ה-`$effect` שפותר סמל לתא בודד,
  וכלל ה-`alt`. **העתק את שניהם, אל תמציא.**
- ‏`SymbolResolver` ב-`src/lib/gridset/symbols.ts` — החוזה `resolve(cell)` והערות
  ה-`perCell` / `blobUrls`.
- ‏`OutputBuffer` ב-`src/lib/gridset/runtime.svelte.ts` — הגטר `text` ו-`appendToStream`.
- ‏`src/lib/components/gridset/visualFidelity.svelte.spec.ts` — ‏`fakeSymbols` ו-`PIXEL`
  (פותר מזויף, בלי רשת ב-CI). **זה הפותר שבדיקות הסלייס משתמשות בו.**

---

## §1 — המטרה

מי שאינו קורא — קהל-היעד — בונה משפט ורואה **את הסמלים שלחץ** מעל המילים בפס
העליון, ולא רק שורת טקסט. האישור החזותי שהלחיצה נכנסה חוזר.

---

## §2 — Scope

| | בפנים | בחוץ |
|---|---|---|
| ‏`OutputItem.image` מצויר מעל הטקסט של אותו פריט | ✅ | — |
| הפריטים נשארים **שורה אחת** שגולשת-נחתכת כמו היום | ✅ | — |
| **פריסת** הסמל — יחס, ריווח, גודל | 🛑 מסומן `לא-מאומת מול Grid` | ❌ לא נמדד |
| סמן-הכתיבה בסוף הפס | — | ❌ לא בהיקף |
| פריט **בלי** `image` | — | ❌ **לא** לשלוף לו סמל מ-ARASAAC לפי הכתובית. טקסט בלבד |
| ‏`<ShowSymbols>` (פער 9) | — | ❌ ראו §2.1 |
| ‏`ChatCell` — כיווץ רצף-הרווחים | — | ❌ **מכוון. אל תסיר** |
| כתובית-תא (`ButtonCell`) | — | ❌ סלייס 14 |

### §2.1 — ‏`ShowSymbols`: נבדק, ואינו תנאי כאן

‏`grep -rni showsymbols src/` מחזיר **אפס** — התגית אינה נקראת באף מקום במודל,
וגם לא ב-`parseSettings`. לכן הסמל בפס-הפלט **אינו מגודר בה**, ואין מה להכריע:
ממשים ללא-תנאי. המפרט (§9 שם) אומר שמשמעות התגית דורשת Grid חי, ו-Grid חסום.
🛑 **אל תוסיף ניתוח של התגית, שדה במודל, או דגל.** אם אתה משוכנע שאי-אפשר
לממש בלעדיה — **עצור ודווח**, זה גבול-היקף מפורש בפקודת-המשימה.

---

## §3 — הארכיטקטורה

```
ChatCell.svelte                    ← משתנה: מחרוזת אחת ⇒ רשימת שבבים
  ├─ ctx.output.items  (OutputItem[])
  ├─ derived: parts = [{ text, lead, image }]   ← חוזה-הטקסט נשמר כאן
  └─ {#each parts} → ChatChip.svelte            ← חדש
                       ├─ תא-נגזר { ...cell, caption: text, image, commands: [] }
                       ├─ symbols.resolve(תא-נגזר)   ← אותו פותר, אותו $effect כמו ButtonCell
                       └─ <img> מעל <span class="word">
commands.ts                        ← משתנה: **הערה בלבד**, אזהרה שהופרכה נמשכת
```

---

## §4 — 🛑 החוזה שאסור לשבור: מה שנראה = מה שנאמר

‏`OutputBuffer.text` (מה ש-`Action.Speak` מקריא) ו-`ChatCell` מחשבים **את אותה
מחרוזת בדיוק**: `map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()`.
שתי בדיקות קיימות משוות `textContent` **מדויק** (‏`toBe`, לא `toHaveTextContent`
שמנרמל): ‏`'1 + 2'` ו-`'1 +'` ב-`describe` של "סלייס 11". פיצול ל-`<span>`-ים
מאיים עליהן ישירות — צומת-טקסט אחד שדולף מה-markup הורג אותן.

**🔑 השקילות שמצילה אותן, ונמדדה ב-probe:** "לאחד ב-`' '` ואז לכווץ רצפים" שקול
ל"לכווץ ולגזום כל פריט לחוד, ולאחד את הלא-ריקים ברווח אחד" — שני הביטויים הם
`tokens.join(' ')`. לכן ה-`derived` הוא:

```ts
// נמדד ב-probe על הבסיס: [{'1'},{' + ', img},{'2'}] → textContent === '1 + 2',
// ו-[{'שמלה', img},{'', img},{'כובע'}] → 'שמלה כובע' (פריט בלי טקסט אינו מוסיף רווח).
const parts = $derived.by(() => {
    let emitted = false;
    return ctx.output.items.map((item) => {
        const text = item.text.replace(/\s+/g, ' ').trim();
        const lead = Boolean(text) && emitted;
        if (text) emitted = true;
        return { text, lead, image: item.image };
    });
});
```

ובמארקאפ — ‏🛑 **גוף ה-`{#each}` בשורה אחת, בלי רווח או שורה חדשה בין הצמתים.**
הרווח המפריד הוא **ביטוי** (`{SPACE}` כאשר `const SPACE = ' '`), לא רווח-מארקאפ:

```svelte
<span class="output-text">{#each parts as part}{#if part.lead}{SPACE}{/if}<ChatChip ... />{/each}</span>
```

נמדד ב-probe: בצורה הזאת `textContent` יוצא **מדויק**. אם בכל זאת דולף רווח —
**לשנות את המארקאפ, לא את הטענה בבדיקה.**

---

## §5 — קומיטים בסדר

### קומיט 0 — בדיקות אדומות (approach: tdd)

**קובץ חדש:** ‏`src/lib/components/gridset/ChatCell.svelte.spec.ts` (‏`*.svelte.spec.ts`
⇒ פרויקט `client`, דפדפן אמיתי). מרנדר את `ChatCell` ישירות עם `ctx` מזויף שבו
‏`output.items` מאוכלס, ועם `fakeSymbols` (העתק מ-`visualFidelity.svelte.spec.ts`).
ארבע בדיקות:

1. **`🔑 פריט עם image מקבל <img> מעל המילה`** — פריט `{ text: 'שמלה', image: { library: 'widgit', path: 'dress.emf' } }`.
   יש `<img>` אחד בתוך `[data-testid=chat-cell]`, וה-`top` שלו קטן מזה של המילה.
2. **`פריט בלי image נשאר טקסט חשוף גם כשיש פותר`** — אין `<img>` כלל. (ההגנה
   מפני שליפת-ARASAAC לפי כתובית — מחוץ להיקף.)
3. **`🛑 textContent מדויק — כיווץ הרווחים נשמר`** — פריטים `['1', ' + ', '2']`
   כשלשני הראשונים יש `image` ⇒ `textContent` **בדיוק** `'1 + 2'`.
4. **`פריט בלי טקסט אינו מוסיף רווח`** — `['שמלה', '', 'כובע']` ⇒ `'שמלה כובע'`.

**קובץ שמשתנה:** ‏`wiring.svelte.spec.ts` — בדיקה אחת נוספת ל-`describe` הקיים
של הפרוסה האנכית: לוחצים שתי מילים, לוחצים על תא **"דבר"**, ומשווים
`chat-cell.textContent` ל-`spoken.at(-1)`. **זה החוזה מ-§4 כבדיקה** — מה שנראה
זהה למה שנאמר. אל תיגע בשתי הבדיקות של "סלייס 11", הן השער.

**אימות:** 1, 3, 4 חייבות להיכשל על הבסיס (אין `<img>`, אין שבבים) — **להעתיק את
פלט-הכשל לגוף הקומיט.** ‏2 ו-5 ירוקות מההתחלה.

### קומיט 1 — `ChatChip.svelte`

**קובץ חדש:** ‏`src/lib/components/gridset/ChatChip.svelte`. חתימה — **אסור לשנות**:

```ts
// $props()
{
    text: string;
    image: ImageRef | undefined;
    /** התא האמיתי של פס-הפלט — הבסיס לתא-הנגזר (סגנון, span). */
    cell: Cell;
    symbols?: SymbolResolver | null;
}
```

- תא-נגזר, **בדיוק כמו `WordListCell`**: `{ ...cell, caption: text, image, commands: [] }`.
  ‏🛑 `commands: []` **חובה** — ‏`collectImageRefs` סורק פרמטרי-פקודות של התא, ופס-הפלט
  נושא שרשראות שאינן שייכות לפריט.
- פותר **רק כשיש `image`**. אין `image` ⇒ אין קריאה לפותר ואין `<img>`.
- ה-`$effect` והביטול-בניקוי — העתקה מ-`ButtonCell`, כולל ה-`cancelled`.
- ‏`alt` — אותו כלל כמו ב-`ButtonCell`: יש טקסט ⇒ `''` · אין ⇒ `resolution.keyword ?? ''`.
- ‏`data-testid="chat-chip"` על העוטף, `class="word"` על ה-`<span>` של הטקסט.
- ‏🛑 גוף המארקאפ **בשורה אחת** בלי רווחים בין צמתים (§4).
- ‏CSS: השבב `inline-flex` · `flex-direction: column` · `align-items: center` ·
  ‏`vertical-align: middle`; התמונה `block-size: 2em; inline-size: auto; object-fit: contain`
  עם הערה **`לא-מאומת מול Grid — הפריסה לא נמדדה`** (פקודת-המשימה §3.2).

### קומיט 2 — `ChatCell` עובר לשבבים

**קובץ שמשתנה:** ‏`ChatCell.svelte`. ה-`derived` מ-§4 במקום `const text`, וה-`{#each}`
במקום `{text}`. **נשאר בלי שינוי:** ‏`data-testid="chat-cell"` · `role="status"` ·
‏`padding-inline` · `.chat-cell` · ‏`.output-text` עם `white-space: nowrap; overflow: hidden;
text-overflow: ellipsis; width: 100%` (הפס הוא שורה אחת; ריבוי-שורות לא נמדד).

‏`symbols = null` נוסף ל-`$props()` — הוא **כבר מועבר** מ-`GridCell` לכל מרנדר, ChatCell
פשוט התעלם ממנו.

🛑 **ההערה על כיווץ-הרווחים נשארת בקובץ** ומקבלת שורה שמסבירה שהכיווץ עבר
ל-`parts` ומדוע הוא שקול (§4). **אל תמחק את הנימוק של סלייס 11.**

**אימות:** ‏`CI=1 bunx vitest run` — הכול ירוק, כולל שתי בדיקות "סלייס 11" ללא שינוי.

### קומיט 3 — משיכת האזהרה שהופרכה ב-`commands.ts`

**קובץ שמשתנה:** ‏`src/lib/gridset/commands.ts`, ב-handler של `'Action.InsertCellText'`.
‏grep anchor: `לא-מאומת מול Grid` בתוך אותו handler.

המפרט (§3, "נגזרת") קובע שהצילום `eng-02` מודד שחלל-העבודה **כן** מציג
סמל-מעל-מילה, ולכן האזהרה "האם Grid מציג אותו בחלל-העבודה לא נמדד" הופרכה.
‏`60-system-claims` דורש למשוך אזהרה שהופרכה **בגוף**, לא רק להפסיק לחזור עליה.
להחליף את בלוק ה-`⚠️` בזה:

```ts
// ✅ **עודכן — פס-הפלט אכן מציג סמל-מעל-מילה** (GRID-GAPS §3: צילום `eng-02`,
// סמל חצאית וסמל שמלה מעל השורה). האזהרה שהייתה כאן — "האם Grid מציג אותו
// בחלל-העבודה לא נמדד" — **נמשכת**, וזו הראיה ששללה אותה.
// 🛑 מה שנשאר לא-מאומת צר יותר: שהסמל שנכנס לפריט הוא זה של **התא**
// (`CaptionAndImage/Image`) ולא אחר. הנזק אם זו טעות נשאר סמל עודף בשבב.
```

**אימות:** ‏`bun run check` ‏0 שגיאות (הערה בלבד; אם משהו נשבר — שינית קוד).

---

## §6 — DoD

| # | בדיקה | איך |
|---|---|---|
| 1 | כל הבדיקות | `CI=1 bunx vitest run` — ‏391 + 5 חדשות, ‏1 דולג |
| 2 | שתי בדיקות "סלייס 11" **לא שונו** | `git diff integration/run-grid-gaps-23 -- src/lib/components/gridset/wiring.svelte.spec.ts` — רק **תוספת** |
| 3 | טיפוסים | `bun run check` — ‏0 שגיאות |
| 4 | בילד | `bun run build` — יוצא 0 |
| 5 | אדום-לפני | פלט-הכשל של בדיקות 1/3/4 בגוף קומיט 0 |
| 6 | בעין | `bun run dev` → `/grid` → לחץ `org-3` → לחץ שני תאים עם סמל. screenshot של הפס העליון: סמל מעל כל מילה |
| 7 | ‏`ShowSymbols` לא נגע | `grep -rni showsymbols src/` — עדיין אפס |

## §6.1 — מה ה-DoD **אינו** טוען

- ‏**לא** נטען שהפריסה זהה ל-Grid: לא היחס, לא הריווח, לא הגודל. נמדד ש**קיים** סמל
  ושהוא **מעל** המילה.
- ‏**לא** נטען שכל 3,472 תאי ה-Chat נבדקו — נבדק דפוס.
- ‏**לא** נטען ששיעור-הפתירה בפס-הפלט גבוה: ‏4 מכל 10 סמלים אינם נפתרים (ראו
  ההערות ב-`symbols.ts`), ופריט שסמלו לא נפתר נראה **בדיוק כמו היום**. זה המסלול
  הראשי ולא מצב-שגיאה.
- ‏**לא** הוכרע מה `<ShowSymbols>` עושה.

---

## §7 — סיכונים

| סיכון | מיטיגציה |
|---|---|
| רווח שדולף מה-markup הורג `toBe('1 + 2')` | ‏§4: גוף `{#each}` בשורה אחת + `{SPACE}` כביטוי. נמדד ב-probe שזה עובד |
| ‏`perCell` הוא `WeakMap` על אובייקט-התא — תא-נגזר חדש בכל רינדור ⇒ פתירה חוזרת | זה **קיים כבר** ב-`WordListCell`, ו-`blobUrls`/`inFlight`/הקאש סופגים. אין רשת בבדיקות (פותר מזויף). לא לבנות קאש חדש |
| מונה ה-`stats` ייספר פעמיים לאותו פריט | אותה תופעה קיימת ב-`WordListCell`. **לא בהיקף** — לא לגעת ב-`stats` |
| ‏`text-overflow: ellipsis` לא יעבוד עם ילדים `inline-flex` | לא נמדד ב-Grid ולא בהיקף. להשאיר את ההצהרה |
| ‏RTL — סדר השבבים | פריסה **inline** (לא flex על העוטף) ⇒ הסדר נגזר מכיוון-הכתיבה מעצמו. ‏🛑 אל תוסיף `row-reverse` |
| ‏`<img>` בלי `alt` ייפול ב-`bun run check`/eslint | כלל ה-`alt` בקומיט 1 מחייב תמיד מחרוזת |

---

## §8 — עצור ודווח (‏`AskUserQuestion` אינו עובד — לכתוב בטקסט ולסיים תור)

- כדי לעבור שער אתה צריך לשנות טענה בבדיקה קיימת.
- אתה מסיק שדרוש שדה חדש במודל (‏`ShowSymbols`, דגל בפס-הפלט) — ‏§2.1.
- אתה רוצה לגעת ב-`symbols.ts`, ב-`runtime.svelte.ts` או ב-`types.ts`. **אין בהם צורך**:
  ‏`OutputItem.image` כבר קיים ומאוכלס בשלושה מסלולים, והפותר מקבל `Cell`.
- המפרט שותק על משהו שחוסם אותך.

## §9 — בסיום

קמט אחרי כל קומיט (עברית). דוח ל-
`/home/user/Projects/brief-driven-slices/main/reports/aac-board/15-chat-symbols-eliezer.md`
— מה מומש · פלט השערים כפי שהוא · מה לא נבדק. ואז `notify_parent`.
**אל תמזג בעצמך**; מרדכי ממזג.

## סטיות מהתכנון (‏ממלא המממש)

- ...
