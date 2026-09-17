"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useVideosWorkspace } from "./videos-workspace";
import { UploadCloud } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

export interface UploadButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  label?: string;
  icon?: boolean;
}

export function UploadButton({
  label = "Enviar vídeo",
  icon = true,
  variant = "default",
  size = "default",
  className,
  ...props
}: UploadButtonProps) {
  const { openNewVideoModal } = useVideosWorkspace();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => openNewVideoModal()}
      {...props}
    >
      {icon && <UploadCloud className="size-4 mr-1.5" />}
      {label}
    </Button>
  );
}
