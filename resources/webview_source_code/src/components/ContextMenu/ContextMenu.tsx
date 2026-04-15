import * as React from 'react';
import {
  useFloating,
  autoUpdate,
  flip,
  offset,
  shift,
  useRole,
  useDismiss,
  useInteractions,
  useListNavigation,
  useTypeahead,
  FloatingPortal,
  FloatingFocusManager,
  FloatingOverlay,
} from '@floating-ui/react';
import './ContextMenu.scss';
import { usePostMessage } from '../../PostMessageProvider';
import { useExtensionStore, IDE } from '../../store/extension';

export const MenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    disabled?: boolean;
  }
>(({ label, disabled, ...props }, ref) => {
  return (
    <button
      {...props}
      className="MenuItem"
      ref={ref}
      role="menuitem"
      disabled={disabled}
    >
      {label}
    </button>
  );
});

interface Props {
  label?: string;
  nested?: boolean;
}

export const Menu = React.forwardRef<
  HTMLButtonElement,
  Props & React.HTMLProps<HTMLButtonElement>
>(({ children }) => {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const listItemsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const listContentRef = React.useRef(
    React.Children.map(children, (child) =>
      React.isValidElement(child) ? child.props.label : null,
    ) as Array<string | null>,
  );
  const allowMouseUpCloseRef = React.useRef(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset({ mainAxis: 5, alignmentAxis: 4 }),
      flip({
        fallbackPlacements: ['left-start'],
      }),
      shift({ padding: 10 }),
    ],
    placement: 'right-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });

  const role = useRole(context, { role: 'menu' });
  const dismiss = useDismiss(context);
  const listNavigation = useListNavigation(context, {
    listRef: listItemsRef,
    onNavigate: setActiveIndex,
    activeIndex,
  });
  const typeahead = useTypeahead(context, {
    enabled: isOpen,
    listRef: listContentRef,
    onMatch: setActiveIndex,
    activeIndex,
  });

  const { getFloatingProps, getItemProps } = useInteractions([
    role,
    dismiss,
    listNavigation,
    typeahead,
  ]);

  React.useEffect(() => {
    let timeout: number;

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();

      refs.setPositionReference({
        getBoundingClientRect() {
          return {
            width: 0,
            height: 0,
            x: e.clientX,
            y: e.clientY,
            top: e.clientY,
            right: e.clientX,
            bottom: e.clientY,
            left: e.clientX,
          };
        },
      });

      setIsOpen(true);
      clearTimeout(timeout);

      allowMouseUpCloseRef.current = false;
      timeout = window.setTimeout(() => {
        allowMouseUpCloseRef.current = true;
      }, 300);
    }

    function onMouseUp() {
      if (allowMouseUpCloseRef.current) {
        setIsOpen(false);
      }
    }

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mouseup', onMouseUp);
      clearTimeout(timeout);
    };
  }, [refs]);

  return (
    <FloatingPortal id="webview-context-menu">
      {isOpen && (
        <FloatingOverlay lockScroll style={{ zIndex: Number.MAX_SAFE_INTEGER }}>
          <FloatingFocusManager context={context} initialFocus={refs.floating}>
            <div
              className="ContextMenu"
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              {React.Children.map(
                children,
                (child, index) =>
                  React.isValidElement(child) &&
                  React.cloneElement(
                    child,
                    getItemProps({
                      tabIndex: activeIndex === index ? 0 : -1,
                      ref(node: HTMLButtonElement) {
                        listItemsRef.current[index] = node;
                      },
                      onClick() {
                        child.props.onClick?.();
                        setIsOpen(false);
                      },
                      onMouseUp() {
                        child.props.onClick?.();
                        setIsOpen(false);
                      },
                    }),
                  ),
              )}
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
});

export default function ContextMenu() {
  const { postMessage } = usePostMessage();
  const prevFocusedElement = React.useRef<Element>();
  const ide = useExtensionStore((state) => state.IDE);
  const [hasSelection, setHasSelection] = React.useState(false);
  const [isInputElement, setIsInputElement] = React.useState(false);

  React.useEffect(() => {
    // 由于自定义的 context menu 会把输入框的失焦导致无法在粘贴时判断是否为输入框
    // 这里使用 ref 存储 target element,用于 handlePaste 判断
    function onContextMenu(e: MouseEvent) {
      const targetElement = e.target as Element;
      prevFocusedElement.current = targetElement;

      // 检查是否是输入框
      const isInput =
        targetElement !== null &&
        (targetElement.tagName === 'INPUT' ||
          targetElement.tagName === 'TEXTAREA' ||
          (targetElement as HTMLElement).isContentEditable);
      setIsInputElement(isInput);

      // 检查是否有选中的文本
      const selectedText = window.getSelection()?.toString();
      setHasSelection(!!selectedText && selectedText.length > 0);
    }
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  const handleCopy = () => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText) {
      // 模拟复制事件,发送消息到 vscode,复制内容到粘贴板
      postMessage({
        type: 'COPY_TO_CLIPBOARD',
        data: selectedText,
      });
    }
  };

  const handlePaste = () => {
    const focusedElement = prevFocusedElement.current;

    function isInputFocused() {
      if (!focusedElement) {
        return false;
      }

      return (
        focusedElement !== null &&
        (focusedElement.tagName === 'INPUT' ||
          focusedElement.tagName === 'TEXTAREA' ||
          (focusedElement as HTMLElement).isContentEditable)
      );
    }
    if (isInputFocused()) {
      if (ide === IDE.JetBrains || ide === IDE.VisualStudio) {
        postMessage({
          type: 'KEYBOARD_PASTE',
        });
      } else {
        document.execCommand('paste');
      }

      (focusedElement as HTMLInputElement).focus();
    }
  };

  const handlePasteText = () => {
    const focusedElement = prevFocusedElement.current;

    function isInputFocused() {
      if (!focusedElement) {
        return false;
      }
      return (
        focusedElement !== null &&
        (focusedElement.tagName === 'INPUT' ||
          focusedElement.tagName === 'TEXTAREA' ||
          (focusedElement as HTMLElement).isContentEditable)
      );
    }
    if (isInputFocused()) {
      postMessage({
        type: 'KEYBOARD_PASTE',
      });
      (focusedElement as HTMLInputElement).focus();
    }
  };
  return (
    (hasSelection || isInputElement) ? <Menu>
      {hasSelection && <MenuItem label="复制" onClick={handleCopy} />}
      {isInputElement && <MenuItem label="粘贴" onClick={handlePaste} />}
      {isInputElement && <MenuItem label="粘贴为纯文本" onClick={handlePasteText} />}
    </Menu> : <></>
  );
}
