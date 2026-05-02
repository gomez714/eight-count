"use client";

import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  createProjectGroup,
  deleteProjectGroup,
  updateProjectGroupMembers,
} from "./group-actions";

export type TeamMemberOption = {
  teamMemberId: string;
  userId: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";
};

export type ProjectGroupItem = {
  id: string;
  name: string;
  description: string | null;
  memberTeamMemberIds: string[];
};

type ProjectGroupsSectionProps = {
  projectId: string;
  canManage: boolean;
  groups: ProjectGroupItem[];
  teamMembers: TeamMemberOption[];
};

export function ProjectGroupsSection({
  projectId,
  canManage,
  groups,
  teamMembers,
}: Readonly<ProjectGroupsSectionProps>) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold tracking-tight">Groups</h3>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Named subsets of the cast you can target when leaving notes.
          </p>
        </div>
        {canManage && !isCreateOpen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus aria-hidden className="size-3" />
            New
          </Button>
        ) : null}
      </header>

      {canManage && isCreateOpen ? (
        <CreateGroupForm
          projectId={projectId}
          onCancel={() => setIsCreateOpen(false)}
          onCreated={() => setIsCreateOpen(false)}
        />
      ) : null}

      {groups.length === 0 ? (
        <EmptyGroups canManage={canManage} />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              projectId={projectId}
              group={group}
              teamMembers={teamMembers}
              canManage={canManage}
              isEditing={editingGroupId === group.id}
              onEdit={() => setEditingGroupId(group.id)}
              onCloseEdit={() => setEditingGroupId(null)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyGroups({ canManage }: Readonly<{ canManage: boolean }>) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed bg-muted/30 px-4 py-5 text-center">
      <Users aria-hidden className="size-4 text-muted-foreground" />
      <p className="max-w-[220px] text-[12px] leading-snug text-muted-foreground">
        {canManage
          ? "No groups yet. Front line, soloists, captains — name what you'll address."
          : "No groups yet. An admin or instructor can add them."}
      </p>
    </div>
  );
}

type CreateGroupFormProps = {
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
};

function CreateGroupForm({
  projectId,
  onCancel,
  onCreated,
}: Readonly<CreateGroupFormProps>) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    startTransition(async () => {
      setError(null);

      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("name", name);
      formData.append("description", description);

      const result = await createProjectGroup({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(`Group "${name.trim()}" created.`);
      setName("");
      setDescription("");
      onCreated();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border bg-background p-3"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="groupName">Name</FieldLabel>
          <FieldContent>
            <Input
              id="groupName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Front line"
              disabled={isPending}
              autoFocus
            />
            <FieldDescription>
              Choose something the rest of the team will recognize.
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="groupDescription">Description</FieldLabel>
          <FieldContent>
            <Textarea
              id="groupDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional: extra context."
              disabled={isPending}
              className="min-h-[64px]"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      {error ? <FieldError errors={[{ message: error }]} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating..." : "Create group"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

type GroupCardProps = {
  projectId: string;
  group: ProjectGroupItem;
  teamMembers: TeamMemberOption[];
  canManage: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
};

function GroupCard({
  projectId,
  group,
  teamMembers,
  canManage,
  isEditing,
  onEdit,
  onCloseEdit,
}: Readonly<GroupCardProps>) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    group.memberTeamMemberIds
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const memberLookup = new Map(
    teamMembers.map((member) => [member.teamMemberId, member])
  );

  const currentMembers = group.memberTeamMemberIds
    .map((id) => memberLookup.get(id))
    .filter((member): member is TeamMemberOption => Boolean(member));

  const handleToggle = (teamMemberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(teamMemberId)
        ? prev.filter((id) => id !== teamMemberId)
        : [...prev, teamMemberId]
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateProjectGroupMembers({
        projectId,
        groupId: group.id,
        teamMemberIds: selectedIds,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Members updated.`);
      onCloseEdit();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete group "${group.name}"? This can't be undone.`)) {
      return;
    }
    startDelete(async () => {
      const result = await deleteProjectGroup({
        projectId,
        groupId: group.id,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Group "${group.name}" deleted.`);
    });
  };

  const isEmpty = currentMembers.length === 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold">
              {group.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 text-[10.5px] font-semibold tabular-nums",
                isEmpty
                  ? "border-[color:var(--status-progress-border)] bg-[color:var(--status-progress-bg)] text-[color:var(--status-progress-fg)]"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {isEmpty ? "empty" : currentMembers.length}
            </span>
          </div>
          {group.description ? (
            <p className="text-[12px] leading-snug text-muted-foreground">
              {group.description}
            </p>
          ) : null}
        </div>
        {canManage && !isEditing ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Edit ${group.name} members`}
              onClick={() => {
                setSelectedIds(group.memberTeamMemberIds);
                onEdit();
              }}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete ${group.name}`}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border bg-muted/20 p-1.5">
            {teamMembers.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No team members available.
              </p>
            ) : (
              teamMembers.map((member) => {
                const checked = selectedIds.includes(member.teamMemberId);
                return (
                  <label
                    key={member.teamMemberId}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-card"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(member.teamMemberId)}
                      disabled={isPending}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium">
                        {member.name || member.email}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {member.email} • {member.role}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(group.memberTeamMemberIds);
                  onCloseEdit();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <MemberPills members={currentMembers} canManage={canManage} onAdd={onEdit} />
      )}
    </div>
  );
}

type MemberPillsProps = {
  members: TeamMemberOption[];
  canManage: boolean;
  onAdd: () => void;
};

function MemberPills({ members, canManage, onAdd }: Readonly<MemberPillsProps>) {
  if (members.length === 0) {
    if (canManage) {
      return (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed bg-transparent py-1.5 text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden className="size-3" />
          Add members
        </button>
      );
    }
    return (
      <p className="text-[12px] text-muted-foreground">No members yet.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((member) => (
        <span
          key={member.teamMemberId}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-2 text-[11.5px] font-medium"
        >
          <AvatarInitials
            name={member.name}
            fallback={member.email}
            toneSeed={member.userId}
            size={16}
          />
          {member.name || member.email}
        </span>
      ))}
    </div>
  );
}
