# Dev/Test Database Reset

This guide is the clean reset path for the current testing-stage app.

Use this when you do **not** need to preserve existing users or data.

## Recommendation

Keep `C:\Users\uberc\LD Pro\Asset-Manager\lib\db\migrations\user-ownership.sql` for a future production-preservation migration, but do **not** use it for local resets.

For local development, the right path is:

1. keep `DATABASE_URL` free to point at Neon or another main/dev database
2. point `LOCAL_DATABASE_URL` at a disposable local Postgres database
3. drop and recreate that local database
4. apply the current Drizzle schema from scratch
5. let the API bootstrap the first admin user
6. create test users and seed sample private data through the API

The current schema already contains the Phase 2 `user_id` ownership columns directly. A fresh schema push creates them without any backfill step.

## Preconditions

- Node 24+
- `corepack pnpm install` already run
- local PostgreSQL running
- `.env` present at `C:\Users\uberc\LD Pro\Asset-Manager\.env`
- `DATABASE_URL` may point to Neon or another non-local environment
- `LOCAL_DATABASE_URL` points to a **dedicated local disposable** database such as:

```env
DATABASE_URL=postgresql://neondb_owner:password@ep-example.us-west-2.aws.neon.tech/neondb?sslmode=require
LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/jobops_dev
```

Do not run this reset flow against Neon or any shared database. The bundled reset helper uses `LOCAL_DATABASE_URL` by default and refuses any host other than `localhost`, `127.0.0.1`, or `::1`.
Do not point `LOCAL_DATABASE_URL` at `postgres`, `template0`, or `template1`. Use a dedicated local dev database name such as `jobops_dev` or `asset_manager_dev`.

## 1. Reset the local database

From `C:\Users\uberc\LD Pro\Asset-Manager`:

```powershell
node --env-file=.env .\lib\db\reset-dev-db.mjs
```

That command:

- reads `LOCAL_DATABASE_URL`
- refuses non-local hosts
- terminates active connections to the target database
- drops the database
- recreates it empty

Safety rules:

- it refuses to run if `LOCAL_DATABASE_URL` is missing
- it never uses `DATABASE_URL` by default
- it only uses `DATABASE_URL` if you pass `--allow-database-url`
- even with `--allow-database-url`, it still refuses any non-local host
- it refuses reserved database names: `postgres`, `template0`, and `template1`

Example fallback command if you intentionally want to borrow `DATABASE_URL` for a local-only sandbox:

```powershell
node --env-file=.env .\lib\db\reset-dev-db.mjs --allow-database-url
```

That flag is only for unusual local setups. It is not for Neon.

## Neon note

If `DATABASE_URL` points to Neon:

- do **not** use `reset-dev-db.mjs`
- do **not** attempt to drop/reset the Neon database from this script
- for disposable Neon testing, create a disposable Neon branch or database and run schema apply commands manually

Example manual schema apply against whatever `DATABASE_URL` currently targets:

```powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern '^DATABASE_URL=(.*)$' | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run push
```

## 2. Apply the current schema

Still from the repo root:

```powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern '^DATABASE_URL=(.*)$' | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run push
```

This is the authoritative dev/test schema creation step. It creates the current user-owned tables directly from `lib\db\src\schema\*.ts`.

## 3. Create the first admin user

Set first-run bootstrap variables in `.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_EMAIL=admin@example.com
```

Then start the API server:

```powershell
$env:PORT = '5000'
corepack pnpm --filter @workspace/api-server run dev
```

On startup, if `admin_users` is empty, the API creates the bootstrap admin automatically.

Important current behavior:

- bootstrap admin is created with `role = 'admin'`
- bootstrap admin is created with `email_verified = true`
- bootstrap admin is created with `is_active = true`

After first successful startup, remove `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` from `.env`.

## 4. Log in as the bootstrap admin

Open a new PowerShell window and run:

```powershell
$loginBody = @{
  username = 'admin'
  password = 'YourStrongPassword123!'
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/auth/login' `
  -ContentType 'application/json' `
  -Body $loginBody `
  -SessionVariable adminSession

$adminLogin
```

Expected response:

```json
{ "ok": true }
```

## 5. Create two test users

Create `user_a`:

```powershell
$userA = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/users' `
  -WebSession $adminSession `
  -ContentType 'application/json' `
  -Body (@{
    username = 'user_a'
    email = 'user_a@example.com'
    firstName = 'User'
    lastName = 'A'
    role = 'user'
  } | ConvertTo-Json)

$userA
```

Create `user_b`:

```powershell
$userB = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/users' `
  -WebSession $adminSession `
  -ContentType 'application/json' `
  -Body (@{
    username = 'user_b'
    email = 'user_b@example.com'
    firstName = 'User'
    lastName = 'B'
    role = 'user'
  } | ConvertTo-Json)

$userB
```

Important current behavior:

- admin-created users are created with `email_verified = true`
- admin-created users are created with `is_active = true`
- each response returns a one-time `generatedPassword`

Save the generated passwords into shell variables:

```powershell
$userAPassword = $userA.generatedPassword
$userBPassword = $userB.generatedPassword
```

## 6. Log in as both test users

```powershell
$null = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/auth/login' `
  -ContentType 'application/json' `
  -Body (@{
    username = 'user_a'
    password = $userAPassword
  } | ConvertTo-Json) `
  -SessionVariable userASession

$null = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/auth/login' `
  -ContentType 'application/json' `
  -Body (@{
    username = 'user_b'
    password = $userBPassword
  } | ConvertTo-Json) `
  -SessionVariable userBSession
```

## 7. Seed sample private records for `user_a`

### Create a base resume

```powershell
$baseResume = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/base-resume' `
  -WebSession $userASession `
  -ContentType 'application/json' `
  -Body (@{
    label = 'Backend Resume'
    contentText = @'
Jane Doe
Senior Backend Engineer

Experience
- Built TypeScript APIs with PostgreSQL and Redis.
- Improved CI reliability and deployment safety.
'@
  } | ConvertTo-Json)
```

### Create a claim

```powershell
$claim = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/claims' `
  -WebSession $userASession `
  -ContentType 'application/json' `
  -Body (@{
    summary = 'Built and maintained Node.js and TypeScript backend services.'
    evidence = 'Self-attested test claim'
    domain = 'backend'
    applicableTags = @('nodejs', 'typescript', 'postgres')
  } | ConvertTo-Json)
```

### Create a job

```powershell
$job = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/jobs' `
  -WebSession $userASession `
  -ContentType 'application/json' `
  -Body (@{
    title = 'Senior Backend Engineer'
    company = 'Acme Corp'
    location = 'Remote'
    rawJdText = 'Build backend APIs, PostgreSQL queries, and internal platform tooling.'
  } | ConvertTo-Json)
```

### Create an application

```powershell
$application = Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/applications' `
  -WebSession $userASession `
  -ContentType 'application/json' `
  -Body (@{
    jobId = $job.id
    status = 'applied'
    applyMode = 'assisted'
    platform = 'greenhouse'
  } | ConvertTo-Json)
```

## 8. Verify private data ownership behavior

The expected behavior is:

- private inserts derive `userId` from the authenticated session
- clients never send `userId`
- cross-user access returns not found behavior
- admin users do not bypass private ownership rules on ordinary business routes

### Verify `user_b` cannot read `user_a`'s job

```powershell
try {
  Invoke-RestMethod `
    -Method GET `
    -Uri "http://localhost:5000/api/jobs/$($job.id)" `
    -WebSession $userBSession
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected result: `404`

### Verify `user_b` cannot mutate `user_a`'s job

```powershell
try {
  Invoke-RestMethod `
    -Method PATCH `
    -Uri "http://localhost:5000/api/jobs/$($job.id)" `
    -WebSession $userBSession `
    -ContentType 'application/json' `
    -Body (@{ title = 'Stolen Job' } | ConvertTo-Json)
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected result: `404`

### Verify admin cannot bypass private ownership through ordinary user routes

```powershell
try {
  Invoke-RestMethod `
    -Method GET `
    -Uri "http://localhost:5000/api/jobs/$($job.id)" `
    -WebSession $adminSession
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected result: `404`

## 9. Verify global config remains global but admin-protected

Ordinary authenticated user:

```powershell
try {
  Invoke-RestMethod `
    -Method PATCH `
    -Uri 'http://localhost:5000/api/chat/lever-config' `
    -WebSession $userASession `
    -ContentType 'application/json' `
    -Body (@{} | ConvertTo-Json)
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected result: `403`

Admin user:

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri 'http://localhost:5000/api/chat/lever-config' `
  -WebSession $adminSession
```

Expected result: current global config payload.

## 10. Optional faster reset when you do not need to recreate the database

If the schema is already in place and you only want to wipe app test data while preserving admin users and global config, use the admin reset endpoint:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri 'http://localhost:5000/api/admin/test-reset' `
  -WebSession $adminSession `
  -ContentType 'application/json' `
  -Body (@{ confirmation = 'RESET' } | ConvertTo-Json)
```

That preserves tables such as:

- `admin_users`
- `ai_learning_config`
- `ai_model_configs`
- `ai_prompt_versions`
- `best_practices`
- `invite_codes`
- `job_sources`
- `site_adapters`
- `user_usage_limits`
- `waitlist`

## Summary of exact local reset commands

```powershell
cd 'C:\Users\uberc\LD Pro\Asset-Manager'

node --env-file=.env .\lib\db\reset-dev-db.mjs

$env:DATABASE_URL = (Select-String -Path .env -Pattern '^DATABASE_URL=(.*)$' | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run push

$env:PORT = '5000'
corepack pnpm --filter @workspace/api-server run dev
```

Minimal `.env` shape for this setup:

```env
DATABASE_URL=postgresql://neondb_owner:password@ep-example.us-west-2.aws.neon.tech/neondb?sslmode=require
LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/jobops_dev
```
