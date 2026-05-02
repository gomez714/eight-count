import { Film } from "lucide-react";

import { NewRehearsalButton } from "./new-rehearsal-button";
import { RehearsalRow, type RehearsalRowData } from "./rehearsal-row";

type RehearsalsSectionProps = {
  projectId: string;
  rehearsals: RehearsalRowData[];
  canManage: boolean;
};

function RehearsalsEmptyState({
  projectId,
  canManage,
}: Readonly<{ projectId: string; canManage: boolean }>) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed bg-card px-7 py-9">
      <span
        aria-hidden
        className="inline-flex size-11 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground"
      >
        <Film className="size-5" />
      </span>
      <div className="flex max-w-lg flex-col gap-1.5">
        <h3 className="text-base font-semibold tracking-tight">
          No rehearsals yet
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A rehearsal is a video plus the notes it generates. Record a run,
          upload it here, and your team can leave timestamped feedback in the
          workspace.
        </p>
      </div>
      {canManage ? (
        <NewRehearsalButton
          projectId={projectId}
          label="Create first rehearsal"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          An admin or instructor can add the first rehearsal.
        </p>
      )}
    </div>
  );
}

export function RehearsalsSection({
  projectId,
  rehearsals,
  canManage,
}: Readonly<RehearsalsSectionProps>) {
  const isEmpty = rehearsals.length === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Rehearsals</h2>
          <p className="text-[13px] text-muted-foreground">
            Each rehearsal becomes a workspace where you watch the run and
            leave notes.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <RehearsalsEmptyState projectId={projectId} canManage={canManage} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rehearsals.map((rehearsal) => (
            <RehearsalRow key={rehearsal.id} rehearsal={rehearsal} />
          ))}
        </div>
      )}
    </section>
  );
}
