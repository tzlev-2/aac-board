# סלייס 10 — `autocontent-activate`: להפוך את תאי ה-`WordList` ללחיצים

**ענף:** `slice/autocontent-activate` · **בסיס:** `grid-clone`

## הפער, בניסוח המשתמש
המשתמש צילם את דף `בגדים` ב-Grid מול הקלון וראה ‏**‏11 תאים ריקים**.
סלייס 9 מילא אותם במילים. ‏**הם עדיין לא לחיצים.**

## המדידה — בבילד, על `org-1/בגדים`
לחיצה על "שמלה": ‏**התא אינו `<button>` כלל**, ושום דבר לא קורה.

```
תאי WordList: 11        פקודות על התא:  — ריק —  (11 מ-11)
AutoContentCommands של הדף:  [WordList] → ['AutoContent.Activate']
```

🔑 **הפקודה יושבת ברמת הדף.** ‏`GridCell.svelte` מחשב
`interactive = cell.commands.length > 0`, ותא-`WordList` **ריק בכוונה** —
ולכן נופל החוצה. ‏`parse.ts` **כבר טוען** את `page.autoContentCommands`;
**אף אחד לא קורא אותו.**

**היקף:** ‏`AutoContent.Activate` היא **‏158 הפעלות** בלוחות-הדגימה
(‏3,342 בקורפוס) ו**הפקודה השמינית בשכיחות**. היא המנגנון שמפעיל
**‏2,025 תאי `AutoContent`**.

## מה לממש

### 1 · תא `AutoContent` שואב פקודות מהדף
```
cell.commands ריק  ∧  cell.contentType === 'AutoContent'
   ⇒ page.autoContentCommands[cell.contentSubType]
```
🛑 **לא לדרוס `cell.commands`** — התא עשוי לשאת פקודות משלו, ואז הן גוברות.
‏⚠️ **המפתח הוא `AutoContentType`**, וב-`בגדים` הוא `WordList`. בדפים אחרים
יש `Chat.History`, ‏`Contacts.Contacts` ועוד — **לא רק `WordList`.**

### 2 · `AutoContent.Activate` — handler
מכניסה את **הפריט של התא** לפס-הפלט.
🔑 **`OutputItem` נושא דקדוק** — ‏`gender`/`number`/`person`/`pos` מה-
`WordListItem`. **לא מחרוזת.**
🛑 **היא אינה נוגעת בעימוד** (`wordlist-overflow.md` §7). תא-הניווט מטופל
ב-`GridBoard` ואינו עובר דרך כאן.

### 3 · `coverage.ts` — שלוש רמות
היום סופר **רמת-תא בלבד**: ‏63 מזהים, ‏4,052 הפעלות. מחוץ לטווח:
`/Grid/AutoContentCommands/…` (‏**‏166**) ו-`/Grid/Commands` (‏4).
🛑 **המדד יכול לטפס ל-100% בזמן ש-33.7% מהתאים מתים.** לתקן את המכנה.

## 🛑 מה שאסור
- **אל תיגע בעימוד** (`wordListPager.ts`) — נמדד ועובד.
- **אל תממש** `Chat.History`/`Contacts`/`Prediction` — רק הצינור הגנרי
  ו-`Activate`. סוגים אחרים ייפלו ל-`UnsupportedCell` כמו היום.
- **אל תיגע** ב-`Board.svelte` · `Tile.svelte` · `OutputBar.svelte` ·
  `types/board.ts` · `routes/s/…`.

## קריטריון קבלה — צילום ומספרים, לא בדיקות

🛑 **פריוויו רק מ-build.** ‏🛑 **פורטים 4000 · 4173 תפוסים** — קח אחר, שמור
PID, הרוג רק את שלך. ‏🛑 tmux `aac-tunnel` — לא לגעת.

⚠️ ‏`setInputFiles` **אינו מפעיל** את מטפל ה-`change`. נדרש אחריו
`page.evaluate(() => document.querySelector('input[type=file]').dispatchEvent(new Event('change',{bubbles:true})))`,
עם ~1.5ש לפני ואחרי.

**‏5 דפים לפחות**, ובהם `בגדים` (‏11⇄11) · `בגדים - עוד` (גלישה) · ודף
שרובו `AutoContent`. לכל דף:
1. **כמה תאים מצוירים, וכמה מהם `<button>`** — היעד: ‏**כולם**.
2. לחיצה על 4 מילים → **המשפט בפס-הפלט**, עם הטקסט המדויק.
3. ‏`coverage` מדפיס — **כמה מ-`org-1` מכוסה בשלוש רמות.**
4. **צילום של הדף הגרוע.**

🛑 **בלי לקשט.** נשאר תא לא-לחיץ — **זה הדיווח**.

## DoD
`bun run check` · `bun run test:unit --run` ירוקים · בדיקה שתא-`WordList`
בלי פקודות **כן** לחיץ · קומיט בעברית. **לא לדחוף, לא למזג.**
‏🛑 `AskUserQuestion` אינו עובד — נתקעת, כתוב בטקסט וסיים את התור.
