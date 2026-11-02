"use client";
import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const TOKEN = /\\\$|\$([^$\n]+)\$|\[\[img:([^\]\n]+)\]\]/g;
const UUID = /^[0-9a-f-]{36}$/i;

// Shows question text with $...$ as equations and [[img:id]] as pictures. Everything else stays plain text.
export default function MathText({ text }: { text?: string | null }) {
  const parts = useMemo(() => {
    const value = text ?? "";
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const match of value.matchAll(TOKEN)) {
      if (match.index > last) out.push(value.slice(last, match.index));
      const key = `${match.index}`;
      if (match[0] === "\\$") {
        out.push("$");
      } else if (match[1] !== undefined) {
        // KaTeX escapes its output, and `trust: false` blocks links and scripts inside equations.
        out.push(
          <span
            key={key}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(match[1], { throwOnError: false, trust: false, strict: "ignore" }),
            }}
          />
        );
      } else if (UUID.test(match[2])) {
        out.push(
          // Served from an authenticated API route, which next/image can't optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key} src={`/api/question-images/${match[2]}`} alt="Question figure" style={{ display: "block", maxWidth: "100%", maxHeight: 320, margin: "8px 0" }} />
        );
      } else {
        // In the import preview, the picture hasn't been saved yet.
        out.push(<span key={key} style={{ fontStyle: "italic", color: "#6b7280" }}>[picture]</span>);
      }
      last = match.index + match[0].length;
    }
    if (last < value.length) out.push(value.slice(last));
    return out;
  }, [text]);

  return <span style={{ whiteSpace: "pre-wrap" }}>{parts}</span>;
}
