"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}: ProjectGroupsSectionProps) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Groups</h2>
        <p className="text-sm text-muted-foreground">
          Named subsets of the cast — front line, soloists, captains — that
          you can target when leaving notes.
        </p>
      </div>

      {canManage ? (
        <CreateGroupForm projectId={projectId} />
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No groups yet
              {canManage
                ? ". Create one above to start sending section notes."
                : ". An admin or instructor can add groups."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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

type CreateGroupFormProps = {
  projectId: string;
};

function CreateGroupForm({ projectId }: CreateGroupFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setDescription("");
    setError(null);
  };

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
      reset();
      setIsOpen(false);
    });
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
      >
        New group
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New group</CardTitle>
        <CardDescription>
          Give the group a name. You&apos;ll add members after it&apos;s
          created.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <FieldLabel htmlFor="groupDescription">
                Description
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id="groupDescription"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional: extra context about this group."
                  disabled={isPending}
                  className="min-h-[80px]"
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          {error ? <FieldError errors={[{ message: error }]} /> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create group"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
}: GroupCardProps) {
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

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{group.name}</CardTitle>
            {group.description ? (
              <CardDescription>{group.description}</CardDescription>
            ) : null}
          </div>
          {canManage && !isEditing ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedIds(group.memberTeamMemberIds);
                  onEdit();
                }}
              >
                Edit members
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team members available.
                </p>
              ) : (
                teamMembers.map((member) => {
                  const checked = selectedIds.includes(member.teamMemberId);
                  return (
                    <label
                      key={member.teamMemberId}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(member.teamMemberId)}
                        disabled={isPending}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {member.name || member.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.email} • {member.role}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
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
        ) : (
          <MemberPills members={currentMembers} />
        )}
      </CardContent>
    </Card>
  );
}

type MemberPillsProps = {
  members: TeamMemberOption[];
};

function MemberPills({ members }: MemberPillsProps) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No members yet.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => (
        <span
          key={member.teamMemberId}
          className={cn(
            "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
          )}
        >
          {member.name || member.email}
        </span>
      ))}
    </div>
  );
}
