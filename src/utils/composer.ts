export function normalizeComposerText(value: string): string {
  return value
    .replace(/\u001b\[200~/g, "")
    .replace(/\u001b\[201~/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function shouldSubmitAuth(email: string, password: string): boolean {
  return Boolean(email.trim() && password.trim());
}
