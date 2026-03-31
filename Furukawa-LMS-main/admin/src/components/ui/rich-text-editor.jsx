import React from "react";
import { cn } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";
import "./rich-text-editor.css";

const ToolbarButton = ({ onClick, active, children, title }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title}
          onClick={onClick}
          className={cn(
            "h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors cursor-pointer",
            active
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent"
              : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const RichTextEditorBase = ({ className, value, onChange, placeholder, borderless = false, ...props }, ref) => {
  const fileInputRef = React.useRef(null);
  const extensions = React.useMemo(() => {
    return [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'max-w-full h-auto rounded' } }),
      Placeholder.configure({ placeholder: placeholder || "Write something..." }),
    ];
  }, []);

  const editor = useEditor({
    extensions,
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      if (onChange) {
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] border-0 px-3 py-2 bg-transparent text-[hsl(var(--foreground))] focus:outline-none editor-content",
      },
    },
  });

  // Sync external value changes without losing focus
  React.useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();
    const newValue = value || "";

    // Only update if the content is actually different and editor is not focused
    if (currentContent !== newValue && !editor.isFocused) {
      editor.commands.setContent(newValue, false);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[120px] border border-[hsl(var(--border))] rounded-md px-3 py-2 bg-[hsl(var(--background))]",
          className
        )}
      />
    );
  }

  return (
    <div className={cn("rich-text-editor", className)} ref={ref} {...props}>
      <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-[hsl(var(--border))]">
        {/* Text color */}
        <label className="sr-only" htmlFor="rte-color">Text color</label>
        <input
          id="rte-color"
          type="color"
          title="Text color"
          className="w-8 h-8 p-0 border rounded"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <ToolbarButton title="Clear color" onClick={() => editor.chain().focus().unsetColor().run()}>
          <Eraser className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
        <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
        <ToolbarButton title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
        <ToolbarButton title="Align Left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Align Center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Align Right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
        <ToolbarButton title="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Ordered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Code Block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Insert Image" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        {/* Image alignment & width controls (active when selecting image) */}
        {editor?.isActive('image') && (
          <>
            <ToolbarButton title="Image Left" onClick={() => editor.chain().focus().updateAttributes('image', { style: 'float:left;margin:0 1rem 1rem 0;' }).run()}>
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Image Center" onClick={() => editor.chain().focus().updateAttributes('image', { style: 'display:block;margin:0 auto;' }).run()}>
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Image Right" onClick={() => editor.chain().focus().updateAttributes('image', { style: 'float:right;margin:0 0 1rem 1rem;' }).run()}>
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-muted-foreground">W</span>
              <input
                type="range"
                min={10}
                max={100}
                defaultValue={100}
                onChange={(e) => editor.chain().focus().updateAttributes('image', { style: `display:block;margin:0 auto;width:${e.target.value}%` }).run()}
              />
            </div>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
              toast.error('Please select an image file');
              e.target.value = '';
              return;
            }
            try {
              const formData = new FormData();
              formData.append('file', file);
              const res = await axiosInstance.post('/api/upload/single', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              const url = res?.data?.data?.url;
              if (url) {
                editor.chain().focus().setImage({ src: url, alt: file.name }).run();
              } else {
                toast.error('Upload succeeded but no URL returned');
              }
            } catch (err) {
              const message = err?.response?.data?.message || err?.message || 'Image upload failed';
              toast.error(message);
            } finally {
              e.target.value = '';
            }
          }}
        />
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />
        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className={cn(
        "min-h-[120px] overflow-hidden",
        borderless ? "border-0 rounded-none" : "border border-[hsl(var(--border))] rounded-md"
      )}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const RichTextEditor = React.memo(React.forwardRef(RichTextEditorBase));
RichTextEditor.displayName = "RichTextEditor";

export { RichTextEditor };
