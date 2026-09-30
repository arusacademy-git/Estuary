# Minimal Server Deployment

This deployment runs the current Estuary prototype as one application
container. It does not create or replace PostgreSQL. Prisma is packaged with
the application and reads the existing database connection from `.env.server`.

The current prototype still stores workflow state, queued email files, and PDF
exports under `runtime/prototype`. Compose mounts the server's `runtime`
directory into the container so those files survive a rebuild or restart.

## First deployment

The server needs Git and Docker Engine with the Compose plugin.

```sh
git clone https://github.com/arusacademy-git/Estuary.git estuary
cd estuary
cp .env.server.example .env.server
```

Edit `.env.server` and set at least:

- `DATABASE_URL` and `DIRECT_URL` for the PostgreSQL already on the server
- `NEXTAUTH_URL` and `ESTUARY_BASE_URL` to the address users will open
- a long random `NEXTAUTH_SECRET`

When PostgreSQL runs directly on the same Linux host, use
`host.docker.internal` instead of `localhost` in the database URLs. Inside a
container, `localhost` means the Estuary container itself. PostgreSQL must be
configured to accept the connection from Docker's bridge network.

Create the persistent runtime folder and start Estuary:

```sh
mkdir -p runtime/prototype
docker compose -f compose.server.yaml up -d --build
docker compose -f compose.server.yaml ps
docker compose -f compose.server.yaml logs --tail=100 app
```

Open `http://SERVER_ADDRESS:3000/dashboard`, or the value configured through
`ESTUARY_PORT`.

## Updating after an approved change

The intern should push work to a branch and open a pull request. After review
and merge into `main`, update the server with:

```sh
git pull --ff-only origin main
docker compose -f compose.server.yaml up -d --build
docker compose -f compose.server.yaml ps
```

Do not edit application files directly on the server. Do not commit
`.env.server` or the `runtime` directory.

## Data that must be backed up

Back up both independently:

1. the existing PostgreSQL database using the server's normal PostgreSQL backup
   procedure;
2. the repository's `runtime` directory while the current file-backed
   prototype is in use.

Rebuilding or replacing the application container does not delete the mounted
`runtime` directory.
