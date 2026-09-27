# סלייס 2 — `gridset-parser`: ‏`.gridset` → מודל

**ענף:** `slice/gridset-parser` · **בסיס:** `grid-clone` · **worktree:** `.worktrees/gridset-parser`

## מה לבנות

`src/lib/gridset/parse.ts`:

```ts
export async function parseGridSet(
  data: ArrayBuffer | Uint8Array,
  opts?: { resolveStyle?: StyleResolver }
): Promise<GridSet>
```

טעינה **Runtime בדפדפן** — ‏`fflate` לפתיחת ה-ZIP ו-`DOMParser` ל-XML.
🛑 אין שלב preprocess ואין Node-only APIs: הקוד רץ בדפדפן, כי מורה עתידה
לגרור קובץ אל האפליקציה.

**התלות בסגנונות מוזרקת.** הפרסר אינו פותר ירושה; הוא מרכיב `CellStyleSource`
ומעביר ל-`opts.resolveStyle`. בלי פותר — `DEFAULT_RESOLVED_STYLE`. כך הסלייס
הזה וסלייס 3 נכתבים במקביל.

## שבע המלכודות — כולן מעוגנות בסכמה האמפירית

1. **‏`X=0` הוא הימני.** לשמור את `x` **כפי שהוא**. 🛑 אסור להמיר
   ל-`columns - 1 - x` — זה נשבר על `ColumnSpan`. ההיפוך נעשה ב-CSS.
2. **מאפיין חסר = 0.** ‏`X` מופיע 214,687 פעם ו-`Y` ‏217,543 מתוך **252,974
   תאים** — עשרות אלפי תאים בלי קואורדינטה מפורשת.
3. **‏`columns`/`rows` הם ספירת אלמנטים** ב-`<ColumnDefinitions>`/`<RowDefinitions>`,
   לא מאפיין.
4. **טקסט עשיר בשלוש צורות** — ‏`Text/p/s/r` (28,078) · `Text/s/r` (27,927) ·
   `Text/r` (206). לנרמל לצורה אחת של `RichText`, לעטוף במרומז את מה שחסר.
   🔑 הסמל יושב על ה-`<s>` (מאפיין `Image`), לא על התא.
5. **‏`<CaptionAndImage nil="true"/>`** — ‏30,251 מופעים. לא לקרוס.
6. **הדף מחזיק מנועים.** ‏`<WordList>` קיים ב-**כל אחד** מ-7,057 הדפים,
   ו-`<PredictionSource>` (958) הוא מאפיין-דף. למלא `Page.wordList` ו-`predictionSource`.
7. **‏`AutoContentCommands` ברמת הדף.** ‏3,194 מופעים של
   `AutoContentCommandCollection[AutoContentType]`. 🔑 תא `AutoContent` שואב
   את פקודותיו **משם**, לפי הסוג שלו — מי שיחפש אותן בתוך התא ימצא ריק.
   למלא `Page.autoContentCommands`; אין צורך לחבר אותן לתא כאן.

**עוד לפרסר:** ‏`Visibility` (1,555) · `ScanBlock` (לשמור, לא לרנדר) ·
`ContentSubSubType` (159) · `Content/Parameters ID=` (29) · רקע הדף
(`BackgroundStyle`/`BackgroundColour`/`BackgroundImage`) · יישורים · `GridGuid`
· `SelfClosing` · `/Grid/Commands` (419, פקודות דף).

**פרמטרים של פקודה** — שלושה סוגים: טקסט פשוט · `<p>` (טקסט עשיר,
ב-`Action.InsertText`) · `<data>` (‏mp3/bmp, ב-`SpeechPlaySound`) · ו-`<WordList>`
(ב-`Prediction.ChangeWordList`). לפרסר לפי `ParamValue`.

**‏`ImageRef`:** ‏`"[widgit]widgit rebus\h\have.emf"` → `{library:'widgit', path:'widgit rebus\h\have.emf'}`.
הספרייה case-insensitive בנתונים (`[WIDGIT]` ו-`[widgit]` שניהם מופיעים).

## בדיקות

‏Vitest מול ה-fixtures מסלייס 1 (`src/lib/gridset/__fixtures__/`). **אם הם
עדיין לא במיזוג** — לכתוב XML מינימלי inline בקובץ ה-spec שלך ולהמשיך;
אל תיחסם. כל אחת משבע המלכודות = בדיקה נפרדת בשם מפורש.

## קריטריון קבלה
`bun run test:unit` ו-`bun run check` ירוקים · snapshot יציב של `parseGridSet(fixtures.orgHome)`.

## מחוץ להיקף
פתירת ירושת-סגנון · רינדור · ביצוע פקודות · פתירת קבצי סמל בפועל.
