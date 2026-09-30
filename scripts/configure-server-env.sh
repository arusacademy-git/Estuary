#!/usr/bin/env bash

set -euo pipefail

base_url="${1:-http://100.72.165.226:3000}"
database_container="${ESTUARY_DATABASE_CONTAINER:-estuary-postgres}"
output_file="${ESTUARY_ENV_FILE:-.env.server}"

if [[ -e "$output_file" ]]; then
  echo "$output_file already exists; leaving it unchanged."
  exit 1
fi

database_environment="$(sudo docker inspect "$database_container" --format '{{range .Config.Env}}{{println .}}{{end}}')"
database_name="$(printf '%s\n' "$database_environment" | sed -n 's/^POSTGRES_DB=//p')"
database_user="$(printf '%s\n' "$database_environment" | sed -n 's/^POSTGRES_USER=//p')"
database_password="$(printf '%s\n' "$database_environment" | sed -n 's/^POSTGRES_PASSWORD=//p')"

if [[ -z "$database_name" || -z "$database_user" || -z "$database_password" ]]; then
  echo "Could not read the existing PostgreSQL settings from $database_container." >&2
  exit 1
fi

encoded_user="$(VALUE="$database_user" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["VALUE"], safe=""))')"
encoded_password="$(VALUE="$database_password" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["VALUE"], safe=""))')"
encoded_database="$(VALUE="$database_name" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["VALUE"], safe=""))')"
database_url="postgresql://${encoded_user}:${encoded_password}@estuary-postgres:5432/${encoded_database}?schema=public"
nextauth_secret="$(openssl rand -hex 32)"

umask 077
{
  printf 'DATABASE_URL="%s"\n' "$database_url"
  printf 'DIRECT_URL="%s"\n' "$database_url"
  printf 'NEXTAUTH_URL="%s"\n' "$base_url"
  printf 'ESTUARY_BASE_URL="%s"\n' "$base_url"
  printf 'NEXTAUTH_SECRET="%s"\n' "$nextauth_secret"
  printf 'GOOGLE_CLIENT_ID="replace-me"\n'
  printf 'GOOGLE_CLIENT_SECRET="replace-me"\n'
  printf 'AWS_REGION="ap-southeast-1"\n'
  printf 'AWS_ACCESS_KEY_ID="replace-me"\n'
  printf 'AWS_SECRET_ACCESS_KEY="replace-me"\n'
  printf 'AWS_SES_FROM_EMAIL="finance@example.com"\n'
  printf 'AWS_S3_BUCKET="estuary-local"\n'
  printf 'ESTUARY_PORT=3000\n'
  printf 'ESTUARY_DATABASE_NETWORK="estuary-db_default"\n'
} > "$output_file"

unset database_environment database_password database_url encoded_password

echo "Created $output_file with mode 600 using the existing $database_container credentials."
