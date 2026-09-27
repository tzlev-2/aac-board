# ליבת `gridset` — תכנון המנגנונים

נכתב 27.9.2026. **זהו החוזה המרכזי של סבב הקלון.** כל סלייס בסבב הזה נגזר
ממנו, ואף סלייס אינו רשאי לסטות ממנו בלי לעדכן אותו קודם.

המפרט הארגוני שממנו הוא נגזר: `tzlev-docs-repo/aac-board/board-model.md`
ו-`grid-reference/derived/` (הסכמה האמפירית). כאן מוגדר **איך זה נבנה בקוד**.

---

> ## 🛑 מה הם `org-*.gridset` — הוכרע 27.9.2026
>
> **הם אינם לוחות של הארגון.** הקידומת `org-` מסמנת "לא-מובנה"
> (`parse_gridsets.py:24`) — כלומר לא נשלח עם Grid — והיא הובנה כ"של הארגון".
> בפועל אלה **מוצרים מדף של Grid בעברית**. הראיות, מתוך הקבצים עצמם:
>
> - ‏`Description` הוא קופי-שיווקי בגוף שלישי (*"דיבור בסמלים א' **היא** מערכת
>   תקשורת מלאה **המיועדת למשתמשים**"*).
> - ‏`b034` — חבילה **מובנית** — הוא "דיבור בסמלים ד'", מאותה סדרת-מוצר.
> - ‏`org-4` נושא `DocumentationSlug=/hakol-kalul`, באותו מרחב-שמות כמו
>   `/netflix` ו-`/spotify`; ‏35 מ-116 הקבצים נושאים slug כזה.
> - דפי-האנשים נושאים טקסט-מציין מהמפעל (*"רשום כאן את שמות אנשי הצוות"*) —
>   אף שם לא מולא מעולם.
> - ‏`org-3` ו-`org-4` זהים בייטים ב-53 מ-54 הרשומות.
> - כל קובצי התוכן נושאים חותמת `1980-00-00` (אריזה תוכנתית); רק
>   `thumbnail.bmp` נושא `23.9.2026 22:28` — הרגע שנפתח על studio. **אומת.**
>
> ### 🔑 מה זה עושה לכל המספרים במסמך הזה
>
> הם **תקפים כתיאור של מבנה Grid** — וזה בדיוק מה שאנחנו מקלנים, ולכן ההחלטות
> הארכיטקטוניות עומדות. הם **אינם תקפים כדפוסי-שימוש של הארגון**.
>
> "‏126 תאים ייחסמו אצלנו" הוא **"‏126 תאים בלוחות-הדגימה"**. מה שיקרה בלוח של
> מורה אמיתית עדיין לא נמדד — ‏`plan.md` שלב F.
>
> ‏`used_by_us` ב-`commands.tsv` נשאר בשמו במכוון (שינוי היה שובר את ה-TSV
> ואת `map_commands.py`); משמעותו האמיתית היא "בלוחות-הדגימה".

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

### 🛑 `Settings.RequiredFeature` — תוקן 27.9.2026, וזו אינה פקודת-שומר

**הגרסה הראשונה של הסעיף הזה הייתה שגויה.** היא קבעה שזו פקודה בראש השרשרת
שעוצרת אותה. **נמדד ישירות מ-116 קובצי `.gridset`** ב-`~/work/grid-mapping/raw/`:

| מיקום בשרשרת | מופעים | % |
|---|---:|---:|
| **אחרונה** | **4,014** | **96.6%** |
| אחת לפני האחרונה | 78 | 1.9% |
| **ראשונה** | 57 | 1.4% |
| באמצע | 6 | 0.1% |

השרשרת הנפוצה ביותר (‏2,529 מופעים) היא
`Settings.RestEyeGaze · Settings.RestPointer · Settings.RestSwitch · Settings.RequiredFeature`.

🔑 **המסקנה:** זו **הצהרת-דרישה של התא, בתחביר של פקודה** — לא שומר-הרצה.
היא כמעט תמיד אחרונה, ולכן אין לה מה לעצור. ההשפעה שלה היא **בזמן רינדור**:
תא שדרישתו אינה מתקיימת **אינו מצויר, אך שומר את משבצתו** (בלי reflow).

```ts
// המנגנון האמיתי — שער רינדור, לא עצירת-הרצה
export function isCellAvailable(cell: Cell, features: ReadonlySet<FeatureId>): boolean
```

### 🛑 חודד 27.9.2026 אחרי אימות — ובלוחות-הדגימה זה 126 מתוך 126

המאמת סרק את ארבעת הלוחות הארגוניים: ‏**השומר הוא הפקודה האחרונה בכל 126
המופעים**, ומהם **68 יושבים ב-index 1** — אחרי `Settings.RestAll` (56),
`Jump.To` (10) או `Settings.ToggleMenu` (2). רק 58 הם שרשרת באורך 1.

**שתי נגזרות מחייבות:**

1. 🛑 **בדיקת ראש-שרשרת בלבד מחמיצה 54% מהמופעים** (‏68 מ-126) — ומחזירה
   "זמין" לתא שאינו זמין. זהו בדיוק סיכון #1.
   `isCellAvailable` **חייב לסרוק את כל השרשרת**, ללא תלות במקום.

2. 🛑 **`'halt'` אינו המנגנון — ובמקרה אחד הוא מזיק.** בעשרה תאים `Jump.To`
   **מקדים** את השומר: המשתמש לוחץ, **הניווט מתבצע**, ורק אז השומר מחזיר
   `'halt'` שאינו מבטל דבר. השער לא שימש כשער.

**המבנה הנכון:**

```
isCellAvailable(cell, features)   ← נקרא לפני הרינדור. סורק את כל השרשרת.
executeCommands(cell, ctx)        ← נקרא רק על תא זמין.
commandRegistry['Settings.RequiredFeature'] = () => {}   ← no-op בזמן הרצה
```

‏`CommandResult = 'halt'` **נשאר בחוזה** — פקודות אחרות עשויות להזדקק לו —
אבל `Settings.RequiredFeature` אינה משתמשת בו.

🛑 **וזה אינו `Visibility`.** ‏`Cell/Visibility` הוא אלמנט נפרד (1,555 מופעים,
`Hidden|Disabled|PointerAndTouchOnly`). שני מנגנונים, לא אחד.

### שנים-עשר ערכי `feature` — רשימה סגורה שנמדדה

| `feature` | מופעים | % |
|---|---:|---:|
| **`Dwell`** | **3,581** | **92.4%** |
| `SecondScreen` | 77 | 2.0% |
| `ComputerControl` | 65 | 1.7% |
| `EyeGazeAccess` | 59 | 1.5% |
| `TouchAccess` | 27 | 0.7% |
| `PointerAccess` | 23 | 0.6% |
| `SwitchAccess` | 21 | 0.5% |
| `MusicVideo` | 17 | 0.4% |
| `EnvironmentControl` · `ShareCommand` · `WebBrowser` · `Email` | 5 | 0.1% |

🛑 **שלושה שמות שניחשתי כאן אינם קיימים בנתונים:** ‏`EyeGaze` (השם הוא
`EyeGazeAccess`) · ‏`Environment` (`EnvironmentControl`) · ‏**`Phone`** (אינו
קיים כלל). הרשימה נמדדה — אין מה לנחש.

🛑 **ומקור הטעות שווה תיעוד:** ציטטתי `feature=ComputerControl`
מ-`derived/commands.tsv`. העמודה `sample_param_values` היא **דגימה אלפביתית**
(`parse_gridsets.py:138` כותב `sorted(v)[0]`), לא הערך הנפוץ. ‏`ComputerControl`
הוא 1.7%. מי שמתכנן לפי ה-TSV לבדו מתכנן סביב הזנב.

🔑 **נגזרת ל-`WEB_FEATURES`:** ‏`Dwell` הוא 92.4%, והוא **כן ניתן למימוש בווב**
(dwell-click). ההנחה הראשונה שלי — "קלון-ווב אינו מחזיק את התכונות, לכן התאים
ייחסמו" — הפוכה: רוב המופעים הם על תכונה שאנחנו יכולים לספק.

### מידות עמודה ושורה — נוספו למודל 27.9.2026

`<ColumnDefinition Width="Large">` — ‏11,400 מ-58,701 הגדרות-עמודה נושאות
`Width` מפורש (‏`ExtraSmall|Small|Large|ExtraLarge`), ‏29.7% מהדפים. הפרסר מנה
את ההגדרות ו**זרק את המאפיינים**, ולכן `Page` קיבל `columns: 6` בלבד והרינדור
היה מצייר שש עמודות שוות.

🔑 **אבל בלוחות-הדגימה: 0 מ-1,963.** הרשתות שלנו אחידות, וכל אי-האחידות
בלוחות המובנים. לכן זה **ראוי-תיקון ולא חוסם** — נשמר במודל
(`Page.columnWidths` / `rowHeights`) כי לוח מורה עתידי כן עלול להשתמש בו.

### 280 מופעים בלי שום פרמטר — הכרעה מפורשת

`<Command ID="Settings.RequiredFeature" />` בלי `<Parameter>`, ‏**56 מתוך 126
המופעים בלוחות-הדגימה**. 🛑 מימוש תמים כותב `features.has(undefined)` ומכריע
`false` — כלומר **מסתיר 56 תאים בשקט**.

**הוכרע:** מופע בלי פרמטר = **אין דרישה** (התא זמין), ‏+ ‏`reportUnimplemented`
כדי שזה יהיה נראה. לא `false`, ולא זריקה.

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

## 5 · סגנון — שתי רמות, ולא שרשרת

🛑 **תוקן 27.9.2026 — הגרסה הראשונה של הסעיף הזה הייתה שגויה.** היא קבעה
`Default → … → BasedOnStyle (שרשרת) → הסגנון הנקוב → עקיפות`, כלומר סגנון
שיורש מסגנון עד `Default`. **אין דבר כזה בנתונים.**

הראיה, מתוך `grid-reference/derived/gridset-schema.tsv`:

| שורה | נתיב | מופעים |
|---|---|---:|
| 96 | `/Grid/Cells/Cell/Content/Style/BasedOnStyle` | **252,974** |
| 191 | `/StyleData/Styles/Style` | 3,282 |
| 193–200 | `…/Style/{BackColour,BackgroundShape,BorderColour,FontColour,FontName,FontSize,Name,TileColour}` | — |

הסכמה **כן** מכסה את `styles.xml` במלואו, וכל שדות-הבן של `Style` מפורטים
בה — ‏`BasedOnStyle` **אינו** ביניהם. הוא מופיע במקום אחד בלבד: על התא,
ו-252,974 המופעים הם **מספר התאים** — כלומר כל תא נושא הפניה אחת.

**המבנה האמיתי:**

```
DEFAULT_RESOLVED_STYLE → הסגנון הנקוב (רשומה שטוחה) → עקיפות מקומיות של התא
```

סגנון נקוב הוא **רשומה שטוחה** תחת `StyleData/Styles/Style[Key]` עם שמונה
שדות, והיא אינה יורשת מאף אחד. ‏3,282 סגנונות — הם חוסכים שכפול בין
**תאים**, לא בין סגנונות.

🛑 **אין להשאיר בקוד מהלך-שרשרת** (לולאת `while`, הגנה ממעגל, `visited`).
הוא מכונה מתה שמשדרת שהמנגנון קיים, וזה בדיוק הסוג של דבר שמכוון עבודה
עתידית לכיוון לא נכון.

**מקור הטעות, לתיעוד:** ‏`board-model.md` הארגוני כותב *"‏`styles.xml` מגדיר
את `Jump cell 1`, ש**אולי** בעצמו `BasedOnStyle` של אחר, עד `Default`"* —
השערה, בלשון השערה. היא הוקשחה כאן למנגנון, ומשם לשני בריפים ולמימוש.
צריך למשוך אותה גם שם.

### שני שדות שהיו חסרים במודל
`Style` נושא **גם `Key` וגם `Name`** (3,282 מול 2,587): ‏`Key` הוא המזהה
שאליו `BasedOnStyle` מפנה, ‏`Name` הוא שם-תצוגה ואינו על כל סגנון. בנוסף
`TileColour` (228).

### ומה שכן נשאר
צבעים `#RRGGBBAA` (**אלפא בסוף**) · ‏`FontSize` מרשימה סגורה של 20 ·
`BackgroundShape` enum 1–10.

🛑 **מה שאינו ב-XML ואסור לנחש:** גודל הסמל, מיקומו בתא, רדיוס-פינה, מרווח
פנימי, וסמנטיקת `BackgroundShape=1..10`. אלה נסגרים במדידה דיפרנציאלית מול
studio (`plan.md` שלב C). בסבב הזה — ערכי-ברירת-מחדל **מרוכזים בקובץ אחד**
(`visualDefaults.ts`) עם הערה שהם לא-מאומתים.

## 6 · טעינה — Runtime בדפדפן

**הוכרע 27.9.2026:** ‏`fflate` + `DOMParser` בצד-הלקוח. ‏`.gridset` הוא ZIP.
מורה גוררת קובץ והאפליקציה קוראת אותו — אין שלב preprocess.

🛑 **תוקן 27.9.2026: קובצי המקור כן קיימים** — ‏`~/work/grid-mapping/raw/`:
‏`org-1..4.gridset` ו-112 מובנים תחת `bundled/`. הקביעה הקודמת ("אין אף
`.gridset` על המכונה") נבעה מחיפוש ב-`~/Projects` ו-`/tmp` בעומק 4 בלבד.

**ה-fixture הסינתטי נשאר נחוץ** — תוכן Smartbox מורשה אינו נכנס לריפו
ציבורי, ולכן בדיקות ה-CI צריכות fixture משלהן. אבל **אימות מול הקובץ האמיתי
אפשרי מקומית ורצוי**, וזה קריטריון-הקבלה האמיתי של הפרסר. ‏`*.gridset` ב-`.gitignore` — תוכן Smartbox מורשה אינו
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
