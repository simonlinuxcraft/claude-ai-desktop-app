# Bug-Report-Proxy (Cloudflare Worker)

Kleiner Worker, der den Web3Forms-Access-Key serverseitig haelt. Die App spricht
nur diesen Endpoint an, der Key kommt nie ins Renderer- oder gepackte App-Bundle.

## Setup (einmalig)

1. Cloudflare-Account anlegen (gratis: https://dash.cloudflare.com/sign-up).
2. Wrangler installieren oder via npx benutzen — kein globales Install noetig.
3. In diesem Ordner einloggen:

   ```
   cd cloudflare-worker
   npx wrangler login
   ```

4. Web3Forms-Key als Secret setzen (wird interaktiv abgefragt):

   ```
   npx wrangler secret put WEB3FORMS_KEY
   ```

   Wert: `<your Web3Forms access key>` (der bisher in `main.js` hardcodierte Key).
   **Tipp:** danach im Web3Forms-Dashboard einen NEUEN Key generieren und den
   alten ablaufen lassen — der alte ist bereits in den AppImage-/Snap-Releases
   geleakt und kann von jedem extrahiert werden, der ein altes Binary hat.

5. `APP_SHARED_SECRET` (weak app check): not supported by the app yet, leave
   it unset. The app sends no `X-App-Secret` header, so with the secret set the
   worker answers every submit with 403.

6. Optional: Rate-Limit aktivieren (5 Submits/Stunde/IP).

   ```
   npx wrangler kv namespace create RATE_LIMIT
   ```

   Die zurueckgegebene `id` in `wrangler.toml` eintragen und den Block
   ein-kommentieren.

   Without the KV binding the rate limit does not apply at all. With it, the
   counter is read and written in two steps (not atomic), so parallel requests
   can exceed the limit.

7. Deployen:

   ```
   npx wrangler deploy
   ```

   Im Output steht die URL, z.B.
   `https://claude-desktop-bugreport.<account>.workers.dev`. Diese URL in
   `main.js` als `BUG_REPORT_PROXY` eintragen.

## Endpoint

`POST <worker-url>/submit` — JSON-Body:

```json
{
  "subject": "Bug-Title",
  "message": "Beschreibung",
  "email": "optional@example.com"
}
```

The worker requires an `X-App-Secret` header if `APP_SHARED_SECRET` is set. The app does not send one yet.

Response: `{ "success": true|false, "message": "..." }`

## Re-Deploy nach Code-Aenderung

```
npx wrangler deploy
```

Secrets bleiben erhalten.

## Logs anschauen

```
npx wrangler tail
```
