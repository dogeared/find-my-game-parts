# Find My Game Parts

Concierge MVP for sourcing replacement board game parts. Full design context: [`docs/designs/find-my-game-parts.md`](docs/designs/find-my-game-parts.md).

## Local development (Docker only — never run `npm`/`node` on the host)

```bash
cp .env.example .env
docker compose up
```

This starts the app (`localhost:3030`), Postgres, and a dev-mode Keycloak (`localhost:8090`, admin/admin).

First run only — apply the database schema:

```bash
docker compose exec app npx prisma migrate deploy
```

## Keycloak, Google, and Facebook setup (manual — do this in order)

This is hands-on setup across three consoles. None of it should be
automated — creating OAuth apps needs a real person driving it. Until it's
done, sign-in will fail even though the app itself is running.

**Fast path for steps 1 and the group mapper below:** `keycloak/setup-realm.sh`
scripts the whole realm/client/group/mapper bootstrap via `kcadm` (everything
except Google/Facebook and creating real users, which still need a person).
This Keycloak instance's realm data isn't persisted (`start-dev`, embedded
database) — a container *recreate* wipes it, which has already happened
more than once during development — so re-running this script is faster
than redoing the console clicks by hand:
```bash
docker compose cp keycloak/setup-realm.sh keycloak:/tmp/setup-realm.sh
docker compose exec keycloak sh /tmp/setup-realm.sh
```
It prints a new client secret each time it creates the client — update
`KEYCLOAK_CLIENT_SECRET` in `.env` and `docker compose restart app` after.

### 1. Create the realm and client in Keycloak

1. `docker compose up`.
2. **If you hit a Keycloak error saying the request must use HTTPS** when
   opening the admin console: Keycloak's realms default to requiring HTTPS
   for anything they classify as an "external" request, and on some
   networks (a corporate VPN/proxy that rewrites the apparent source IP is
   the usual cause) it misclassifies a plain `localhost` request as
   external. Fix it once per realm from inside the container, where the
   request stays genuinely local:
   ```bash
   docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
     --server http://localhost:8080 --realm master --user admin --password admin
   docker compose exec keycloak /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
   ```
   Repeat the second command with `realms/find-my-game-parts` after you create that realm in step 3 below, if you hit the same error there.
3. Open http://localhost:8090 and sign in with `admin` / `admin`.
4. Top-left realm dropdown → **Create realm** → name it `find-my-game-parts`.
5. Left nav → **Clients** → **Create client**:
   - Client ID: `find-my-game-parts` (matches `KEYCLOAK_CLIENT_ID` in `.env.example`)
   - Client authentication: **On** (a confidential client, so it gets a client secret)
   - Valid redirect URIs: `http://localhost:3030/api/auth/callback/keycloak`
6. Save, open the client's **Credentials** tab, and copy the **Client secret** into `KEYCLOAK_CLIENT_SECRET` in your `.env`.
7. **Create a group named after `KEYCLOAK_ADMIN_GROUP`** (defaults to `admin`) and add its members via **Users** → select a user → **Groups** → **Join Group**. Group membership *is* admin status in this app — see "Admins are managed via Keycloak groups" below.

### Admins are managed via Keycloak groups, not a database flag

`isAdmin` is synced automatically from the Keycloak group named in
`KEYCLOAK_ADMIN_GROUP` (default `admin`) on every login (`lib/auth.ts`) —
to make someone an admin, add them to that group in Keycloak's console; to
revoke it, remove them (takes effect on their next login, since sessions
are stateless JWTs). There's deliberately no "manage admins" page in this
app. If you change `KEYCLOAK_ADMIN_GROUP`, rename or recreate the matching
group in Keycloak too — the two aren't linked automatically.

This depends on a group-membership protocol mapper on the client, which
`kcadm` needs to create (there's no console UI step for this — it's a
one-time API call). Run it after creating the client above:

```bash
CLIENT_UUID=$(docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin > /dev/null 2>&1; \
  docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get clients -r find-my-game-parts \
  -q clientId=find-my-game-parts --fields id --format csv --noquotes | tail -1)

docker compose exec keycloak /opt/keycloak/bin/kcadm.sh create \
  clients/$CLIENT_UUID/protocol-mappers/models -r find-my-game-parts \
  -s name=groups -s protocol=openid-connect -s protocolMapper=oidc-group-membership-mapper \
  -s 'config."full.path"=false' -s 'config."id.token.claim"=true' \
  -s 'config."access.token.claim"=true' -s 'config."userinfo.token.claim"=true' \
  -s 'config."claim.name"=groups'
```

Like the rest of this Keycloak instance's data, this mapper is not
persisted (`start-dev` uses an embedded database) — redo it if the
container is ever recreated, not just restarted.

### 2. Google as an identity provider

1. In the realm: **Identity providers** → **Add provider** → **Google**. Keycloak
   shows the exact **Redirect URI** to use —
   `http://localhost:8090/realms/find-my-game-parts/broker/google/endpoint`. Copy it.
2. In the [Google Cloud Console](https://console.cloud.google.com/): create or
   select a project → **APIs & Services** → **OAuth consent screen** → fill in
   the app name and support email → save.
3. **APIs & Services** → **Credentials** → **Create credentials** →
   **OAuth client ID** → application type **Web application** → paste the
   redirect URI from step 1 into **Authorized redirect URIs**.
4. Copy the generated **Client ID** and **Client secret** into Keycloak's
   Google identity provider form, then **Save**.

### 3. Facebook as an identity provider

1. In the realm: **Identity providers** → **Add provider** → **Facebook**.
   Copy its **Redirect URI** —
   `http://localhost:8090/realms/find-my-game-parts/broker/facebook/endpoint`.
2. In [Facebook for Developers](https://developers.facebook.com/apps): **Create App**
   → type **Consumer** → give it a name.
3. Add the **Facebook Login** product → **Settings** → paste the redirect URI
   from step 1 into **Valid OAuth Redirect URIs**.
4. **App settings** → **Basic** → copy the **App ID** and **App secret** into
   Keycloak's Facebook identity provider form, then **Save**.

### 4. Test it

Restart the app so it picks up the new `.env` values:

```bash
docker compose restart app
```

Then visit http://localhost:3030/request and sign in — "Sign in with Google" and
"Sign in with Facebook" should appear alongside the email/password form.

**Note on the two different Keycloak URLs:** the app itself talks to Keycloak
over Docker's internal network (`http://keycloak:8080`, in `KEYCLOAK_ISSUER`),
but your browser and Google/Facebook talk to it over `http://localhost:8090`
(`KEYCLOAK_PUBLIC_URL`). Both reach the same container — that's host-vs-container
networking, not two separate Keycloak instances. `lib/auth.ts` splits these on
purpose: only the browser-facing authorization redirect uses
`KEYCLOAK_PUBLIC_URL`; everything else (discovery, token exchange, userinfo)
uses the internal `KEYCLOAK_ISSUER`, which is hardcoded in `docker-compose.yml`
and deliberately not something `.env` can override — see the comment there
if you ever need to change the realm name or port mapping.

## Custom Keycloak login theme

`keycloak/themes/find-my-game-parts/` is a CSS-only login theme matching
the app's own Parchment palette/fonts — it extends Keycloak 26's built-in
`keycloak.v2` theme (`theme.properties`'s `parent=keycloak.v2`) rather than
forking any `.ftl` templates, so it stays this simple and picks up
Keycloak's own future template fixes automatically. The actual class names
it targets (`.pf-v5-c-login__main`, `.pf-v5-c-button.pf-m-primary`, etc.)
were confirmed by extracting the real theme JAR from a running container
(`org.keycloak.keycloak-themes-26.4.7.jar`, `theme/keycloak.v2/login/`),
not guessed.

**Local dev:** already wired up — `docker-compose.yml` bind-mounts
`keycloak/themes` into the container, and `start-dev` doesn't cache themes,
so editing `styles.css` takes effect on refresh with no rebuild or restart.
`keycloak/setup-realm.sh` sets the realm's login theme to
`find-my-game-parts` as part of its bootstrap (`loginTheme` realm attribute)
— that setting is what actually activates it; the files alone don't.

**Production:** copy `keycloak/themes/find-my-game-parts/` into your
production Keycloak's `themes/` directory (or bake it into a custom
Keycloak image via a `COPY` in a Dockerfile — more durable than a bind
mount for a real deployment), then set the realm's **Login Theme** to
`find-my-game-parts` in the admin console (**Realm settings** → **Themes**).
No rebuild of the app itself is needed — this only touches Keycloak.

## Tests, lint, typecheck

```bash
docker run --rm -v "$PWD":/app -w /app node:22-slim npx vitest run
docker run --rm -v "$PWD":/app -w /app node:22-slim npx tsc --noEmit
docker run --rm -v "$PWD":/app -w /app node:22-slim npx eslint .
```

## What's built vs. stubbed

- Public browse, request submission (with BGG lookup + manual fallback),
  admin add-game/toggle, admin triage (criticality tagging, the
  double-approve nudge, 5-day claim expiry) — all implemented per
  `docs/designs/find-my-game-parts.md`'s Implementation Tasks.
- Auth is wired as a generic OIDC client against Keycloak — the Keycloak
  realm/client and Google/Facebook federation are not created yet (see above).
- Email notifications use Resend — needs a real `RESEND_API_KEY` in `.env`.
- Deployment (Render blueprint) has not been created yet.
