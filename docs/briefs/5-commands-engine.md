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

## 🛑 `Settings.RequiredFeature` — תוקן 27.9.2026, וזו **אינה** פקודת-שומר

הגרסה הראשונה של הבריף הזה טעתה. **נמדד ישירות מ-116 קובצי `.gridset`**
ב-`~/work/grid-mapping/raw/` (הם קיימים — ראו תכנון §6):

| מיקום בשרשרת | מופעים | % |
|---|---:|---:|
| **אחרונה** | **4,014** | **96.6%** |
| לפני-אחרונה | 78 | 1.9% |
| ראשונה | 57 | 1.4% |

השרשרת הנפוצה (‏2,529): ‏`Settings.RestEyeGaze · Settings.RestPointer ·
Settings.RestSwitch · Settings.RequiredFeature`.

🔑 **זו הצהרת-דרישה של התא בתחביר של פקודה.** היא אחרונה, ולכן אין לה מה
לעצור. ההשפעה היא **בזמן רינדור**: תא שדרישתו אינה מתקיימת **אינו מצויר אך
שומר את משבצתו**.

**מה זה אומר למימוש:**

```ts
// המנגנון המרכזי — שער רינדור
export function isCellAvailable(cell: Cell, features: ReadonlySet<FeatureId>): boolean
```

‏`executeCommands` **כן** מכבד `'halt'` (זול, ו-57 המופעים בראש אמיתיים) —
אבל אל תציג את זה כמנגנון העיקרי, ואל תקרא לו `canActivate` כאילו הוא שער
הפעלה. **שנה את השם ל-`isCellAvailable` ואת הסמנטיקה לשער-רינדור.**

🛑 **וזה אינו `Visibility`** — ‏`Cell/Visibility` הוא אלמנט נפרד (1,555).

### `WEB_FEATURES` — ההנחה הראשונה הייתה הפוכה

‏12 ערכי `feature`, רשימה סגורה שנמדדה, כבר ב-`types.ts`. ‏**`Dwell` הוא
3,581 מהמופעים — 92.4%** ו-`ComputerControl` הוא 65 (‏1.7%).

🛑 הבריף הקודם אמר "קלון-ווב אינו מחזיק `ComputerControl` ולא `EyeGaze`" —
הציטוט ההוא בא מ-`derived/commands.tsv`, שבו `sample_param_values` הוא **דגימה
אלפביתית** (`parse_gridsets.py:138`: ‏`sorted(v)[0]`) ולא הערך הנפוץ. בפועל רוב
המופעים הם `Dwell`, שהוא **כן** ניתן למימוש בווב.

**`WEB_FEATURES` בסבב הזה:** ‏`new Set(['TouchAccess','PointerAccess'])` — מה
שדפדפן מספק ודאית. ‏`Dwell` יתווסף כשיהיה מימוש dwell-click; לרשום זאת בהערה.

### 🛑 280 מופעים בלי שום פרמטר — 56 מתוך 126 בלוחות שלנו

`<Command ID="Settings.RequiredFeature" />` בלי `<Parameter>` בכלל. מימוש תמים
כותב `features.has(undefined)`, מקבל `false`, ו**מסתיר 56 תאים בשקט**.

**הוכרע: מופע בלי פרמטר = אין דרישה** (התא זמין), ‏+ `reportUnimplemented`
כדי שזה יהיה נראה. חייבת להיות בדיקה על זה.

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
| `Settings.RequiredFeature` | 126 | `feature` — **הצהרת-דרישה, ראו למעלה** |
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

`isCellAvailable`: תכונה מתקיימת → זמין · אינה מתקיימת → לא זמין ·
**בלי פרמטר → זמין** (ולא מוסתר) · ‏`RequiredFeature` אחרונה בשרשרת אינה
מונעת מהפקודות שלפניה לרוץ.

`executeCommands`: ‏`'halt'` עוצר את מה שאחריו (57 המופעים שבראש) ·
`Jump.Back` על מחסנית ריקה אינו קורס · `Action.InsertText` שומרת דקדוק ·
פקודה לא-מוכרת נספרת וממשיכה · תשע הפקודות, כל אחת בדיקה.

## קריטריון קבלה
`bun run test:unit` · `bun run check` ירוקים · דוח כיסוי מדפיס 9/63.

## מחוץ להיקף
מנועי WordList ו-Prediction · נטייה עברית · סריקה · ‏54 הפקודות הנותרות ·
קומפוננטות (סלייס 4) · פרסור (סלייס 2).
