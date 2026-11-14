"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Mail, Percent, Settings } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchEmailConfig,
  fetchEmailTemplates,
  fetchPlatformSettings,
  sendTestEmail,
  updatePlatformSettings,
  type EmailTemplateId,
} from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import { cn } from "@/lib/utils";

const schema = z.object({
  to: z.string().email("Enter a valid email address"),
  template: z.string().min(1, "Choose a template"),
});

const commissionSchema = z.object({
  commissionPercentage: z.number().min(0, "Minimum is 0%").max(20, "Maximum is 20%"),
});

type FormValues = z.infer<typeof schema>;
type CommissionFormValues = z.infer<typeof commissionSchema>;

export default function AdminSettingsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [lastSent, setLastSent] = useState<{
    subject: string;
    to: string;
  } | null>(null);

  const configQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_EMAIL_CONFIG] as const,
    queryFn: fetchEmailConfig,
    enabled: isAuthenticated,
  });

  const templatesQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_EMAIL_TEMPLATES] as const,
    queryFn: fetchEmailTemplates,
    enabled: isAuthenticated,
  });

  const platformSettingsQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_PLATFORM_SETTINGS] as const,
    queryFn: fetchPlatformSettings,
    enabled: isAuthenticated,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      to: user?.email ?? "",
      template: "",
    },
  });

  const selectedTemplateId = watch("template") as EmailTemplateId | "";
  const selectedTemplate = templatesQuery.data?.find(
    (item) => item.id === selectedTemplateId,
  );

  const {
    register: registerCommission,
    handleSubmit: handleCommissionSubmit,
    reset: resetCommissionForm,
    formState: { errors: commissionErrors, isDirty: commissionDirty },
  } = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionSchema),
    values: {
      commissionPercentage: platformSettingsQuery.data?.commissionPercentage ?? 0,
    },
  });

  const sendMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: (result) => {
      setLastSent({ subject: result.subject, to: result.to });
      handleSuccessToast({
        description: `Test email sent to ${result.to}.`,
      });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  const commissionMutation = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (result) => {
      resetCommissionForm({
        commissionPercentage: result.commissionPercentage,
      });
      handleSuccessToast({ description: "Platform settings saved." });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  if (
    authLoading ||
    configQuery.isLoading ||
    templatesQuery.isLoading ||
    platformSettingsQuery.isLoading
  ) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={3} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const config = configQuery.data;
  const templates = templatesQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#484848]">
          Platform configuration and tools for administrators.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-traffik-pink/10 text-traffik-pink">
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#030803]">
                Marketplace commission
              </h2>
              <p className="mt-1 text-sm text-[#484848]">
                Traffik&apos;s cut on Kashia checkout, charged to the buyer as a
                marketplace fee. Set to 0% to disable the platform commission.
              </p>
            </div>
          </div>

          {platformSettingsQuery.error ? (
            <ErrorState
              title="Could not load platform settings"
              onRetry={() => platformSettingsQuery.refetch()}
            />
          ) : (
            <form
              onSubmit={handleCommissionSubmit((values) =>
                commissionMutation.mutate(values),
              )}
              className="space-y-4"
            >
              <div>
                <Input
                  label="Commission percentage"
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  {...registerCommission("commissionPercentage", {
                    valueAsNumber: true,
                  })}
                />
                {commissionErrors.commissionPercentage ? (
                  <p className="mt-1 text-sm text-red-500">
                    {commissionErrors.commissionPercentage.message}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[#484848]">
                    Allowed range: 0–20%. Applies to new payment links only.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={commissionMutation.isPending || !commissionDirty}
              >
                {commissionMutation.isPending ? "Saving…" : "Save commission"}
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#030803]/5 text-[#030803]">
              <Settings className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#030803]">
                Email delivery
              </h2>
              <p className="mt-1 text-sm text-[#484848]">
                SMTP status for transactional emails sent by the platform.
              </p>
            </div>
          </div>

          {configQuery.error ? (
            <ErrorState
              title="Could not load email config"
              onRetry={() => configQuery.refetch()}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  config?.configured
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                {config?.configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {config?.configured ? "SMTP configured" : "SMTP not configured"}
              </span>
              {config?.fromEmail ? (
                <p className="text-sm text-[#484848]">
                  From{" "}
                  <span className="font-medium text-[#030803]">
                    {config.fromName ? `${config.fromName} ` : ""}
                    &lt;{config.fromEmail}&gt;
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-traffik-pink/10 text-traffik-pink">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#030803]">
                Test emails
              </h2>
              <p className="mt-1 text-sm text-[#484848]">
                Send any template with sample data to verify delivery and
                formatting before go-live.
              </p>
            </div>
          </div>

          {templatesQuery.error ? (
            <ErrorState
              title="Could not load templates"
              onRetry={() => templatesQuery.refetch()}
            />
          ) : (
            <form
              onSubmit={handleSubmit((values) =>
                sendMutation.mutate({
                  to: values.to,
                  template: values.template as EmailTemplateId,
                }),
              )}
              className="space-y-4"
            >
              <div>
                <Input
                  label="Recipient"
                  type="email"
                  placeholder="you@example.com"
                  {...register("to")}
                />
                {errors.to ? (
                  <p className="mt-1 text-sm text-red-500">{errors.to.message}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="email-template"
                  className="mb-1.5 block text-sm font-medium text-[#030803]"
                >
                  Template
                </label>
                <select
                  id="email-template"
                  className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#030803] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-traffik-pink/30"
                  {...register("template")}
                >
                  <option value="">Select a template…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
                {errors.template ? (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.template.message}
                  </p>
                ) : null}
                {selectedTemplate ? (
                  <p className="mt-2 text-sm text-[#484848]">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={sendMutation.isPending || !config?.configured}
              >
                {sendMutation.isPending ? "Sending…" : "Send test email"}
              </Button>

              {!config?.configured ? (
                <p className="text-sm text-amber-700">
                  Configure SMTP environment variables on the API server before
                  sending test emails.
                </p>
              ) : null}

              {lastSent ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                  Last sent: <strong>{lastSent.subject}</strong> to{" "}
                  {lastSent.to}
                </p>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
