"use client";

import {
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { ProjectResourceRow } from "@/lib/resources/types";
import {
  RESOURCE_DESCRIPTION_MAX,
  RESOURCE_TITLE_MAX,
} from "@/lib/resources/validation";
import { cn } from "@/lib/utils";

import {
  createResource,
  deleteResource,
  updateResource,
} from "./resource-actions";

type ProjectResourcesSectionProps = {
  projectId: string;
  /**
   * True when the viewer holds a role permitted to add / edit / delete
   * resources (ADMIN / INSTRUCTOR / ASSISTANT). Author-only mutation
   * gates still apply on top — the server enforces both.
   */
  canManage: boolean;
  viewerId: string;
  resources: ProjectResourceRow[];
};

export function ProjectResourcesSection({
  projectId,
  canManage,
  viewerId,
  resources,
}: Readonly<ProjectResourcesSectionProps>) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold tracking-tight">Resources</h3>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Links to docs, spreadsheets, or references for this project.
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
        <ResourceForm
          projectId={projectId}
          mode="create"
          onCancel={() => setIsCreateOpen(false)}
          onSaved={() => setIsCreateOpen(false)}
        />
      ) : null}

      {resources.length === 0 ? (
        <EmptyResources
          canManage={canManage}
          onAdd={canManage && !isCreateOpen ? () => setIsCreateOpen(true) : null}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceRow
                resource={resource}
                viewerId={viewerId}
                isEditing={editingResourceId === resource.id}
                onEdit={() => setEditingResourceId(resource.id)}
                onCancelEdit={() => setEditingResourceId(null)}
                onSaved={() => setEditingResourceId(null)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Empty state -------------------------------------------------------

type EmptyResourcesProps = {
  canManage: boolean;
  /**
   * When set, the empty state renders a primary `Add first resource`
   * button bound to this handler. Hidden for dancers (canManage=false)
   * and when the create form is already open.
   */
  onAdd: (() => void) | null;
};

function EmptyResources({ canManage, onAdd }: Readonly<EmptyResourcesProps>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-5 text-center">
      <Link2 aria-hidden className="size-4 text-muted-foreground" />
      <p className="max-w-[240px] text-[12px] leading-snug text-muted-foreground">
        {canManage
          ? "No resources yet. Add a link to the running order, choreography notes, or shared docs."
          : "No resources yet. An admin, instructor, or assistant can add them."}
      </p>
      {onAdd ? (
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus aria-hidden className="size-3" />
          Add first resource
        </Button>
      ) : null}
    </div>
  );
}

// --- Form (shared create + edit) ---------------------------------------

type ResourceFormMode =
  | { mode: "create" }
  | { mode: "edit"; resource: ProjectResourceRow };

type ResourceFormProps = {
  projectId: string;
  onCancel: () => void;
  onSaved: () => void;
} & ResourceFormMode;

function ResourceForm(props: Readonly<ResourceFormProps>) {
  const { projectId, onCancel, onSaved } = props;
  const initial = props.mode === "edit" ? props.resource : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = props.mode === "edit";
  const descriptionRemaining = RESOURCE_DESCRIPTION_MAX - description.length;
  const showDescriptionCounter = descriptionRemaining < 40;

  // Event param is deliberately omitted — TS infers it at the inline
  // `onSubmit` call site and we sidestep `React.FormEvent` /
  // `FormEventHandler`, which sonar's S1874 rule treats as deprecated
  // against the React 19 form-action push.
  const submitForm = () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!trimmedUrl) {
      setError("URL is required.");
      return;
    }

    startTransition(async () => {
      setError(null);

      const formData = new FormData();
      formData.append("title", trimmedTitle);
      formData.append("url", trimmedUrl);
      // Trim parity with title/url. The server schema trims anyway, but
      // sending the trimmed value keeps the maxLength counter honest
      // when a user fills to the cap with trailing whitespace.
      formData.append("description", description.trim());

      let result;
      if (isEdit && initial) {
        formData.append("resourceId", initial.id);
        result = await updateResource({}, formData);
      } else {
        formData.append("projectId", projectId);
        result = await createResource({}, formData);
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(
        isEdit ? "Resource updated." : `Resource "${trimmedTitle}" added.`
      );

      if (!isEdit) {
        setTitle("");
        setUrl("");
        setDescription("");
      }
      onSaved();
    });
  };

  // Cmd/Ctrl + Enter submits — matches the comment composer convention so
  // users who type the description don't have to reach for the mouse.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  // Avoid the nested ternary inside the JSX — sonar S3358 wants this
  // computed up front, and the explicit branching reads more clearly.
  let submitLabel: string;
  if (isPending) {
    submitLabel = isEdit ? "Saving..." : "Adding...";
  } else {
    submitLabel = isEdit ? "Save changes" : "Add resource";
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitForm();
      }}
      className="flex flex-col gap-3 rounded-md border bg-background p-3"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="resourceTitle">Title</FieldLabel>
          <FieldContent>
            <Input
              id="resourceTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Show running order"
              maxLength={RESOURCE_TITLE_MAX}
              disabled={isPending}
              autoFocus
            />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="resourceUrl">URL</FieldLabel>
          <FieldContent>
            <Input
              id="resourceUrl"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://docs.google.com/..."
              disabled={isPending}
              // text-base prevents iOS auto-zoom on focus — same rule the
              // comment composer follows; the global Input primitive may
              // already do this, but explicit is safer for the URL field.
              className="text-base"
            />
            <FieldDescription>
              Must start with http:// or https://.
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="resourceDescription">
            Description (optional)
          </FieldLabel>
          <FieldContent>
            <Textarea
              id="resourceDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A quick note about what this is."
              maxLength={RESOURCE_DESCRIPTION_MAX}
              disabled={isPending}
              rows={2}
              className="min-h-[60px]"
            />
            {showDescriptionCounter ? (
              <FieldDescription
                className={cn(descriptionRemaining < 0 && "text-destructive")}
              >
                {descriptionRemaining} characters left
              </FieldDescription>
            ) : null}
          </FieldContent>
        </Field>
      </FieldGroup>

      {error ? <FieldError errors={[{ message: error }]} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {submitLabel}
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

// --- Row ---------------------------------------------------------------

type ResourceRowProps = {
  resource: ProjectResourceRow;
  viewerId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
};

function ResourceRow({
  resource,
  viewerId,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaved,
}: Readonly<ResourceRowProps>) {
  const isAuthor = resource.author.id === viewerId;

  if (isEditing) {
    return (
      <ResourceForm
        projectId={resource.projectId}
        mode="edit"
        resource={resource}
        onCancel={onCancelEdit}
        onSaved={onSaved}
      />
    );
  }

  const domain = extractDomain(resource.url);
  const edited = isEdited(resource);
  const authorName = resource.author.name || resource.author.email;
  // Defense-in-depth scheme check at render time. The validation layer
  // blocks non-http(s) URLs at write time, so this regex normally passes
  // — but if a bad URL ever reaches the DB (raw SQL, future migration
  // mistake, etc.), we degrade to a no-op href rather than rendering a
  // live `javascript:` link. React doesn't sanitize hrefs natively.
  const safeHref = /^https?:\/\//i.test(resource.url) ? resource.url : "#";

  return (
    <div className="flex items-start gap-2 rounded-md border bg-background p-3">
      <Link2
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          title={resource.title}
          className="group inline-flex max-w-full items-center gap-1.5 text-[13.5px] font-semibold leading-snug text-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:underline"
        >
          <span className="truncate">{resource.title}</span>
          <ExternalLink
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary"
          />
        </a>
        {domain || resource.description ? (
          <p className="line-clamp-1 text-[12px] leading-snug text-muted-foreground">
            {domain ? (
              <span className="font-medium text-foreground/70">{domain}</span>
            ) : null}
            {domain && resource.description ? (
              <span aria-hidden> · </span>
            ) : null}
            {resource.description}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AvatarInitials
            name={resource.author.name}
            fallback={resource.author.email}
            toneSeed={resource.author.id}
            size={16}
          />
          <span className="truncate">{firstName(authorName)}</span>
          <span aria-hidden>·</span>
          <span>{formatRelative(resource.createdAt)}</span>
          {edited ? (
            <>
              <span aria-hidden>·</span>
              <span>edited</span>
            </>
          ) : null}
        </div>
      </div>
      {isAuthor ? (
        <ResourceActionsMenu
          resource={resource}
          onEdit={onEdit}
        />
      ) : (
        // Reserve the same width so rows align regardless of menu visibility.
        <span aria-hidden className="inline-block size-6 shrink-0" />
      )}
    </div>
  );
}

type ResourceActionsMenuProps = {
  resource: ProjectResourceRow;
  onEdit: () => void;
};

function ResourceActionsMenu({
  resource,
  onEdit,
}: Readonly<ResourceActionsMenuProps>) {
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(`Delete "${resource.title}"? This can't be undone.`)
    ) {
      return;
    }
    startDelete(async () => {
      const result = await deleteResource({ resourceId: resource.id });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Resource deleted.");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for ${resource.title}`}
          disabled={isDeleting}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden className="size-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleDelete} variant="destructive">
          <Trash2 aria-hidden className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Helpers -----------------------------------------------------------

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isEdited(resource: ProjectResourceRow): boolean {
  // 60s grace window — Prisma's `updatedAt` ticks on insert too, so a
  // bare `>` would surface "edited" on every freshly-created row.
  return resource.updatedAt.getTime() > resource.createdAt.getTime() + 60_000;
}

function firstName(displayName: string): string {
  return displayName.split(/\s+/)[0] ?? displayName;
}

function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
