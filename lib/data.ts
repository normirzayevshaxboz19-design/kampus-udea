import { all, db, one, run } from "./db";
import { now } from "./format";
import { ticketCode } from "./password";
import { etiquetteError } from "./moderation";

export type EventRow = {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  emoji: string;
  visibility: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  reg_opens_at: string | null;
  reg_closes_at: string | null;
  capacity: number | null;
  requirements: string | null;
  status: string;
  org_name: string;
  org_slug: string;
  org_emoji: string;
  org_color: string;
  confirmed: number;
  waitlist: number;
};

const EVENT_COLUMNS = `
  e.id, e.org_id, e.project_id, e.title, e.slug, e.description, e.emoji, e.visibility,
  e.location, e.starts_at, e.ends_at, e.reg_opens_at, e.reg_closes_at, e.capacity,
  e.requirements, e.status,
  o.name AS org_name, o.slug AS org_slug, o.emoji AS org_emoji, o.color AS org_color,
  (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('confirmed','attended')) AS confirmed,
  (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'waitlist') AS waitlist`;

const EVENT_FROM = `FROM events e JOIN orgs o ON o.id = e.org_id`;

const EVENT_SELECT = `SELECT ${EVENT_COLUMNS} ${EVENT_FROM}`;

export function upcomingEvents(limit = 6): EventRow[] {
  return all<EventRow>(
    `${EVENT_SELECT}
     WHERE e.visibility = 'public' AND e.status IN ('published','closed') AND e.starts_at >= ?
     ORDER BY e.starts_at LIMIT ?`,
    now(),
    limit
  );
}

export function allPublicEvents(): EventRow[] {
  return all<EventRow>(
    `${EVENT_SELECT} WHERE e.visibility = 'public' AND e.status != 'draft' ORDER BY e.starts_at`
  );
}

export function eventsOfOrg(orgId: string, includeInternal = false): EventRow[] {
  return all<EventRow>(
    `${EVENT_SELECT}
     WHERE e.org_id = ? ${includeInternal ? "" : "AND e.visibility = 'public'"}
     ORDER BY e.starts_at`,
    orgId
  );
}

export function getEvent(slug: string): EventRow | undefined {
  return one<EventRow>(`${EVENT_SELECT} WHERE e.slug = ?`, slug);
}

export function getEventById(id: string): EventRow | undefined {
  return one<EventRow>(`${EVENT_SELECT} WHERE e.id = ?`, id);
}

/** Sayt admini uchun barcha tashkilotlarning barcha tadbirlari. */
export function allEvents(): EventRow[] {
  return all<EventRow>(`${EVENT_SELECT} ORDER BY e.starts_at DESC`);
}

export function slugTaken(slug: string, exceptId?: string): boolean {
  const row = one<{ id: string }>("SELECT id FROM events WHERE slug = ?", slug);
  return Boolean(row && row.id !== exceptId);
}

export function registrationFor(eventId: string, userId: string) {
  return one<{ id: string; status: string; ticket_code: string; checked_in_at: string | null; promoted_at: string | null }>(
    "SELECT id, status, ticket_code, checked_in_at, promoted_at FROM registrations WHERE event_id = ? AND user_id = ?",
    eventId,
    userId
  );
}

export function participants(eventId: string) {
  return all<{
    id: string;
    user_id: string;
    full_name: string;
    avatar_emoji: string;
    avatar_url: string | null;
    faculty: string | null;
    email: string;
    status: string;
    ticket_code: string;
    created_at: string;
    checked_in_at: string | null;
    promoted_at: string | null;
  }>(
    `SELECT r.id, r.user_id, u.full_name, u.avatar_emoji, u.avatar_url, u.faculty, u.email, r.status,
            r.ticket_code, r.created_at, r.checked_in_at, r.promoted_at
     FROM registrations r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ?
     ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'attended' THEN 1
                   WHEN 'waitlist' THEN 2 ELSE 3 END, r.created_at`,
    eventId
  );
}

export function pendingRegistrationCounts(): Record<string, number> {
  const rows = all<{ event_id: string; c: number }>(
    "SELECT event_id, COUNT(*) AS c FROM registrations WHERE status = 'pending' GROUP BY event_id"
  );
  return Object.fromEntries(rows.map((r) => [r.event_id, r.c]));
}

export type RegistrationResult = { ok: boolean; status?: string; error?: string };

export function registerForEvent(eventId: string, userId: string): RegistrationResult {
  return db().transaction((): RegistrationResult => {
    const event = one<{
      status: string;
      visibility: string;
      org_id: string;
      capacity: number | null;
      reg_opens_at: string | null;
      reg_closes_at: string | null;
      slug: string;
    }>(
      "SELECT status, visibility, org_id, capacity, reg_opens_at, reg_closes_at, slug FROM events WHERE id = ?",
      eventId
    );
    if (!event) return { ok: false, error: "Tadbir topilmadi" };
    if (event.status !== "published") return { ok: false, error: "Bu tadbir uchun ro'yxatdan o'tish yopilgan" };
    if (event.visibility === "internal" && !orgAccess(event.org_id, userId)) {
      return { ok: false, error: "Bu tadbir faqat klub a'zolari uchun" };
    }

    const stamp = now();
    if (event.reg_opens_at && stamp < event.reg_opens_at) return { ok: false, error: "Ro'yxatdan o'tish hali boshlanmagan" };
    if (event.reg_closes_at && stamp > event.reg_closes_at) return { ok: false, error: "Ro'yxatdan o'tish muddati tugagan" };

    const existing = one<{ id: string; status: string }>(
      "SELECT id, status FROM registrations WHERE event_id = ? AND user_id = ?",
      eventId,
      userId
    );
    if (existing && !["cancelled", "rejected"].includes(existing.status)) {
      return { ok: false, error: "Siz allaqachon ro'yxatdan o'tgansiz" };
    }

    // Bir bosishda RSVP: joy bo'lsa darhol tasdiqlanadi, to'lgan bo'lsa navbatga qo'yiladi.
    const taken =
      one<{ c: number }>(
        "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status IN ('confirmed','attended')",
        eventId
      )?.c ?? 0;
    const full = event.capacity !== null && taken >= event.capacity;
    const status = full ? "waitlist" : "confirmed";
    const code = uniqueTicketCode(event.slug.slice(0, 2).toUpperCase());

    if (existing) {
      run(
        "UPDATE registrations SET status = ?, ticket_code = ?, created_at = datetime('now'), checked_in_at = NULL WHERE id = ?",
        status,
        code,
        existing.id
      );
    } else {
      run(
        "INSERT INTO registrations (id, event_id, user_id, status, ticket_code) VALUES (?,?,?,?,?)",
        `r-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        eventId,
        userId,
        status,
        code
      );
    }
    return { ok: true, status };
  })();
}

/** Takrorlanmaydigan chipta kodini yaratadi (masalan ZA-4821). */
export function uniqueTicketCode(prefix: string): string {
  const base = (prefix || "UD").replace(/[^A-Z0-9]/g, "").slice(0, 3) || "UD";
  for (let i = 0; i < 40; i += 1) {
    const code = ticketCode(base);
    const busy = one<{ id: string }>("SELECT id FROM registrations WHERE ticket_code = ?", code);
    if (!busy) return code;
  }
  return `${base}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export type PulsePass = {
  registration_id: string;
  event_id: string;
  slug: string;
  title: string;
  emoji: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  org_name: string;
  org_color: string;
  status: string;
  ticket_code: string;
  checked_in_at: string | null;
  promoted_at: string | null;
  capacity: number | null;
  confirmed: number;
  waitlist: number;
  wait_position: number;
};

/** Foydalanuvchining barcha chiptalari (QR shu kodga bog'langan). */
export function pulsePasses(userId: string): PulsePass[] {
  return all<PulsePass>(
    `SELECT r.id AS registration_id, r.event_id, r.status, r.ticket_code, r.checked_in_at, r.promoted_at,
            e.slug, e.title, e.emoji, e.location, e.starts_at, e.ends_at, e.capacity,
            o.name AS org_name, o.color AS org_color,
            (SELECT COUNT(*) FROM registrations x WHERE x.event_id = e.id AND x.status IN ('confirmed','attended')) AS confirmed,
            (SELECT COUNT(*) FROM registrations x WHERE x.event_id = e.id AND x.status = 'waitlist') AS waitlist,
            CASE WHEN r.status = 'waitlist' THEN
              (SELECT COUNT(*) FROM registrations w WHERE w.event_id = e.id AND w.status = 'waitlist' AND w.created_at <= r.created_at)
            ELSE 0 END AS wait_position
     FROM registrations r JOIN events e ON e.id = r.event_id JOIN orgs o ON o.id = e.org_id
     WHERE r.user_id = ? AND r.status IN ('pending','confirmed','waitlist','attended')
     ORDER BY e.starts_at`,
    userId
  );
}

export type TicketInfo = {
  registration_id: string;
  status: string;
  ticket_code: string;
  checked_in_at: string | null;
  user_id: string;
  full_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  faculty: string | null;
  email: string;
  event_id: string;
  event_title: string;
  event_start: string;
  event_end: string | null;
  event_location: string | null;
  event_status: string;
  org_id: string;
  org_name: string;
};

/** QR ichidagi kod bo'yicha chiptani topadi (skaner uchun). */
export function ticketByCode(rawCode: string): TicketInfo | undefined {
  const code = rawCode.trim().toUpperCase();
  if (!code) return undefined;
  return one<TicketInfo>(
    `SELECT r.id AS registration_id, r.status, r.ticket_code, r.checked_in_at,
            u.id AS user_id, u.full_name, u.avatar_emoji, u.avatar_url, u.faculty, u.email,
            e.id AS event_id, e.title AS event_title, e.starts_at AS event_start, e.ends_at AS event_end,
            e.location AS event_location, e.status AS event_status,
            o.id AS org_id, o.name AS org_name
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     JOIN events e ON e.id = r.event_id
     JOIN orgs o ON o.id = e.org_id
     WHERE upper(r.ticket_code) = ?`,
    code
  );
}

/** Chiptani “kirdi” deb belgilaydi. Allaqachon belgilangan bo'lsa — xato qaytaradi. */
export function checkInTicket(registrationId: string): { ok: boolean; error?: string } {
  const reg = one<{ status: string; checked_in_at: string | null }>(
    "SELECT status, checked_in_at FROM registrations WHERE id = ?",
    registrationId
  );
  if (!reg) return { ok: false, error: "Chipta topilmadi" };
  if (reg.status === "cancelled" || reg.status === "rejected") return { ok: false, error: "Chipta bekor qilingan" };
  if (reg.status === "waitlist" || reg.status === "pending") return { ok: false, error: "Chipta hali tasdiqlanmagan" };
  if (reg.checked_in_at) return { ok: false, error: "Bu chipta allaqachon ishlatilgan" };
  run("UPDATE registrations SET status = 'attended', checked_in_at = datetime('now') WHERE id = ?", registrationId);
  return { ok: true };
}

/** Tashkilotchi arizani tasdiqlaydi (joy bo'lsa) yoki rad etadi. */
export function decideRegistration(registrationId: string, eventId: string, decision: "approve" | "reject") {
  const result = db().transaction((): { ok: boolean; status?: string; error?: string } => {
    const reg = one<{ id: string; status: string }>(
      "SELECT id, status FROM registrations WHERE id = ? AND event_id = ?",
      registrationId,
      eventId
    );
    if (!reg) return { ok: false, error: "Ariza topilmadi" };

    if (decision === "reject") {
      run("UPDATE registrations SET status = 'rejected', checked_in_at = NULL WHERE id = ?", reg.id);
      return { ok: true, status: "rejected" };
    }
    const capacity = one<{ capacity: number | null }>("SELECT capacity FROM events WHERE id = ?", eventId);
    const taken =
      one<{ c: number }>(
        "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status IN ('confirmed','attended')",
        eventId
      )?.c ?? 0;
    const full = capacity?.capacity !== null && capacity?.capacity !== undefined && taken >= capacity.capacity;
    run("UPDATE registrations SET status = ? WHERE id = ?", full ? "waitlist" : "confirmed", reg.id);
    return { ok: true, status: full ? "waitlist" : "confirmed" };
  })();

  // Ariza rad etilganda bo'shagan joyni navbatdagilarga beramiz.
  if (result.ok && decision === "reject") promoteFromWaitlist(eventId);
  return result;
}

export function cancelRegistration(eventId: string, userId: string): void {
  db().transaction(() => {
    run(
      "UPDATE registrations SET status = 'cancelled', checked_in_at = NULL WHERE event_id = ? AND user_id = ?",
      eventId,
      userId
    );
  })();
  // Bekor qilingan o'rin navbatdagi birinchi ishtirokchiga o'tadi.
  promoteFromWaitlist(eventId);
}

/**
 * Navbatdagilarni bo'sh joylar hisobiga avtomatik tasdiqlaydi (FIFO).
 * `limit` berilmasa — qancha joy bo'sh bo'lsa, shuncha kishi ko'chiriladi.
 * Nechta kishi tasdiqlangani qaytadi.
 */
export function promoteFromWaitlist(eventId: string, limit?: number): number {
  return db().transaction((): number => {
    const event = one<{ capacity: number | null }>("SELECT capacity FROM events WHERE id = ?", eventId);
    if (!event) return 0;

    const taken =
      one<{ c: number }>(
        "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status IN ('confirmed','attended')",
        eventId
      )?.c ?? 0;

    const freeSeats = event.capacity === null ? Number.MAX_SAFE_INTEGER : Math.max(0, event.capacity - taken);
    const seats = Math.min(freeSeats, limit ?? freeSeats);
    if (seats <= 0) return 0;

    const waiting = all<{ id: string }>(
      "SELECT id FROM registrations WHERE event_id = ? AND status = 'waitlist' ORDER BY created_at, rowid LIMIT ?",
      eventId,
      seats
    );
    for (const w of waiting) {
      run("UPDATE registrations SET status = 'confirmed', promoted_at = datetime('now') WHERE id = ?", w.id);
    }
    return waiting.length;
  })();
}

export type ClubRow = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  emoji: string;
  color: string;
  telegram: string | null;
  instagram: string | null;
  members: number;
  upcoming: number;
};

export function clubs(): ClubRow[] {
  return all<ClubRow>(
    `SELECT o.id, o.name, o.slug, o.tagline, o.description, o.emoji, o.color, o.telegram, o.instagram,
       (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS members,
       (SELECT COUNT(*) FROM events e WHERE e.org_id = o.id AND e.visibility = 'public' AND e.starts_at >= ?) AS upcoming
     FROM orgs o WHERE o.kind = 'club' AND o.is_active = 1
     ORDER BY members DESC, o.name`,
    now()
  );
}

export function getClub(slug: string): ClubRow | undefined {
  return one<ClubRow>(
    `SELECT o.id, o.name, o.slug, o.tagline, o.description, o.emoji, o.color, o.telegram, o.instagram,
       (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS members,
       (SELECT COUNT(*) FROM events e WHERE e.org_id = o.id AND e.visibility = 'public' AND e.starts_at >= ?) AS upcoming
     FROM orgs o WHERE o.slug = ?`,
    now(),
    slug
  );
}

export function orgMembers(orgId: string) {
  return all<{
    id: string;
    user_id: string;
    full_name: string;
    avatar_emoji: string;
    avatar_url: string | null;
    faculty: string | null;
    role_key: string;
    joined_at: string | null;
  }>(
    `SELECT m.id, m.user_id, u.full_name, u.avatar_emoji, u.avatar_url, u.faculty, m.role_key, m.joined_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ? AND m.status = 'active'
     ORDER BY CASE m.role_key WHEN 'president' THEN 0 WHEN 'vice_president' THEN 1 WHEN 'project_lead' THEN 2 WHEN 'coordinator' THEN 3 ELSE 4 END, u.full_name`,
    orgId
  );
}

export function pendingRequests(orgId: string) {
  return all<{
    id: string;
    user_id: string;
    full_name: string;
    avatar_emoji: string;
    avatar_url: string | null;
    faculty: string | null;
    created_at: string;
  }>(
    `SELECT m.id, m.user_id, u.full_name, u.avatar_emoji, u.avatar_url, u.faculty, m.created_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ? AND m.status = 'pending' ORDER BY m.created_at`,
    orgId
  );
}

export function membershipOf(userId: string, orgId: string) {
  return one<{ id: string; status: string; role_key: string }>(
    "SELECT id, status, role_key FROM memberships WHERE user_id = ? AND org_id = ?",
    userId,
    orgId
  );
}

export function joinClub(userId: string, orgId: string) {
  const existing = membershipOf(userId, orgId);
  if (existing) {
    if (existing.status === "pending") return { ok: false, error: "Arizangiz allaqachon yuborilgan" };
    if (existing.status === "active") return { ok: false, error: "Siz allaqachon a'zosiz" };
    run("UPDATE memberships SET status = 'pending' WHERE id = ?", existing.id);
    return { ok: true };
  }
  run(
    "INSERT INTO memberships (id, user_id, org_id, role_key, status) VALUES (?,?,?,?, 'pending')",
    `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    orgId,
    "member"
  );
  return { ok: true };
}

export function myRegistrations(userId: string) {
  return all<EventRow & { reg_status: string; ticket_code: string }>(
    `SELECT ${EVENT_COLUMNS},
            (SELECT r.status FROM registrations r WHERE r.event_id = e.id AND r.user_id = ?) AS reg_status,
            (SELECT r.ticket_code FROM registrations r WHERE r.event_id = e.id AND r.user_id = ?) AS ticket_code
     ${EVENT_FROM}
     WHERE e.id IN (SELECT event_id FROM registrations WHERE user_id = ? AND status != 'cancelled')
     ORDER BY e.starts_at`,
    userId,
    userId,
    userId
  );
}

export function myClubs(userId: string) {
  return all<ClubRow>(
    `SELECT o.id, o.name, o.slug, o.tagline, o.description, o.emoji, o.color, o.telegram, o.instagram,
       (SELECT COUNT(*) FROM memberships m2 WHERE m2.org_id = o.id AND m2.status = 'active') AS members,
       (SELECT COUNT(*) FROM events e WHERE e.org_id = o.id AND e.visibility = 'public' AND e.starts_at >= ?) AS upcoming
     FROM orgs o JOIN memberships m ON m.org_id = o.id
     WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name`,
    now(),
    userId
  );
}

export function myPendingClubs(userId: string) {
  return all<{ org_id: string; name: string; emoji: string; created_at: string }>(
    `SELECT m.org_id, o.name, o.emoji, m.created_at FROM memberships m JOIN orgs o ON o.id = m.org_id
     WHERE m.user_id = ? AND m.status = 'pending'`,
    userId
  );
}

export function announcementsFor(limit = 4, orgIds?: string[]) {
  if (orgIds && orgIds.length) {
    const marks = orgIds.map(() => "?").join(",");
    return all<{ id: string; title: string; body: string | null; created_at: string; org_name: string | null; org_emoji: string | null }>(
      `SELECT a.id, a.title, a.body, a.created_at, o.name AS org_name, o.emoji AS org_emoji
       FROM announcements a LEFT JOIN orgs o ON o.id = a.org_id
       WHERE a.audience = 'public' OR a.org_id IN (${marks})
       ORDER BY a.created_at DESC LIMIT ?`,
      ...orgIds,
      limit
    );
  }
  return all<{ id: string; title: string; body: string | null; created_at: string; org_name: string | null; org_emoji: string | null }>(
    `SELECT a.id, a.title, a.body, a.created_at, o.name AS org_name, o.emoji AS org_emoji
     FROM announcements a LEFT JOIN orgs o ON o.id = a.org_id
     WHERE a.audience = 'public' ORDER BY a.created_at DESC LIMIT ?`,
    limit
  );
}

export type ProjectRow = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total: number;
  done: number;
  org_name: string;
};

export function projectsOfOrg(orgId: string): ProjectRow[] {
  return all<ProjectRow>(
    `SELECT p.id, p.org_id, p.title, p.description, p.status, p.start_date, p.end_date,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done,
       o.name AS org_name
     FROM projects p JOIN orgs o ON o.id = p.org_id
     WHERE p.org_id = ?
     ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, p.end_date`,
    orgId
  );
}

export function getProject(id: string): ProjectRow | undefined {
  return one<ProjectRow>(
    `SELECT p.id, p.org_id, p.title, p.description, p.status, p.start_date, p.end_date,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done,
       o.name AS org_name
     FROM projects p JOIN orgs o ON o.id = p.org_id WHERE p.id = ?`,
    id
  );
}

export type TaskRow = {
  id: string;
  project_id: string;
  org_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_emoji: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  project_title?: string;
};

export function tasksOfProject(projectId: string): TaskRow[] {
  return all<TaskRow>(
    `SELECT t.id, t.project_id, t.org_id, t.title, t.description, t.assignee_id, t.status, t.priority,
            t.start_date, t.due_date, u.full_name AS assignee_name, u.avatar_emoji AS assignee_emoji
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.project_id = ? ORDER BY t.sort, t.due_date`,
    projectId
  );
}

export function myTasks(userId: string, orgId?: string): TaskRow[] {
  return all<TaskRow>(
    `SELECT t.id, t.project_id, t.org_id, t.title, t.description, t.assignee_id, t.status, t.priority,
            t.start_date, t.due_date, u.full_name AS assignee_name, u.avatar_emoji AS assignee_emoji,
            p.title AS project_title
     FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.assignee_id = ? ${orgId ? "AND t.org_id = ?" : ""}
     ORDER BY CASE t.status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 WHEN 'review' THEN 2 ELSE 3 END, t.due_date`,
    ...(orgId ? [userId, orgId] : [userId])
  );
}

export function taskById(id: string) {
  return one<TaskRow>(
    `SELECT t.id, t.project_id, t.org_id, t.title, t.description, t.assignee_id, t.status, t.priority,
            t.start_date, t.due_date, u.full_name AS assignee_name, u.avatar_emoji AS assignee_emoji
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`,
    id
  );
}

export function orgTasks(orgId: string): TaskRow[] {
  return all<TaskRow>(
    `SELECT t.id, t.project_id, t.org_id, t.title, t.description, t.assignee_id, t.status, t.priority,
            t.start_date, t.due_date, u.full_name AS assignee_name, u.avatar_emoji AS assignee_emoji,
            p.title AS project_title
     FROM tasks t JOIN projects p ON p.id = t.project_id LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.org_id = ? ORDER BY t.due_date`,
    orgId
  );
}

export function planOfWeek(orgId: string, week: string) {
  return all<{ id: string; day: string; title: string; done: number; sort: number }>(
    "SELECT id, day, title, done, sort FROM plan_items WHERE org_id = ? AND week_start = ? ORDER BY sort, id",
    orgId,
    week
  );
}

/* ---------- Chat (tadbir va klub sahifalari ostida) ---------- */

export type ScopeType = "event" | "org";

/** Foydalanuvchi tashkilot a'zosimi yoki sayt adminimi. */
function orgAccess(orgId: string, userId: string): boolean {
  const row = one<{ ok: number }>(
    `SELECT 1 AS ok WHERE EXISTS (
        SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ? AND status = 'active'
     ) OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_admin = 1)`,
    userId,
    orgId,
    userId
  );
  return Boolean(row?.ok);
}

/** Chat yozish/o'qish huquqi: ochiq tadbir — hammaga, ichki tadbir va klub chati — a'zolarga. */
export function canAccessScope(scopeType: string, scopeId: string, userId: string): boolean {
  if (scopeType === "event") {
    const event = one<{ org_id: string; visibility: string }>(
      "SELECT org_id, visibility FROM events WHERE id = ?",
      scopeId
    );
    if (!event) return false;
    if (event.visibility !== "internal") return true;
    return orgAccess(event.org_id, userId);
  }
  if (scopeType === "org") {
    return Boolean(one<{ id: string }>("SELECT id FROM orgs WHERE id = ?", scopeId)) && orgAccess(scopeId, userId);
  }
  return false;
}

/** Chat yozilgan tadbir yoki klubning tashkilotini qaytaradi. */
export function orgOfScope(scopeType: string, scopeId: string): string | undefined {
  if (scopeType === "event") return one<{ org_id: string }>("SELECT org_id FROM events WHERE id = ?", scopeId)?.org_id;
  if (scopeType === "org") return one<{ id: string }>("SELECT id FROM orgs WHERE id = ?", scopeId)?.id;
  return undefined;
}

export type MessageRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  full_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  role_key: string | null;
};

export function messagesFor(scopeType: string, scopeId: string, limit = 80): MessageRow[] {
  const orgId = orgOfScope(scopeType, scopeId) ?? "";
  return all<MessageRow>(
    `SELECT m.id, m.user_id, m.body, m.created_at, u.full_name, u.avatar_emoji, u.avatar_url,
       (SELECT mm.role_key FROM memberships mm
         WHERE mm.user_id = m.user_id AND mm.org_id = ? AND mm.status = 'active') AS role_key
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.scope_type = ? AND m.scope_id = ?
     ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`,
    orgId,
    scopeType,
    scopeId,
    limit
  ).reverse();
}

export function messagesCount(scopeType: string, scopeId: string): number {
  return (
    one<{ c: number }>("SELECT COUNT(*) AS c FROM messages WHERE scope_type = ? AND scope_id = ?", scopeType, scopeId)
      ?.c ?? 0
  );
}

export type MessageResult = { ok: boolean; error?: string };

export function addMessage(scopeType: string, scopeId: string, userId: string, body: string): MessageResult {
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: "Xabar juda qisqa" };
  if (text.length > 600) return { ok: false, error: "Xabar 600 belgidan oshmasin" };
  const rude = etiquetteError(text);
  if (rude) return { ok: false, error: rude };

  const recent =
    one<{ c: number }>(
      "SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND created_at >= datetime('now','-60 seconds')",
      userId
    )?.c ?? 0;
  if (recent >= 5) return { ok: false, error: "Biroz sekinlashib yozing — daqiqada 5 tadan ko'p xabar yuborilmaydi" };

  run(
    "INSERT INTO messages (id, scope_type, scope_id, user_id, body) VALUES (?,?,?,?,?)",
    `msg-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    scopeType,
    scopeId,
    userId,
    text
  );
  return { ok: true };
}

export function messageById(id: string) {
  return one<{ id: string; scope_type: string; scope_id: string; user_id: string }>(
    "SELECT id, scope_type, scope_id, user_id FROM messages WHERE id = ?",
    id
  );
}

export function deleteMessage(id: string): void {
  run("DELETE FROM messages WHERE id = ?", id);
}

/* ---------- Tadbirdan keyingi fikr-mulohaza ---------- */

export type FeedbackRow = {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
};

export function feedbackFor(eventId: string): FeedbackRow[] {
  return all<FeedbackRow>(
    `SELECT f.id, f.event_id, f.user_id, f.rating, f.comment, f.created_at,
            u.full_name, u.avatar_emoji, u.avatar_url
     FROM event_feedback f JOIN users u ON u.id = f.user_id
     WHERE f.event_id = ? ORDER BY f.created_at DESC`,
    eventId
  );
}

export function feedbackStats(eventId: string): { count: number; avg: number } {
  const row = one<{ c: number; a: number | null }>(
    "SELECT COUNT(*) AS c, AVG(rating) AS a FROM event_feedback WHERE event_id = ?",
    eventId
  );
  return { count: row?.c ?? 0, avg: row?.a ? Math.round(row.a * 10) / 10 : 0 };
}

export function myFeedback(eventId: string, userId: string): FeedbackRow | undefined {
  return one<FeedbackRow>(
    `SELECT f.id, f.event_id, f.user_id, f.rating, f.comment, f.created_at,
            u.full_name, u.avatar_emoji, u.avatar_url
     FROM event_feedback f JOIN users u ON u.id = f.user_id
     WHERE f.event_id = ? AND f.user_id = ?`,
    eventId,
    userId
  );
}

export function saveFeedback(
  eventId: string,
  userId: string,
  rating: number,
  comment: string
): { ok: boolean; error?: string } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Baho 1 dan 5 gacha bo'lsin" };
  const text = comment.trim();
  if (text.length > 600) return { ok: false, error: "Fikr 600 belgidan oshmasin" };
  if (text) {
    const rude = etiquetteError(text);
    if (rude) return { ok: false, error: rude };
  }

  const event = one<{ starts_at: string; ends_at: string | null }>(
    "SELECT starts_at, ends_at FROM events WHERE id = ?",
    eventId
  );
  if (!event) return { ok: false, error: "Tadbir topilmadi" };
  const end = event.ends_at ?? event.starts_at;
  if (new Date(end) > new Date()) return { ok: false, error: "Tadbir hali yakunlanmagan" };

  const reg = one<{ status: string }>(
    "SELECT status FROM registrations WHERE event_id = ? AND user_id = ?",
    eventId,
    userId
  );
  if (!reg || !["attended", "confirmed"].includes(reg.status)) {
    return { ok: false, error: "Fikr qoldirish uchun tadbirda qatnashgan bo'lishingiz kerak" };
  }

  run(
    `INSERT INTO event_feedback (id, event_id, user_id, rating, comment)
     VALUES (?,?,?,?,?)
     ON CONFLICT(event_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment,
       created_at = datetime('now')`,
    `fb-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    eventId,
    userId,
    rating,
    text || null
  );
  return { ok: true };
}

export function orgStats(orgId: string) {
  const projects = one<{ c: number }>("SELECT COUNT(*) AS c FROM projects WHERE org_id = ? AND status = 'active'", orgId);
  const members = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM memberships WHERE org_id = ? AND status = 'active'",
    orgId
  );
  const events = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM events WHERE org_id = ? AND starts_at >= ? AND status = 'published'",
    orgId,
    now()
  );
  const pending = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM memberships WHERE org_id = ? AND status = 'pending'",
    orgId
  );
  return {
    projects: projects?.c ?? 0,
    members: members?.c ?? 0,
    events: events?.c ?? 0,
    pending: pending?.c ?? 0,
  };
}

/* ---------- Tadbir jamoalari (team formation) ---------- */

/** Bitta jamoaga qo'shilishi mumkin bo'lgan ishtirokchilar soni. */
export const TEAM_MAX_MEMBERS = 6;

export type EventTeamMember = {
  user_id: string;
  full_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  faculty: string | null;
};

export type EventTeamRow = {
  id: string;
  event_id: string;
  name: string;
  idea: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  members: EventTeamMember[];
};

/** Tadbirda tuzilgan jamoalar va ularning a'zolari. */
export function eventTeams(eventId: string): EventTeamRow[] {
  const teams = all<Omit<EventTeamRow, "members">>(
    `SELECT t.id, t.event_id, t.name, t.idea, t.created_by, u.full_name AS creator_name, t.created_at
     FROM event_teams t JOIN users u ON u.id = t.created_by
     WHERE t.event_id = ?
     ORDER BY t.created_at`,
    eventId
  );
  const rows = all<EventTeamMember & { team_id: string }>(
    `SELECT m.team_id, m.user_id, u.full_name, u.avatar_emoji, u.avatar_url, u.faculty
     FROM event_team_members m
     JOIN users u ON u.id = m.user_id
     JOIN event_teams t ON t.id = m.team_id
     WHERE t.event_id = ?
     ORDER BY m.joined_at`,
    eventId
  );

  const grouped = new Map<string, EventTeamMember[]>();
  for (const r of rows) {
    const list = grouped.get(r.team_id) ?? [];
    list.push({
      user_id: r.user_id,
      full_name: r.full_name,
      avatar_emoji: r.avatar_emoji,
      avatar_url: r.avatar_url,
      faculty: r.faculty,
    });
    grouped.set(r.team_id, list);
  }

  return teams.map((t) => ({ ...t, members: grouped.get(t.id) ?? [] }));
}

/** Foydalanuvchi shu tadbirda qaysi jamoada? */
export function myTeamForEvent(eventId: string, userId: string) {
  return one<{ team_id: string; name: string }>(
    `SELECT t.id AS team_id, t.name
     FROM event_team_members m JOIN event_teams t ON t.id = m.team_id
     WHERE t.event_id = ? AND m.user_id = ?`,
    eventId,
    userId
  );
}

/** Jamoa tuzish uchun ishtirokchi tasdiqlangan bo'lishi shart. */
function teamEligibility(eventId: string, userId: string): { ok: boolean; error?: string } {
  const reg = registrationFor(eventId, userId);
  if (!reg || !["confirmed", "attended"].includes(reg.status)) {
    return { ok: false, error: "Jamoa tuzish faqat tasdiqlangan ishtirokchilar uchun" };
  }
  return { ok: true };
}

export function createEventTeam(params: {
  eventId: string;
  userId: string;
  name: string;
  idea?: string | null;
}): { ok: boolean; error?: string; teamId?: string } {
  const name = params.name.trim();
  const idea = (params.idea ?? "").trim() || null;
  if (name.length < 2 || name.length > 40) return { ok: false, error: "Jamoa nomi 2–40 belgidan iborat bo'lsin" };
  if (idea && idea.length > 200) return { ok: false, error: "G'oya tavsifi 200 belgidan oshmasin" };

  return db().transaction((): { ok: boolean; error?: string; teamId?: string } => {
    const eligible = teamEligibility(params.eventId, params.userId);
    if (!eligible.ok) return eligible;

    if (myTeamForEvent(params.eventId, params.userId)) {
      return { ok: false, error: "Siz allaqachon jamoadasiz — avval jamoadan chiqing" };
    }
    const clash = one<{ id: string }>(
      "SELECT id FROM event_teams WHERE event_id = ? AND lower(name) = lower(?)",
      params.eventId,
      name
    );
    if (clash) return { ok: false, error: "Bunday nomdagi jamoa allaqachon bor" };

    const id = `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    run(
      "INSERT INTO event_teams (id, event_id, name, idea, created_by) VALUES (?,?,?,?,?)",
      id,
      params.eventId,
      name,
      idea,
      params.userId
    );
    run("INSERT INTO event_team_members (team_id, user_id) VALUES (?,?)", id, params.userId);
    return { ok: true, teamId: id };
  })();
}

export function joinEventTeam(teamId: string, eventId: string, userId: string): { ok: boolean; error?: string } {
  return db().transaction((): { ok: boolean; error?: string } => {
    const eligible = teamEligibility(eventId, userId);
    if (!eligible.ok) return eligible;

    const team = one<{ id: string }>("SELECT id FROM event_teams WHERE id = ? AND event_id = ?", teamId, eventId);
    if (!team) return { ok: false, error: "Jamoa topilmadi" };
    if (myTeamForEvent(eventId, userId)) return { ok: false, error: "Siz allaqachon jamoadasiz" };

    const size =
      one<{ c: number }>("SELECT COUNT(*) AS c FROM event_team_members WHERE team_id = ?", teamId)?.c ?? 0;
    if (size >= TEAM_MAX_MEMBERS) return { ok: false, error: "Bu jamoa to'lgan" };

    run("INSERT INTO event_team_members (team_id, user_id) VALUES (?,?)", teamId, userId);
    return { ok: true };
  })();
}

export function leaveEventTeam(teamId: string, eventId: string, userId: string): { ok: boolean; error?: string } {
  return db().transaction((): { ok: boolean; error?: string } => {
    const team = one<{ id: string }>("SELECT id FROM event_teams WHERE id = ? AND event_id = ?", teamId, eventId);
    if (!team) return { ok: false, error: "Jamoa topilmadi" };
    const membership = one<{ user_id: string }>(
      "SELECT user_id FROM event_team_members WHERE team_id = ? AND user_id = ?",
      teamId,
      userId
    );
    if (!membership) return { ok: false, error: "Siz bu jamoada emassiz" };

    run("DELETE FROM event_team_members WHERE team_id = ? AND user_id = ?", teamId, userId);
    const left = one<{ c: number }>("SELECT COUNT(*) AS c FROM event_team_members WHERE team_id = ?", teamId)?.c ?? 0;
    if (left === 0) run("DELETE FROM event_teams WHERE id = ?", teamId);
    return { ok: true };
  })();
}
