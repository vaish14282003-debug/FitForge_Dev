"use client";

import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAddNote, useClientNotes, useDeleteNote } from "@/hooks/use-extras";
import { useSession } from "@/hooks/use-session";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** A trainer's private notebook about one client. The member never sees it. */
export function ClientNotes({ memberId }: { memberId: string }) {
  const { data: session } = useSession();
  const notes = useClientNotes(memberId);
  const add = useAddNote(memberId);
  const remove = useDeleteNote(memberId);
  const toast = useToast();
  const [body, setBody] = useState("");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Notes</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Only trainers and the owner see these
        </span>
      </div>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          add.mutate(body.trim(), { onSuccess: () => (setBody(""), toast({ title: "Note added" })) });
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="e.g. Left knee sore on deep squats, keep to box squats this week."
          aria-label="New note"
          className="w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
            Add note
          </Button>
        </div>
      </form>
      {notes.isPending ? (
        <Skeleton className="mt-4 h-20 w-full" />
      ) : notes.data?.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No notes yet. Injuries, preferences and goals worth remembering go here.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {notes.data?.map((n) => (
            <li key={n.id} className="flex gap-3 py-3">
              <Avatar name={n.author.name} src={n.author.avatarUrl} className="size-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {n.author.name} · {when(n.createdAt)}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{n.body}</p>
              </div>
              {(n.author.id === session?.user.id || session?.user.role === "GYM_OWNER") && (
                <button
                  type="button"
                  aria-label="Delete note"
                  onClick={() => remove.mutate(n.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/15 hover:text-accent-text"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
