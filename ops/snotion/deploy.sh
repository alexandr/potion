#!/bin/bash
# Deploy the snotion.com Worker and attach the domains. Needs: source ~/.cockpit/keys.env
set -eu
cd "$(dirname "$0")"
CF=https://api.cloudflare.com/client/v4; A=$CLOUDFLARE_ACCOUNT_ID; H="Authorization: Bearer $CLOUDFLARE_API_KEY"
ok() { python3 -c 'import sys,json;d=json.load(sys.stdin);print("ok" if d["success"] else d["errors"])'; }
curl -s -X PUT -H "$H" "$CF/accounts/$A/workers/scripts/snotion" \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2026-10-01"};type=application/json' \
  -F 'worker.js=@worker.js;type=application/javascript+module' | ok
Z=$(curl -s -H "$H" "$CF/zones?name=snotion.com" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')
for host in snotion.com www.snotion.com; do
  curl -s -X PUT -H "$H" -H "Content-Type: application/json" "$CF/accounts/$A/workers/domains" \
    -d "{\"hostname\":\"$host\",\"service\":\"snotion\",\"zone_id\":\"$Z\",\"environment\":\"production\"}" | ok
done
