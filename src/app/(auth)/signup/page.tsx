import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta no WatchMap.",
};

export default function SignupPage() {
  return <SignupForm />;
}
