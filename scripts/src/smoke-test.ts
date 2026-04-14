type LoginResponse = {
  ok?: boolean;
  totpRequired?: boolean;
  error?: string;
};

type TotpResponse = {
  ok?: boolean;
  codesRemaining?: number;
  error?: string;
};

type BasicResponse = {
  error?: string;
};

const baseUrl = (process.env.JOB_OPS_BASE_URL ?? "http://localhost:5000").replace(/\/+$/, "");
const username = process.env.JOB_OPS_USERNAME;
const password = process.env.JOB_OPS_PASSWORD;
const totpToken = process.env.JOB_OPS_TOTP_TOKEN;
const jobId = process.env.JOB_OPS_JOB_ID ? Number(process.env.JOB_OPS_JOB_ID) : null;
const runAi = process.env.JOB_OPS_RUN_AI === "true";

if (!username || !password) {
  console.error(
    "JOB_OPS_USERNAME and JOB_OPS_PASSWORD are required. " +
    "Optionally set JOB_OPS_TOTP_TOKEN and JOB_OPS_JOB_ID.",
  );
  process.exit(1);
}

const cookieJar = new Map<string, string>();

function updateCookies(response: Response): void {
  const header = response.headers.get("set-cookie");
  if (!header) return;

  for (const part of header.split(/,(?=[^;]+=[^;]+)/)) {
    const [cookie] = part.split(";", 1);
    const [name, value] = cookie.split("=", 2);
    if (name && value) {
      cookieJar.set(name.trim(), value.trim());
    }
  }
}

function getCookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const cookieHeader = getCookieHeader();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  updateCookies(response);

  const text = await response.text();
  const data = text ? JSON.parse(text) as T : (null as T);

  if (!response.ok) {
    const error =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as BasicResponse).error === "string"
        ? (data as BasicResponse).error
        : `${response.status} ${response.statusText}`;

    throw new Error(`${path}: ${error}`);
  }

  return data;
}

function logStep(message: string): void {
  console.log(`\n==> ${message}`);
}

async function main(): Promise<void> {
  logStep("Checking health");
  const health = await request<{ status: string }>("/api/healthz");
  console.log(`Health: ${health.status}`);

  logStep("Logging in");
  const login = await request<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (login.totpRequired) {
    if (!totpToken) {
      throw new Error("TOTP is required for this account. Set JOB_OPS_TOTP_TOKEN and retry.");
    }

    logStep("Completing TOTP step");
    const totp = await request<TotpResponse>("/api/auth/login/totp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: totpToken }),
    });
    console.log(`TOTP verified: ${Boolean(totp.ok)}`);
  } else {
    console.log("Password login succeeded without TOTP");
  }

  logStep("Verifying authenticated session");
  const me = await request<{ username: string; email: string; totpEnabled: boolean }>("/api/auth/me");
  console.log(`Authenticated as ${me.username} (${me.email})`);

  logStep("Checking core protected endpoints");
  const [claims, jobs, resumes, coverLetters, applications] = await Promise.all([
    request<unknown[]>("/api/claims"),
    request<unknown[]>("/api/jobs"),
    request<unknown[]>("/api/resume-versions"),
    request<unknown[]>("/api/cover-letter-versions"),
    request<unknown[]>("/api/applications"),
  ]);

  console.log(
    `Claims: ${claims.length}, Jobs: ${jobs.length}, Resumes: ${resumes.length}, ` +
    `Cover letters: ${coverLetters.length}, Applications: ${applications.length}`,
  );

  if (runAi) {
    if (!jobId || Number.isNaN(jobId)) {
      throw new Error("JOB_OPS_RUN_AI=true requires a numeric JOB_OPS_JOB_ID.");
    }

    logStep(`Triggering AI smoke flow for job ${jobId}`);
    await request(`/api/jobs/${jobId}/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    await request(`/api/jobs/${jobId}/tailor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    await request(`/api/jobs/${jobId}/cover-letter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("AI endpoints accepted the smoke requests.");
  }

  logStep("Logging out");
  await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  console.log("Smoke test completed successfully.");
}

main().catch((error) => {
  console.error("\nSmoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
