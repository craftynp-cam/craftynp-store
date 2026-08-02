#!/usr/bin/env bash
# Pushes apps/medusa/.env.production to both Railway Medusa services.
#
# Only variable NAMES are ever printed. Values are passed straight to the
# Railway CLI and never echoed, so running this under an agent or in a shared
# terminal does not disclose them.
#
# The source file is gitignored by the root .gitignore's `.env.*` rule.

set -euo pipefail

ENV_FILE="apps/medusa/.env.production"
PROJECT="d20f6819-f4f7-4638-a91a-e1e59e9763fc"
ENVIRONMENT="cfde11ef-0c47-4711-860a-2049e967c8fd"

# Only these are read from the file. Everything else on the services was set
# from the deployment's own values (hostnames, CORS origins, bucket names), and
# a wholesale copy of .env.example would otherwise overwrite them with the
# localhost ones.
WANTED="
AUTH0_CLIENT_ID AUTH0_CLIENT_SECRET AUTH0_DOMAIN
COOKIE_SECRET JWT_SECRET MFA_ENCRYPTION_KEY
ORDER_ACCESS_SECRET ORIGIN_SHARED_SECRET SHIPPING_QUOTE_SECRET TAX_QUOTE_SECRET
FILE_STORAGE_ACCESS_KEY_ID FILE_STORAGE_SECRET_ACCESS_KEY
LABEL_STORAGE_ACCESS_KEY_ID LABEL_STORAGE_SECRET_ACCESS_KEY
GOOGLE_ADMIN_ALLOWED_DOMAIN GOOGLE_ADMIN_CLIENT_ID GOOGLE_ADMIN_CLIENT_SECRET
RESEND_API_KEY RESEND_FROM_EMAIL RESEND_REPLY_TO
SHIPSTATION_API_KEY SHIPSTATION_JWKS_URL SHIPSTATION_USPS_CARRIER_ID
STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
SHIPPING_OPTION_DEFAULT_AMOUNT SHIPPING_OPTION_DEFAULT_LABEL
SHOP_POSTAL_ADDRESS
SHIP_FROM_ADDRESS_1 SHIP_FROM_ADDRESS_2 SHIP_FROM_CITY SHIP_FROM_COMPANY
SHIP_FROM_COUNTRY_CODE SHIP_FROM_NAME SHIP_FROM_PHONE SHIP_FROM_POSTAL_CODE
SHIP_FROM_STATE
"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy apps/medusa/.env.example to it and fill it in." >&2
  exit 1
fi

for SERVICE in medusa-server medusa-worker; do
  echo "==> $SERVICE"
  ARGS=()
  NAMES=()

  # The `|| [ -n "$line" ]` matters: read returns non-zero on a final line with
  # no trailing newline, which silently drops it. An editor that does not add
  # one would otherwise lose the last variable in the file.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"

    # Skip blanks and the placeholders shipped in .env.example, so a half-filled
    # file cannot overwrite a real value with "replace-me-...".
    [ -z "$value" ] && continue
    case "$value" in replace-me-*|pk_replace_me) continue ;; esac

    case " $(echo $WANTED) " in *" $key "*) ;; *) continue ;; esac

    ARGS+=(--set "$key=$value")
    NAMES+=("$key")
  done < "$ENV_FILE"

  if [ ${#ARGS[@]} -eq 0 ]; then
    echo "    nothing to set"
    continue
  fi

  printf '    %s\n' "${NAMES[@]}"
  railway variables \
    --project "$PROJECT" \
    --environment "$ENVIRONMENT" \
    --service "$SERVICE" \
    --skip-deploys \
    "${ARGS[@]}" >/dev/null
  echo "    pushed ${#NAMES[@]} variable(s)"
done

echo
echo "Done. Values were never printed."
