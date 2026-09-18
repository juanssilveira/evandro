import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta Evandro Watch.",
};

export default function LoginPage() {
  return <LoginForm />;
}
