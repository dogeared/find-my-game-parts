# Find My Game Parts

[![version](https://img.shields.io/badge/version-1.6.1-blue)](CHANGELOG.md)
[![CI](https://github.com/dogeared/find-my-game-parts/actions/workflows/ci.yml/badge.svg)](https://github.com/dogeared/find-my-game-parts/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

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
scripts the whole realm/client/group/mapper bootstrap via `kcadm`, including
turning on self-registration (`registrationAllowed`) so people can create
their own accounts from Keycloak's own login page — no app code needed for
this, it's a Keycloak-hosted page reached the same way login already is, and
it automatically inherits the custom theme (everything except Google/
Facebook and creating real users, which still need a person).
This Keycloak instance's realm data isn't persisted (`start-dev`, embedded
database) — a container *recreate* wipes it, which has already happened
more than once during development — so re-running this script is faster
than redoing the console clicks by hand:
```bash
docker compose cp keycloak/setup-realm.sh keycloak:/tmp/setup-realm.sh
docker compose exec keycloak sh /tmp/setup-realm.sh
```
The client it creates is public (Authorization Code + PKCE, no secret) —
nothing to copy into `.env` afterward.

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
   - Client authentication: **Off** (a public client — Authorization Code + PKCE, no secret; `lib/auth.ts` sets `token_endpoint_auth_method: "none"` to match)
   - Valid redirect URIs: `http://localhost:3030/api/auth/callback/keycloak`
6. Save — nothing to copy into `.env`, this client has no secret.
7. **Create a group named after `KEYCLOAK_ADMIN_GROUP`** (defaults to `admin`) and add its members via **Users** → select a user → **Groups** → **Join Group**. Group membership *is* admin status in this app — see "Admins are managed via Keycloak groups" below.
8. **Realm settings** → **Login** tab → turn on **User registration** — this is what puts a "Register" link on the login page so people can create their own accounts (`setup-realm.sh` does this automatically if you used the fast path instead).

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

**Production:** Keycloak is self-hosted separately, not deployed via this
repo (see "Production deployment" below) — copy or bind-mount
`keycloak/themes/find-my-game-parts` into that instance's own
`themes/` directory alongside whatever theme(s) other realms on it
already use, then set this realm's **Login Theme** to
`find-my-game-parts` in the admin console (**Realm settings** →
**Themes**), or via `keycloak/setup-realm.sh` (it sets this automatically).
`keycloak/Dockerfile` still exists as a reference for baking the theme
into a built image, if you ever deploy a dedicated Keycloak instance
instead of a shared self-hosted one — it's not part of the current
deploy path.

## Email verification

Optional — Keycloak requires new accounts to verify their email address
before finishing sign-in, using any standard SMTP relay (e.g.
[Mailjet](https://www.mailjet.com), which has a free tier generous enough
for an early-stage app). Entirely Keycloak-hosted: no app code involved,
same as self-registration above — Keycloak's login flow intercepts an
unverified user right after their credentials are accepted and forces
them through verification before completing the OAuth handshake, so
NextAuth never even sees an unverified session.

Configure it by passing SMTP settings to `keycloak/setup-realm.sh`:

```bash
SMTP_HOST=smtp-relay.mailjet.com \
SMTP_PORT=587 \
SMTP_FROM=no-reply@findmygame.parts \
SMTP_USER=<your-mailjet-api-key> \
SMTP_PASSWORD=<your-mailjet-secret-key> \
  sh -c "$(cat keycloak/setup-realm.sh)"
```

If `SMTP_HOST` is left unset, the script skips SMTP configuration and
`verifyEmail` entirely — this is the local dev default, so registering
locally keeps working with no real email account needed. Only set these
against an instance you actually want sending real verification emails.

**Note:** Keycloak's `smtpServer` realm setting only accepts a single
JSON object (`-s 'smtpServer={"host":"...", ...}'`) — per-field
dot-notation (`-s smtpServer.host=...`) silently no-ops here, confirmed
live by setting it that way and finding the realm's `smtpServer` still
empty afterward, even though `kcadm`'s own docs describe dot-notation as
generally supported for nested attributes. All values must be strings,
including `port`/`auth`/`starttls`/`ssl` — Keycloak's schema is
`Map<String,String>`, so a bare number or boolean is a type mismatch,
not just a style choice. `keycloak/setup-realm.sh` already handles this
correctly; only worth knowing if you ever configure SMTP by hand.

The "check your email" interstitial page inherits the custom theme
automatically (same broad `keycloak.v2` extension as everything else),
but the actual **email message content** uses Keycloak's default
template look unless you also build an `email` theme — a nice-to-have,
not required for this to work.

**Clicking the verification link from a different session** (e.g.
checking email on a different device/app than where you registered —
the common case, since Keycloak can't resume the original login flow
without its original session cookie) lands on a plain "Your email
address has been verified" page. `setup-realm.sh` sets the client's
`baseUrl` (Keycloak's "Home URL" field) specifically so this page shows
a "« Back to Application" link — Keycloak's own default `info.ftl`
template falls back to `client.baseUrl` for this automatically, no
theme changes needed. Confirmed live: registered a real test user,
clicked the actual emailed link cold (no session), and compared the
resulting page with and without `baseUrl` set — no link at all without
it, "« Back to Application" with it.

## Two-way claim email

Optional — lets a buyer reply directly to the "your part is available"
notification (`lib/email.ts`) to arrange payment/shipping, with the reply
landing in a real inbox, while outgoing mail still shows a dedicated
`claim@findmygame.parts` sender rather than a personal address. This is
pure DNS + email-provider configuration — no app code beyond the
`EMAIL_FROM` value below, since Mailjet needs no per-address setup once a
domain is verified (any address at a verified domain works immediately).

### 1. Cloudflare Email Routing (inbound: claim@ → your real inbox)

Requires `findmygame.parts`'s DNS to be on Cloudflare (it already is, for
the Keycloak Cloudflare Tunnel — see "Production deployment" below).

1. Cloudflare dashboard → the `findmygame.parts` zone → **Email** → **Email Routing**.
2. Enable Email Routing if it isn't already (Cloudflare adds the necessary
   MX/TXT records automatically — don't add them by hand, they conflict).
3. **Routing rules** → **Create address** → `claim@findmygame.parts` →
   destination: your real personal inbox. Verify that destination address
   if Cloudflare prompts for it (one-time, via a confirmation email).

Mail sent to `claim@findmygame.parts` now forwards straight to your inbox.

### 2. "Send as" alias in your email provider (outbound: reply → looks like claim@)

Without this step, replying to a forwarded message sends from your real
address, not `claim@findmygame.parts`. Every major provider supports
sending as a verified alias — exact menu names vary, but the shape is the
same everywhere (Gmail: Settings → **Accounts and Import** → **Send mail
as**; Google Workspace, Fastmail, Zoho, and Outlook all have an equivalent
under account/identity settings):

1. Add `claim@findmygame.parts` as a "send as" / custom "from" address.
2. Choose email-based verification (not SMTP credentials — Mailjet doesn't
   provide a personal-inbox SMTP login, and you don't need one here). The
   provider sends a confirmation code/link to `claim@findmygame.parts`,
   which arrives via the Cloudflare forwarding set up in step 1.
3. Confirm it. You can now compose or reply *as* `claim@findmygame.parts`
   from your normal inbox — the buyer never sees your personal address.

### 3. App config

`lib/email.ts` reads the sender from `EMAIL_FROM`:

```bash
EMAIL_FROM=claim@findmygame.parts
```

Set it in your local `.env` for dev, and as the `EMAIL_FROM` Render secret
(`sync: false` in `render.yaml` — set once in the Render dashboard, see
"Set the `sync: false` environment variables" below) for production. If
unset, `lib/email.ts` falls back to `claim@findmygame.parts` by default.
This is a single global value — every email this app sends currently goes
through one code path (`sendOrderResponseEmail`), so one address covers
it. A second, distinct email type wanting a different sender (e.g. staying
on `noreply@` for something unrelated to claims) would need a small code
change to pass `from` per call instead of reading one env var; not needed
today since there's only the one flow.

## Production deployment

The app + its own Postgres deploy to Render via `render.yaml` (this
repo's blueprint) — one Docker web service, one isolated database.

**Keycloak is not part of this blueprint.** It's self-hosted separately
(a Docker container reachable via Cloudflare Tunnel) and shared across
projects — this app gets its own realm on that instance, isolated from
whatever other realms/projects it also serves. That instance and its
database aren't managed from this repo at all; `render.yaml` only knows
about the app.

This was a deliberate pivot away from an earlier attempt at also
deploying Keycloak on Render (see the commit history around
`keycloak/Dockerfile`/`render.yaml` from that period) — Keycloak's JVM
didn't fit comfortably in Render's starter plan's 512Mi even with every
tuning knob available (clustering disabled, heap/metaspace capped hard),
and kept getting killed under real memory pressure. Self-hosting sidesteps
that entirely and reuses infrastructure that already exists.

### 1. Prerequisites

- A GitHub repo with this code pushed.
- A [Render](https://render.com) account, and the `render` CLI installed
  locally (`brew install render`, or see Render's docs) if you want to
  validate/deploy from the command line instead of the dashboard.
- A running self-hosted Keycloak instance (this repo's `keycloak/Dockerfile`
  can build one if you don't have one yet), reachable at a public HTTPS
  hostname (e.g. via Cloudflare Tunnel) with a DNS record you control —
  the hostname you'll use for this project's realm (e.g.
  `auth.findmygame.parts`).
- Real Google/Facebook OAuth apps pointed at your production domain (same
  console steps as the "Keycloak, Google, and Facebook setup" section
  above, just with production redirect URIs instead of `localhost`).
- BGG API access approved (see Dependencies in
  [the design doc](docs/designs/find-my-game-parts.md)) and a
  [Mailjet](https://mailjet.com) API key pair, if you want those live in
  production from day one — both are optional at first (the app degrades
  gracefully: BGG search returns empty, email failures are logged, not fatal).

### 2. Validate the blueprint

```bash
render login          # opens a browser auth flow against your own Render account
render blueprints validate render.yaml
```

Fix anything it flags before deploying. Re-run this after any change to
`render.yaml`.

### 3. Deploy the app to Render

In the Render dashboard: **New** → **Blueprint** → connect the GitHub repo
→ Render reads `render.yaml` and provisions the database and the app
service. First deploy will fail health checks until the `sync: false`
env vars below are set — that's expected, not a bug.

### 4. Point Keycloak at a second public hostname

If your existing instance currently serves only one project at one fixed
hostname (`--hostname`/`KC_HOSTNAME` set to a single value, the default
"strict" mode), it needs two changes to safely add a second, independent
hostname for this project without touching the other project's realm:

- **Cloudflare Tunnel**: add `auth.findmygame.parts` (or whatever hostname
  you're using) as another public hostname, routed to the same local
  Keycloak service the other project already uses.
- **Keycloak**: set `KC_HOSTNAME_STRICT=false` and remove any fixed
  `KC_HOSTNAME`/`--hostname` value entirely — do not set it to anything,
  not even the instance's "main" hostname. A fixed hostname is what
  actually caused a real bug hit live: the initial login redirect looked
  fine (the app itself sends the browser to the right host), but
  Keycloak's own follow-up links (e.g. `login-actions/authenticate`)
  fell back to the fixed hostname instead of the one the flow started
  on — a different origin, so the session cookie wasn't sent, surfacing
  as "we're sorry, cookie not found".
  Use `KC_PROXY_HEADERS=xforwarded`, not `forwarded` — confirmed live via
  Keycloak's own `/realms/master/hostname-debug` page that Cloudflare
  Tunnel never sends the standard RFC 7239 `Forwarded` header at all,
  only the legacy `X-Forwarded-*` ones. Setting `proxy-headers=forwarded`
  made Keycloak ignore the correct `X-Forwarded-Proto: https` it was
  receiving (wrong header family) and fall back to reporting `http` in
  every generated URL instead. With `hostname-strict=false` + no fixed
  hostname + `proxy-headers=xforwarded` matching what Cloudflare Tunnel
  actually sends, every link Keycloak generates mid-flow — and each
  realm's issuer scheme — correctly matches whichever hostname (and
  `https`) the request actually came in on; the other project's realm
  keeps working exactly as before.

### 5. Set the `sync: false` environment variables

`render.yaml` deliberately does not store these — set them in the app
service's **Environment** tab in the Render dashboard:

| Var | Value |
|---|---|
| `NEXTAUTH_URL` | This service's own public URL (e.g. `https://findmygameparts.com`) |
| `KEYCLOAK_ISSUER` | `https://auth.findmygame.parts/realms/find-my-game-parts` |
| `KEYCLOAK_PUBLIC_URL` | `https://auth.findmygame.parts` — **the same host as `KEYCLOAK_ISSUER`'s base**; unlike local dev's container-vs-host split, there's no internal network here at all, since Keycloak isn't on Render |
| `MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE`, `EMAIL_FROM` | Your Mailjet credentials — same provider Keycloak sends through for this domain. `EMAIL_FROM=claim@findmygame.parts` — see "Two-way claim email" above for the reply-forwarding setup |
| `BGG_API_TOKEN` | Your approved BGG application token (register at boardgamegeek.com/using_the_xml_api) |

### 6. Bootstrap the realm

Exec into the Keycloak container and run the same script used for local
dev, pointed at your real production app URL and that instance's real
bootstrap admin credentials:

```bash
docker exec -it <your-keycloak-container> sh
KCADM_ADMIN_USER=<real-admin-username> \
KCADM_ADMIN_PASSWORD=<real-admin-password> \
APP_PUBLIC_URL=https://findmygameparts.com \
  sh -c "$(cat keycloak/setup-realm.sh)"
```

The script only ever touches the `find-my-game-parts` realm — safe to run
against an instance already serving other projects. Because
`APP_PUBLIC_URL` starts with `https://`, it also automatically skips the
`sslRequired=NONE` calls (those are dev-only, for plain-http `localhost`
— see the script's comments). The client it creates is public
(Authorization Code + PKCE, no secret) — nothing to copy anywhere. Then,
in the Keycloak console: create real users, add admins to the `admin`
group, and set up Google/Facebook as identity providers with production
redirect URIs (same steps as local dev, above) — scoped to this realm only.

### 7. Database migrations run automatically

`render.yaml`'s `preDeployCommand` runs this before every deploy starts
serving traffic — no manual step needed. If you ever need to run it by
hand (e.g. troubleshooting), it's a one-off job against the app's database:

```bash
render jobs create <app-service-id> --start-command "npx --yes prisma@7.10.0 migrate deploy"
```

### 8. CI/CD

`.github/workflows/ci.yml` runs lint, typecheck, and the test suite on
every push/PR. Render's own GitHub integration handles continuous deploy
on merge to `main` automatically once the blueprint is connected
(step 3), so this CI is about catching regressions before merge, not
triggering the deploy itself.

Snyk (`snyk test`/`snyk code test`) is temporarily removed from CI —
`snyk code test` hung indefinitely more than once, and even with
per-step timeouts as a backstop the timing was still unreliable enough
to pull from required checks. It's still enforced locally via the
`.husky/pre-push` hook; will be re-added to CI once confirmed stable.

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
- Public `/about` page, content stored in the DB (`AboutPage` model) and
  edited from the "Admin" nav link's About tab (a plain markdown
  textarea + Preview) — no redeploy needed to change it.
- Social link previews (Slack, etc.): `app/opengraph-image.tsx` generates
  a 1200×630 image matching the site's look on the fly (Next.js's
  `opengraph-image` file convention — wires up `og:image`/`twitter:image`
  automatically). Uses the bundled Courier Prime font
  (`assets/fonts/`, SIL OFL 1.1) rather than fetching one at request
  time. `metadataBase` in `app/layout.tsx` is hardcoded to
  `https://findmygame.parts` — update it if you deploy this under a
  different domain, or the generated image URL in link previews will be
  wrong.
- Auth is wired as a generic OIDC client against Keycloak — the Keycloak
  realm/client and Google/Facebook federation are not created yet (see above).
  Self-registration and optional email verification (SMTP) are supported
  via `keycloak/setup-realm.sh` — see "Email verification" above.
- Email notifications use Mailjet — needs real `MJ_APIKEY_PUBLIC`/
  `MJ_APIKEY_PRIVATE` credentials in `.env`. Same provider Keycloak's own
  SMTP config (above) already sends through for this domain — one email
  service for the whole project, not two.
- Deployment: app + database on Render (`render.yaml`), Keycloak
  self-hosted separately (see "Production deployment").

## License

[MIT](LICENSE) — fork it, self-host it, adapt it for your own game
collection. Contributions welcome.
