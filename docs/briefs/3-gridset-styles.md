# סלייס 3 — `gridset-styles`: ירושת סגנונות

**ענף:** `slice/gridset-styles` · **בסיס:** `grid-clone` · **worktree:** `.worktrees/gridset-styles`

## מה לבנות

`src/lib/gridset/resolveStyle.ts`:

```ts
export function parseStyles(stylesXml: string): Record<string, Style>
export function createStyleResolver(styles: Record<string, Style>): StyleResolver
```

`src/lib/gridset/visualDefaults.ts` — **כל** ערך-ברירת-מחדל חזותי במקום אחד.

## סדר הפתירה — מוצהר, לא משתמע

```
DEFAULT_RESOLVED_STYLE → שרשרת BasedOnStyle מהשורש כלפי מטה → הסגנון הנקוב
                       → העקיפות המקומיות של התא (CellStyleSource.overrides)
```

‏3,282 סגנונות ב-`styles.tsv`. בלי ירושה כל תא היה נושא את כל התכונות — ולכן
תא שנראה כמו ברירת-המחדל הוא הסימן שהפתירה נשברה.

🛑 **הגנה ממעגל.** ‏`BasedOnStyle` יכול להצביע בחזרה (נתונים אמיתיים, לא
תיאורטי). לשמור `Set` של שמות שכבר נראו, ולעצור עם אזהרה — לא `RangeError`.

🛑 **שם סגנון שאינו קיים** — ליפול חזרה לברירת-המחדל ולדווח, לא לזרוק.

## צבעים
`#RRGGBBAA` — **אלפא בסוף**. להמיר ל-CSS תקין (`#RRGGBBAA` נתמך בדפדפנים
מודרניים, אבל לוודא ולא להניח). ‏`FontSize` מגיע מרשימה סגורה של 20 גדלים.

## 🛑 מה שאסור לנחש — וכאן נמצא הגבול של הסלייס

**‏`BackgroundShape=1..10` — הסמנטיקה טרם פוענחה.** גם גודל הסמל, מיקומו בתא,
רדיוס-הפינה והמרווח הפנימי **אינם קיימים ב-XML**. הם נסגרים במדידה
דיפרנציאלית מול studio (`plan.md` שלב C) ולא בסלייס הזה.

לכן: כל ערך כזה יושב ב-`visualDefaults.ts` עם הערה `// לא-מאומת מול Grid`,
כדי שהחלפתו אחרי המדידה תהיה שורה אחת ולא ציד ברחבי הקוד. **אסור לפזר
מספרי-קסם בקומפוננטות.**

## בדיקות
שרשרת בעומק 3 · עקיפה מקומית גוברת על מורשת · מעגל אינו תולה · שם חסר נופל
לברירת-מחדל · המרת `#RRGGBBAA`.

## קריטריון קבלה
`bun run test:unit` ו-`bun run check` ירוקים.

## מחוץ להיקף
פרסור ה-`.gridset` (סלייס 2 מזריק את הפותר) · רינדור · נאמנות פיקסלים.
