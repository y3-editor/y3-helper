import * as React from 'react';
import {
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../PostMessageProvider';
import { useExtensionStore, IDE } from '../store/extension';
import { EventContext } from './eventProviderContext';
import { addString, checkValueOfPressedKeyboard, isWin } from '../utils';

export const DEBOUNCE_DELAY = 300;
interface EventProviderProps {
  children: React.ReactNode;
}
export default function EventProvider(props: EventProviderProps) {
  const { children } = props;
  const { postMessage } = usePostMessage();
  const [ide, appVersion] = useExtensionStore((state) => [
    state.IDE,
    state.appVersion,
  ]);
  const isJetBrains2020 = appVersion?.includes('2020');
  // Key 是 DOM 元素，所以需要使用 WeakMap 来存储，避免内存泄漏
  const historyStack = React.useRef<WeakMap<HTMLElement, string[]>>(
    new WeakMap(),
  );
  const pasteEventDebounceRef = React.useRef<number>(Date.now());
  const updateHistoryContext = React.useCallback(
    (element: HTMLElement | HTMLInputElement, value: string) => {
      updateHistory(historyStack.current, element, value);
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({ updateHistory: updateHistoryContext }),
    [updateHistoryContext],
  );

  React.useEffect(
    function globalEventHandler() {
      function handleGlobalKeyboardEvent(event: KeyboardEvent) {
        if (event.metaKey || event.ctrlKey) {
          // ctrl/cmd + a 全选
          if (checkValueOfPressedKeyboard(event, ['KeyA'], ['a', 'A'])) {
            const element = queryActiveEditableElement();
            if (element) {
              element.select();
            }
          }
          // ctrl/cmd + c 复制
          if (checkValueOfPressedKeyboard(event, ['KeyC'], ['c', 'C'])) {
            const selectedText = window.getSelection()?.toString();
            if (selectedText) {
              // 模拟复制事件，发送消息到 vscode，复制内容到粘贴板
              postMessage({
                type: 'COPY_TO_CLIPBOARD',
                data: selectedText,
              });
            }
          }
          // ctrl/cmd + v 粘贴
          if (checkValueOfPressedKeyboard(event, ['KeyV'], ['v', 'V'])) {
            // 检查是否是 Ctrl+Shift+V (粘贴为纯文本)
            if (event.shiftKey) {
              // 粘贴为纯文本
              const element = queryActiveEditableElement();
              if (element) {
                postMessage({
                  type: 'KEYBOARD_PASTE',
                });
                element.focus();
              }
              event.preventDefault();
              return;
            }
            
            // 普通粘贴逻辑
            if (
              ide === IDE.VisualStudioCode ||
              isJetBrains2020 ||
              ide === IDE.VisualStudio
            ) {
              event.preventDefault();
            }
            if ((isJetBrains2020 && isWin()) || ide === IDE.VisualStudio) {
              postMessage({
                type: 'KEYBOARD_PASTE',
              });
            } else {
              document.execCommand('paste');
            }
          }
          // ctrl/cmd + x 剪切
          if (checkValueOfPressedKeyboard(event, ['KeyX'], ['x', 'X'])) {
            // 模拟剪切事件，发送消息到 vscode，复制内容到剪切板并且清空选中的文本
            const element = queryActiveEditableElement();
            if (element) {
              const value = element.value;
              const selectionStart = element.selectionStart || 0;
              const selectionEnd = element.selectionEnd || 0;
              if (selectionStart === selectionEnd) {
                return;
              }
              const prefix = value.slice(0, selectionStart);
              const postfix = value.slice(selectionEnd);
              const selectedChars = value.slice(selectionStart, selectionEnd);
              if (selectedChars) {
                postMessage({
                  type: 'COPY_TO_CLIPBOARD',
                  data: selectedChars,
                });
              }
              const nextValue = prefix + postfix;
              element.value = nextValue;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              setTimeout(() => {
                element.selectionStart = selectionStart;
                element.selectionEnd = selectionStart;
              });
            }
          }
          // ctrl/cmd + z 撤回
          if (checkValueOfPressedKeyboard(event, ['KeyZ'], ['z', 'Z'])) {
            const element = queryActiveEditableElement();
            if (element) {
              undo(historyStack.current, element);
            }
          }
        }
      }

      function handleApplyClipboard(
        event: MessageEvent<PostMessageSubscribeType>,
      ) {
        // 统一对粘贴事件做处理，根据当前 active element 是否是 textarea 或者 input
        if (event.data.type === SubscribeActions.APPLY_KEYBOARD_PASTE) {
          // 兼容 jetbrains 版本粘贴事件，由于部分版本能支持粘贴，部分版本不能，所以现在的处理
          // 方式有可能导致粘贴事件触发了两次，故需要加入防抖
          const now = Date.now();
          if (now - pasteEventDebounceRef.current < DEBOUNCE_DELAY) {
            return;
          }
          pasteEventDebounceRef.current = now;
          const element = document.activeElement;
          if (
            element &&
            element instanceof HTMLElement &&
            (element.tagName.toLowerCase() === 'textarea' ||
              element.tagName.toLowerCase() === 'input')
          ) {
            let insertValue = event.data.data as string;
            // 对于 chakra react select 组件，由于组件设计问题，直接修改 value 并不能完全展示，
            // 因为上层还有 div 作为主要渲染，遮挡了 input，故使用这种方式做下兼容处理
            if (element.id && element.id.startsWith('chakra-react-select')) {
              insertValue = insertValue + '\n';
            }
            const nextText = addString(
              element as HTMLTextAreaElement,
              insertValue,
            );
            updateHistory(historyStack.current, element, nextText);
            (element as HTMLTextAreaElement).value = nextText;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }

      let isComposing = false;

      function handleInputEvent(event: Event) {
        const element = event.target as HTMLTextAreaElement | HTMLInputElement;
        if (element && element.value !== null && !isComposing) {
          updateHistory(historyStack.current, element, element.value);
        }
      }

      function handleCompositionStartEvent() {
        isComposing = true;
      }

      function handleCompositionEndEvent(event: Event) {
        isComposing = false;
        const element = event.target as HTMLTextAreaElement | HTMLInputElement;
        if (element && element.value !== null) {
          updateHistory(historyStack.current, element, element.value);
        }
      }

      function attachInputEventListeners() {
        const elements = document.querySelectorAll('textarea, input');
        elements.forEach((element) => {
          element.addEventListener('input', handleInputEvent);
          element.addEventListener('focus', handleFocusEvent);
          element.addEventListener(
            'compositionstart',
            handleCompositionStartEvent,
          );
          element.addEventListener('compositionend', handleCompositionEndEvent);
        });
      }

      function removeEventListeners() {
        const elements = document.querySelectorAll('textarea, input');
        elements.forEach((element) => {
          element.removeEventListener('input', handleInputEvent);
          element.removeEventListener('focus', handleFocusEvent);
          element.removeEventListener(
            'compositionstart',
            handleCompositionStartEvent,
          );
          element.removeEventListener(
            'compositionend',
            handleCompositionEndEvent,
          );
        });
      }

      function handleFocusEvent(event: Event) {
        const element = event.target as HTMLTextAreaElement | HTMLInputElement;
        if (element && !historyStack.current.has(element)) {
          // 元素获取焦点时，记录初始值
          historyStack.current.set(element, [element.value]);
        }
      }

      // textarea 和 input 可能是从弹窗中打开的，这个时候需要监听 DOM 变化才能加上这些事件
      const observer = new MutationObserver(() => {
        attachInputEventListeners();
      });

      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('keydown', handleGlobalKeyboardEvent);
      window.addEventListener('message', handleApplyClipboard);
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyboardEvent);
        window.removeEventListener('message', handleApplyClipboard);
        removeEventListeners();
        observer.disconnect();
      };
    },
    [ide, postMessage, isJetBrains2020],
  );

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

function queryActiveEditableElement() {
  type EditableInputElement = HTMLTextAreaElement | HTMLInputElement;
  const activeElement = document.activeElement;
  if (
    activeElement &&
    activeElement instanceof HTMLElement &&
    (activeElement.tagName.toLocaleLowerCase() === 'textarea' ||
      activeElement.tagName.toLocaleLowerCase() === 'input')
  ) {
    return activeElement as EditableInputElement;
  }
  return;
}

function updateHistory(
  historyStack: WeakMap<HTMLElement, string[]>,
  element: HTMLElement | HTMLInputElement,
  value: string,
) {
  if (!historyStack.has(element)) {
    // 初始值未被记录，记录初始值
    historyStack.set(element, [(element as HTMLInputElement)?.value]);
  }
  const stack = historyStack.get(element)!;

  // 避免重复保存相同的历史记录
  if (stack[stack.length - 1] !== value) {
    stack.push(value);
  }
  historyStack.set(element, stack);
}
// 撤销输入框的内容
function undo(
  historyStack: WeakMap<HTMLElement, string[]>,
  element: HTMLTextAreaElement | HTMLInputElement,
) {
  const stack = historyStack.get(element);
  if (stack && stack.length > 1) {
    stack.pop();
    const previousValue = stack[stack.length - 1]; // 获取上一个值
    element.value = previousValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
