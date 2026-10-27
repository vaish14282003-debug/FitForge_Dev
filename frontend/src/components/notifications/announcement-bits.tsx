"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Megaphone, Pin } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { timeAgo } from "@/components/notifications/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAnnouncements, useCreateAnnouncement, useSendMessage } from "@/hooks/use-notifications";
import type { Announcement, UserRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const textareaClass =
  "w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none";

export function AnnouncementItem({ a, actions }: { a: Announcement; actions?: React.ReactNode }) {
  return (
    <article className={cn("rounded-3xl border bg-white/[0.03] p-5 backdrop-blur-xl", a.pinned ? "border-primary/30" : "border-white/10")}>
      <div className="flex items-start gap-3">
        <Avatar name={a.author.name} src={a.author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.title}</span>
            {a.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-accent-text">
                <Pin className="size-3" aria-hidden />
                Pinned
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {a.author.name} · {timeAgo(a.createdAt)}
            {a.audience !== "EVERYONE" && ` · to ${a.audience.toLowerCase()}`}
          </p>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{a.body}</p>
        </div>
        {actions}
      </div>
    </article>
  );
}

/** The newest (pinned first) announcement, shown on dashboards. Renders nothing when there are none. */
export function LatestAnnouncement() {
  const { data } = useAnnouncements();
  const latest = data?.[0];
  if (!latest) return null;
  return (
    <Link href="/announcements" className="group mt-6 flex items-start gap-4 rounded-3xl border border-primary/25 bg-primary/[0.07] p-4 transition hover:border-primary/45 sm:p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/20 text-accent-text">
        <Megaphone className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">
          Announcement · {timeAgo(latest.createdAt)}
          {data.length > 1 ? ` · ${data.length - 1} more` : ""}
        </span>
        <span className="block font-semibold">{latest.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-foreground/80">{latest.body}</span>
      </span>
    </Link>
  );
}

export function PostAnnouncementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Post an announcement" description="Everyone in the audience gets a notification.">
      {open && <AnnouncementForm onDone={onClose} />}
    </Dialog>
  );
}

function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("EVERYONE");
  const [pinned, setPinned] = useState(false);
  const create = useCreateAnnouncement();
  const toast = useToast();

  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="an-title">
        <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Closed on Diwali" autoFocus />
      </Field>
      <Field label="Message" htmlFor="an-body">
        <textarea id="an-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} className={textareaClass} placeholder="The gym is closed on 1 November. Happy Diwali!" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who sees it" htmlFor="an-aud">
          <Select id="an-aud" value={audience} onChange={(e) => setAudience(e.target.value as Announcement["audience"])}>
            <option value="EVERYONE">Everyone</option>
            <option value="MEMBERS">Members only</option>
            <option value="TRAINERS">Trainers only</option>
            <option value="STAFF">Staff and trainers</option>
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-white/10 px-4 py-3 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Pin to the top
        </label>
      </div>
      <FormError message={create.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          loading={create.isPending}
          disabled={title.trim().length < 2 || !body.trim()}
          onClick={() =>
            create.mutate(
              { title: title.trim(), body: body.trim(), audience, pinned },
              {
                onSuccess: (r) => {
                  toast({ title: "Announcement posted", description: `${r.notified} ${r.notified === 1 ? "person" : "people"} notified.` });
                  onDone();
                },
              },
            )
          }
        >
          Post
        </Button>
      </div>
    </div>
  );
}

export function MessageClientsDialog({ open, clients, onClose }: { open: boolean; clients: UserRef[]; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Message clients" description="They'll see it in their notifications.">
      {open && <MessageForm clients={clients} onDone={onClose} />}
    </Dialog>
  );
}

function MessageForm({ clients, onDone }: { clients: UserRef[]; onDone: () => void }) {
  const [selected, setSelected] = useState(() => new Set(clients.map((c) => c.id)));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const send = useSendMessage();
  const toast = useToast();
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">To</p>
        <div className="flex flex-wrap gap-2">
          {clients.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={cn("inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition", on ? "border-primary bg-primary/15" : "border-white/10 text-muted-foreground")}
              >
                <Avatar name={c.name} src={c.avatarUrl} className="size-7 text-[11px]" />
                {c.name}
                {on && <Check className="size-3.5 text-accent-text" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Subject" htmlFor="msg-title">
        <Input id="msg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="New week, new targets" autoFocus />
      </Field>
      <Field label="Message" htmlFor="msg-body">
        <textarea id="msg-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} className={textareaClass} placeholder="Optional details" />
      </Field>
      <FormError message={send.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          loading={send.isPending}
          disabled={selected.size === 0 || title.trim().length < 2}
          onClick={() =>
            send.mutate(
              { memberIds: [...selected], title: title.trim(), body: body.trim() },
              {
                onSuccess: (r) => {
                  toast({ title: `Message sent to ${r.sent} ${r.sent === 1 ? "client" : "clients"}` });
                  onDone();
                },
              },
            )
          }
        >
          Send
        </Button>
      </div>
    </div>
  );
}
