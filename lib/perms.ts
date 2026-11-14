import { tr, type Lang } from "./i18n";

export type RoleKey =
  | "president"
  | "vice_president"
  | "project_lead"
  | "coordinator"
  | "member";

export type Permission =
  | "project.create"
  | "project.edit"
  | "task.assign"
  | "task.own"
  | "event.manage"
  | "reg.view"
  | "reg.export"
  | "plan.edit"
  | "team.manage";

export const ROLES: Record<RoleKey, { label: string; perms: Permission[]; accent: string }> = {
  president: {
    label: "Prezident",
    accent: "bg-indigo-100 text-indigo-700",
    perms: [
      "project.create",
      "project.edit",
      "task.assign",
      "task.own",
      "event.manage",
      "reg.view",
      "reg.export",
      "plan.edit",
      "team.manage",
    ],
  },
  vice_president: {
    label: "Vitse-prezident",
    accent: "bg-violet-100 text-violet-700",
    perms: [
      "project.create",
      "project.edit",
      "task.assign",
      "task.own",
      "event.manage",
      "reg.view",
      "reg.export",
      "plan.edit",
      "team.manage",
    ],
  },
  project_lead: {
    label: "Loyiha rahbari",
    accent: "bg-sky-100 text-sky-700",
    perms: ["project.create", "project.edit", "task.assign", "task.own", "event.manage", "reg.view", "reg.export"],
  },
  coordinator: {
    label: "Koordinator",
    accent: "bg-emerald-100 text-emerald-700",
    perms: ["task.assign", "task.own", "event.manage", "reg.view", "reg.export", "team.manage"],
  },
  member: {
    label: "A'zo",
    accent: "bg-slate-100 text-slate-600",
    perms: ["task.own"],
  },
};

export const ROLE_ORDER: RoleKey[] = ["president", "vice_president", "project_lead", "coordinator", "member"];

export function roleLabel(role: string, lang: Lang = "uz"): string {
  return tr(lang, ROLES[role as RoleKey]?.label ?? role);
}

export function roleAccent(role: string): string {
  return ROLES[role as RoleKey]?.accent ?? "bg-slate-100 text-slate-600";
}

export function can(role: string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const perms = ROLES[role as RoleKey]?.perms;
  return perms ? perms.includes(perm) : false;
}

/** Sayt admini har qanday tashkilotda to'liq huquqqa ega. */
export function canActor(
  role: string | null | undefined,
  perm: Permission,
  admin?: number | boolean | null
): boolean {
  return Boolean(admin) || can(role, perm);
}
