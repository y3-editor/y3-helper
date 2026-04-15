import React, { useCallback } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import CodeBlock from './CodeBlock';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import { proxyImage } from '../../utils';
import BrainMakerImage from './BrainMakerImage';
import ImagePreview from '../ImagePreview';
import { IRecommendFileChange, IRecommendFileChangeRecord } from '../../routes/CodeChat/FileRecommendApplyPanel';
import { useAuthStore } from '../../store/auth';
import { IDE, useExtensionStore } from '../../store/extension';

const MemoizedReactMarkdown: React.FunctionComponent<Options> = React.memo(
  ReactMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className,
);

export interface CodeBlockBaseProps {
  language: string;
  value: string;
  startLineNumber?: number;
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
      onUpdateCodeBlockMeta: (codeMeta: IRecommendFileChange) => void;
    }
  >;
  data: TD;
  _props?: TP;
  children: string;
  startLineNumber?: number;
  onRecommendFileChange?: (codeMetas: IRecommendFileChangeRecord) => void;
}

export default function Markdown<TD, TP>(props: MarkdownProps<TD, TP>) {
  const { isStreaming, CodeRender, startLineNumber, onRecommendFileChange } = props;
  const { postMessage } = usePostMessage();
  const [ loginFrom ] = useAuthStore((state) => [state.loginFrom]);
  const isVscodeIDE = useExtensionStore((state) => state.IDE === IDE.VisualStudioCode);

  const openUrlInBrowser = (url?: string) => {
    if (url) {
      postMessage({
        type: BroadcastActions.OPEN_IN_BROWSER,
        data: { url },
      });
    }
  };
  const openFile = (filePath: string) => {
    if (filePath) {
      postMessage({
        type: 'OPEN_FILE',
        data: {
          filePath,
        },
      });
    }
  };

  // 获取单条信息所有代码块源信息
  const codeBlockMetaRef = React.useRef<IRecommendFileChangeRecord>({}); // 代码源信息记录
  const onUpdateCodeBlockMeta = useCallback((codeMeta: IRecommendFileChange) => {
    if (!CodeRender) return null
    const { filePath, codeBlockId } = codeMeta
    // file -> codeBlock -> metaInfo
    if (codeBlockMetaRef.current[filePath]) {
      codeBlockMetaRef.current[filePath][codeBlockId] = codeMeta
    } else {
      codeBlockMetaRef.current[filePath] = {}
      codeBlockMetaRef.current[filePath][codeBlockId] = codeMeta
    }
    onRecommendFileChange?.(codeBlockMetaRef.current)
  }, [CodeRender, onRecommendFileChange])

  return (
    <MemoizedReactMarkdown
      className="markdown-content"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      skipHtml={true}
      components={{
        a({ href, children }) {
          if (href?.startsWith('file:')) {
            return (
              <a
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  openFile(href.split(':')[1].trim());
                }}
              >
                {children || href}
              </a>
            );
          }
          return (
            <a
              href={href}
              onClick={(event) => {
                if (isVscodeIDE || loginFrom === 'browser') {
                  event.preventDefault();
                  openUrlInBrowser(href);
                }
              }}
            >
              {children || href}
            </a>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
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
          const language = (match && match[1]) || '';
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
                language={language}
                value={String(children).replace(/\n$/, '')}
                data={props.data}
                _props={props._props}
                children={children}
                metaData={metaData}
                onUpdateCodeBlockMeta={onUpdateCodeBlockMeta}
              />
            );
          }

          return (
            <CodeBlock
              key={Math.random()}
              language={language}
              value={String(children).replace(/\n$/, '')}
              collapsable={!isStreaming}
              startLineNumber={startLineNumber}
              metaData={metaData}
              {...args}
            />
          );
        },
        img({ src, alt, ...args }) {
          if (src?.includes('brainmaker')) {
            // 只有 BM 的图片需要代理
            return (
              <BrainMakerImage
                src={proxyImage(src || '')}
                alt={alt || ''}
                className="max-w-full rounded-md"
                {...args}
              />
            );
          }
          return <ImagePreview w="144px" h="144px" key={src} url={src || ''} />;
        },
      }}
    >
      {props.children}
    </MemoizedReactMarkdown>
  );
}
