import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Undo2, Redo2, Copy, ClipboardPaste, CopyPlus, Trash2,
  Group as GroupIcon, Ungroup as UngroupIcon, Lock, Unlock,
  Type as TypeIcon, Square, Image as ImageIcon, Video as VideoIcon,
} from "lucide-react";

const RibbonButton = ({ icon: Icon, label, ...props }) => (
  <Button type="button" variant="outline" size="sm" className="gap-1.5" {...props}>
    <Icon className="h-4 w-4" /> {label}
  </Button>
);

/**
 * EditorRibbon: PowerPoint-style tabbed toolbar. Home covers selection-driven
 * actions (undo/redo, copy/paste/duplicate/delete, group/lock); Insert covers
 * adding new content to the active slide.
 */
export default function EditorRibbon({ editor, onInsertImage, onInsertVideo, uploadingMedia, disabled }) {
  const hasSelection = editor.selectedIds.length > 0;
  const hasMultiSelection = editor.selectedIds.length >= 2;
  const elements = editor.activeSlide?.elements || [];
  const selectedElements = elements.filter((el) => editor.selectedIds.includes(el.id));
  const hasGrouped = selectedElements.some((el) => el.groupId);
  const hasLocked = selectedElements.some((el) => el.locked);

  return (
    <Tabs defaultValue="home" className="gap-2">
      <TabsList>
        <TabsTrigger value="home">Home</TabsTrigger>
        <TabsTrigger value="insert">Insert</TabsTrigger>
      </TabsList>

      <TabsContent value="home">
        <div className="flex flex-wrap items-center gap-1.5">
          <RibbonButton icon={Undo2} label="Undo" onClick={editor.undo} disabled={disabled || !editor.canUndo} />
          <RibbonButton icon={Redo2} label="Redo" onClick={editor.redo} disabled={disabled || !editor.canRedo} />
          <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
          <RibbonButton icon={Copy} label="Copy" onClick={editor.copySelected} disabled={disabled || !hasSelection} />
          <RibbonButton icon={ClipboardPaste} label="Paste" onClick={editor.pasteClipboard} disabled={disabled} />
          <RibbonButton icon={CopyPlus} label="Duplicate" onClick={editor.duplicateSelected} disabled={disabled || !hasSelection} />
          <RibbonButton icon={Trash2} label="Delete" onClick={editor.deleteSelected} disabled={disabled || !hasSelection} />
          <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
          <RibbonButton icon={GroupIcon} label="Group" onClick={editor.groupSelected} disabled={disabled || !hasMultiSelection} />
          <RibbonButton icon={UngroupIcon} label="Ungroup" onClick={editor.ungroupSelected} disabled={disabled || !hasGrouped} />
          <RibbonButton
            icon={hasLocked ? Unlock : Lock}
            label={hasLocked ? 'Unlock' : 'Lock'}
            onClick={editor.toggleLockSelected}
            disabled={disabled || !hasSelection}
          />
        </div>
      </TabsContent>

      <TabsContent value="insert">
        <div className="flex flex-wrap items-center gap-1.5">
          <RibbonButton icon={TypeIcon} label="Text" onClick={editor.addTextBox} disabled={disabled} />
          <RibbonButton icon={Square} label="Shape" onClick={editor.addRect} disabled={disabled} />
          <RibbonButton icon={ImageIcon} label="Image" onClick={onInsertImage} disabled={disabled} />
          <RibbonButton icon={VideoIcon} label="Video" onClick={onInsertVideo} disabled={disabled || uploadingMedia} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
