# Intern Code and Server Update Guide

This is the standard workflow for updating Estuary. GitHub `main` is the
official codebase. The Penang Ubuntu server runs a copy of `main` from
`/opt/estuary-app`.

Do not edit application code directly on the server. Do not copy a project
folder over the server installation. Never commit `.env.server` or `runtime/`.

## First: recover the newer login-page code

If the login-page version currently exists only on the intern's computer,
protect it before pulling or merging anything.

Open a terminal in that Estuary project folder and run:

```sh
git status --short --branch
git remote -v
git switch -c intern/recover-latest-interface
git add -A
git commit -m "feat: recover latest Estuary interface"
git push -u origin intern/recover-latest-interface
```

Then open GitHub and create a pull request from
`intern/recover-latest-interface` into `main`.

If any command fails, stop and send Afiq the complete output. Do not run
`git reset`, force-push, delete files, or pull `main` over the uncommitted work.

The pull request must be compared and tested before it is merged. This is
especially important for the login-page version because the current GitHub
repository does not contain that implementation.

## Normal workflow for every future change

Start from the latest official code:

```sh
git switch main
git pull --ff-only origin main
git switch -c intern/short-description
```

Make the interface or backend changes. Before pushing, run:

```sh
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Commit and push the branch:

```sh
git add -A
git commit -m "feat: describe the change"
git push -u origin intern/short-description
```

Open a pull request into `main`. Describe what changed, include screenshots for
interface changes, and report the test results. Afiq reviews and merges it.
Never push feature work directly to `main`.

## Update the Penang server after merge

Only deploy after the pull request has been merged into GitHub `main`.

Connect the computer to NetBird, then connect to Ubuntu:

```sh
ssh estuary-db
```

On Ubuntu, run:

```sh
cd /opt/estuary-app
git status --short
git pull --ff-only origin main
sudo docker compose --env-file .env.server -f compose.server.yaml up -d --build
sudo docker compose --env-file .env.server -f compose.server.yaml ps
sudo docker compose --env-file .env.server -f compose.server.yaml logs --tail=60 app
```

`git status --short` should print nothing before the pull. If it shows changed
files, stop and contact Afiq; do not discard them.

While connected to NetBird, verify:

```text
http://100.72.165.226:3000/dashboard
```

The existing `estuary-postgres` container, its `estuary_postgres_data` volume,
`.env.server`, and the app's `runtime/` directory remain in place during an app
rebuild.

## If the update fails

Collect the status and logs:

```sh
cd /opt/estuary-app
sudo docker compose --env-file .env.server -f compose.server.yaml ps
sudo docker compose --env-file .env.server -f compose.server.yaml logs --tail=200 app
git rev-parse --short HEAD
```

Send the output to Afiq. Do not reset Git, delete Docker volumes, recreate
PostgreSQL, or remove `/opt/estuary-app/runtime`.
