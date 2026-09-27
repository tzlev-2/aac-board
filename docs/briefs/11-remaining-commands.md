# סלייס 11 — `remaining-commands`: ‏4 פקודות + `CommandExecution.Wait`

**ענף:** `slice/remaining-commands` · **בסיס:** `grid-clone`
**תלוי ב:** סלייס 10 (`AutoContent.Activate`) — **למזג אותו קודם.**

## ההיקף — חמש פקודות, וכולן מדודות

| פקודה | ‏`org-1` | פרמטרים |
|---|---:|---|
| `Action.Punctuation` | 22 | `letter` |
| `Action.Number` | 20 | `letter` |
| `Action.Space` | 15 | — |
| `Action.DeleteLetter` | 13 | — |
| **`CommandExecution.Wait`** | **1** | `cancellable` · `waittime` |

**‏4 הראשונות: ‏90.3% → ‏96.4%** ב-`org-1` (רמת-תא).

🛑 **‏`Settings.RestAll` אינו ברשימה** — ‏**‏0 מופעים ב-`org-1`** (‏32 ב-`org-3`).
גרסה קודמת של התוכנית כללה אותו והבטיחה ‏98%. **שתיהן שגויות.**
‏⚠️ ו-3.6% הנותרים הם זנב של ~12 פקודות נדירות — **אין אצווה שסוגרת אותן.**

## 🛑 `CommandExecution.Wait` — באג התנהגותי שנמדד

**אינה רק "פקודה חסרה".** בתא ‏(4,0) ב-`org-3` השרשרת היא:
```
Action.InsertText → CommandExecution.Wait → Jump.To
```
היא אינה ממומשת, ולכן ‏**הקפיצה מתבצעת מיָד** במקום אחרי השהיה.

**מה שזה מחייב:** ‏`executeCommands` היום **סינכרוני**. השהיה מחייבת שהמריץ
יהיה אסינכרוני — או שהפקודה תדחה את **המשך השרשרת**.
🛑 **זו הכרעת-ארכיטקטורה, לא הוספת handler.** ‏`CommandResult` כולל היום
`void | 'halt'`; ייתכן שצריך `'await'`. **תעד את הבחירה בהודעת-הקומיט.**
⚠️ ‏`cancellable` — **לא נמדד מה מבטל את ההמתנה.** אל תמציא; לתעד כלא-נמדד.

## פרמטרים — מהקטלוג, לא מהזיכרון
`~/Projects/tzlev-docs-repo/aac-board/grid-reference/derived/commands.tsv`
🛑 **אל תסתמך על העמודה `sample_param_values`** — היא **דגימה אלפביתית**
(`parse_gridsets.py:138`: `sorted(v)[0]`), לא הערך הנפוץ. **הטעתה את התכנון
פעם אחת.** לקרוא ערכים אמיתיים מקובצי ה-`.gridset` ב-`~/work/grid-mapping/raw/`.
‏🔑 ערכי `letter` **עבריים** (`א`·`י`·`ו`) ו-`Action.Punctuation` נושא `!` ודומיו.

## 🛑 מחוץ להיקף
‏`Settings.RestAll` · ‏54 הפקודות הנותרות · ‏`Prediction.*` (שלב D רץ עכשיו) ·
‏`AutoContent.*` (סלייס 10).

## קריטריון קבלה
1. ‏`coverage` מדפיס **‏≥96% ב-`org-1`**, בשלוש רמות (סלייס 10 הרחיב את המכנה).
2. **‏`Wait` מדגים השהיה בפועל** — בדיקה שמוכיחה שהפקודה שאחריה **לא** רצה מיָד.
3. **‏5 דפים בבילד**, ומשפט של 4 מילים שכולל **רווח וסימן-פיסוק**.
4. 🛑 **פריוויו רק מ-build.** ‏**‏4000 · 4173 תפוסים** · ‏tmux `aac-tunnel` — לא לגעת.

⚠️ ‏`setInputFiles` **אינו מפעיל** את מטפל ה-`change` — נדרש
`page.evaluate(() => …dispatchEvent(new Event('change',{bubbles:true})))`.

## DoD
`check` + בדיקות ירוקים · בדיקה לכל אחת מחמש · קומיט בעברית.
**לא לדחוף, לא למזג.** ‏🛑 `AskUserQuestion` אינו עובד — נתקעת, כתוב בטקסט.
