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
| `styleChain` | שרשרת `BasedOnStyle` בעומק 3 עד `Default`, עם עקיפות מקומיות |
| `contentTypes` | תא `Workspace/Chat` · `AutoContent/WordList` · `LiveCell` · `ContentSubSubType` |
| `guarded` | תא ששרשרתו נפתחת ב-`Settings.RequiredFeature feature=ComputerControl` |
| `visibility` | `Hidden` · `Disabled` · `PointerAndTouchOnly` |
| `nilCaption` | `<CaptionAndImage nil="true" />` — ‏30,251 מופעים בנתונים האמיתיים |
| `pageEngines` | דף עם `<WordList>` מאוכלס ו-`<PredictionSource>WordListAndPredictor` |
| `autoContent` | ‏`AutoContentCommands` ברמת הדף עם `AutoContentType="Chat.History"` |

## עוגני-אמת — לבנות לפי הסכמה, לא לפי הדמיון

מקור יחיד: `~/Projects/tzlev-docs-repo/aac-board/grid-reference/derived/gridset-schema.tsv`
(‏199 שורות: נתיב · מאפיין · שכיחות · ערכי-דוגמה). **לקרוא אותו בפועל** —
הוא מכיל את שמות האלמנטים המדויקים והערכים החוקיים. דוגמאות פרמטרים:
`commands.tsv` עמודת `sample_param_values`.

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
