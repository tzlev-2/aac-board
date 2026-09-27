# סלייס 5 — `commands-engine`: רג'יסטרי הפקודות, השומרים, וההקשר

**ענף:** `slice/commands-engine` · **בסיס:** `grid-clone` · **worktree:** `.worktrees/commands-engine`

## מה לבנות

| קובץ | תפקיד |
|---|---|
| `src/lib/gridset/commands.ts` | הרג'יסטרי + `executeCommands` |
| `src/lib/gridset/runtime.svelte.ts` | מימוש `RuntimeContext` (‏Svelte 5 runes) |
| `src/lib/gridset/features.ts` | `WEB_FEATURES` — קבוצת התכונות של קלון-ווב |
| `src/lib/gridset/coverage.ts` | דוח כיסוי: כמה פקודות מומשו מתוך 63 שבשימוש |

## 🔑 המבנה: רג'יסטרי, לא `switch`

`grid-reference/derived/commands.tsv` מונה **353 פקודות**; בלוחות שנותחו
בשימוש **63**. הוספת פקודה חייבת להיות **ערך במפה**, לא ענף בקוד —
54 הפקודות הנותרות ייכנסו אחרי הסבב הזה בלי לגעת במריץ.

## 🛑 פקודות-שומר — זה המנגנון שאסור לפספס

`Settings.RequiredFeature` (‏4,155 הפעלות, ‏126 בלוחות שלנו) **אינה מאפיין של
תא ואינה מתעדת כלום** — היא פקודה בשרשרת שתפקידה **לעצור אותה** כשהתכונה
אינה זמינה. לכן המריץ אינו `forEach`:

```ts
export function executeCommands(cell: Cell, ctx: RuntimeContext) {
  for (const inv of cell.commands) {
    const handler = commandRegistry[inv.id];
    if (!handler) { ctx.reportUnimplemented(inv.id); continue; }
    if (handler(inv.params, ctx) === 'halt') return;
  }
}
```

`Settings.RequiredFeature` מחזירה `'halt'` כש-`!ctx.features.has(params.feature)`.

**‏`features.ts`:** קלון-ווב אינו מחזיק `ComputerControl` ולא `EyeGaze`.
הקבוצה מוצהרת **במקום אחד** — לא נבדקת ad-hoc בתוך handler.

🔑 **נגזרת לרינדור:** תא ששרשרתו נפתחת בשומר שאינו מתקיים אמור להיראות
מעומעם ולא להיעלם. לחשוף `canActivate(cell, ctx): boolean` שבודק בדיוק את
הפקודות-שומר בראש השרשרת. בלי זה — **לוחות אמיתיים ייראו שבורים**
(סיכון #1 ב-`plan.md`).

## תשע הפקודות של הסבב — 91.5% מההפעלות

| פקודה | הפעלות | פרמטרים |
|---|---:|---|
| `Action.InsertText` | 1,736 | `text` (טקסט עשיר) · `gender` (ערכים **עבריים**: `זכר`) · `number` · `person` · `pos` · `showincelllabel` |
| `Jump.To` | 464 | `grid` = **שם הדף** (המפתח ב-`GridSet.pages`) |
| `Jump.Back` | 375 | — (מחסנית) |
| `Jump.Home` | 262 | — (`gridSet.startGrid`) |
| `Action.Clear` | 212 | — |
| `Action.Speak` | 212 | `movecaret` · `unit` (`All`…) |
| `Action.DeleteWord` | 204 | — |
| `Settings.RequiredFeature` | 126 | `feature` — **שומר** |
| `Action.Letter` | 118 | `letter` |

## 🔑 חוצץ-הפלט נושא דקדוק, לא מחרוזת

`Action.InsertText` מביאה `gender`/`number`/`person`/`pos`, ו-`WordListItem`
נושא `PartOfSpeech` (12,259) · `Number` (412) · `Person` (797). לכן
`ctx.output.items` הוא `OutputItem[]` — לא `string`.

חוקי הנטייה העברית הם `plan.md` שלב E **ואינם בסבב הזה**. אבל המודל נושא
את השדות מהיום, אחרת כל מימוש נטייה עתידי יידרש לשכתב את החוצץ.

## דיבור
לעבור דרך `src/lib/services/tts.ts` הקיים. 🛑 הוא מקבל מחרוזת; טקסט עשיר
מצטמצם אליו כאן (שרשור ה-`runs`). **לא לשנות את חוזה `tts.ts`** — הרחבתו
לשני ערוצים (ציבורי ומשוב-פרטי) היא סלייס נפרד.

## מדיניות פקודה לא-ממומשת
`ctx.reportUnimplemented(id)` — נצבר, מודפס פעם אחת לכל מזהה בפיתוח,
**לעולם לא זורק ולא שותק**. ‏`coverage.ts` מפיק את המדד.

## בדיקות
‏`commands.ts` חייב להיבדק **בלי DOM** — ‏`RuntimeContext` מזויף (fake).
שרשרת שנעצרת בשומר · שרשרת שממשיכה כשהתכונה קיימת · `Jump.Back` על מחסנית
ריקה אינו קורס · `Action.InsertText` שומרת דקדוק · פקודה לא-מוכרת נספרת
וממשיכה · תשע הפקודות, כל אחת בדיקה.

## קריטריון קבלה
`bun run test:unit` · `bun run check` ירוקים · דוח כיסוי מדפיס 9/63.

## מחוץ להיקף
מנועי WordList ו-Prediction · נטייה עברית · סריקה · ‏54 הפקודות הנותרות ·
קומפוננטות (סלייס 4) · פרסור (סלייס 2).
