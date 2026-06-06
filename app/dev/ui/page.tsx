import { getUiVariant, type UiVariant } from "@/lib/ui/variant";

export const metadata = {
  title: "UI variant · Eight Count",
  robots: "noindex, nofollow",
};

const OPTIONS: ReadonlyArray<{
  value: UiVariant;
  label: string;
  description: string;
}> = [
  {
    value: "v1",
    label: "v1 — current production",
    description:
      "Today's dashboard: meta band, onboarding checklist, work tiles, teams list.",
  },
  {
    value: "v2",
    label: "v2 — activity-led redesign",
    description:
      "Pinned Up Next + activity feed + quiet-week + quick-start re-entry handling.",
  },
];

export default async function UiVariantTogglePage() {
  const current = await getUiVariant();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Internal · UI variant
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Switch dashboard variant
        </h1>
        <p className="text-sm text-muted-foreground">
          Sets the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            ec_ui_variant
          </code>{" "}
          cookie. Affects what you (and only you) see on{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            /dashboard
          </code>
          . Persists for one year on this device.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const isActive = current === option.value;
          return (
            <form
              key={option.value}
              action="/api/dev/ui-variant"
              method="POST"
              className="contents"
            >
              <input type="hidden" name="variant" value={option.value} />
              <input type="hidden" name="redirect" value="/dev/ui" />
              <button
                type="submit"
                disabled={isActive}
                className="group flex flex-col items-start gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] disabled:opacity-100"
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  {isActive ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      Switch →
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            </form>
          );
        })}
      </section>

      <footer className="text-xs text-muted-foreground">
        Programmatic alternative:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
          curl -X POST -H &apos;content-type: application/json&apos; -d
          &apos;{`{`}&quot;variant&quot;:&quot;v2&quot;{`}`}&apos;
          /api/dev/ui-variant
        </code>
      </footer>
    </main>
  );
}
