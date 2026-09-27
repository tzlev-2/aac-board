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

### 🛑 280 מופעים בלי שום פרמטר — 56 מתוך 126 בלוחות-הדגימה

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

---

# סבב 2 — `NO-GO` באימות, ושני חוסמים (27.9.2026)

המבנה, הבדיכות והשערים הפורמליים תקינים: ‏104/104 עוברות, ‏`bun run check` נקי,
אין `switch` (רג'יסטרי אמיתי), נבדק בלי DOM, גבולות נשמרו, והערכים העבריים
(`gender=זכר`, ‏`number=יחיד`, ‏`person=גוף שלישי`, ‏`letter=א`) נשמרים **גלמיים**
בלי הנחת אנגלית. דוח הכיסוי מדפיס בדיוק
`9/63 פקודות (14.3%) · 3709/4052 הפעלות (91.5%)`.

🛑 **מה שמפיל: המודל של `Settings.RequiredFeature` שנתתי לך בבריף היה שגוי.**
מימשת אותו מילה-במילה, כולל `new Set([])`. התיקון בתכנון, לא באשמתך.

## חוסם 1 · `canActivate` מחמיץ 54% מהמופעים בלוחות-הדגימה

‏`commands.ts:246-253` עוצר בפקודה הראשונה שאינה שומר (`break` בשורה 249).
**סריקה של ארבעת הלוחות הארגוניים:**

| מקום השומר | תאים | מה לפניו |
|---|---:|---|
| בראש (שרשרת באורך 1) | 58 | — |
| **index 1** | **68** | `Settings.RestAll` (56) · `Jump.To` (10) · `Settings.ToggleMenu` (2) |

עבור 68 התאים `canActivate` מחזיר `true` והתא מוצג פעיל לגמרי. ‏`blockingGuard`
נשבר באותה צורה (`commands.ts:259`), ולכן גם ההסבר למה התא מעומעם לא יגיע.

🛑 **והבדיקה מקדשת את הבאג:** ‏`commands.test.ts:356-362` קובעת
`canActivate(late, ctx)).toBe(true)` עבור `[InsertText, RequiredFeature(EyeGaze)]`
— כלומר מאמתת במפורש את המקרה שהוא 54% מהמציאות. **למחוק ולהחליף.**

## חוסם 2 · `'halt'` הוא no-op על כל תא אמיתי — ובמקרה אחד מזיק

השומר הוא הפקודה **האחרונה ב-126 מתוך 126** המופעים בלוחות-הדגימה (‏3,888 מ-4,029
בחבילה). אין אחריו מה לעצור.

🛑 **והנזק:** בעשרה תאים `Jump.To` **מקדים** את השומר. המשתמש לוחץ, **הניווט
מתבצע**, ורק אז השומר מחזיר `'halt'` שאינו מבטל דבר.

## המבנה המתוקן

```ts
// שער — נקרא לפני הרינדור, סורק את כל השרשרת ללא תלות במקום
export function isCellAvailable(cell: Cell, features: ReadonlySet<FeatureId>): boolean

// הרצה — נקראת רק על תא זמין
commandRegistry['Settings.RequiredFeature'] = () => {};   // no-op
```

- **שנה את השם** מ-`canActivate` ל-`isCellAvailable`, והסמנטיקה לשער-רינדור.
- ‏`CommandResult = 'halt'` **נשאר בחוזה** (פקודות אחרות עשויות להזדקק לו) —
  אבל `Settings.RequiredFeature` אינה משתמשת בו.
- מופע **בלי פרמטר** = אין דרישה (56 מ-126 אצלנו). ‏`features.has(undefined)`
  היה מסתיר אותם בשקט.

## ראוי-תיקון · `WEB_FEATURES` ריקה שוללת מגע ומצביע

‏`features.ts:51` הוא `new Set([])`, בנאמנות לבריף השגוי. התכונות שנדרשות בפועל
בלוחות-הדגימה: ‏`EyeGazeAccess` 58 (נכון לשלול) · ללא-`feature` 56 ·
**`TouchAccess` 8** · **`PointerAccess` 2** · `SwitchAccess` 2.

‏`new Set(['TouchAccess', 'PointerAccess'])` — מה שדפדפן מספק ודאית.
‏`Dwell` (‏92.4% בחבילה, ‏0 אצלנו) יתווסף כשיהיה מימוש dwell-click; לרשום בהערה.

## הערה · `indicatorenabled` מושמט
מופיע ב-1,739 מ-1,739 המופעים של `Action.InsertText`. לא חוסם, אבל לתעד למה
מושמט במקום להשמיט בשקט.

## הערה · ריאקטיביות `output.items` — עובר לכאן מסלייס 4
‏`ChatCell.svelte:11` קורא `ctx.output.items` ב-`$derived`. ‏**`RuntimeContext`
שלך חייב לעטוף את המערך ב-`$state`**, אחרת פס-הפלט לא יתעדכן כשמריצים פקודות.
זו מלכודת מוכנה ואין מי שיתפוס אותה בבדיקות של אף אחד מהשניים.

## בדיקות חדשות נדרשות
שומר ב-index 1 אחרי `Settings.RestAll` → התא **אינו** זמין · שומר אחרון בשרשרת
באורך 3 → אינו זמין · שומר בלי פרמטר → **זמין** · `TouchAccess` ב-`WEB_FEATURES`
→ זמין · ‏`isCellAvailable` אינו תלוי במקום השומר · `output.items` ריאקטיבי.

## DoD
`bun run check` · `bun run test:unit --run` ירוקים · קומיט בעברית · לא לדחוף ולא למזג.
