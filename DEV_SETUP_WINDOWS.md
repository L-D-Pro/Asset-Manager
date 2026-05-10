# Windows Dev Environment Setup Guide

Step-by-step guide to get `pnpm run dev` working on a fresh Windows machine for this project.

---

## Prerequisites

- Windows 10 or 11
- Node.js **24.x** (Current, not LTS — this project requires `>=24.0.0`)

---

## Step 1 — Install Node.js 24

Open PowerShell (normal user) and run:

```powershell
winget install OpenJS.NodeJS
```

> Use `OpenJS.NodeJS` (not `OpenJS.NodeJS.LTS`) to get Node 24.x.

After install, **close and reopen PowerShell**, then verify:

```powershell
node --version
# Expected: v24.x.x
```

---

## Step 2 — Enable Corepack (as Administrator)

Corepack ships with Node and manages `pnpm` for you. It needs admin to register shims in `C:\Program Files\nodejs\`.

1. Press `Win`, type `PowerShell`
2. Right-click **Windows PowerShell** → **Run as administrator**
3. Click **Yes** on the UAC prompt

In the admin PowerShell, run:

```powershell
corepack enable
```

---

## Step 3 — Allow PowerShell Scripts (as Administrator)

Still in the admin PowerShell, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

Type `Y` and press Enter when prompted.

> This allows local scripts to run. Scripts downloaded from the internet must be signed. This is the standard safe setting for developers on Windows.

You can now close the admin PowerShell.

---

## Step 4 — Verify pnpm

Open a **normal (non-admin) PowerShell** and run:

```powershell
pnpm --version
```

If prompted by Corepack to download `pnpm-10.x.x`, type `Y` and press Enter. This only happens once.

Expected output: `10.x.x`

---

## Step 5 — Install Project Dependencies

Navigate to the project root and install:

```powershell
cd C:\Users\uberc\L-D-Pro\Asset-Manager
corepack pnpm install
```

---

## Step 6 — Configure Environment Variables

Ensure a `.env` file exists in the project root. Required keys:

```
DATABASE_URL=
SESSION_SECRET=
AI_INTEGRATIONS_OPENROUTER_API_KEY=
AI_INTEGRATIONS_OPENROUTER_BASE_URL=
```

> Never commit this file. Ask a team member for the values if needed.

---

## Step 7 — Start the Dev Server

```powershell
corepack pnpm run dev
```

This starts both the API server and the dashboard in parallel.

---

## Summary of One-Time Setup Commands

```powershell
# 1. Install Node 24 (normal PowerShell)
winget install OpenJS.NodeJS

# 2. Admin PowerShell — enable corepack + allow scripts
corepack enable
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine

# 3. Normal PowerShell — install deps and run
cd C:\Users\uberc\L-D-Pro\Asset-Manager
corepack pnpm install
corepack pnpm run dev
```
