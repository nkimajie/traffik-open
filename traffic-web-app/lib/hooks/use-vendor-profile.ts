import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchVendorProfile } from "@/lib/services/api/vendors/vendor-profile.api";
import { QueryKeys } from "@/lib/services/config/query-keys";

export function useVendorProfile() {
  const { user, isAuthenticated, isVendor, isLoading: authLoading } = useAuth();
  const vendorId = user?._id;

  return useQuery({
    queryKey: [QueryKeys.VENDOR_PROFILE, vendorId] as const,
    queryFn: fetchVendorProfile,
    enabled: isAuthenticated && isVendor && !authLoading && !!vendorId,
  });
}
