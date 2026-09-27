# fixtures של `.gridset`

מחולל ZIP סינתטי (`buildGridset.ts` + `spec.ts`) ומאגר fixtures בעלי-שם
(`fixtures.ts`), לבדיקת הפרסר (סלייס 2) בלי צורך בקובץ `.gridset` אמיתי.
עוגן-האמת: `~/Projects/tzlev-docs-repo/aac-board/grid-reference/derived/gridset-schema.tsv`.

## אומת מבנית מול קבצים אמיתיים (27.9.2026)

המבנה (סדר-אלמנטים, מאפיינים, namespace) הושווה ידנית מול
`~/work/grid-mapping/raw/org-1.gridset` (ZIP אמיתי, לא ב-CI ולא בריפו —
תוכן Smartbox מורשה), ותוקן בעקבות ההשוואה: סדר-בנים ב-`<Content>`, מיקום
`<Visibility>`, סדר-שדות ב-`<Style>`, `<AutoContentCommands>`/`<WordList>`
תמיד-נוכחים, וה-namespace של `xsi:nil`. פירוט מלא בהערות למטה.

`verifyAgainstRealFile.spec.ts` מריץ אימות **אוטומטי** (השוואת קבוצות-תגים,
לא תוכן) מול כל 117 קבצי ה-`.gridset` תחת `~/work/grid-mapping/raw/`
(‏`org-1..4` + `bundled/`) — מדלג בעדינות כשהתיקייה לא קיימת (כך שב-CI
הוא פשוט לא רץ, בלי להיכשל).

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
| `nilCaption`     | `<CaptionAndImage xsi:nil="true" />` — 30,251 מופעים בנתונים האמיתיים                                                              |
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
- שלושת השורשים (`GridSetSettings`/`StyleData`/`Grid`) מכריזים
  `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`, כמו בקבצים
  האמיתיים — נדרש כי `nilCaption` כותב `xsi:nil="true"` (לא `nil` גולמי).
- `<AutoContentCommands>` ו-`<WordList>` נכתבים **תמיד** (גם ריקים —
  `<Items />`), כמו בקבצי Grid אמיתיים.

### מה שנבדק ונמצא תואם, ומה שנשאר מחוץ להיקף

לא כל שדה שנצפה בקבצים האמיתיים נבנה כאן — רק מה שהבריף ביקש. שדות שנצפו
בפועל אך לא נכללים ב-fixtures (כי אף אחד מ-12 המלכודות לא דרש אותם):
`BackgroundColour`, `GridGuid`, `ScanBlockAudioDescriptions`, מאפיין
`ScanBlock` על `<Cell>` (שונה מ-`<ScanBlocks><ScanBlock>` הנדיר), `DirectActivate`,
ורוב שדות `GridSetSettings` (`PictureSearch`, `Appearance`, `Description`
וכו'). אלה לא "מלכודות" שהבריף כיסה — אם סלייס 2 יזדקק להם, נדרש fixture
חדש, לא הרחבה שקטה של הקיימים.
