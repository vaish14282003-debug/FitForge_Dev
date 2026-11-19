"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Compass, KeyRound, Trash2, Upload } from "lucide-react";
import { FormError } from "@/components/auth/auth-card";
import { PageHeader } from "@/components/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { tourStore } from "@/features/tour/tour-store";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useGym } from "@/hooks/use-gym";
import { useChangePassword, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { ROLE_LABEL } from "@/lib/access";
import type { FitnessGoal, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "LOSE_WEIGHT", label: "Lose weight" },
  { value: "BUILD_MUSCLE", label: "Build muscle" },
  { value: "GET_STRONGER", label: "Get stronger" },
  { value: "IMPROVE_FITNESS", label: "Improve fitness" },
  { value: "STAY_HEALTHY", label: "Stay healthy" },
];

function PhotoCard({ user }: { user: User }) {
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Free the temporary preview URL once it's replaced or the page closes.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(file: File | undefined) {
    if (!file) return;
    // Checked here for a quick answer; the server checks again and decodes the image properly.
    if (!TYPES.includes(file.type)) return toast({ title: "Use a JPG, PNG or WebP image", tone: "error" });
    if (file.size > MAX_BYTES) return toast({ title: "That image is over 5 MB", description: "Choose a smaller one.", tone: "error" });
    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: () => toast({ title: "Profile photo updated" }),
      onError: (err) => toast({ title: "Couldn't upload photo", description: err.message, tone: "error" }),
      onSettled: () => setPreview(null),
    });
  }

  const shown = preview ?? user.avatarUrl;

  return (
    <Card
      className={cn("flex flex-col items-center text-center transition", dragging && "border-primary bg-primary/10")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files[0]);
      }}
    >
      <div className="relative">
        <Avatar name={user.name} src={shown} size="xl" className={cn("ring-4 ring-white/10", upload.isPending && "opacity-60")} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label="Change profile photo"
          className="absolute right-0 bottom-0 grid size-10 place-items-center rounded-full bg-primary text-white shadow-[0_6px_20px_-6px_var(--primary)] ring-4 ring-[#0f0a0a] transition hover:brightness-110"
        >
          <Camera className="size-[18px]" aria-hidden />
        </button>
        {upload.isPending && (
          <span className="absolute inset-0 grid place-items-center" role="status" aria-label="Uploading">
            <span className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </span>
        )}
      </div>
      <h2 className="font-display mt-5 text-2xl font-semibold">{user.name}</h2>
      <p className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]}</p>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending}>
          <Upload className="size-4" aria-hidden />
          {user.avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        {user.avatarUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            loading={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => toast({ title: "Photo removed" }) })}
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Drag a photo here, or choose one. JPG, PNG or WebP, up to 5 MB.</p>
    </Card>
  );
}

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number"),
  dateOfBirth: z.string(),
  heightCm: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 100 && Number(v) <= 250), "Between 100 and 250 cm"),
  bio: z.string().trim().max(300),
});
type Details = z.infer<typeof detailsSchema>;

function DetailsCard({ user }: { user: User }) {
  const update = useUpdateProfile();
  const toast = useToast();
  const isMember = user.role === "MEMBER";
  const [goal, setGoal] = useState<FitnessGoal | null>(user.fitnessGoal);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? "",
      dateOfBirth: user.dateOfBirth ?? "",
      heightCm: user.heightCm ? String(user.heightCm) : "",
      bio: user.bio ?? "",
    },
  });

  function save(values: Details) {
    update.mutate(
      {
        name: values.name,
        phone: values.phone,
        ...(isMember
          ? { dateOfBirth: values.dateOfBirth || null, heightCm: values.heightCm ? Number(values.heightCm) : null, fitnessGoal: goal }
          : { bio: values.bio }),
      },
      { onSuccess: () => toast({ title: "Profile saved" }) },
    );
  }

  return (
    <Card>
      <CardTitle className="text-foreground">Your details</CardTitle>
      <form className="mt-5 space-y-5" noValidate onSubmit={handleSubmit(save)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="p-name" error={errors.name?.message}>
            <Input id="p-name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Phone" htmlFor="p-phone" error={errors.phone?.message}>
            <Input id="p-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" aria-invalid={!!errors.phone} {...register("phone")} />
          </Field>
        </div>

        {isMember ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" htmlFor="p-dob">
                <Input id="p-dob" type="date" max={new Date().toLocaleDateString("en-CA")} {...register("dateOfBirth")} />
              </Field>
              <Field label="Height (cm)" htmlFor="p-height" error={errors.heightCm?.message}>
                <Input id="p-height" inputMode="numeric" placeholder="168" aria-invalid={!!errors.heightCm} {...register("heightCm")} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">Main goal</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Main goal">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    role="radio"
                    aria-checked={goal === g.value}
                    onClick={() => setGoal(goal === g.value ? null : g.value)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      goal === g.value ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Your trainer sees this when building your plan.</p>
            </div>
          </>
        ) : (
          <Field label="About you" htmlFor="p-bio" hint="Shown to members, e.g. specialties and experience.">
            <textarea
              id="p-bio"
              rows={3}
              maxLength={300}
              className="w-full rounded-xl border border-border bg-white/[0.04] px-4 py-3 text-[15px] transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
              placeholder="Strength & conditioning coach, 6 years. Specialises in powerlifting and mobility."
              {...register("bio")}
            />
          </Field>
        )}

        <FormError message={update.error?.message} />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!isDirty && goal === user.fitnessGoal}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });

function PasswordCard() {
  const change = useChangePassword();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });

  return (
    <Card>
      <CardTitle className="flex items-center gap-2 text-foreground">
        <KeyRound className="size-4 text-accent-text" aria-hidden />
        Change password
      </CardTitle>
      <form
        className="mt-5 space-y-4"
        noValidate
        onSubmit={handleSubmit(({ currentPassword, newPassword }) =>
          change.mutate(
            { currentPassword, newPassword },
            {
              onSuccess: () => {
                reset();
                toast({ title: "Password changed", description: "You've been signed out on your other devices." });
              },
            },
          ),
        )}
      >
        <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword?.message}>
          <PasswordInput id="pw-current" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register("currentPassword")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="pw-new" error={errors.newPassword?.message} hint="At least 8 characters.">
            <PasswordInput id="pw-new" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm?.message}>
            <PasswordInput id="pw-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
          </Field>
        </div>
        <FormError message={change.error?.message} />
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={change.isPending}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const { data: gym } = useGym();
  if (!session) return null;
  const { user } = session;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={
          <>
            Your <span className="text-primary">profile</span>
          </>
        }
        subtitle="How you appear to your gym, and how you sign in."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <PhotoCard user={user} />
          <Card>
            <CardTitle className="text-foreground">Account</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Email", user.email],
                ["Role", ROLE_LABEL[user.role]],
                ["Gym", gym?.name ?? "…"],
                ...(user.trainer ? [["Trainer", user.trainer.name]] : []),
                ["Member since", new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <Button variant="outline" size="sm" className="mt-5 w-full" onClick={() => tourStore.start()}>
              <Compass className="size-4" aria-hidden />
              Take the tour again
            </Button>
          </Card>
        </div>
        <div className="space-y-6">
          <DetailsCard key={user.id} user={user} />
          <PasswordCard />
        </div>
      </div>
    </>
  );
}
