#!/usr/bin/env bash
# מחיל את ה-bindings המוצהרים ב-`wrangler.jsonc` על פרויקט ה-Pages.
#
# 🛑 למה זה קיים: Pages **אינו קורא `wrangler.jsonc`** — bindings שם הם
# הגדרת-פרויקט שחיה בדשבורד. בלי הסקריפט הזה הקונפיג היה בלתי-נראה בגיט,
# וסוכן שיקרא את הריפו בעוד חודש לא היה יודע שהוא קיים.
#
# שימוש:  tools/apply-pages-bindings.sh [--dry-run]
set -euo pipefail

PROJECT="aac-board"
ACCOUNT="a2681969546c8fbafdc45737bd367a6f"   # Avibr@tzlev.com's Account
PROFILE="$HOME/.config/cloudflare/config/avibr_AT_tzlev_com.json"

[[ -f "$PROFILE" ]] || { echo "🛑 אין פרופיל cf: $PROFILE" >&2; exit 1; }

# 🛑 טוקן ה-OAuth של `cf` פג בערך כל שעה, והשגיאה שחוזרת היא
# `{"code":10000,"message":"Authentication error"}` — שנראית כמו בעיית
# הרשאות ואינה. כל פקודת `cf` מרעננת את הקובץ, ולכן קוראים לאחת לפני
# שקוראים ממנו. נצרב 28/09/2026.
cf accounts list --profile "$(basename "$PROFILE" .json)" >/dev/null 2>&1 || true
TOKEN=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['oauth_token'])" "$PROFILE")

# ‏`wrangler.jsonc` הוא JSONC — מסירים הערות לפני הפרסור.
BINDINGS=$(python3 - "$(dirname "$0")/../wrangler.jsonc" <<'PY'
import json, re, sys
raw = open(sys.argv[1], encoding='utf-8').read()
raw = re.sub(r'^\s*//.*$', '', raw, flags=re.M)
cfg = json.loads(raw)
print(json.dumps({b['binding']: {'name': b['bucket_name']}
                  for b in cfg.get('r2_buckets', [])}, ensure_ascii=False))
PY
)

echo "r2_buckets מתוך wrangler.jsonc: $BINDINGS"
if [[ "${1:-}" == "--dry-run" ]]; then echo "(dry-run — לא הוחל)"; exit 0; fi

BODY=$(python3 -c "
import json,sys
b=json.loads(sys.argv[1])
print(json.dumps({'deployment_configs':{'production':{'r2_buckets':b},'preview':{'r2_buckets':b}}}))
" "$BINDINGS")

curl -sS --fail-with-body -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/pages/projects/$PROJECT" \
  -d "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('success'):
    print('🛑 נכשל:', [e.get('message') for e in d.get('errors') or []])
    print('   אם זה Authentication error — הטוקן פג. הרץ: cf accounts list --profile <שם>')
    sys.exit(1)
print('success: True')
cfg = (d.get('result') or {}).get('deployment_configs') or {}
for env in ('production','preview'):
    print(' ', env, (cfg.get(env) or {}).get('r2_buckets'))
"
