#!/usr/bin/env bash
#
# pcs-sync — מסנכרן את סמלי ה-PCS שהלוחות באמת מפנים אליהם, מגוגל-דרייב ל-R2,
# ומייצר מחדש את `src/lib/gridset/pcs-manifest.ts`.
#
# ‏🔑 למה סקריפט ולא העלאה חד-פעמית: הועלו רק המזהים שהקורפוס הנוכחי מפנה
# אליהם. לוח חדש של מורה יפנה למזהים אחרים, והם פשוט לא יהיו בדלי. הסקריפט
# סורק, משווה למה שכבר שם, ומעלה **רק את החסר**.
#
# ‏🛑 הדלי פרטי ונשאר פרטי. הסקריפט לא מפעיל `r2.dev` ולא מוסיף custom domain.
#
# נמדד ⟨28.9.2026⟩: ‏867 הפניות `[MJPCS#]` בארכיון · ‏123 מזהים ייחודיים ·
# ‏121 מהם מספריים. שני החריגים — ‏`hebrew\db0201` ו-`hebrew\mop` — נושאים
# תיקיית-משנה `hebrew\`, ו-`PCS COLOR` שטוחה, ולכן **אין להם קובץ** והם
# נופלים ל-ARASAAC. זה לא באג.
#
# שימוש:
#   tools/pcs-sync.sh                 # תכנון בלבד — מה חסר, בלי לגעת
#   tools/pcs-sync.sh --apply         # מוריד מהדרייב, מעלה ל-R2, מייצר מניפסט
#   tools/pcs-sync.sh --seed-local    # זורע את סימולציית ה-R2 של wrangler dev
#
set -euo pipefail

# ── מה שצריך לדעת כדי להגיע למקומות הנכונים ─────────────────────────────────
# ‏🛑 חשבון #3, Avibr@tzlev.com's Account. **לא** החשבון האישי ולא התת-חשבון
# הריק שנקרא "tzlev" — ראו runbook `cloudflare-delete-secondary-account`.
ACCOUNT_ID="a2681969546c8fbafdc45737bd367a6f"
CF_PROFILE="avibr_AT_tzlev_com"
BUCKET="aac-assets"
KEY_PREFIX="img/pcs"
# ‏🛑 ‏`gog`/`rclone` מוצאים את התיקייה רק דרך מזהה-השורש הזה, ורק בחשבון
# ‏avibr@tzlev.com. חיפוש לפי שם מהשורש מחזיר 404.
DRIVE_REMOTE="avibr_AT_tzlev.com:"
DRIVE_ROOT_ID="1liOzCozFj_yiBLy2_hGgfsuQ50T8VCWE"
DRIVE_SUBDIR="PCS COLOR"

MODE="plan"
case "${1:-}" in
	--apply) MODE="apply" ;;
	--seed-local) MODE="seed-local" ;;
	"") ;;
	*) echo "שימוש: $0 [--apply|--seed-local]" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── 1 · אילו מזהים הלוחות מפנים אליהם ───────────────────────────────────────
# סורק **כל** ה-XML בארכיון ולא רק `Grids/*/grid.xml`. נצרב: ‏4 הפניות יושבות
# ב-`Settings0/AutoReplacements/autoreplacements.xml`, וסריקה של `Grids` לבדה
# מחמיצה אותן.
CORPUS_DIRS=(
	"$HOME/work/grid-mapping/raw"
	"$HOME/work/grid-mapping/raw/bundled"
	"$REPO_ROOT/static"
)
: > "$WORK/refs.txt"
gridsets=0
for dir in "${CORPUS_DIRS[@]}"; do
	[ -d "$dir" ] || continue
	while IFS= read -r -d '' f; do
		gridsets=$((gridsets + 1))
		unzip -p "$f" '*.xml' 2>/dev/null | grep -oiE '\[MJPCS#\][^<"]*' >> "$WORK/refs.txt" || true
	done < <(find "$dir" -maxdepth 1 -name '*.gridset' -print0)
done

# מזהה → שם-קובץ: מסירים קדם-ספרייה, תיקיות-משנה וסיומת, ומרפדים ל-5.
sed -E 's/^\[[^]]*\]//; s#.*[\\/]##; s/\.[A-Za-z0-9]+$//' "$WORK/refs.txt" \
	| sort -u > "$WORK/ids-all.txt"
grep -E '^[0-9]+$' "$WORK/ids-all.txt" | awk '{printf "%05d\n", $1}' | sort -u > "$WORK/ids-wanted.txt"
grep -vE '^[0-9]+$' "$WORK/ids-all.txt" > "$WORK/ids-skipped.txt" || true

echo "‏קבצי gridset שנסרקו: $gridsets"
echo "‏הפניות [MJPCS#]:      $(wc -l < "$WORK/refs.txt")"
echo "‏מזהים ייחודיים:       $(wc -l < "$WORK/ids-all.txt")"
echo "‏מספריים (ניתנים לפתירה): $(wc -l < "$WORK/ids-wanted.txt")"
if [ -s "$WORK/ids-skipped.txt" ]; then
	echo "‏🛑 לא-מספריים, אין להם קובץ ב-PCS COLOR — ייפלו ל-ARASAAC:"
	sed 's/^/     /' "$WORK/ids-skipped.txt"
fi

# ── 2 · מה כבר בדלי ─────────────────────────────────────────────────────────
cf_r2() { CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" bunx cf@latest "$@" --profile "$CF_PROFILE"; }

if [ "$MODE" = "seed-local" ]; then
	: > "$WORK/ids-present.txt"
else
	cf_r2 r2 buckets objects list --bucket-name "$BUCKET" --per-page 1000 2>/dev/null \
		| grep -oE "\"${KEY_PREFIX}/[0-9]{5}\.png\"" \
		| grep -oE '[0-9]{5}' | sort -u > "$WORK/ids-present.txt" || true
	echo "‏כבר בדלי:             $(wc -l < "$WORK/ids-present.txt")"
fi

comm -23 "$WORK/ids-wanted.txt" "$WORK/ids-present.txt" > "$WORK/ids-missing.txt"
missing=$(wc -l < "$WORK/ids-missing.txt")
echo "‏חסרים:                $missing"

if [ "$MODE" = "plan" ]; then
	[ "$missing" -gt 0 ] && sed 's/^/     + /' "$WORK/ids-missing.txt"
	echo "‏(תכנון בלבד. להרצה: --apply)"
	exit 0
fi

if [ "$missing" -eq 0 ]; then
	echo "‏אין מה להעלות."
else
	# ── 3 · הורדה מהדרייב, רק את החסרים ────────────────────────────────────
	awk '{print $1 ".png"}' "$WORK/ids-missing.txt" > "$WORK/files-from.txt"
	mkdir -p "$WORK/dl"
	# ‏`--no-traverse`: ‏`PCS COLOR` היא 42,412 קבצים; אין לרשום אותה כדי
	# להוריד מתוכה עשרות.
	rclone copy --drive-root-folder-id "$DRIVE_ROOT_ID" \
		"${DRIVE_REMOTE}${DRIVE_SUBDIR}" "$WORK/dl" \
		--files-from "$WORK/files-from.txt" --no-traverse --transfers 8

	got=$(find "$WORK/dl" -name '*.png' | wc -l)
	echo "‏ירדו מהדרייב: $got מתוך $missing"
	if [ "$got" -lt "$missing" ]; then
		echo "‏⚠️ מזהים שלא נמצאו בדרייב (יישארו ללא סמל PCS):"
		comm -23 "$WORK/ids-missing.txt" \
			<(find "$WORK/dl" -name '*.png' -printf '%f\n' | sed 's/\.png$//' | sort) \
			| sed 's/^/     /'
	fi

	# ── 4 · העלאה ───────────────────────────────────────────────────────────
	ok=0; fail=0
	for f in "$WORK/dl"/*.png; do
		[ -e "$f" ] || break
		n="$(basename "$f")"
		if [ "$MODE" = "seed-local" ]; then
			# סימולציית R2 מקומית — ‏`wrangler dev` בלי גישה לחשבון בכלל.
			if (cd "$REPO_ROOT/proxy" && bunx wrangler r2 object put \
					"${BUCKET}/${KEY_PREFIX}/${n}" --file "$f" \
					--content-type image/png --local >/dev/null 2>&1); then
				ok=$((ok + 1)); else fail=$((fail + 1)); echo "‏נכשל: $n" >&2
			fi
		else
			if cf_r2 r2 buckets objects upload "${KEY_PREFIX}/${n}" \
					--bucket-name "$BUCKET" --content-type image/png \
					--body "@$f" -q >/dev/null 2>&1; then
				ok=$((ok + 1)); else fail=$((fail + 1)); echo "‏נכשל: $n" >&2
			fi
		fi
	done
	echo "‏הועלו: $ok · כשלונות: $fail"
	[ "$fail" -gt 0 ] && exit 1
fi

# ── 5 · מניפסט — מהדלי, לא מהכוונה ──────────────────────────────────────────
# 🔑 המניפסט נגזר מ**רשימת האובייקטים בדלי** ולא מרשימת מה שרצינו להעלות.
# אחרת הוא מבטיח קבצים שאינם שם, וזו בדיוק התמונה השבורה שהוא בא למנוע.
if [ "$MODE" = "seed-local" ]; then
	echo "‏(seed-local: המניפסט לא נוגע — הוא מתאר את הדלי המרוחק.)"
	exit 0
fi

cf_r2 r2 buckets objects list --bucket-name "$BUCKET" --per-page 1000 2>/dev/null \
	| grep -oE "\"${KEY_PREFIX}/[0-9]{5}\.png\"" \
	| grep -oE '[0-9]{5}' | sort -u > "$WORK/ids-final.txt"

MANIFEST="$REPO_ROOT/src/lib/gridset/pcs-manifest.ts"
{
	cat <<'HDR'
/**
 * ‏מזהי ה-PCS שקיימים בפועל בדלי — **קובץ מיוצר, לא לעריכה ביד.**
 * ‏מיוצר מ-`tools/pcs-sync.sh`, שקורא את רשימת האובייקטים מ-R2 עצמו.
 *
 * 🔑 **למה בכלל צריך מניפסט בלקוח.** הפתירה של `[MJPCS#]` היא lookup מדויק
 * ‏(`id.zfill(5) + '.png'`) ולא חיפוש, ולכן היא *תמיד* מצליחה לבנות כתובת —
 * גם למזהה שאין לו קובץ. בלי המניפסט התוצאה היא `<img>` שבור, וגרוע מכך:
 * הוא **מנצח** את ARASAAC, שאולי כן היה פותר את התא דרך הכתובית העברית.
 * עם המניפסט, מזהה שאינו כאן פשוט אינו נחשב פתירת-PCS ונופל הלאה.
 *
 * ‏🛑 לא כל הספרייה כאן — רק המזהים שהקורפוס מפנה אליהם. לוח חדש יפנה
 * למזהים אחרים; ‏`tools/pcs-sync.sh` סורק, משווה לדלי, ומעלה את החסר.
 */

/** ‏מרופד ל-5 ספרות, כמו מוסכמת-השמות של `PCS COLOR`. */
export const PCS_AVAILABLE_IDS: ReadonlySet<string> = new Set([
HDR
	sed "s/^/\t'/; s/$/',/" "$WORK/ids-final.txt"
	echo "]);"
} > "$MANIFEST"

(cd "$REPO_ROOT" && bunx prettier --write "$MANIFEST" >/dev/null)
echo "‏מניפסט נכתב: $(wc -l < "$WORK/ids-final.txt") מזהים → ${MANIFEST#"$REPO_ROOT/"}"
