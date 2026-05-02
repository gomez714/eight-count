"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { NewProjectButton } from "./new-project-button";
import { ProjectRow, type ProjectRowData } from "./project-row";

type ProjectsSectionProps = {
  teamId: string;
  projects: ProjectRowData[];
  canCreate: boolean;
};

function ProjectsEmptyState({
  teamId,
  canCreate,
}: Readonly<{ teamId: string; canCreate: boolean }>) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed bg-card px-7 py-9">
      <span
        aria-hidden
        className="inline-flex size-11 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground"
      >
        <Sparkles className="size-5" />
      </span>
      <div className="flex max-w-lg flex-col gap-1.5">
        <h3 className="text-base font-semibold tracking-tight">
          No projects yet
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A project is a piece you&apos;re rehearsing — a routine, a number, or a
          full show. Each project holds its rehearsals and the notes left on
          them.
        </p>
      </div>
      {canCreate ? (
        <NewProjectButton teamId={teamId} label="Create first project" />
      ) : (
        <p className="text-xs text-muted-foreground">
          An admin or instructor can add the first project.
        </p>
      )}
    </div>
  );
}

export function ProjectsSection({
  teamId,
  projects,
  canCreate,
}: Readonly<ProjectsSectionProps>) {
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = useMemo(
    () => projects.filter((p) => p.status === "ARCHIVED").length,
    [projects]
  );

  const visible = useMemo(
    () =>
      showArchived
        ? projects
        : projects.filter((p) => p.status === "ACTIVE"),
    [projects, showArchived]
  );

  const isEmpty = projects.length === 0;
  const hasArchived = archivedCount > 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          <p className="text-[13px] text-muted-foreground">
            Pieces, routines, and shows under this team. Open one to manage its
            rehearsals and notes.
          </p>
        </div>

        {!isEmpty ? (
          <div className="flex flex-wrap items-center gap-3">
            {hasArchived ? (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-pressed={showArchived}
                className="rounded text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showArchived
                  ? "Hide archived"
                  : `Show archived (${archivedCount})`}
              </button>
            ) : null}
            {canCreate ? (
              <NewProjectButton teamId={teamId} variant="outline" size="sm" />
            ) : null}
          </div>
        ) : null}
      </div>

      {isEmpty ? <ProjectsEmptyState teamId={teamId} canCreate={canCreate} /> : null}

      {!isEmpty && visible.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-7 text-center text-sm text-muted-foreground">
          No active projects.{" "}
          {hasArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Show archived ({archivedCount})
            </button>
          ) : null}
        </div>
      ) : null}

      {!isEmpty && visible.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {visible.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
