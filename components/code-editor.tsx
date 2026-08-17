"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { memo, useEffect, useRef } from "react";
import type { Suggestion } from "@/lib/db/schema";

type EditorProps = {
  content: string;
  language?: CodeLanguage;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
};

export type CodeLanguage =
  | "python"
  | "javascript"
  | "typescript"
  | "json"
  | "html"
  | "text";

function extensionsForLanguage(language: CodeLanguage) {
  if (language === "python") return [python()];
  if (language === "javascript" || language === "typescript") {
    return [
      javascript({
        jsx: true,
        typescript: language === "typescript",
      }),
    ];
  }
  if (language === "json") return [javascript()];
  return [];
}

function PureCodeEditor({
  content,
  language = "python",
  onSaveContent,
  status,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const onSaveContentRef = useRef(onSaveContent);
  const languageCompartmentRef = useRef(new Compartment());

  useEffect(() => {
    onSaveContentRef.current = onSaveContent;
  }, [onSaveContent]);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          languageCompartmentRef.current.of(extensionsForLanguage(language)),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const transaction = update.transactions.find(
              (current) => !current.annotation(Transaction.remote)
            );
            if (transaction) {
              onSaveContentRef.current(update.state.doc.toString(), true);
            }
          }),
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // The editor must remain mounted while callbacks and parent state change.
    // Recreating EditorState would discard undo history and cursor position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.dispatch({
      effects: languageCompartmentRef.current.reconfigure(
        extensionsForLanguage(language)
      ),
    });
  }, [language]);

  useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === "streaming" || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  return (
    <div
      className="not-prose relative min-h-[min(70dvh,720px)] w-full overflow-auto text-sm"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  if (prevProps.suggestions !== nextProps.suggestions) {
    return false;
  }
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
    return false;
  }
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
    return false;
  }
  if (prevProps.status === "streaming" && nextProps.status === "streaming") {
    return false;
  }
  if (prevProps.content !== nextProps.content) {
    return false;
  }
  if (prevProps.language !== nextProps.language) {
    return false;
  }

  return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);
