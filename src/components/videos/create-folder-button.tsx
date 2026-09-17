"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateFolderDialog } from "./create-folder-dialog";
import { FolderPlus } from "lucide-react";

export interface CreateFolderButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onSuccess?: () => void;
}

export function CreateFolderButton({
  variant = "outline",
  size = "default",
  className,
  onSuccess,
}: CreateFolderButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FolderPlus className="size-4" />
        <span>Nova pasta</span>
      </Button>

      <CreateFolderDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
