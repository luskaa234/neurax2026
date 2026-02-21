import { ChevronRight, File, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FileNode, FolderNode } from "@/lib/file-tree/engine";

interface Props {
  tree: FolderNode;
  activeFileId: string | null;
  onOpenFile: (file: FileNode) => void;
}

function FolderView({ folder, activeFileId, onOpenFile, depth = 0 }: {
  folder: FolderNode;
  activeFileId: string | null;
  onOpenFile: (file: FileNode) => void;
  depth?: number;
}) {
  return (
    <div>
      {folder.path !== "." && (
        <div className="flex items-center gap-1 py-1 text-xs text-muted-foreground" style={{ paddingLeft: depth * 10 + 8 }}>
          <ChevronRight className="h-3 w-3" />
          <FolderOpen className="h-3 w-3" />
          <span className="truncate">{folder.name}</span>
        </div>
      )}

      {folder.files.map((file) => (
        <button
          key={file.id}
          onClick={() => onOpenFile(file)}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs transition-colors",
            activeFileId === file.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          style={{ paddingLeft: depth * 10 + 20 }}
        >
          <File className="h-3 w-3 shrink-0" />
          <span className="truncate">{file.name}</span>
        </button>
      ))}

      {folder.children.map((child) => (
        <FolderView
          key={child.id}
          folder={child}
          activeFileId={activeFileId}
          onOpenFile={onOpenFile}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function ProjectFileTree({ tree, activeFileId, onOpenFile }: Props) {
  return (
    <div className="h-full border-r border-border bg-card/40">
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        File Explorer
      </div>
      <ScrollArea className="h-[calc(100%-34px)]">
        <div className="p-2">
          <FolderView folder={tree} activeFileId={activeFileId} onOpenFile={onOpenFile} />
        </div>
      </ScrollArea>
    </div>
  );
}
