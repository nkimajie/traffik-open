import { Suspense } from "react";
import AdminLoginContent from "./admin-login-content";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
