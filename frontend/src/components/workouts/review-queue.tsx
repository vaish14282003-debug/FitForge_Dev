"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CircleCheck, MessageSquarePlus } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { SessionDetail, SessionStats } from "@/components/workouts/session-detail";
import { useReviewSession } from "@/hooks/use-sessions";
import type { WorkoutSession } from "@/lib/types";
import { formatDate } from "@/lib/workout";

function ReviewDialog({ session, onClose }: { session: WorkoutSession | null; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const review = useReviewSession();
  const toast = useToast();

  function close() {
    setComment("");
    review.reset();
    onClose();
  }

  return (
    <Dialog
      open={!!session}
      onClose={close}
      title={session ? `${session.member.name.split(" ")[0]}'s ${session.dayName}` : ""}
      description={session ? `${formatDate(session.completedAt)} · ${session.planName}` : undefined}
      className="max-w-xl"
    >
      {session && (
        <div className="space-y-5">
          <SessionDetail session={session} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Your feedback</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="e.g. Solid session. Add 2.5 kg to the bench next time."
              className="w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
            />
          </label>
          <FormError message={review.error?.message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Later
            </Button>
            <Button
              loading={review.isPending}
              disabled={!comment.trim()}
              onClick={() =>
                review.mutate(
                  { id: session.id, comment: comment.trim() },
                  {
                    onSuccess: () => {
                      toast({ title: "Feedback sent", description: `${session.member.name} will see it in their history.` });
                      close();
                    },
                  },
                )
              }
            >
              Send feedback
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Client workouts waiting for the trainer's feedback, newest first. */
export function ReviewQueue({ sessions, loading }: { sessions: WorkoutSession[] | undefined; loading: boolean }) {
  const [open, setOpen] = useState<WorkoutSession | null>(null);

  return (
    <>
      {loading ? (
        <Skeleton className="h-28 w-full rounded-3xl" />
      ) : !sessions?.length ? (
        <Card className="flex items-center gap-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">All caught up</p>
            <p className="text-sm text-muted-foreground">New client workouts will appear here for your feedback.</p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session, i) => (
            <motion.li
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-5"
            >
              <Avatar name={session.member.name} src={session.member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {session.member.name} <span className="font-normal text-muted-foreground">· {session.dayName}</span>
                </p>
                <p className="text-sm text-muted-foreground">{formatDate(session.completedAt)}</p>
                <SessionStats session={session} className="mt-2" />
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpen(session)}>
                <MessageSquarePlus className="size-4" aria-hidden />
                Review
              </Button>
            </motion.li>
          ))}
        </ul>
      )}
      <ReviewDialog session={open} onClose={() => setOpen(null)} />
    </>
  );
}
