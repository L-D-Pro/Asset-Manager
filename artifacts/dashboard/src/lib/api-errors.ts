export function getErrorMessage(
 error: unknown,
 fallback: string,
): string {
 if (!(error instanceof Error)) {
 return fallback;
 }

 const message = error.message.trim();
 const httpPrefixMatch = /^HTTP \d+ [^:]+:\s*(.+)$/.exec(message);

 if (httpPrefixMatch?.[1]) {
 return httpPrefixMatch[1];
 }

 return message || fallback;
}

export function hasHttpStatus(error: unknown, status: number): boolean {
 return error instanceof Error && error.message.includes(`HTTP ${status} `);
}
