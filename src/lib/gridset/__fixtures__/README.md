# fixtures של `.gridset`

מחולל ZIP סינתטי (`buildGridset.ts` + `spec.ts`) ומאגר fixtures בעלי-שם
(`fixtures.ts`), לבדיקת הפרסר (סלייס 2) בלי צורך בקובץ `.gridset` אמיתי.
עוגן-האמת: `~/Projects/tzlev-docs-repo/aac-board/grid-reference/derived/gridset-schema.tsv`.

| fixture          | מה הוא מכסה                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `minimal`        | דף אחד 2×2, שני תאים, `Jump.To` ו-`Action.InsertText`                                                                              |
| `orgHome`        | 6×4, 21 תאים מוגדרים ו-20 מלאים — מידות אמיתיות של `דף ראשי` מ-`pages.tsv`                                                         |
| `spans`          | `ColumnSpan`/`RowSpan` גדולים לצד רשת אחידה                                                                                        |
| `sparseCoords`   | תאים בלי מאפיין `X` ו/או `Y` (ברירת מחדל 0)                                                                                        |
| `richTextShapes` | שלוש הצורות: `Text/p/s/r` · `Text/s/r` · `Text/r`                                                                                  |
| `styleTwoLevel`  | סגנון נקוב שטוח ב-`StyleData` + `BasedOnStyle` על התא + עקיפות מקומיות. 🛑 אין שרשרת בין סגנונות — ראו `gridset-core-design.md` §5 |
| `contentTypes`   | תא `Workspace/Chat` · `AutoContent/WordList` · `LiveCell` · `ContentSubSubType`                                                    |
| `guarded`        | תא ששרשרתו נפתחת ב-`Settings.RequiredFeature feature=ComputerControl`                                                              |
| `visibility`     | `Hidden` · `Disabled` · `PointerAndTouchOnly`                                                                                      |
| `nilCaption`     | `<CaptionAndImage nil="true" />` — 30,251 מופעים בנתונים האמיתיים                                                                  |
| `pageEngines`    | דף עם `<WordList>` מאוכלס ו-`<PredictionSource>WordListAndPredictor`                                                               |
| `autoContent`    | `AutoContentCommands` ברמת הדף עם `AutoContentType="Chat.History"`                                                                 |

## מבנה ה-ZIP

```
Settings0/settings.xml
Settings0/Styles/styles.xml
Grids/<שם הדף>/grid.xml
```

## הערות

- הקואורדינטות נכתבות כמו Grid (`X=0` = ימני); היפוך ה-RTL הוא עניין של
  הרינדור, לא של ה-fixture.
- הצבעים בפורמט `#RRGGBBAA` — אלפא בסוף.
- `GridsetSpec` (ב-`spec.ts`) הוא טיפוס-קלט פנימי ל-fixtures בלבד, ומשקף
  את ה-XML הגולמי — **לא** את המודל המפורסר ב-`src/lib/gridset/types.ts`.
