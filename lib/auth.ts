import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { all, one, run } from "./db";
import { token } from "./password";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  is_admin: number;
  university_id: string | null;
  student_no: string | null;
  faculty: string | null;
  bio: string | null;
  interests: string | null;
};

export type Membership = {
  id: string;
  org_id: string;
  role_key: string;
  status: string;
  org_name: string;
  org_slug: string;
  org_kind: string;
  org_emoji: string;
  org_color: string;
};

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) return null;
  const user = one<SessionUser>(
    `SELECT u.id, u.email, u.full_name, u.avatar_emoji, u.avatar_url, u.is_admin, u.university_id, u.student_no, u.faculty, u.bio, u.interests
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    sid
  );
  return user ?? null;
});

/** Sayt admini — barcha tashkilotlar bo'yicha to'liq huquq. */
export function isAdmin(user: { is_admin?: number | boolean | null } | null | undefined): boolean {
  return Boolean(user?.is_admin);
}

/**
 * Foydalanuvchining tashkilotlardagi a'zoliklari.
 * Sayt admini uchun barcha tashkilotlar «Prezident» huquqi bilan qaytariladi.
 */
export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  const user = one<{ is_admin: number }>("SELECT is_admin FROM users WHERE id = ?", userId);
  if (user?.is_admin) {
    return all<Membership>(
      `SELECT 'admin-' || o.id AS id, o.id AS org_id, 'president' AS role_key, 'active' AS status,
              o.name AS org_name, o.slug AS org_slug, o.kind AS org_kind, o.emoji AS org_emoji, o.color AS org_color
       FROM orgs o WHERE o.is_active = 1 ORDER BY o.name`
    );
  }
  return all<Membership>(
    `SELECT m.id, m.org_id, m.role_key, m.status, o.name AS org_name, o.slug AS org_slug,
            o.kind AS org_kind, o.emoji AS org_emoji, o.color AS org_color
     FROM memberships m JOIN orgs o ON o.id = m.org_id
     WHERE m.user_id = ? AND m.status = 'active'
     ORDER BY CASE m.role_key WHEN 'president' THEN 0 WHEN 'vice_president' THEN 1 WHEN 'project_lead' THEN 2 WHEN 'coordinator' THEN 3 ELSE 4 END`,
    userId
  );
});

export async function requireUser(next = "/"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function createSession(userId: string): Promise<void> {
  const sid = token(24);
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${expires.getFullYear()}-${pad(expires.getMonth() + 1)}-${pad(expires.getDate())} ${pad(
    expires.getHours()
  )}:${pad(expires.getMinutes())}:${pad(expires.getSeconds())}`;
  run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)", sid, userId, stamp);
  const store = await cookies();
  store.set("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get("sid")?.value;
  if (sid) run("DELETE FROM sessions WHERE id = ?", sid);
  store.delete("sid");
}

/** Organizator paneli uchun tanlangan tashkilot (cookie yoki birinchi a'zolik). */
export const getActiveOrg = cache(async (userId: string): Promise<Membership | null> => {
  const memberships = await getMemberships(userId);
  if (memberships.length === 0) return null;
  const chosen = (await cookies()).get("activeOrg")?.value;
  return memberships.find((m) => m.org_id === chosen) ?? memberships[0];
});
