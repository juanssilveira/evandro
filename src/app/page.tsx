import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "WatchMap — Em breve",
  description:
    "Uma plataforma técnica para gerenciar, configurar e acompanhar seus vídeos com precisão.",
};

export default function HomePage() {
  return <ComingSoon />;
}
