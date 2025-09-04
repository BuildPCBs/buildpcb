"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { BRAND_COLORS } from '@/lib/constants';

// Import highlight.js styles for code syntax highlighting
import 'highlight.js/styles/github.css';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

export function MarkdownMessage({
  content,
  isUser = false,
  className = ""
}: MarkdownMessageProps) {
  return (
    <div
      className={`rounded-2xl px-4 py-2 mb-1 text-sm leading-relaxed ${
        isUser
          ? "rounded-br-md text-white"
          : "rounded-bl-md bg-gray-50 text-gray-900 border border-gray-200"
      } ${className}`}
      style={isUser ? { backgroundColor: BRAND_COLORS.primary } : {}}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom styling for different markdown elements
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ml-4">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2 text-gray-700">
              {children}
            </blockquote>
          ),
          code: ({ children, ...props }) => {
            const isInline = !props.className && !children?.toString().includes('\n');
            if (isInline) {
              return (
                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-100 p-3 rounded mb-2 overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border border-gray-300 text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody>{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-200">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
