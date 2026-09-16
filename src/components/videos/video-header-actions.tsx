"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { EditVideoDialog } from "./edit-video-dialog";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { useRouter } from "next/navigation";
import type { Video } from "@/db/schema";

interface VideoHeaderActionsProps {
  video: Video;
  onTitleUpdated?: (newTitle: string) => void;
}

export function VideoHeaderActions({
  video,
  onTitleUpdated,
}: VideoHeaderActionsProps) {
  const [currentVideo, setCurrentVideo] = useState<Video>(video);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const handleEditSuccess = (updatedVideo: Video) => {
    setCurrentVideo(updatedVideo);
    onTitleUpdated?.(updatedVideo.title);
    router.refresh();
  };

  const handleDeleteSuccess = () => {
    router.push("/videos");
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
        className="h-8 px-3 text-xs font-medium gap-1.5 cursor-pointer shadow-2xs"
      >
        <Pencil className="size-3.5 text-muted-foreground" />
        <span>Editar</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        className="h-8 px-3 text-xs font-medium gap-1.5 cursor-pointer shadow-2xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 hover:border-destructive/50"
      >
        <Trash2 className="size-3.5 text-destructive" />
        <span>Excluir</span>
      </Button>

      <EditVideoDialog
        video={currentVideo}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleEditSuccess}
      />

      <DeleteVideoDialog
        video={currentVideo}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
