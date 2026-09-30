# Minimal Server Deployment

This deployment runs the current Estuary prototype as one application
container on the Penang Ubuntu desktop. Access is through NetBird and
`ssh estuary-db`; administrative commands use `sudo`. It does not create or
replace PostgreSQL.

The app joins the existing `estuary-db_default` Docker network and reaches the
healthy `estuary-postgres` container directly. The existing database package
remains at `/opt/estuary-db` and its `estuary_postgres_data` volume is not
modified by this deployment.

The current prototype still stores workflow state, queued email files, and PDF
exports under `runtime/prototype`. Compose mounts the server's `runtime`
directory into the container so those files survive a rebuild or restart.

## First deployment

From the Windows project computer, connect through NetBird:

```powershell
ssh estuary-db
```

On the Ubuntu server, prepare an app-owned folder and clone the public
repository:

```sh
sudo mkdir -p /opt/estuary-app
sudo chown arusacademy:arusacademy /opt/estuary-app
git clone https://github.com/arusacademy-git/Estuary.git /opt/estuary-app
cd /opt/estuary-app
```

Create `.env.server` without displaying or copying the existing PostgreSQL
password. The argument is the NetBird address users will open:

```sh
bash scripts/configure-server-env.sh http://100.72.165.226:3000
```

The script reads the credentials from `estuary-postgres` using `sudo docker
inspect`, URL-encodes them, generates a new application secret, and writes a
mode-600 `.env.server`. It never prints the database password.

Create the persistent runtime folder and start Estuary:

```sh
mkdir -p runtime/prototype
sudo docker compose -f compose.server.yaml up -d --build
sudo docker compose -f compose.server.yaml ps
sudo docker compose -f compose.server.yaml logs --tail=100 app
```

While connected to NetBird, open
`http://100.72.165.226:3000/dashboard`.

## Updating after an approved change

The intern should push work to a branch and open a pull request. After review
and merge into `main`, update the server with:

```sh
git pull --ff-only origin main
sudo docker compose -f compose.server.yaml up -d --build
sudo docker compose -f compose.server.yaml ps
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
