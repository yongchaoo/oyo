"use client";

import ReactMarkdown from "react-markdown";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none break-words ${className || ""}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="text-xs px-1 py-0.5 rounded bg-black/5 font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="text-xs p-2 rounded bg-black/5 overflow-x-auto mb-2 font-mono">{children}</pre>
          ),
          h1: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="font-semibold text-sm mb-1">{children}</h4>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
