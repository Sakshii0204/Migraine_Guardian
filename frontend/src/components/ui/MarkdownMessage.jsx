/**
 * MarkdownMessage
 *
 * Renders Markdown content from the RAG chatbot API response using react-markdown.
 * Applies clean, accessible styling matching the MigraineGuardian design system.
 *
 * Strips the trailing ### Sources section because sources are shown separately
 * from the `sources` array in the chat UI.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * Strips the trailing ### Sources section from RAG answer text.
 * Sources are already displayed as chips from the `sources` array.
 */
function stripSourcesSection(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\n{0,2}###? Sources[\s\S]*$/i, '').trimEnd();
}

export function MarkdownMessage({ content, className = '' }) {
  const cleanContent = stripSourcesSection(content);

  return (
    <div className={`prose-migraine ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-brand-dark mt-3 mb-1 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold text-brand-dark mt-3 mb-1 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-brand-dark mt-2 mb-1 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-brand-dark mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-0.5 mb-2 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-2 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-brand-dark">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-brand-dark">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-brand-dark">{children}</em>
          ),
          code: ({ children }) => (
            <code className="font-mono text-xs bg-brand-sage/10 px-1 py-0.5 rounded text-brand-dark">{children}</code>
          ),
          hr: () => (
            <hr className="border-t border-brand-sage/30 my-2" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand-teal pl-3 my-2 text-muted-text italic">{children}</blockquote>
          ),
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownMessage;
