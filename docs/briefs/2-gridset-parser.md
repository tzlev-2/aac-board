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

---

# סבב 2 — תיקונים אחרי אימות (27.9.2026)

המאמת נתן `GO` עם שבעה ממצאים. ‏**אין מנגנון מומצא, אין היפוך `x`, ואין מלכודת
שכוסתה בשם בלבד** — שלושת אלה אומתו אחד-אחד. מה שלמטה הוא מה שכן צריך תיקון.

## 1 · 🛑 `FontSize` שברי נקטע ונשבר — הממצא החמור

‏`parse.ts:206` משתמש ב-`Number.parseInt`. ‏**132 מ-2,221 הסגנונות נושאים ערך
שברי** — ‏`18.666666666666668` (75 מופעים) · `14.666666666666666` (35) ·
`26.666666666666668` (13) ועוד. אלה המרות pt→px מדויקות.

🛑 **וזו לא רק אובדן דיוק אלא התנגשות:** ‏`14.666…` → `14`, שהוא **בלתי-מובחן**
מסגנון שערכו `14`.

‏`parseFloat`. ‏`Style.fontSize` כבר מוקלד `number` ומותר לו להיות שברי (הערה
נוספה ב-`types.ts`). ‏🔑 והבאג **שורד** הסרת `parseStyleCatalog`, כי אותו
`readStyleProps` משרת גם `<FontSize>` ברמת התא — ‏17,325 מופעים.

**בדיקה נדרשת:** ערך שברי נשמר, ו-`14.666` ו-`14` נבדלים.

## 2 · מידות עמודה ושורה — נזרקות במקום שבו הן נקראות

‏`parse.ts:219-220` מונה `ColumnDefinition`/`RowDefinition` ומתעלם ממאפייניהן.
`Width` מופיע ב-11,400 מ-58,701 (‏`ExtraSmall|Small|Large|ExtraLarge`),
`Height` ב-4,575 מ-44,667.

`types.ts` הורחב: ‏`Page.columnWidths: (SizeName|null)[]` ו-`Page.rowHeights`,
לפי הסדר, ‏`null` = רגיל. **למלא אותם.**

🔑 להקשר: בלוחות הארגון 0 מ-1,963 — הרשתות שלנו אחידות. זה לא חוסם, אבל
הנתון יושב שורה אחת מהמקום שבו הוא נזרק וזה הקובץ היחיד שיכול לחלץ אותו.

## 3 · `basedOnStyle` בקטלוג הסגנונות — שדה-רפאים

‏`parse.ts:177` ממפה `BasedOnStyle` גם לסגנונות-קטלוג, ו-`spec:645` **בונה XML
עם השדה הזה ומאמת שהוא נקרא** — כלומר הבדיכה מנציחה הנחה שנשללה.

`BasedOnStyle` קיים **רק** על `<Style>` של תא. **להסיר מהמיפוי של הקטלוג,
ולמחוק את הבדיקה.** ראו `docs/plans/gridset-core-design.md` §5.

## 4 · `<gridimageref>` הופך בשקט למחרוזת ריקה

‏`parse.ts:406-418`. ‏10 מופעים. ‏`''` אומר שקר — הצרכן אינו יכול להבחין בין
"צורה לא נתמכת" ל"ערך ריק". ‏`CommandCollectionParameterValue` (‏`parse.ts:413`)
עושה את הדבר הנכון ומושמט מהמפתחות. **אותו טיפול ל-`gridimageref`.**

## 5 · `<p/>` ריק מייצר פסקה ריקה — א-סימטריה

‏`richText.ts:201-203` דוחף פסקה בלי תנאי, בעוד `flushLoose` (186-192) מדלג על
ריק. התוצאה: ‏`richTextToString` מחזיר `"\nא"` עם שורה ריקה מובילה.
‏`Parameter/p` מופיע 44,380 פעם ו-`Action.InsertText` הוא הצרכן.

## 6 · שתי הערות קטנות

- ‏`Caption` של רווח-בלבד מקוצץ ל-`''` אך נחשב מוגדר (`parse.ts:302-303`).
  במקלדת AAC מקש-הרווח הוא בדיוק המקרה הזה, וספירת ה-snapshot (`spec:741`)
  סופרת אותו כ"תא מלא". ‏`Caption` אינו נושא `xml:space` בנתונים, ולכן ההשפעה
  מוגבלת — אבל הקיצוץ אינו מוצדק דווקא לכתובית.
- ‏`xml.ts:74` ו-`spec:92` כותבים "`X`/`Y` חסרים ב-38,287 תאים". ‏38,287 הוא
  החוסר של `X` בלבד; עבור `Y` המספר הוא **35,431**. לתקן את ההערה.

## 7 · 🔑 ועכשיו אפשר לאמת מול הקובץ האמיתי

המאמת כתב שלא יכול לאמת את מבנה ה-ZIP כי "אין אף `.gridset` על המכונה" —
זו הייתה קביעה שגויה שלי. **הם קיימים:** ‏`~/work/grid-mapping/raw/org-1.gridset`
ועוד 115. **הרץ את `parseGridSet` על `org-1.gridset` האמיתי** ודווח: עבר? כמה
דפים ותאים? אילו פקודות לא-מוכרות? ‏🛑 אל תוסיף את הקובץ או תוכן ממנו לריפו,
והבדיקה שתלויה בו חייבת לדלג בעדינות כשהוא חסר (CI).

## DoD
`bun run check` · `bun run test:unit --run` ירוקים · קומיט בעברית · לא לדחוף ולא למזג.
