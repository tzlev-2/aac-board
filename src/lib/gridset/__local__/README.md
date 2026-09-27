# `__local__` — קובצי `.gridset` אמיתיים, מחוץ לריפו

🛑 **תוכן Smartbox מורשה אינו נכנס לריפו.** ‏`*.gridset` נמצא ב-`.gitignore`
(שורה 34), והתיקייה הזאת קיימת כדי שיהיה לו מקום מוסכם — לא כדי לאחסן אותו.

## להריץ את בדיקת הקובץ האמיתי

```bash
cp ~/work/grid-mapping/raw/org-1.gridset src/lib/gridset/__local__/real.gridset
bun run test:unit --run --project client
```

בלי הקובץ הבדיקה **מדלגת** (`ctx.skip`) — וכך היא מתנהגת ב-CI. הבדיקה מאתרת
אותו דרך `fetch('/src/lib/gridset/__local__/real.gridset')`, כי היא רצה
בכרומיום ו-vite מגיש מתוך שורש הפרויקט.

## מה נאמת בסבב 2 (27.9.2026)

‏**116 קבצים** מ-`~/work/grid-mapping/raw/` נפרסו ללא כשל אחד, והמצרפים
זהים ל-`grid-reference/derived/gridset-schema.tsv`: ‏7,057 דפים ·
‏252,974 תאים · 3,282 סגנונות · 185,258 פקודות-תא · 24,585 `Jump.To`.
המסקנות המלאות הן בדוח הסלייס.
