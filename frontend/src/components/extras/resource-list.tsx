"use client";

import { Download, FileText, Image as ImageIcon, Trash2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useDeleteResource } from "@/hooks/use-extras";
import type { Resource } from "@/lib/types";

export const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Shared files as cards. Owners of a file (or the gym owner) can delete it. */
export function ResourceList({ resources, canDelete, showAudience }: { resources: Resource[]; canDelete: (r: Resource) => boolean; showAudience?: boolean }) {
  const remove = useDeleteResource();
  const toast = useToast();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {resources.map((r) => {
        const Icon = r.mimeType === "application/pdf" ? FileText : ImageIcon;
        return (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-accent-text ring-1 ring-primary/20">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{r.title}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {r.fileName} · {fileSize(r.size)}
                </p>
              </div>
            </div>
            {r.description ? <p className="mt-3 text-sm text-muted-foreground">{r.description}</p> : null}
            <div className="mt-4 flex flex-1 items-end justify-between gap-2 border-t border-white/10 pt-3">
              <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {showAudience ? (
                  <>
                    <Users className="size-3.5 shrink-0" aria-hidden />
                    {r.shareWithAllClients ? "All your clients" : `${r.sharedWith.length} client${r.sharedWith.length === 1 ? "" : "s"}`}
                  </>
                ) : (
                  <>
                    <Avatar name={r.owner.name} src={r.owner.avatarUrl} className="size-6 text-[10px]" />
                    <span className="truncate">{r.owner.name}</span>
                  </>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <a
                  href={r.downloadUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-sm font-medium transition hover:bg-white/10"
                >
                  <Download className="size-4" aria-hidden />
                  Open
                </a>
                {canDelete(r) && (
                  <button
                    type="button"
                    aria-label={`Delete ${r.title}`}
                    onClick={() => remove.mutate(r.id, { onSuccess: () => toast({ title: "File deleted" }) })}
                    className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
