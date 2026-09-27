# סלייס 1 — `gridset-fixture`: מחולל ‏.gridset סינתטי

**ענף:** `slice/gridset-fixture` · **בסיס:** `grid-clone` · **worktree:** `.worktrees/gridset-fixture`

## למה זה קיים

🛑 **אין אף קובץ `.gridset` על המכונה.** ה-TSV-ים תחת
`tzlev-docs-repo/aac-board/grid-reference/derived/` הם התוצר של ניתוח שנעשה
במקום אחר; המקור אינו כאן, ולא יגיע בסבב הזה. בלי fixture סינתטי אי אפשר
לבדוק את הפרסר — ולכן זה הסלייס הראשון.

‏`*.gridset` נמצא ב-`.gitignore` (תוכן Smartbox מורשה). ה-fixture הסינתטי
נבנה **בקוד**, לא כקובץ בינארי בריפו.

## מה לבנות

`src/lib/gridset/__fixtures__/buildGridset.ts`:

```ts
export function buildGridset(spec: GridsetSpec): Uint8Array   // ZIP בזיכרון (fflate)
```

מבנה ה-ZIP לפי הקובץ האמיתי:
```
Settings0/settings.xml
Settings0/Styles/styles.xml
Grids/<שם הדף>/grid.xml
```

`src/lib/gridset/__fixtures__/fixtures.ts` — fixtures בעלי-שם, כל אחד מכוון
למלכודת ידועה:

| fixture | מה הוא מכסה |
|---|---|
| `minimal` | דף אחד 2×2, שני תאים, ‏`Jump.To` ו-`Action.InsertText` |
| `orgHome` | ‏6×4, ‏21 תאים מוגדרים ו-20 מלאים — מידות אמיתיות של `דף ראשי` מ-`pages.tsv` |
| `spans` | ‏`ColumnSpan`/`RowSpan` גדולים לצד רשת אחידה |
| `sparseCoords` | תאים **בלי** מאפיין `X` ו/או `Y` (ברירת מחדל 0) |
| `richTextShapes` | שלוש הצורות: `Text/p/s/r` · `Text/s/r` · `Text/r` |
| `styleTwoLevel` | סגנון נקוב שטוח ב-`StyleData` + `BasedOnStyle` על התא + עקיפות מקומיות. 🛑 **לא שרשרת** — ראו תכנון §5 |
| `contentTypes` | תא `Workspace/Chat` · `AutoContent/WordList` · `LiveCell` · `ContentSubSubType` |
| `guarded*` | 🛑 **שוכתב בסבב 3 — ראו למטה.** שלושה fixtures, לא אחד |
| `visibility` | `Hidden` · `Disabled` · `PointerAndTouchOnly` |
| `nilCaption` | `<CaptionAndImage nil="true" />` — ‏30,251 מופעים בנתונים האמיתיים |
| `pageEngines` | דף עם `<WordList>` מאוכלס ו-`<PredictionSource>WordListAndPredictor` |
| `autoContent` | ‏`AutoContentCommands` ברמת הדף עם `AutoContentType="Chat.History"` |

## עוגני-אמת — לבנות לפי הסכמה, לא לפי הדמיון

שני מקורות, בסדר הזה:
1. **הקובץ האמיתי** — `~/work/grid-mapping/raw/org-1.gridset`. ‏ZIP; פתח וקרא.
2. `~/Projects/tzlev-docs-repo/aac-board/grid-reference/derived/gridset-schema.tsv`
   (‏199 שורות: נתיב · מאפיין · שכיחות · ערכי-דוגמה).

🛑 **אל תסתמך על העמודה `sample_param_values` ב-`commands.tsv`** — היא **דגימה
אלפביתית** (`parse_gridsets.py:138`: `sorted(v)[0]`), לא הערך הנפוץ. היא הטעתה
את התכנון פעם אחת כבר היום.

🛑 **צבעים הם `#RRGGBBAA` — אלפא בסוף**, לא בהתחלה.
🛑 **`X=0` הוא התא הימני.** ה-fixture כותב קואורדינטות כמו Grid; ההיפוך הוא
עניין של הרינדור, לא של הנתונים.

## קריטריון קבלה

- ‏`bun run test:unit` ירוק: לכל fixture בדיקה ש-`buildGridset` מפיק ZIP
  שנפתח ומכיל את שלושת סוגי הקבצים, וש-XML-ים תקינים (‏`DOMParser` בלי
  `parsererror`).
- ‏`bun run check` ירוק.
- קובץ `__fixtures__/README.md` קצר: איזה fixture לאיזו מלכודת.

## מחוץ להיקף

פרסור (סלייס 2) · פתירת סגנונות (סלייס 3) · רינדור · כל קובץ מחוץ ל-`src/lib/gridset/__fixtures__/`
פרט להוספת `fflate` ל-`package.json`.


---

# סבב 3 — `NO-GO`, ושורש הבעיה הוא הבריף הזה (27.9.2026)

‏69 בדיקות ירוקות, ‏`check` נקי, גבולות נשמרו, ההשוואה המבנית מול `org-1`
בוצעה. **ובכל זאת ה-fixture מייצר צורה שאינה קיימת בנתונים.**

🛑 **וזו אשמתי, לא שלך.** הקומיט `ff31bbf` תיקן את `gridset-core-design.md`
§1 ואת `types.ts`, אבל **בבריף הזה הוא נגע רק במקטע "עוגני-אמת"**. שורה 42
נשארה *"תא ששרשרתו **נפתחת** ב-`Settings.RequiredFeature`"*. יישמת בריף
נאמנה; הבריף היה מיושן.

## 1 · 🔴 ‏`guarded` מייצר 0%, ומחסיר את ה-100%

נמדד על `org-1..4`:

| | מופעים |
|---|---:|
| ‏`Settings.RequiredFeature` בשרשרות תא | 126 |
| **אחרונה בשרשרת** | **126 (100%)** |
| שרשרת באורך 1 (לבדה) | 58 |
| ב-index 1 (מהם 56 אחרי `Settings.RestAll`) | 68 |
| **ראשונה ואחריה עוד פקודה** | **0** |

‏`fixtures.ts:256-259` מייצר `[Settings.RequiredFeature, Action.Speak]` —
השורה התחתונה. בכל 116 הקבצים היא 57 מ-4,130 (‏1.4%); בלוחות-הדגימה **אפס**.

**שלושה fixtures במקום אחד:**

| שם | צורה | למה |
|---|---|---|
| `guardLast` | `[Action.InsertText, Settings.RequiredFeature feature=EyeGazeAccess]` | ‏126/126 — הצורה האמיתית |
| `guardAfterRest` | `[Settings.RestAll, Settings.RequiredFeature feature=TouchAccess]` | ‏56 מ-126, התבנית הנפוצה ביותר |
| `guardNoParam` | `<Command ID="Settings.RequiredFeature" />` **בלי `<Parameter>`** | ‏**56 מ-126 (44%)** — §1 מכריע עליהם במפורש, ואין להם fixture |

🛑 **ערכי `feature`:** ‏`ComputerControl` הוא 0 בלוחות-הדגימה. שם קיימים
`EyeGazeAccess`(58) · `TouchAccess`(8) · `SwitchAccess`(2) · `PointerAccess`(2),
ו-`Dwell` הוא 3,581 (‏92.4%) בכלל החבילה. השתמש באלה.

**ומחק את שם-הבדיקה** ב-`buildGridset.svelte.spec.ts:96` (*"נמצא ראשון
בשרשרת"*) — הוא מקדש את הצורה השגויה.

## 2 · 🔴 טקסט עשיר — שני נשאים, לא אחד

| צורה | `Command/Parameter` ישיר | `WordListItem/Text` |
|---|---:|---:|
| `p/s/r` | **137,448** | 28,078 |
| `s/r` | 1,516 | **27,927** |
| `r` ישיר | 9,072 | 206 |
| `d/p/s/r` | 2,125 | 2,060 |

המספרים שהיו בבריף ובתכנון הם של `WordListItem/Text` בלבד. ‏`richTextShapes`
מכסה את נשא-הפרמטר; **צריך כיסוי גם ל-`WordListItem/Text`**, כולל `d/…`.
🔑 ‏`<Text>` עוטף קיים **רק** תחת `WordListItem` — תחת `Parameter` הבנים ישירים.

## 3 · ההשוואה המבנית חד-כיוונית וקבוצתית

`verifyAgainstRealFile.spec.ts` משווה **קבוצות-תגים** ובכיוון אחד, ולכן
**אינה יכולה מבנית להיכשל** על אף אחד מהממצאים למעלה: ‏`Settings.RequiredFeature`
קיים בשני הצדדים, רק במיקום אחר. חזק אותה כך שתשווה גם **מיקום בשרשרת**
ו**קיום פרמטר** — או לפחות תיעד במפורש מה היא לא יכולה לתפוס.

## DoD
`bun run check` · `bun run test:unit --run` ירוקים · הבדיקות מדלגות בעדינות
בלי `~/work/grid-mapping/` · קומיט בעברית · לא לדחוף ולא למזג.
