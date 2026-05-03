"use client";

import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { InviteMemberButton } from "./invite-member-button";
import { MemberRow, type MemberRowData } from "./member-row";
import {
  PendingInvitationRow,
  type PendingInvitationRowData,
} from "./pending-invitation-row";
import { ROLE_LABEL, type TeamRole } from "./role-chip";

type RoleFilter = TeamRole | "ALL";

type MembersSectionProps = {
  teamId: string;
  members: MemberRowData[];
  pendingInvitations: PendingInvitationRowData[];
  canManage: boolean;
};

const ROLE_ORDER: Record<TeamRole, number> = {
  ADMIN: 0,
  INSTRUCTOR: 1,
  ASSISTANT: 2,
  DANCER: 3,
};

const ROLE_FILTERS: ReadonlyArray<{ key: RoleFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ADMIN", label: ROLE_LABEL.ADMIN },
  { key: "INSTRUCTOR", label: ROLE_LABEL.INSTRUCTOR },
  { key: "ASSISTANT", label: ROLE_LABEL.ASSISTANT },
  { key: "DANCER", label: ROLE_LABEL.DANCER },
];

// Toolbar appears only when controls earn their space.
const SEARCH_THRESHOLD = 8;
const ROLE_FILTER_MIN_MEMBERS = 6;
const ROLE_FILTER_MIN_DISTINCT_ROLES = 3;

function MembersEmptyState({
  teamId,
  canManage,
}: Readonly<{ teamId: string; canManage: boolean }>) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed bg-card px-7 py-9">
      <span
        aria-hidden
        className="inline-flex size-11 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground"
      >
        <UserPlus className="size-5" />
      </span>
      <div className="flex max-w-lg flex-col gap-1.5">
        <h3 className="text-base font-semibold tracking-tight">
          Just you here
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Invite the people you&apos;ll work with. Members can be assigned roles
          to control what they can see and do.
        </p>
      </div>
      {canManage ? (
        <InviteMemberButton
          teamId={teamId}
          variant="default"
          size="default"
          label="Add first member"
        />
      ) : null}
    </div>
  );
}

export function MembersSection({
  teamId,
  members,
  pendingInvitations,
  canManage,
}: Readonly<MembersSectionProps>) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  const counts = useMemo(() => {
    const c: Record<RoleFilter, number> = {
      ALL: members.length,
      ADMIN: 0,
      INSTRUCTOR: 0,
      ASSISTANT: 0,
      DANCER: 0,
    };
    for (const m of members) c[m.role] += 1;
    return c;
  }, [members]);

  const distinctRoleCount = useMemo(
    () =>
      (["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"] as TeamRole[]).filter(
        (r) => counts[r] > 0
      ).length,
    [counts]
  );

  const showSearch = members.length >= SEARCH_THRESHOLD;
  const showRoleFilter =
    members.length >= ROLE_FILTER_MIN_MEMBERS &&
    distinctRoleCount >= ROLE_FILTER_MIN_DISTINCT_ROLES;
  const showToolbar = showSearch || showRoleFilter;

  const filtered = useMemo(() => {
    const q = showSearch ? query.trim().toLowerCase() : "";
    const activeRoleFilter = showRoleFilter ? roleFilter : "ALL";
    const rows = members.filter((m) => {
      if (activeRoleFilter !== "ALL" && m.role !== activeRoleFilter) return false;
      if (q) {
        const haystack = `${m.name ?? ""} ${m.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (a.role !== b.role) return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      const aName = (a.name ?? a.email).toLowerCase();
      const bName = (b.name ?? b.email).toLowerCase();
      return aName.localeCompare(bName);
    });
    return rows;
  }, [members, query, roleFilter, showSearch, showRoleFilter]);

  const hasPending = pendingInvitations.length > 0;

  if (members.length === 0 && !hasPending) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Members</h2>
            <p className="text-[13px] text-muted-foreground">
              Roles control what each person can do. Only admins can change them.
            </p>
          </div>
          {canManage ? <InviteMemberButton teamId={teamId} /> : null}
        </div>
        <MembersEmptyState teamId={teamId} canManage={canManage} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <p className="text-[13px] text-muted-foreground">
            Roles control what each person can do. Only admins can change them.
          </p>
        </div>
        {canManage ? <InviteMemberButton teamId={teamId} /> : null}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {showToolbar ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
            {showSearch ? (
              <div className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 sm:max-w-xs">
                <Search aria-hidden className="size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search members…"
                  aria-label="Search members"
                  className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            ) : null}

            {showRoleFilter ? (
              <div
                role="tablist"
                aria-label="Filter by role"
                className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-muted p-1"
              >
                {ROLE_FILTERS.filter(
                  (f) => f.key === "ALL" || counts[f.key] > 0
                ).map((f) => {
                  const active = roleFilter === f.key;
                  const count = counts[f.key];
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setRoleFilter(f.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-md)-4px)] px-2 py-1 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-card font-semibold text-foreground shadow-sm"
                          : "font-medium text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                      <span
                        className={cn(
                          "inline-flex min-w-3.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-muted text-muted-foreground"
                            : "bg-card text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {(() => {
          const q = showSearch ? query.trim().toLowerCase() : "";
          const filteredPending = pendingInvitations.filter((p) => {
            if (q && !p.email.toLowerCase().includes(q)) return false;
            if (showRoleFilter && roleFilter !== "ALL" && p.role !== roleFilter)
              return false;
            return true;
          });

          const showPendingBlock = filteredPending.length > 0;

          if (filtered.length === 0 && !showPendingBlock) {
            return (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No members match this filter.
              </div>
            );
          }

          return (
            <>
              {showPendingBlock ? (
                <div>
                  <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pending invitations · {filteredPending.length}
                    </span>
                  </div>
                  {filteredPending.map((inv, i) => (
                    <PendingInvitationRow
                      key={inv.invitationId}
                      teamId={teamId}
                      invitation={inv}
                      isLast={i === filteredPending.length - 1}
                      canManage={canManage}
                    />
                  ))}
                </div>
              ) : null}

              {filtered.length > 0 ? (
                <div>
                  {showPendingBlock ? (
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Members · {filtered.length}
                      </span>
                    </div>
                  ) : null}
                  {filtered.map((m, i) => (
                    <MemberRow
                      key={m.teamMemberId}
                      member={m}
                      isLast={i === filtered.length - 1}
                      canManage={canManage}
                    />
                  ))}
                </div>
              ) : null}
            </>
          );
        })()}

        {canManage && !showToolbar ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed bg-muted/40 px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              Invite by email — they&apos;ll get a link to join.
            </span>
            <InviteMemberButton teamId={teamId} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
