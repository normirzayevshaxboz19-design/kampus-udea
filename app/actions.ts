"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { one, run } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, getMemberships, isAdmin, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { can, canActor } from "@/lib/perms";
import { allowRate, clientIp, resetRate, safeExternalUrl, safeNext } from "@/lib/security";
import {
  addMessage,
  canAccessScope,
  cancelRegistration,
  createEventTeam,
  decideRegistration,
  deleteMessage,
  joinClub,
  joinEventTeam,
  leaveEventTeam,
  membershipOf,
  messageById,
  orgOfScope,
  promoteFromWaitlist,
  registerForEvent,
  saveFeedback,
  slugTaken,
  taskById,
} from "@/lib/data";

const EMOJIS = ["🙂", "👩‍🎓", "🧑‍🎓", "👩‍💼", "🧑‍💻", "👩‍🎨", "🧑‍🔬", "🦉", "🐼", "🎧"];

function back(path: string, key: "err" | "ok", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${key}=${encodeURIComponent(message)}`);
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** Chat xatosini chatning o'zida ko'rsatish uchun (sahifa #chat ga suriladi). */
function backChat(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}chat_err=${encodeURIComponent(message)}#chat`);
}

export async function loginAction(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(str(form, "next"));

  // Parolni taxmin qilish urinishlarini cheklaymiz: 15 daqiqada 10 urinish.
  const ip = await clientIp();
  if (!allowRate(`login:${email}`, 10, 900) || !allowRate(`login-ip:${ip}`, 40, 900)) {
    back(
      `/login?email=${encodeURIComponent(email)}`,
      "err",
      "Juda ko'p urinish. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring"
    );
  }

  const user = one<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    back(`/login?email=${encodeURIComponent(email)}`, "err", "Email yoki parol noto'g'ri");
  }
  resetRate(`login:${email}`);
  await createSession(user!.id);
  redirect(next);
}

export async function registerAction(form: FormData) {
  const fullName = str(form, "full_name");
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const faculty = str(form, "faculty");
  const studentNo = str(form, "student_no");
  const next = safeNext(str(form, "next"));

  if (!allowRate(`register-ip:${await clientIp()}`, 10, 3600)) {
    back("/register", "err", "Bir soatda ko'pi bilan 10 ta hisob yaratish mumkin");
  }
  if (fullName.length < 3) back("/register", "err", "Ism va familiyani to'liq kiriting");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("/register", "err", "Email manzil noto'g'ri");
  if (password.length < 8) back("/register", "err", "Parol kamida 6 belgidan iborat bo'lsin");

  const exists = one<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  if (exists) back("/register", "err", "Bu email allaqachon ro'yxatdan o'tgan");

  const id = `u-${Date.now().toString(36)}`;
  run(
    `INSERT INTO users (id, email, password_hash, full_name, avatar_emoji, university_id, student_no, faculty)
     VALUES (?,?,?,?,?,?,?,?)`,
    id,
    email,
    hashPassword(password),
    fullName,
    EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    "udea",
    studentNo || null,
    faculty || null
  );
  await createSession(id);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function registerEventAction(form: FormData) {
  const user = await getCurrentUser();
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const target = `/events/${slug}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);

  const result = registerForEvent(eventId, user!.id);
  if (!result.ok) back(target, "err", result.error ?? "Xatolik yuz berdi");
  revalidatePath(target);
  back(target, "ok", "Arizangiz yuborildi — tashkilotchi tasdiqlashini kuting");
}

export async function cancelEventAction(form: FormData) {
  const user = await getCurrentUser();
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const target = `/events/${slug}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);
  cancelRegistration(eventId, user!.id);
  revalidatePath(target);
  revalidatePath("/pulse");
  back(target, "ok", "Ro'yxatdan o'tish bekor qilindi — bo'shagan joy navbatdagiga o'tdi");
}

/** Navbatdagilarni bo'sh joylar hisobiga qo'lda tasdiqlash (tashkilotchi uchun). */
export async function promoteWaitlistAction(form: FormData) {
  const eventId = str(form, "event_id");
  const target = str(form, "next") || `/admin/events/${eventId}`;
  const user = await requireUser(target);
  const event = one<{ org_id: string; slug: string }>("SELECT org_id, slug FROM events WHERE id = ?", eventId);
  if (!event) back("/admin/events", "err", "Tadbir topilmadi");

  const membership = await membershipOf(user.id, event!.org_id);
  if (!canActor(membership?.role_key, "event.manage", user.is_admin)) back(target, "err", "Ruxsat yo'q");

  const moved = promoteFromWaitlist(eventId);
  revalidatePath(target);
  revalidatePath(`/events/${event!.slug}`);
  revalidatePath("/pulse");
  back(
    target,
    moved > 0 ? "ok" : "err",
    moved > 0 ? `Navbatdan tasdiqlandi: ${moved} kishi` : "Bo'sh joy yo'q — avval o'rin bo'shatilishi kerak"
  );
}

/* ---------- Tadbir jamoalari (team formation) ---------- */

export async function createTeamAction(form: FormData) {
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const target = `/events/${slug}`;
  const user = await requireUser(target);

  const res = createEventTeam({
    eventId,
    userId: user.id,
    name: str(form, "name"),
    idea: str(form, "idea"),
  });
  if (!res.ok) back(target, "err", res.error ?? "Jamoa yaratilmadi");
  revalidatePath(target);
  back(target, "ok", "Jamoa yaratildi — endi jamoadoshlaringizni chaqiring");
}

export async function joinTeamAction(form: FormData) {
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const teamId = str(form, "team_id");
  const target = `/events/${slug}`;
  const user = await requireUser(target);

  const res = joinEventTeam(teamId, eventId, user.id);
  if (!res.ok) back(target, "err", res.error ?? "Jamoaga qo'shilmadi");
  revalidatePath(target);
  back(target, "ok", "Jamoaga qo'shildingiz");
}

export async function leaveTeamAction(form: FormData) {
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const teamId = str(form, "team_id");
  const target = `/events/${slug}`;
  const user = await requireUser(target);

  const res = leaveEventTeam(teamId, eventId, user.id);
  if (!res.ok) back(target, "err", res.error ?? "Jamoadan chiqilmadi");
  revalidatePath(target);
  back(target, "ok", "Jamoadan chiqdingiz");
}

export async function joinClubAction(form: FormData) {
  const user = await getCurrentUser();
  const slug = str(form, "slug");
  const orgId = str(form, "org_id");
  const target = `/clubs/${slug}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);
  const res = joinClub(user!.id, orgId);
  revalidatePath(target);
  if (!res.ok) back(target, "err", res.error ?? "Xatolik");
  back(target, "ok", "Arizangiz koordinatorga yuborildi");
}

export async function updateProfileAction(form: FormData) {
  const user = await requireUser("/profile");
  const fullName = str(form, "full_name");
  if (fullName.length < 3) back("/profile", "err", "Ismni to'liq kiriting");
  const emoji = str(form, "avatar_emoji") || user.avatar_emoji;
  run(
    "UPDATE users SET full_name = ?, faculty = ?, student_no = ?, bio = ?, interests = ?, avatar_emoji = ? WHERE id = ?",
    fullName,
    str(form, "faculty") || null,
    str(form, "student_no") || null,
    str(form, "bio") || null,
    str(form, "interests") || null,
    EMOJIS.includes(emoji) ? emoji : user.avatar_emoji,
    user.id
  );
  revalidatePath("/profile");
  back("/profile", "ok", "Profil saqlandi");
}

const MAX_AVATAR_CHARS = 400 * 1024;

function validAvatarData(data: string): boolean {
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(data) && data.length <= MAX_AVATAR_CHARS;
}

/** Profil rasmini yangilash yoki o'chirish. */
export async function updateAvatarAction(form: FormData) {
  const user = await requireUser("/profile");
  if (str(form, "remove") === "1") {
    run("UPDATE users SET avatar_url = NULL WHERE id = ?", user.id);
    revalidatePath("/", "layout");
    back("/profile", "ok", "Profil rasmi o'chirildi");
  }
  const data = str(form, "avatar_data");
  if (!data) back("/profile", "err", "Rasm tanlanmadi");
  if (!validAvatarData(data)) back("/profile", "err", "Rasm formati noto'g'ri yoki hajmi juda katta");
  run("UPDATE users SET avatar_url = ? WHERE id = ?", data, user.id);
  revalidatePath("/", "layout");
  back("/profile", "ok", "Profil rasmi yangilandi");
}

/** Tadbir yoki klub chatiga xabar yozish. */
export async function postMessageAction(form: FormData) {
  const next = str(form, "next") || "/";
  const user = await requireUser(next);
  const scopeType = str(form, "scope_type");
  const scopeId = str(form, "scope_id");
  if (!orgOfScope(scopeType, scopeId)) backChat(next, "Chat topilmadi");
  if (!canAccessScope(scopeType, scopeId, user.id)) backChat(next, "Chatga yozishga ruxsatingiz yo'q");

  const res = addMessage(scopeType, scopeId, user.id, String(form.get("body") ?? ""));
  if (!res.ok) backChat(next, res.error ?? "Xabar yuborilmadi");
  revalidatePath(next);
  redirect(next);
}

/** O'z xabarini (yoki tashkilot rahbari sifatida boshqaning xabarini) o'chirish. */
export async function deleteMessageAction(form: FormData) {
  const next = str(form, "next") || "/";
  const user = await requireUser(next);
  const id = str(form, "message_id");
  const msg = messageById(id);
  if (!msg) backChat(next, "Xabar topilmadi");

  const orgId = orgOfScope(msg!.scope_type, msg!.scope_id);
  const membership = orgId ? await membershipOf(user.id, orgId) : undefined;
  if (msg!.user_id !== user.id && !canActor(membership?.role_key, "team.manage", user.is_admin)) {
    backChat(next, "Faqat o'z xabaringizni o'chira olasiz");
  }
  deleteMessage(id);
  revalidatePath(next);
  redirect(next);
}

export async function setActiveOrgAction(form: FormData) {
  const user = await requireUser("/admin");
  const orgId = str(form, "org_id");
  const memberships = await getMemberships(user.id);
  if (!memberships.some((m) => m.org_id === orgId)) redirect("/admin");
  (await cookies()).set("activeOrg", orgId, { path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect(safeNext(str(form, "next"), "/admin"));
}

async function requirePerm(perm: Parameters<typeof can>[1], orgId: string) {
  const user = await requireUser("/admin");
  const membership = await membershipOf(user.id, orgId);
  const allowed =
    isAdmin(user) || (membership?.status === "active" && can(membership.role_key, perm));
  if (!allowed) {
    redirect("/admin?err=" + encodeURIComponent("Bu amal uchun ruxsatingiz yo'q"));
  }
  return { user, role: membership?.role_key ?? "president" };
}

export async function updateTaskStatusAction(form: FormData) {
  const user = await requireUser("/admin");
  const taskId = str(form, "task_id");
  const status = str(form, "status");
  const target = str(form, "next") || "/admin/tasks";
  if (!["todo", "doing", "review", "done"].includes(status)) back(target, "err", "Noto'g'ri holat");

  const task = taskById(taskId);
  if (!task) back(target, "err", "Vazifa topilmadi");
  const membership = await membershipOf(user.id, task!.org_id);
  const allowed = task!.assignee_id === user.id || canActor(membership?.role_key, "task.assign", user.is_admin);
  if (!allowed) back(target, "err", "Bu vazifani o'zgartirish huquqingiz yo'q");

  run(
    "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
    status,
    status === "done" ? new Date().toISOString() : null,
    taskId
  );
  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  revalidatePath(`/admin/projects/${task!.project_id}`);
  back(target, "ok", "Vazifa holati yangilandi");
}

export async function createTaskAction(form: FormData) {
  const projectId = str(form, "project_id");
  const orgId = str(form, "org_id");
  const target = `/admin/projects/${projectId}?view=board`;
  const { user } = await requirePerm("task.assign", orgId);
  const project = one<{ org_id: string }>("SELECT org_id FROM projects WHERE id = ?", projectId);
  if (!project || project.org_id !== orgId) back(target, "err", "Loyiha bu tashkilotga tegishli emas");
  const title = str(form, "title");
  if (title.length < 3) back(target, "err", "Vazifa nomini kiriting");
  const assignee = str(form, "assignee_id") || null;
  if (assignee) {
    const membership = await membershipOf(assignee, orgId);
    if (!membership || membership.status !== "active") back(target, "err", "Mas'ul jamoa a'zosi emas");
  }
  run(
    `INSERT INTO tasks (id, project_id, org_id, title, description, assignee_id, status, priority, due_date, created_by)
     VALUES (?,?,?,?,?,?, 'todo', ?, ?, ?)`,
    `t-${Date.now().toString(36)}`,
    projectId,
    orgId,
    title,
    str(form, "description") || null,
    assignee,
    ["low", "normal", "high", "urgent"].includes(str(form, "priority")) ? str(form, "priority") : "normal",
    str(form, "due_date") || null,
    user.id
  );
  revalidatePath(target);
  back(target, "ok", "Yangi vazifa qo'shildi");
}

export async function decideJoinAction(form: FormData) {
  const membershipId = str(form, "membership_id");
  const decision = str(form, "decision");
  const orgId = str(form, "org_id");
  await requirePerm("team.manage", orgId);
  const row = one<{ id: string; user_id: string }>("SELECT id, user_id FROM memberships WHERE id = ? AND org_id = ?", membershipId, orgId);
  if (!row) back("/admin/team", "err", "Ariza topilmadi");
  if (decision === "approve") {
    run("UPDATE memberships SET status = 'active', joined_at = datetime('now') WHERE id = ? AND org_id = ?", membershipId, orgId);
  } else {
    run("UPDATE memberships SET status = 'rejected' WHERE id = ? AND org_id = ?", membershipId, orgId);
  }
  revalidatePath("/admin/team");
  back("/admin/team", "ok", decision === "approve" ? "Ariza tasdiqlandi" : "Ariza rad etildi");
}

export async function setRoleAction(form: FormData) {
  const membershipId = str(form, "membership_id");
  const role = str(form, "role_key");
  const orgId = str(form, "org_id");
  await requirePerm("team.manage", orgId);
  if (!["president", "vice_president", "project_lead", "coordinator", "member"].includes(role)) {
    back("/admin/team", "err", "Noto'g'ri rol");
  }
  run("UPDATE memberships SET role_key = ? WHERE id = ? AND org_id = ?", role, membershipId, orgId);
  revalidatePath("/admin/team");
  back("/admin/team", "ok", "Rol o'zgartirildi");
}

export async function togglePlanItemAction(form: FormData) {
  const orgId = str(form, "org_id");
  const itemId = str(form, "item_id");
  await requirePerm("plan.edit", orgId);
  run("UPDATE plan_items SET done = 1 - done WHERE id = ? AND org_id = ?", itemId, orgId);
  revalidatePath("/admin/plan");
  redirect("/admin/plan");
}

export async function addPlanItemAction(form: FormData) {
  const orgId = str(form, "org_id");
  const week = str(form, "week_start");
  await requirePerm("plan.edit", orgId);
  const title = str(form, "title");
  const day = str(form, "day");
  if (title.length < 3) back("/admin/plan", "err", "Reja bandini kiriting");
  const max = one<{ m: number }>("SELECT COALESCE(MAX(sort), 0) AS m FROM plan_items WHERE org_id = ? AND week_start = ?", orgId, week);
  run(
    "INSERT INTO plan_items (id, org_id, week_start, day, title, done, sort) VALUES (?,?,?,?,?,0,?)",
    `pl-${Date.now().toString(36)}`,
    orgId,
    week,
    day || "Dushanba",
    title,
    (max?.m ?? 0) + 1
  );
  revalidatePath("/admin/plan");
  back("/admin/plan", "ok", "Reja bandi qo'shildi");
}

export async function attendanceAction(form: FormData) {
  const registrationId = str(form, "registration_id");
  const eventId = str(form, "event_id");
  const status = str(form, "status");
  const target = `/admin/events/${eventId}`;
  const user = await requireUser(target);
  const event = one<{ org_id: string }>("SELECT org_id FROM events WHERE id = ?", eventId);
  if (!event) back("/admin", "err", "Tadbir topilmadi");
  const membership = await membershipOf(user.id, event!.org_id);
  if (!canActor(membership?.role_key, "reg.view", user.is_admin)) back(target, "err", "Ruxsat yo'q");
  if (!["attended", "no_show", "confirmed"].includes(status)) back(target, "err", "Noto'g'ri holat");
  run(
    "UPDATE registrations SET status = ?, checked_in_at = ? WHERE id = ? AND event_id = ?",
    status,
    status === "attended" ? new Date().toISOString() : null,
    registrationId,
    eventId
  );
  revalidatePath(target);
  back(target, "ok", "Davomat belgilandi");
}

/* ---------- Tadbirlarni boshqarish (admin va koordinatorlar) ---------- */

const EVENT_STATUSES = ["draft", "published", "closed", "finished", "cancelled"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’'"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(title: string, given: string, exceptId?: string): string {
  const base = slugify(given) || slugify(title) || "tadbir";
  let slug = base;
  let i = 2;
  while (slugTaken(slug, exceptId)) slug = `${base}-${i++}`;
  return slug;
}

/** Tadbirni yaratish yoki mavjudini tahrirlash. */
export async function saveEventAction(form: FormData) {
  const eventId = str(form, "event_id");
  const editing = Boolean(eventId);
  const target = editing ? `/admin/events/${eventId}/edit` : "/admin/events";

  const current = editing
    ? one<{ id: string; org_id: string }>("SELECT id, org_id FROM events WHERE id = ?", eventId)
    : undefined;
  if (editing && !current) back("/admin/events", "err", "Tadbir topilmadi");

  const orgId = current?.org_id ?? str(form, "org_id");
  if (!orgId) back("/admin/events", "err", "Tashkilotni tanlang");
  const { user } = await requirePerm("event.manage", orgId);

  const title = str(form, "title");
  const startsAt = str(form, "starts_at");
  const endsAt = str(form, "ends_at");
  const visibility = str(form, "visibility") === "internal" ? "internal" : "public";
  const status = EVENT_STATUSES.includes(str(form, "status")) ? str(form, "status") : "published";
  const emoji = str(form, "emoji") || "🎯";
  const description = str(form, "description") || null;
  const location = str(form, "location") || null;
  const requirements = str(form, "requirements") || null;
  const regOpens = str(form, "reg_opens_at") || null;
  const regCloses = str(form, "reg_closes_at") || null;
  const capacityRaw = str(form, "capacity");
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (title.length < 3) back(target, "err", "Tadbir nomini kiriting (kamida 3 belgi)");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startsAt)) back(target, "err", "Boshlanish sanasini tanlang");
  if (endsAt && endsAt < startsAt) back(target, "err", "Tugash vaqti boshlanishdan keyin bo'lsin");
  if (regCloses && regCloses > startsAt) back(target, "err", "Ro'yxat muddati tadbirdan oldin tugasin");
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) {
    back(target, "err", "Joylar soni musbat butun son bo'lsin");
  }

  const slug = uniqueSlug(title, str(form, "slug"), editing ? eventId : undefined);

  if (editing) {
    run(
      `UPDATE events SET title = ?, slug = ?, description = ?, emoji = ?, visibility = ?, location = ?,
         starts_at = ?, ends_at = ?, reg_opens_at = ?, reg_closes_at = ?, capacity = ?, requirements = ?, status = ?
       WHERE id = ?`,
      title,
      slug,
      description,
      emoji,
      visibility,
      location,
      startsAt,
      endsAt || null,
      regOpens,
      regCloses,
      capacity,
      requirements,
      status,
      eventId
    );
  } else {
    run(
      `INSERT INTO events (id, org_id, title, slug, description, emoji, visibility, location, starts_at, ends_at,
         reg_opens_at, reg_closes_at, capacity, requirements, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      `e-${Date.now().toString(36)}`,
      orgId,
      title,
      slug,
      description,
      emoji,
      visibility,
      location,
      startsAt,
      endsAt || null,
      regOpens,
      regCloses,
      capacity,
      requirements,
      status,
      user.id
    );
  }

  // Joylar soni oshirilgan bo'lsa, navbatdagilar avtomatik tasdiqlanadi.
  if (editing) promoteFromWaitlist(eventId);

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${slug}`);
  revalidatePath("/pulse");
  revalidatePath("/");
  back(editing ? `/admin/events/${eventId}/edit` : "/admin/events", "ok", editing ? "Tadbir ma'lumotlari saqlandi" : "Yangi tadbir qo'shildi");
}

/** Ishtirok uchun arizani tasdiqlash yoki rad etish. */
export async function decideRegistrationAction(form: FormData) {
  const registrationId = str(form, "registration_id");
  const eventId = str(form, "event_id");
  const decision = str(form, "decision") === "approve" ? "approve" : "reject";
  const target = str(form, "next") || `/admin/events/${eventId}`;

  const user = await requireUser(target);
  const event = one<{ org_id: string; slug: string }>("SELECT org_id, slug FROM events WHERE id = ?", eventId);
  if (!event) back("/admin/events", "err", "Tadbir topilmadi");
  const membership = await membershipOf(user.id, event!.org_id);
  if (!canActor(membership?.role_key, "reg.view", user.is_admin)) back(target, "err", "Ruxsat yo'q");

  const res = decideRegistration(registrationId, eventId, decision);
  if (!res.ok) back(target, "err", res.error ?? "Ariza o'zgartirilmadi");

  revalidatePath(target);
  revalidatePath(`/events/${event!.slug}`);
  revalidatePath("/pulse");
  back(
    target,
    "ok",
    decision === "reject"
      ? "Ariza rad etildi"
      : res.status === "waitlist"
        ? "Joylar tugagan — ariza navbatga qo'yildi"
        : "Ariza tasdiqlandi"
  );
}

/** Tadbirdan keyin ishtirokchining fikr-mulohazasi. */
export async function submitFeedbackAction(form: FormData) {
  const slug = str(form, "slug");
  const eventId = str(form, "event_id");
  const target = `/events/${slug}`;
  const user = await requireUser(target);

  const rating = Number(str(form, "rating"));
  const res = saveFeedback(eventId, user.id, rating, str(form, "comment"));
  if (!res.ok) back(target, "err", res.error ?? "Fikr saqlanmadi");

  revalidatePath(target);
  back(target, "ok", "Fikringiz uchun rahmat!");
}

export async function quickTaskAction(form: FormData) {
  const taskId = str(form, "task_id");
  const status = str(form, "status");
  if (!["todo", "doing", "review", "done"].includes(status)) redirect("/admin/tasks");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const task = taskById(taskId);
  if (!task) redirect("/admin/tasks");
  const membership = await membershipOf(user!.id, task!.org_id);
  if (task!.assignee_id !== user!.id && !canActor(membership?.role_key, "task.assign", user!.is_admin)) {
    redirect("/admin/tasks");
  }
  run("UPDATE tasks SET status = ? WHERE id = ?", status, taskId);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
  redirect("/admin/tasks");
}


/* ---------- Birinchi ishga tushirish: bosh admin ---------- */

/** Birinchi sozlash uchun ixtiyoriy maxfiy kalit (SETUP_TOKEN). */
function setupTokenOk(given: string): boolean {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (!expected) return true;
  return given.length === expected.length && given === expected;
}

export async function setupAction(form: FormData) {
  const exists = one<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
  if (exists > 0) redirect("/login");
  if (!setupTokenOk(str(form, "token"))) back("/setup", "err", "Sozlash kaliti noto'g'ri");
  if (!allowRate(`setup:${await clientIp()}`, 5, 600)) back("/setup", "err", "Juda ko'p urinish — birozdan so'ng qayta urinib ko'ring");

  const fullName = str(form, "full_name");
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (fullName.length < 3) back("/setup", "err", "Ism va familiyani to'liq kiriting");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("/setup", "err", "Email manzil noto'g'ri");
  if (password.length < 8) back("/setup", "err", "Parol kamida 8 belgidan iborat bo'lsin");

  run("INSERT OR IGNORE INTO universities (id,name,slug,city) VALUES ('udea','UDEA universiteti','udea','Toshkent')");
  const id = `u-${Date.now().toString(36)}`;
  run(
    `INSERT INTO users (id, email, password_hash, full_name, avatar_emoji, university_id, is_admin)
     VALUES (?,?,?,?,?,?,1)`,
    id,
    email,
    hashPassword(password),
    fullName,
    "🧑‍💼",
    "udea"
  );
  await createSession(id);
  redirect("/admin");
}

/* ---------- Pulse: chipta olish / bekor qilish ---------- */

export async function pulseRsvpAction(form: FormData) {
  const user = await requireUser("/pulse");
  const eventId = str(form, "event_id");
  const res = registerForEvent(eventId, user.id);
  revalidatePath("/pulse");
  if (!res.ok) back("/pulse", "err", res.error ?? "Xatolik yuz berdi");
  back(
    "/pulse",
    "ok",
    res.status === "waitlist"
      ? "Joy tugagan — navbatga qo'shildingiz. Joy bo'shashi bilan avtomatik tasdiqlanadi."
      : "Chipta tayyor — «Chiptalarim» bo'limida QR kodni ko'rsating."
  );
}

export async function pulseCancelAction(form: FormData) {
  const user = await requireUser("/pulse");
  const eventId = str(form, "event_id");
  cancelRegistration(eventId, user.id);
  revalidatePath("/pulse");
  back("/pulse", "ok", "Ro'yxatdan o'tish bekor qilindi");
}

/* ---------- Bosh admin: foydalanuvchilar va klublar ---------- */

function requireSiteAdmin(path: string) {
  return requireUser(path).then((user) => {
    if (!isAdmin(user)) back(path, "err", "Bu amal uchun sayt admini huquqi kerak");
    return user;
  });
}

export async function setSiteAdminAction(form: FormData) {
  const admin = await requireSiteAdmin("/admin/users");
  const targetId = str(form, "user_id");
  const makeAdmin = str(form, "make") === "1";
  if (!targetId) back("/admin/users", "err", "Foydalanuvchi tanlanmadi");
  if (targetId === admin.id && !makeAdmin) {
    const admins = one<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1")?.c ?? 0;
    if (admins <= 1) back("/admin/users", "err", "Kamida bitta bosh admin qolishi kerak");
  }
  run("UPDATE users SET is_admin = ? WHERE id = ?", makeAdmin ? 1 : 0, targetId);
  revalidatePath("/admin/users");
  back("/admin/users", "ok", makeAdmin ? "Foydalanuvchi bosh admin qilindi" : "Bosh admin huquqi olib tashlandi");
}

export async function assignRoleAction(form: FormData) {
  await requireSiteAdmin("/admin/users");
  const userId = str(form, "user_id");
  const orgId = str(form, "org_id");
  const role = str(form, "role");
  if (!userId || !orgId) back("/admin/users", "err", "Foydalanuvchi va klub tanlanishi kerak");
  if (!["president", "vice_president", "project_lead", "coordinator", "member"].includes(role)) {
    back("/admin/users", "err", "Noto'g'ri rol");
  }
  const org = one<{ id: string }>("SELECT id FROM orgs WHERE id = ?", orgId);
  if (!org) back("/admin/users", "err", "Klub topilmadi");

  const existing = membershipOf(userId, orgId);
  if (existing) {
    run(
      "UPDATE memberships SET role_key = ?, status = 'active', joined_at = COALESCE(joined_at, datetime('now')) WHERE id = ?",
      role,
      existing.id
    );
  } else {
    run(
      "INSERT INTO memberships (id, user_id, org_id, role_key, status, joined_at) VALUES (?,?,?,?,'active',datetime('now'))",
      `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      orgId,
      role
    );
  }
  revalidatePath("/admin/users");
  back("/admin/users", "ok", "Rol belgilandi — foydalanuvchi endi shu klubni boshqaradi");
}

export async function removeMembershipAction(form: FormData) {
  await requireSiteAdmin("/admin/users");
  const membershipId = str(form, "membership_id");
  run("DELETE FROM memberships WHERE id = ?", membershipId);
  revalidatePath("/admin/users");
  back("/admin/users", "ok", "A'zolik olib tashlandi");
}

export async function createOrgAction(form: FormData) {
  await requireSiteAdmin("/admin/users");
  const name = str(form, "name");
  const kind = str(form, "kind") === "team" ? "team" : "club";
  const emoji = str(form, "emoji") || "🎯";
  const coordinatorId = str(form, "coordinator_id");
  if (name.length < 2) back("/admin/users", "err", "Klub nomini kiriting");

  let base = slugify(name) || "klub";
  let slug = base;
  let i = 2;
  while (one<{ id: string }>("SELECT id FROM orgs WHERE slug = ?", slug)) slug = `${base}-${i++}`;

  const orgId = `org-${Date.now().toString(36)}`;
  run(
    `INSERT INTO orgs (id, university_id, name, slug, kind, emoji, color, is_active)
     VALUES (?,?,?,?,?,?,?,1)`,
    orgId,
    "udea",
    name,
    slug,
    kind,
    emoji,
    ["indigo", "emerald", "sky", "amber", "rose", "teal"][Math.floor(Math.random() * 6)]
  );
  if (coordinatorId) {
    run(
      "INSERT INTO memberships (id, user_id, org_id, role_key, status, joined_at) VALUES (?,?,?,'coordinator','active',datetime('now'))",
      `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      coordinatorId,
      orgId
    );
  }
  revalidatePath("/admin/users");
  back("/admin/users", "ok", `${name} qo'shildi. Koordinator o'z tadbirlarini joylashtira oladi.`);
}

export async function toggleOrgAction(form: FormData) {
  await requireSiteAdmin("/admin/users");
  const orgId = str(form, "org_id");
  const active = str(form, "active") === "1";
  run("UPDATE orgs SET is_active = ? WHERE id = ?", active ? 1 : 0, orgId);
  revalidatePath("/admin/users");
  revalidatePath("/clubs");
  back("/admin/users", "ok", active ? "Tashkilot faollashtirildi" : "Tashkilot vaqtincha yopildi");
}

export async function saveClubAction(form: FormData) {
  const orgId = str(form, "org_id");
  const user = await requireUser("/admin/club");
  const membership = await membershipOf(user.id, orgId);
  if (!canActor(membership?.role_key, "team.manage", user.is_admin)) {
    back("/admin/club", "err", "Ruxsat yo'q");
  }
  const name = str(form, "name");
  if (name.length < 2) back("/admin/club", "err", "Nom kamida 2 belgidan iborat bo'lsin");
  run(
    `UPDATE orgs SET name = ?, tagline = ?, description = ?, emoji = ?, telegram = ?, instagram = ? WHERE id = ?`,
    name,
    str(form, "tagline") || null,
    str(form, "description") || null,
    str(form, "emoji") || "🎯",
    safeExternalUrl(str(form, "telegram")),
    safeExternalUrl(str(form, "instagram")),
    orgId
  );
  revalidatePath("/admin/club");
  revalidatePath("/clubs");
  back("/admin/club", "ok", "Klub ma'lumotlari saqlandi");
}
