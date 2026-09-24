import React, { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkSlackChannelLinks } from "./slack-channel-links";

/** Render the author's structure without inferring lists or rewriting the answer. */
export const AnswerMarkdown = memo(function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 space-y-3 break-words text-[15.5px] font-normal leading-[1.65] text-slate-700 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_li>p]:my-1 [&_li>ul]:mt-1.5 [&_li>ol]:mt-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-3">
      <Markdown
        remarkPlugins={[remarkGfm, remarkSlackChannelLinks]}
        skipHtml
        disallowedElements={["img", "input"]}
        urlTransform={(url) => /^https?:\/\//i.test(url) ? url : ""}
        components={{
          h1: ({ children }) => <h3 className="mt-5 font-bold text-slate-900">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-5 font-bold text-slate-900">{children}</h3>,
          h3: ({ children }) => <h3 className="mt-4 font-bold text-slate-900">{children}</h3>,
          a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-red-700 underline underline-offset-2">{children}</a> : <span>{children}</span>,
          table: ({ children }) => <div className="max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-sm [&_th]:border-b [&_th]:border-slate-300 [&_th]:p-2 [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-2">{children}</table></div>,
        }}
      >{text}</Markdown>
    </div>
  );
});
