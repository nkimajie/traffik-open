"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  useChangePasswordMutation,
  useProfileQuery,
  useUpdateNotificationSettingsMutation,
  useUpdateProfileMutation,
} from "@/lib/services/api/shopper/use-profile.api";
import { DetailSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import type { NotificationSettings } from "@/lib/types/api";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  countryCode: z.string().min(1),
  phone: z.string().min(1, "Phone is required"),
});

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

const defaultNotifications: NotificationSettings = {
  general: true,
  updates: { email: true, push: true, sms: false },
  promotions: { email: true, push: false, sms: false },
};

export default function AccountSettingsPage() {
  const { logout } = useAuth();
  const { data: profile, isLoading, error, refetch } = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const updateNotificationsMutation = useUpdateNotificationSettingsMutation();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationSettings>(defaultNotifications);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      countryCode: "+234",
      phone: "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (!profile) return;
    profileForm.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      countryCode: profile.phone?.countryCode ?? "+234",
      phone: profile.phone?.number ?? "",
    });
    if (profile.notificationSettings) {
      setNotifications({
        general: profile.notificationSettings.general ?? true,
        updates: {
          email: profile.notificationSettings.updates?.email ?? true,
          push: profile.notificationSettings.updates?.push ?? true,
          sms: profile.notificationSettings.updates?.sms ?? false,
        },
        promotions: {
          email: profile.notificationSettings.promotions?.email ?? true,
          push: profile.notificationSettings.promotions?.push ?? false,
          sms: profile.notificationSettings.promotions?.sms ?? false,
        },
      });
    }
  }, [profile, profileForm]);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !profile) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const initials =
    `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  function onProfileSubmit(values: ProfileFormValues) {
    updateProfileMutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: {
          countryCode: values.countryCode,
          number: values.phone,
        },
      },
      {
        onSuccess: () => {
          handleSuccessToast({ description: "Profile updated." });
        },
        onError: () => {
          handleErrorToast({ description: "Could not update profile." });
        },
      },
    );
  }

  function onPasswordSubmit(values: PasswordFormValues) {
    changePasswordMutation.mutate(
      {
        currentPassword: values.oldPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          handleSuccessToast({ description: "Password updated." });
          setPasswordOpen(false);
          passwordForm.reset();
        },
        onError: () => {
          handleErrorToast({ description: "Could not update password." });
        },
      },
    );
  }

  function persistNotifications(next: NotificationSettings) {
    setNotifications(next);
    updateNotificationsMutation.mutate(next, {
      onError: () => {
        handleErrorToast({ description: "Could not update notifications." });
        const saved = profile?.notificationSettings;
        if (saved) {
          setNotifications(saved);
        }
      },
    });
  }

  function updateChannel(
    group: "updates" | "promotions",
    channel: "email" | "push" | "sms",
    value: boolean,
  ) {
    persistNotifications({
      ...notifications,
      [group]: { ...notifications[group], [channel]: value },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[#030803] sm:text-xl">Settings</h2>
        <p className="mt-1 text-sm text-[#484848]">
          Manage your profile, password, and notifications.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-[#030803]">Profile</h3>
        <div className="mt-4 flex items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" className="rounded-xl" disabled>
            Change photo — coming soon
          </Button>
        </div>

        <form
          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
          className="mt-6 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Input label="First name" {...profileForm.register("firstName")} />
            </div>
            <div>
              <Input label="Other names" {...profileForm.register("lastName")} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Input label="Code" {...profileForm.register("countryCode")} />
            <Input label="Phone" {...profileForm.register("phone")} />
          </div>
          <Input label="Email" type="email" {...profileForm.register("email")} />
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#030803]">Password</p>
              <p className="text-xs text-[#484848]">••••••••••</p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="text-sm font-semibold text-traffik-green hover:underline"
            >
              Change
            </button>
          </div>
          <Button
            type="submit"
            variant="signIn"
            className="rounded-xl"
            disabled={updateProfileMutation.isPending}
          >
            Save changes
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-[#030803]">Notifications</h3>
        <div className="mt-4 flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-[#030803]">Push notifications</p>
            <p className="text-xs text-[#484848]">Master toggle for all push alerts</p>
          </div>
          <Switch
            checked={notifications.general}
            onCheckedChange={(value) =>
              persistNotifications({ ...notifications, general: value })
            }
            aria-label="Push notifications"
          />
        </div>

        <Separator className="my-4" />

        <NotificationGroup
          title="Updates from Traffik"
          settings={notifications.updates}
          onChange={(channel, value) => updateChannel("updates", channel, value)}
        />

        <Separator className="my-4" />

        <NotificationGroup
          title="Promotions and tips"
          settings={notifications.promotions}
          onChange={(channel, value) =>
            updateChannel("promotions", channel, value)
          }
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-[#030803]">General</h3>
        <ul className="mt-3 divide-y divide-gray-100">
          {[
            { label: "Terms and conditions", href: "/terms" },
            { label: "Privacy policy", href: "/privacy" },
            { label: "Help center", href: "/how-it-works" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block py-3 text-sm text-[#484848] transition-colors hover:text-traffik-pink"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 py-3 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </li>
        </ul>
      </section>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="space-y-3"
          >
            <div className="relative">
              <Input
                label="Old password"
                type={showOld ? "text" : "password"}
                {...passwordForm.register("oldPassword")}
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-[#484848]"
                onClick={() => setShowOld((v) => !v)}
                aria-label={showOld ? "Hide password" : "Show password"}
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-traffik-green hover:underline"
            >
              Forgot password?
            </Link>
            <div className="relative">
              <Input
                label="New password"
                type={showNew ? "text" : "password"}
                {...passwordForm.register("newPassword")}
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-[#484848]"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Confirm new password"
                type={showConfirm ? "text" : "password"}
                {...passwordForm.register("confirmPassword")}
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-[#484848]"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              type="submit"
              variant="signIn"
              className="w-full rounded-xl"
              disabled={changePasswordMutation.isPending}
            >
              Save new password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationGroup({
  title,
  settings,
  onChange,
}: {
  title: string;
  settings: { email: boolean; push: boolean; sms: boolean };
  onChange: (channel: "email" | "push" | "sms", value: boolean) => void;
}) {
  const rows = [
    { key: "email" as const, label: "Email" },
    { key: "push" as const, label: "Push notifications" },
    { key: "sms" as const, label: "Text messages" },
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-[#030803]">{title}</p>
      <ul className="mt-2 space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between">
            <span className="text-sm text-[#484848]">{row.label}</span>
            <Switch
              checked={settings[row.key]}
              onCheckedChange={(value) => onChange(row.key, value)}
              aria-label={`${title} ${row.label}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
