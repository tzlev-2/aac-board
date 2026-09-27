# ליבת `gridset` — תכנון המנגנונים

נכתב 27.9.2026. **זהו החוזה המרכזי של סבב הקלון.** כל סלייס בסבב הזה נגזר
ממנו, ואף סלייס אינו רשאי לסטות ממנו בלי לעדכן אותו קודם.

המפרט הארגוני שממנו הוא נגזר: `tzlev-docs-repo/aac-board/board-model.md`
ו-`grid-reference/derived/` (הסכמה האמפירית). כאן מוגדר **איך זה נבנה בקוד**.

---

## 0 · העיקרון — מבנה Grid הוא המודל, לא שכבה מעליו

🛑 **הליבה החדשה אינה מרחיבה את `Board`/`Tile` הקיימים.** המודל הקיים
(`src/lib/types/board.ts`, `Tile.type: 'button' | 'folder'`) הוא מודל אחר,
פשוט יותר, והוא **ממשיך לשרת את הלוחות שנבנים באפליקציה**. הקלון יושב לצידו:

| | מודל האפליקציה הקיים | ליבת `gridset` |
|---|---|---|
| קבצים | `src/lib/types/board.ts` · `components/Board.svelte` · `Tile.svelte` | `src/lib/gridset/` · `components/gridset/` |
| מסלול | `/s/[setId]/b/[boardId]` | `/grid` |
| "תיקייה" | שדה `type: 'folder'` | תא שנושא `Jump.To` |
| פלט | קומפוננטת `OutputBar` קבועה | **תא** עם `ContentType=Workspace` |

**אין adapter בכיוון הזה בסבב הזה.** גשר בין שני המודלים הוא החלטת-מוצר
נפרדת, והיא תילקח אחרי שהפרוסה האנכית רצה. מי שמנסה "להתאים את Grid ללוח
הקיים" הופך את הפרויקט לפלסטר — זה בדיוק מה שנפסל.

---

## 1 · שרשרת-הפקודות: רג'יסטרי, ושומרים שעוצרים

`grid-reference/derived/commands.tsv` מונה **353 פקודות**. בלוחות שנותחו
בשימוש **63**, ומהן **9 מכסות 91.5% מכלל ההפעלות**:

| # | פקודה | הפעלות | מצטבר |
|---|---|---:|---:|
| 1 | `Action.InsertText` | 1,736 | 42.8% |
| 2 | `Jump.To` | 464 | 54.3% |
| 3 | `Jump.Back` | 375 | 63.5% |
| 4 | `Jump.Home` | 262 | 70.0% |
| 5 | `Action.Clear` | 212 | 75.2% |
| 6 | `Action.Speak` | 212 | 80.5% |
| 7 | `Action.DeleteWord` | 204 | 85.5% |
| 8 | `Settings.RequiredFeature` | 126 | 88.6% |
| 9 | `Action.Letter` | 118 | 91.5% |

🔑 **לכן המבנה הוא רג'יסטרי ולא `switch`.** הוספת פקודה = ערך במפה, לא ענף
בקוד. היעד של הסבב הוא תשע הפקודות האלה; ‏54 הנותרות חייבות להיכנס אחר כך
בלי לגעת במריץ.

```ts
type CommandResult = void | 'halt';
type CommandHandler = (params: CommandParams, ctx: RuntimeContext) => CommandResult;
export const commandRegistry: Partial<Record<CommandId, CommandHandler>> = { … };
```

### 🛑 פקודות-שומר — המנגנון שאסור לפספס

`Settings.RequiredFeature` **אינה מאפיין של תא ואינה מתעדת כלום** — היא
פקודה בשרשרת, עם פרמטר `feature`, שתפקידה **לעצור את השרשרת** כשהתכונה
אינה זמינה. לכן המריץ אינו לולאה פשוטה:

```ts
export function executeCommands(cell: Cell, ctx: RuntimeContext) {
  for (const inv of cell.commands) {
    const handler = commandRegistry[inv.id];
    if (!handler) { ctx.reportUnimplemented(inv.id); continue; }
    if (handler(inv.params, ctx) === 'halt') return;   // ← השומר עצר
  }
}
```

**‏`Settings.RequiredFeature` היא גם מה שקובע אם התא נראה פעיל מלכתחילה.**
תא שהשרשרת שלו נפתחת בשומר שאינו מתקיים מוצג מעומעם (‏`Visibility=Disabled`
בפועל), לא נעלם. ‏🛑 בלי זה — לוחות קיימים ייראו שבורים (סיכון #1 ב-`plan.md`).

### רג'יסטרי התכונות

```ts
type FeatureId = 'ComputerControl' | 'EyeGaze' | 'Environment' | 'Phone' | …;
export const WEB_FEATURES: ReadonlySet<FeatureId> = new Set([]);  // נבנה בהדרגה
```

קלון-ווב אינו מחזיק `ComputerControl` ולא `EyeGaze`. הקבוצה מוצהרת **במקום
אחד**, לא נבדקת ad-hoc בכל handler.

### מדיניות פקודה לא-ממומשת

‏`ctx.reportUnimplemented(id)` — נצבר במונה, **לעולם לא זורק ולא שותק**.
בפיתוח מודפס פעם אחת לכל מזהה; בסוף טעינת לוח ניתן להפיק דוח כיסוי
(כמה מ-63 הפקודות שבשימוש אמיתי מכוסות). זהו מדד ההתקדמות של הקלון.

---

## 2 · תוכן התא: רג'יסטרי מרנדרים

`ContentType` (‏35,899 מופעים): `AutoContent` · `Workspace` · `LiveCell`.
`ContentSubType`: **`WordList`(652 דפים)** · `Chat`(89) · `Prediction`(21) ·
`Camera` · `Calculator` · `Animation` … · ויש גם `ContentSubSubType`(159).

**תא אינו "כפתור".** כפתור הוא המקרה הנפוץ (ללא `ContentType`), ושאר הסוגים
הם מרנדרים אחרים לגמרי:

```ts
type CellRenderer = Component<{ cell: Cell; ctx: RuntimeContext }>;
export const cellRenderers: Record<string, CellRenderer> = {
  'default':             ButtonCell,      // אין ContentType
  'Workspace/Chat':      ChatCell,        // ← פס-הפלט. תא, לא chrome
  'AutoContent/WordList': WordListCell,   // placeholder בסבב הזה
  'AutoContent/Prediction': PredictionCell,
};
// miss ⇒ UnsupportedCell — מציג caption + תג-סוג, לא קורס, נספר בדוח
```

🔑 **פס-הפלט הוא תא `Workspace/Chat`.** באפליקציה הקיימת `OutputBar` היא
קומפוננטה קבועה בראש המסך; ב-Grid היא תופסת תאים ברשת, עם span, עם סגנון,
ובמיקום שהלוח קובע. מימוש הקלון חייב להיות תא — אחרת כל לוח אמיתי ייראה לא
נכון, ותידרש עקיפה בכל לוח.

---

## 3 · המודל — מה שחסר ב-`board-model.md` ומתווסף כאן

`board-model.md` נכתב לפני שנקראה הסכמה במלואה. שלוש תוספות מחייבות:

**‏(א) הדף מחזיק מנועים.** ‏`/Grid/WordList` מופיע **‏7,057 פעם — אחת לכל דף**,
ו-`/Grid/PredictionSource` (958) הוא מאפיין-דף עם הערכים
`None | WordList | WordListAndPredictor | LastSuggestedAndWordList`.
מנוע ה-WordList אינו גלובלי — **הוא נגזר מהדף הפעיל**.

**‏(ב) ‏`AutoContentCommands` הן טבלת-פקודות ברמת הדף.** ‏3,194 מופעים של
`AutoContentCommandCollection[AutoContentType]` (`Chat.History`,
`Contacts.Contacts`…). תא `AutoContent` **שואב את שרשרת הפקודות שלו מהאוסף
של הדף לפי הסוג שלו**, לא מתוך עצמו. מי שיחפש את הפקודות בתא לא ימצא כלום.

**‏(ג) ‏`Visibility` ברמת התא** (1,555): `Hidden | Disabled | PointerAndTouchOnly`.

```ts
interface Page {
  name: string; guid?: string;
  columns: number; rows: number;
  cells: Cell[];
  wordList: WordListItem[];                 // (א)
  predictionSource: PredictionSource;       // (א)
  autoContentCommands: Record<string, CommandInvocation[]>;  // (ב)
  commands?: CommandInvocation[];           // /Grid/Commands — פקודות דף (419)
  background: { style?: 'Image'|'SolidColor'; colour?: string; image?: string };
  horizontalAlignment?: 'Left'|'Right'; verticalAlignment?: 'Centre'|'Top';
  selfClosing?: boolean;
}
```

---

## 4 · טקסט עשיר — שלוש צורות, נרמול אחד

`board-model.md` מניח `Text → <p> → <s> → <r>` תמיד. הסכמה אומרת אחרת:

| צורה | מופעים |
|---|---:|
| `Text/p/s/r` | 28,078 |
| `Text/s/r` (בלי `<p>`) | 27,927 |
| `Text/r` (ישיר) | 206 |

**הפרסר מנרמל את שלושתן לצורה אחת** (`paragraphs[].sentences[].runs[]`),
ועוטף במרומז את מה שחסר. ‏🔑 **הסמל יושב על ה-`<s>`**, לא על התא.

### דקדוק עברי נישא על הפריט, לא על המחרוזת

`Action.InsertText` נושאת `gender | number | person | pos | showincelllabel`
עם ערכים עבריים (`gender=זכר`), ו-`WordListItem` נושא `PartOfSpeech`(12,259) ·
`Number`(412: singular/plural) · `Person`(797: second/third).

לכן **חוצץ-הפלט הוא רשימת פריטים עם דקדוק, לא מחרוזת**:

```ts
interface OutputItem { text: string; image?: ImageRef;
                       gender?: string; number?: string; person?: string; pos?: string; }
```

חוקי הנטייה עצמם הם `plan.md` שלב E ואינם בסבב הזה — אבל **המודל נושא אותם
מהיום**, אחרת כל מימוש נטייה עתידי יידרש לשכתב את החוצץ.

---

## 5 · סגנון — סדר פתירה מוצהר

```
Default → … → BasedOnStyle (שרשרת) → הסגנון הנקוב → עקיפות מקומיות של התא
```

צבעים `#RRGGBBAA` (**אלפא בסוף**) · ‏`FontSize` מרשימה סגורה של 20 ·
`BackgroundShape` enum 1–10. ‏3,282 סגנונות — בלי ירושה כל תא נושא הכל.

🛑 **מה שאינו ב-XML ואסור לנחש:** גודל הסמל, מיקומו בתא, רדיוס-פינה, מרווח
פנימי, וסמנטיקת `BackgroundShape=1..10`. אלה נסגרים במדידה דיפרנציאלית מול
studio (`plan.md` שלב C). בסבב הזה — ערכי-ברירת-מחדל **מרוכזים בקובץ אחד**
(`visualDefaults.ts`) עם הערה שהם לא-מאומתים, כדי שהחלפתם תהיה שורה אחת.

---

## 6 · טעינה — Runtime בדפדפן

**הוכרע 27.9.2026:** ‏`fflate` + `DOMParser` בצד-הלקוח. ‏`.gridset` הוא ZIP.
מורה גוררת קובץ והאפליקציה קוראת אותו — אין שלב preprocess.

‏🛑 **אין אף `.gridset` על המכונה.** ‏ה-TSV-ים תחת `derived/` הם התוצר;
המקור אינו כאן. לכן **fixture סינתטי הוא תנאי מקדים לבדיקות**, והוא נבנה
מתוך הסכמה עצמה. ‏`*.gridset` ב-`.gitignore` — תוכן Smartbox מורשה אינו
נכנס לריפו ציבורי.

**סמלים:** ‏`ImageRef` נפתר מול `src/lib/services/arasaac.ts` הקיים.
‏`PCS` ו-`[widgit]` נדחים — החלטת 27.9.2026.

---

## 7 · RTL — ‏`X=0` הוא התא הימני

לא נעשה היפוך ידני של אינדקסים. ‏`direction: rtl` על מכולת ה-grid, והדפדפן
ממקם את `grid-column: 1` מימין. ‏🛑 **אסור** להמיר `x` ל-`columns - x` בקוד —
זה נשבר על span.

---

## 8 · מה הסבב הזה **אינו** כולל

מנוע `WordList` · מנוע `Prediction` · נאמנות פיקסלים · העורך · סריקה
(`ScanBlock` — **נשמר במודל, לא מרונדר**) · גשר ללוחות האפליקציה הקיימים.
