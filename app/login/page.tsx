import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading sign-in…</div>}>
      <LoginForm />
    </Suspense>
  );
}
