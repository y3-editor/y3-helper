import React from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import CodeBlock from './CodeBlock';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { CodeProps } from 'react-markdown/lib/ast-to-react';

const MemoizedReactMarkdown: React.FunctionComponent<Options> = React.memo(
  ReactMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className,
);

export interface CodeBlockBaseProps {
  language: string;
  value: string;
}

interface MarkdownProps<TD, TP> {
  isStreaming?: boolean;
  CodeRender?: React.FunctionComponent<
    CodeProps & {
      language: string;
      value: string;
      data: TD;
      _props?: TP;
      metaData: {
        [propName: string]: string;
      };
    }
  >;
  data: TD;
  _props?: TP;
  children: string;
}
function preprocessMarkdown(markdown: string): string {
  return markdown.replace(/\\/g, '\\\\');
}
export default function UserMarkdown<TD, TP>(props: MarkdownProps<TD, TP>) {
  const { isStreaming, CodeRender } = props;
  const { postMessage } = usePostMessage();

  // 预处理 Markdown 数据
  const preprocessedChildren = preprocessMarkdown(props.children);
  const openUrlInBrowser = (url?: string) => {
    if (url) {
      postMessage({
        type: BroadcastActions.OPEN_IN_BROWSER,
        data: { url },
      });
    }
  };
  return (
    <MemoizedReactMarkdown
      className="markdown-content"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      skipHtml={false}
      components={{
        a({ href, children }) {
          return (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault();
                openUrlInBrowser(href);
              }}
            >
              {children || href}
            </a>
          );
        },
        p({ children }) {
          return (
            <p
              className="mb-2 last:mb-0"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {children}
            </p>
          );
        },
        code({ inline, className, children, ...args }) {
          if (children.length) {
            if (children[0] == '▍') {
              return (
                <span className="mt-1 animate-pulse cursor-default">▍</span>
              );
            }
            children[0] = (children[0] as string).replace('`▍`', '▍');
          }

          const match = /language-(\S+)/.exec(className || '');
          const metaData: {
            [propName: string]: string;
          } = {};
          // 如果有 meta 数据，拆解 meta 数据
          if (args.node.data && args.node.data.meta) {
            const metaString = args.node.data.meta as string;
            const metaArr = metaString.split(' ');
            for (const item of metaArr) {
              const [key, value] = item.split('=');
              metaData[key] = value;
            }
          }

          if (inline) {
            return (
              <code className={className} {...args}>
                {children}
              </code>
            );
          }

          if (CodeRender) {
            return (
              <CodeRender
                {...args}
                key={Math.random()}
                language={(match && match[1]) || ''}
                value={String(children).replace(/\n$/, '')}
                data={props.data}
                _props={props._props}
                children={children}
                metaData={metaData}
              />
            );
          }

          return (
            <CodeBlock
              key={Math.random()}
              language={(match && match[1]) || ''}
              value={String(children).replace(/\n$/, '')}
              collapsable={!isStreaming}
              metaData={metaData}
              {...args}
            />
          );
        },
      }}
    >
      {preprocessedChildren}
    </MemoizedReactMarkdown>
  );
}
