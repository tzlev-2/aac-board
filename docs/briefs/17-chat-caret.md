# סלייס 17 — סמן-כתיבה בפס-הפלט (פער 15)

**ענף:** `slice/17-chat-caret` · **בסיס:** `integration/run-visible-3`
**מפרט:** `tzlev-docs-repo/aac-board/GRID-GAPS.md` §15 · **פקודת-משימה:** `plans/missions/visible-3.md`
**מורכבות:** 2/10 (קובץ אחד · אלמנט ריק + CSS) · **תלויות:** אין
**שער כניסה שנמדד לפני כתיבת הבריף:**

```
$ CI=1 bun run check                       → 458 FILES 0 ERRORS 1 WARNINGS
$ CI=1 bunx vitest run --project server    → 207 passed
$ CI=1 bunx vitest run --project client    → 192 passed | 1 skipped
```

🛑 האזהרה `TileEditor.svelte:214` **קיימת בבסיס, בעורך. אל תתקן אותה.**

---

## §0 — הרצה

```bash
cd /home/user/Projects/aac-board-app
git worktree add .worktrees/17-chat-caret -b slice/17-chat-caret integration/run-visible-3
cd .worktrees/17-chat-caret
bun install
cp -p ../run-visible-3/static/*.gridset static/    # ראו §0.1 — חובה
```

### §0.1 — 🛑 הלוחות אינם בגיט

‏`*.gridset` ב-`.gitignore:34`. ‏**worktree טרי נוצר בלי אף לוח**, ו-`/grid`
יחזיר ‏404 על `/org-1.gridset` — ההגשה תיראה "עובדת" עם לוח ריק. ‏`bun install`
אינו מביא אותם ו-`git` לא יביא אותם לעולם.

🛑 **תוכן Smartbox מורשה:** ‏`wrangler dev` על **`127.0.0.1` בלבד** — בלי
`--ip 0.0.0.0`, בלי מנהרה. ‏**אל תקמט אותם ואל תיגע ב-`.gitignore`.**

```bash
# 🛑 בדיקות לא ב-tmux (TTY ⇒ watch mode). בשני חצאים. pipefail על כל pipeline.
CI=1 bunx vitest run --project server      # 207
CI=1 bunx vitest run --project client      # 192 + 1 skipped
bun run check                              # 0 שגיאות
```

**קריאה לפני התחלה (חובה):**
- ‏`src/lib/components/gridset/ChatCell.svelte` — ‏63 שורות, **כולו**. הקובץ היחיד שאתה עורך.
- ‏`src/lib/components/gridset/ChatCell.svelte.spec.ts` — ‏**ארבע הבדיקות. ‏שתיים מהן
  ‏`textContent` עם `toBe`.** ‏זה החוזה של §3.
- ‏`src/lib/components/gridset/wiring.svelte.spec.ts:183,232,314,324` — ‏**עוד ארבע**
  טענות `textContent` על אותו `data-testid="chat-cell"`.
- ‏`src/lib/components/gridset/ChatChip.svelte`.
- ‏`tzlev-docs-repo/aac-board/GRID-GAPS.md` §15.

---

## §1 — המטרה

מי שבונה משפט **רואה היכן תיכתב המילה הבאה**. היום אין שום סימן.

---

## §2 — Scope

| | בפנים | בחוץ |
|---|---|---|
| קו אנכי בקצה זרם-הכתיבה | ✅ | — |
| **הבהוב** | — | ❌ פקודת-משימה §2. 🛑 בלי `animation` |
| **מיקום כשהפס ריק** | — | ❌ ראו §4.2 |
| תלות-מיקוד (`focus`) | — | ❌ לא נמדד |
| כיווץ רצף-הרווחים ב-`parts` | — | ❌ **מכוון. אל תסיר** (סלייס 11+15) |
| ‏`ChatChip` · הסמלים | — | ❌ סלייס 15, הושלם |
| ‏`.caption` · `font-size` · `BackgroundShape` | — | 🛑 **איסור קשה** |

---

## §3 — 🛑 החוזה שאסור לשבור: ‏`textContent` הוא בדיוק מה שנאמר

**שמונה** טענות בשתי סוויטות בודקות `textContent` של `[data-testid="chat-cell"]`,
שש מהן עם `toBe` מדויק:

```
ChatCell.svelte.spec.ts:116   toBe('1 + 2')
ChatCell.svelte.spec.ts:126   toBe('שמלה כובע')
wiring.svelte.spec.ts:183     toHaveTextContent('שלום תפוח')
wiring.svelte.spec.ts:232     toHaveTextContent('שמלה נעליים כובע')
wiring.svelte.spec.ts:314     toBe('1 + 2')
wiring.svelte.spec.ts:324     toBe('1 +')
```

‏⇒ **הסמן חייב לתרום אפס תווים ל-`textContent`.**

| ❌ | למה |
|---|---|
| `<span>\|</span>` | תו אמיתי ⇒ ‏`toBe('1 + 2')` נופל מיָד |
| `::after { content: '\|' }` | לא נכנס ל-`textContent`, **אבל** צורתו תלוית-גופן; מה שנמדד הוא **קו של פיקסל אחד**, לא גליף |
| ‏`caret-color` + `contenteditable` | ‏`.chat-cell` אינו שדה-קלט, ואין לו מיקוד |

✅ **אלמנט ריק עם רקע:** `<span class="caret" aria-hidden="true"></span>` —
אפס תווים, רוחב וגובה נשלטים, צבע מ-`currentColor`.

‏`aria-hidden` חובה: ל-`.chat-cell` יש `role="status"`, וכל שינוי בו מוכרז.

---

## §4 — מה נמדד

### §4.1 — המדידה, על `eng-02-org1-bgadim-after-2words.png` (‏1920×1080)

| מה | ערך | איך |
|---|---|---|
| **רוחב** | ‏**1px** | ‏`x=1307` כהה; ‏`x=1303..1306` ו-`1308..1311` = ‏(250,250,250) רקע נקי |
| **גובה** | ‏**47px** | ‏`y=173..219` |
| **צבע** | ‏**(31,31,31)** ≈ שחור | — |
| **מיקום** | **בקצה זרם-הכתיבה** | הסמן ב-`x=1307`; ‏"שמלה חצאית" ב-`x≈1320..1540`. ב-RTL ⇒ **אחרי** הפריט האחרון |
| גובה פנים-התא | ‏~200px | ‏`y≈70..270` |

⇒ הסמן הוא **‏~23.5% מגובה פנים-התא**, ושכבת-הדיו של המילים באותן שורות בדיוק.

### §4.2 — 🛑 שלושה דברים שלא נמדדו

| | |
|---|---|
| **האם הוא מהבהב** | לא נמדד. ‏🛑 **בלי `animation`.** קו סטטי |
| **מיקומו כשהפס ריק** | ‏`GRID-GAPS` §15 מציין ש-`ovf-03` מראה קו גם בעמוד ריק — **מיקומו שם לא נמדד** |
| **האם הוא תלוי-מיקוד** | לא נמדד |

**מה עושים עם הריק:** הסמן מצויר **תמיד**, כילד ה-inline האחרון. כשהחוצץ ריק
הוא נוחת בתחילת השורה — ‏**זו תוצאה של הפריסה, לא מדידה.** לרשום כך בדוח.

### §4.3 — הגודל בקוד

**רוחב:** ‏`1px`. נמדד ב-1920×1080; ‏**התנהגות-קנה-המידה לא נמדדה** — הערה בקוד.

**גובה:** קשור לקופסת-השורה של הטקסט עצמו (`1em`), ולא ל-`cqh`.
מהמדידה: דיו-הטקסט ‏~38px והסמן 47px ⇒ ‏**~1.24× גובה-הדיו**. בהנחת
ascender≈0.75em יוצא ‏~0.89em. 🛑 **ההנחה הזאת היא הערכה** (אותה הערכה שכבר
מתועדת ב-`visualDefaults.ts` סביב `captionHeightRatio`) — לכן `1em` הוא
**עיגול שלנו**, ונושא `// 🛑 לא-מאומת מול Grid`.

---

## §5 — קומיטים בסדר

### קומיט 0 — בדיקות אדומות (approach: tdd)

ב-`ChatCell.svelte.spec.ts`, **בנוסף** לארבע הקיימות (🛑 אל תשנה אותן):

1. ‏`.caret` קיים כשיש פריטים.
2. 🛑 **`textContent` נשאר `'1 + 2'` בדיוק גם עם הסמן** — אותו תרחיש של
   שורה 110, עם `expect(...).toBe('1 + 2')`. זו הבדיקה שתופסת גליף שדלף.
3. הסמן הוא **האלמנט האחרון** בזרם: ‏`root.querySelector('.caret')` שווה
   ל-`root.querySelector('.output-text')!.lastElementChild`.
4. ‏`.caret` נושא `aria-hidden="true"`.
5. פס ריק (`items: []`) — הסמן עדיין קיים, ו-`textContent` הוא `''`.

### קומיט 1 — הסמן

‏`ChatCell.svelte` בלבד: ‏`<span class="caret" aria-hidden="true"></span>` כילד
האחרון בתוך `.output-text`, וה-CSS.

🛑 **גוף ה-`{#each}` נשאר בשורה אחת** (שורה 44) — ‏§4 של בריף 15: רווח שדולף
מה-markup הורג את `toBe`. הוסף את הסמן **אחרי** ה-`{/each}`, בלי שבירת-שורה
שתכניס רווח.

---

## §6 — DoD

- [ ] ‏`bun run check` — ‏**0 שגיאות**.
- [ ] ‏`--project server` ‏**207** · `--project client` ‏**192 + 5 חדשות, 1 skipped**.
      ⚠️ ‏**`7 skipped` במקום `1` הוא דגל אדום** גם כששורת-הסיכום ירוקה.
- [ ] 🛑 **צילום מסך שבו רואים את הקו** אחרי הקלדת שתי מילים לפחות.
      בלי צילום — התיבה נשארת `בביצוע`.

```bash
bun run build && bunx wrangler dev --port 4214    # 🛑 127.0.0.1 בלבד
# /grid → org-1 → לחץ שני תאים → צלם את הפס העליון
```

---

## §6.1 — מה ה-DoD **אינו** טוען

- **לא** נטען שהסמן זהה ל-Grid. נמדד ש**קיים** קו, רוחבו וגובהו בצילום **אחד** —
  ‏**לא** הבהובו, לא תלות-המיקוד, ולא מיקומו כשהפס ריק.
- **לא** נטען ש-`1em` הוא הגובה הנכון — הוא עיגול של הערכה (§4.3).
- **לא** נטען שהתנהגותו בגלישה נכונה: ל-`.output-text` יש
  `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, ולכן בטקסט
  ארוך **הסמן ייחתך יחד עם הסוף**. ‏🛑 **זה לא נמדד ב-Grid ואינו בהיקף.**
- **לא** נטען שכל 3,472 תאי ה-`Chat` נבדקו — נבדק **דפוס**.

---

## §7 — סיכונים

| סיכון | מיטיגציה |
|---|---|
| 🛑 גליף/רווח שדולף הורג 6 טענות `toBe` | §3 + בדיקה 2 בקומיט 0. **אלמנט ריק, לא תו** |
| שבירת-שורה ב-markup מכניסה רווח | §5 קומיט 1 — הסמן צמוד ל-`{/each}` |
| ‏`span` ריק בלי `display` מקבל רוחב 0 ונעלם **בלי שגיאה** | ‏`display: inline-block` + `width` מפורש. **אמת בצילום** |
| ‏`aria-hidden` חסר ⇒ `role="status"` מכריז אלמנט ריק | בדיקה 4 |
| ‏`animation` שיתווסף "כי ככה סמן נראה" | ‏§2 — **מחוץ להיקף, לא נמדד** |
| ‏RTL — הסמן יופיע בצד הלא-נכון | פריסה **inline**; הסדר נגזר מכיוון-הכתיבה. 🛑 **אל תוסיף `row-reverse` ואל תכפה `direction`** |

---

## §8 — עצור ודווח (‏`AskUserQuestion` אינו עובד — לכתוב בטקסט ולסיים תור)

- כדי לעבור שער אתה צריך לשנות אחת משש טענות ה-`textContent` הקיימות.
- אתה מסיק שדרוש שדה חדש במודל, מצב-מיקוד, או `contenteditable`.
- אתה רוצה לגעת ב-`ChatChip`, ב-`runtime.svelte.ts` או ב-`types.ts` — **אין בהם צורך**.
- אין דרך להפיק צילום.

## §9 — בסיום

קמט אחרי כל קומיט (עברית). דוח ל-
`/home/user/Projects/brief-driven-slices/main/reports/aac-board/17-chat-caret-eliezer.md`
— מה מומש · **פלט השערים כפי שהוא** · **נתיב הצילום** · מה לא נבדק. ואז `notify_parent`.
**אל תמזג בעצמך**; מרדכי ממזג. **אל תסגור את עצמך.**

## סטיות מהתכנון (‏ממלא המממש)

- ...
