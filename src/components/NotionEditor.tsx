import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Undo, Redo, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function NotionEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({ placeholder: placeholder ?? "Type '/' for commands, or just start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "notion-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-notion focus:outline-none min-h-[400px] py-4",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  const lastSync = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== lastSync.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      lastSync.current = value;
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({ on, active, children, title }: { on: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      onClick={on}
      className={cn("h-8 w-8 p-0", active && "bg-accent/15 text-accent-foreground")}
    >
      {children}
    </Button>
  );

  return (
    <div>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/95 backdrop-blur py-1.5 mb-2">
        <Btn title="H1" on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-4 w-4" /></Btn>
        <Btn title="H2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="H3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Strike" on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-4 w-4" /></Btn>
        <Btn title="Code" on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Task list" on={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")}><ListChecks className="h-4 w-4" /></Btn>
        <Btn title="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></Btn>
        <Btn title="Divider" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Undo" on={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Btn>
        <Btn title="Redo" on={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
