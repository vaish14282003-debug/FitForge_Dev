"use client";

import { useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { AnnouncementItem, PostAnnouncementDialog } from "@/components/notifications/announcement-bits";
import { EmptyState, PageHeader } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAnnouncements, useDeleteAnnouncement } from "@/hooks/use-notifications";
import { useSession } from "@/hooks/use-session";
import { can } from "@/lib/access";

export default function AnnouncementsPage() {
  const { data: session } = useSession();
  const announcements = useAnnouncements();
  const remove = useDeleteAnnouncement();
  const toast = useToast();
  const [posting, setPosting] = useState(false);
  const isOwner = !!session && can(session, "gym:settings");

  return (
    <>
      <PageHeader
        eyebrow="Gym news"
        title={
          <>
            <span className="text-primary">Announcements</span>
          </>
        }
        subtitle="Updates from your gym: closures, new equipment, events."
        actions={
          isOwner && (
            <Button onClick={() => setPosting(true)}>
              <Plus className="size-4" aria-hidden />
              Post announcement
            </Button>
          )
        }
      />
      {announcements.isPending ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : announcements.data?.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet">
          {isOwner ? "Post one to let everyone know what's happening." : "When your gym posts news, it shows up here."}
        </EmptyState>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {announcements.data?.map((a) => (
            <AnnouncementItem
              key={a.id}
              a={a}
              actions={
                isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${a.title}`}
                    className="text-muted-foreground"
                    onClick={() => remove.mutate(a.id, { onSuccess: () => toast({ title: "Announcement deleted" }) })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
      <PostAnnouncementDialog open={posting} onClose={() => setPosting(false)} />
    </>
  );
}
