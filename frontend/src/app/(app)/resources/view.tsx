"use client";

import { useRef, useState } from "react";
import { FolderOpen, Upload } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { ResourceList, fileSize } from "@/components/extras/resource-list";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useResources, useUploadResource } from "@/hooks/use-extras";
import { useClients } from "@/hooks/use-gym";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Share a file" description="PDF, JPG, PNG or WebP up to 10 MB." className="max-w-xl">
      {open && <UploadForm onDone={onClose} />}
    </Dialog>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const clients = useClients();
  const upload = useUploadResource();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [everyone, setEveryone] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();

  function choose(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Use a PDF, JPG, PNG or WebP file.");
    if (f.size > MAX) return setError("That file is over 10 MB.");
    setError(undefined);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          choose(e.dataTransfer.files[0]);
        }}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-8 text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5"
      >
        <Upload className="size-6 text-accent-text" aria-hidden />
        {file ? (
          <span className="text-foreground">
            {file.name} · {fileSize(file.size)}
          </span>
        ) : (
          "Drop a file here, or click to choose"
        )}
      </button>
      <input ref={input} type="file" accept={TYPES.join(",")} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
      <Field label="Title" htmlFor="r-title">
        <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. High-protein meal plan" maxLength={100} />
      </Field>
      <Field label="Note" htmlFor="r-desc">
        <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" maxLength={300} />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium">Share with</p>
        <div className="mb-3 flex rounded-full border border-white/10 bg-white/5 p-1">
          {[
            [true, "All my clients"],
            [false, "Pick clients"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setEveryone(value as boolean)}
              className={cn("flex-1 rounded-full py-2 text-sm font-medium transition", everyone === value ? "bg-white text-black" : "text-muted-foreground")}
            >
              {label as string}
            </button>
          ))}
        </div>
        {!everyone && (
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {clients.data?.map((c) => (
              <li key={c.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2", picked.has(c.id) ? "bg-primary/10" : "hover:bg-white/5")}>
                  <input
                    type="checkbox"
                    checked={picked.has(c.id)}
                    onChange={() =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Avatar name={c.name} src={c.avatarUrl} className="size-8 text-xs" />
                  <span className="text-sm">{c.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormError message={error ?? upload.error?.message} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          loading={upload.isPending}
          disabled={!file || title.trim().length < 2 || (!everyone && picked.size === 0)}
          onClick={() =>
            upload.mutate(
              { file: file!, title: title.trim(), description: description.trim(), memberIds: everyone ? [] : [...picked] },
              {
                onSuccess: () => {
                  toast({ title: "File shared", description: everyone ? "Your clients have been notified." : `Shared with ${picked.size} client${picked.size === 1 ? "" : "s"}.` });
                  onDone();
                },
              },
            )
          }
        >
          Share file
        </Button>
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const { data: session } = useSession();
  const resources = useResources();
  const [uploading, setUploading] = useState(false);
  const isTrainer = session?.user.role === "TRAINER";

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title={
          <>
            Shared <span className="text-primary">files</span>
          </>
        }
        subtitle={isTrainer ? "Diet sheets, guides and programmes for your clients. They're notified when you share one." : "Every file trainers have shared with members."}
        actions={
          isTrainer && (
            <Button onClick={() => setUploading(true)}>
              <Upload className="size-4" aria-hidden />
              Share a file
            </Button>
          )
        }
      />
      {resources.isPending ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : resources.data?.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing shared yet">
          {isTrainer ? "Share a PDF or image and your clients will find it on their Workouts page." : "Files trainers share will appear here."}
        </EmptyState>
      ) : (
        <ResourceList resources={resources.data!} canDelete={() => true} showAudience={isTrainer} />
      )}
      <UploadDialog open={uploading} onClose={() => setUploading(false)} />
    </>
  );
}
