import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { supabaseRequest } from "./_rideStore.js";

const supabaseAdminRequest = <T>(path: string, init: RequestInit = {}) => supabaseRequest<T>(path, init, true);

export type Account = { id: string; fullName: string; sex: "Male" | "Female" };
type AccountRow = { id: string; full_name: string; sex: "Male" | "Female"; password_hash: string };
type SessionRow = { account_id: string; expires_at: string };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicAccount(row: Pick<AccountRow, "id" | "full_name" | "sex">): Account {
  return { id: row.id, fullName: row.full_name, sex: row.sex };
}

export async function signUp(fullName: string, sex: "Male" | "Female", password: string): Promise<{ account: Account; token: string }> {
  const name = fullName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new Error("Enter a valid name");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  const rows = await supabaseAdminRequest<AccountRow[]>("lexride_accounts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ full_name: name, sex, password_hash: hashPassword(password) }),
  });
  const account = rows[0];
  if (!account) throw new Error("Account could not be created");
  return { account: publicAccount(account), token: await createSession(account.id) };
}

export async function signIn(fullName: string, password: string): Promise<{ account: Account; token: string }> {
  const name = fullName.trim().replace(/\s+/g, " ");
  const candidates = await supabaseAdminRequest<AccountRow[]>(`lexride_accounts?full_name=ilike.${encodeURIComponent(name)}&select=id,full_name,sex,password_hash&limit=20`);
  const account = candidates.find((row) => verifyPassword(password, row.password_hash));
  if (!account) throw new Error("Name or password is incorrect");
  return { account: publicAccount(account), token: await createSession(account.id) };
}

async function createSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await supabaseAdminRequest("lexride_sessions", {
    method: "POST",
    body: JSON.stringify({ account_id: accountId, token_hash: tokenHash(token), expires_at: expiresAt }),
  });
  return token;
}

export async function getAccountFromToken(token: string | undefined): Promise<Account | null> {
  if (!token) return null;
  const sessions = await supabaseAdminRequest<SessionRow[]>(`lexride_sessions?token_hash=eq.${encodeURIComponent(tokenHash(token))}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=account_id,expires_at&limit=1`);
  const session = sessions[0];
  if (!session) return null;
  const accounts = await supabaseAdminRequest<AccountRow[]>(`lexride_accounts?id=eq.${encodeURIComponent(session.account_id)}&select=id,full_name,sex&limit=1`);
  return accounts[0] ? publicAccount(accounts[0]) : null;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await supabaseAdminRequest(`lexride_sessions?token_hash=eq.${encodeURIComponent(tokenHash(token))}`, { method: "DELETE" });
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  const match = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
