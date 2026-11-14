import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import type { NotificationSettings, ShopperProfile } from "@/lib/types/api";
import {
  changePassword,
  fetchProfile,
  updateNotificationSettings,
  updateProfile,
} from "./shopper.api";

export const shopperProfileKeys = {
  all: [QueryKeys.PROFILE] as const,
  detail: () => [...shopperProfileKeys.all, "detail"] as const,
};

export function useProfileQuery() {
  return useQuery({
    queryKey: shopperProfileKeys.detail(),
    queryFn: fetchProfile,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ShopperProfile>) => updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperProfileKeys.all });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: changePassword,
  });
}

export function useUpdateNotificationSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) =>
      updateNotificationSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperProfileKeys.all });
    },
  });
}
