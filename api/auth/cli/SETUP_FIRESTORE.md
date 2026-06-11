# Switching CLI auth from Vercel Blob → GCP Firestore

The CLI auth handshake was previously backed by Vercel Blob, but heavy
polling burned the "Advanced Operations" quota and Vercel suspended the
store. We migrated to Firestore because the user already has GCP credits
and Firestore has a generous free tier.

## One-time setup

### 1. Enable Firestore in the existing GCP project

```bash
# (Replace MESH-PROJECT with the actual project id used by the LLM proxy.)
gcloud services enable firestore.googleapis.com --project=MESH-PROJECT
```

Or via the console: https://console.cloud.google.com/firestore — click
"Create database" → pick **Native mode** → region close to Vercel
deployments (e.g. `eur3` or `us-central1`).

### 2. Create a service account

```bash
gcloud iam service-accounts create mesh-cli-auth \
  --display-name="Mesh CLI auth handshake" \
  --project=MESH-PROJECT

gcloud projects add-iam-policy-binding MESH-PROJECT \
  --member="serviceAccount:mesh-cli-auth@MESH-PROJECT.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud iam service-accounts keys create ./mesh-cli-auth.json \
  --iam-account=mesh-cli-auth@MESH-PROJECT.iam.gserviceaccount.com \
  --project=MESH-PROJECT
```

That JSON file is the service-account credential. Treat it as a secret.

### 3. Paste the JSON into Vercel as an env var

Vercel dashboard → mesh-marketing-final project → Settings → Environment
Variables → New:
- Name: `GCP_SERVICE_ACCOUNT_JSON`
- Value: paste the entire JSON contents (multi-line is fine)
- Environments: Production, Preview, Development

### 4. Apply a TTL policy on the `cli-auth` collection

The Firestore TTL system auto-deletes documents past their `expiresAt`
field. Saves us a manual cleanup job.

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=cli-auth \
  --enable-ttl \
  --project=MESH-PROJECT
```

### 5. Deploy and verify

```bash
cd sites/marketing && vercel deploy --prod
curl -s "https://try-mesh.com/api/auth/cli/poll?session_id=00000000000000000000000000000000" -i | head -1
# Expect: HTTP/2 204 (no session present)
```

## Tear-down (optional — only after you confirm Vercel Blob is gone)

```bash
# Remove BLOB_READ_WRITE_TOKEN from Vercel env (was used by the old
# poll/complete; nothing reads it after this migration).
vercel env rm BLOB_READ_WRITE_TOKEN production
```

You can also delete the unused @vercel/blob dependency once you're sure
nothing else in the marketing site imports it. (As of this commit only
the CLI auth endpoints did.)
