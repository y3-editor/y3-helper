import * as React from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useOutsideClick,
} from '@chakra-ui/react';
import PromptsPanel from './Prompt/PromptsPanel';
import { TypeAheadMode, TypeAheadSubProps } from './const';
import AttachSelectorPanel from './Attach/AttachSelectorPanel';
import { Prompt, PromptCategoryType } from '../../../services/prompt';
import { debounce } from 'lodash'
import MasksPanel from './Mask/MasksPanel';
import PluginPanel from './PluginMarket/PluginPanel';
import { useMaskStore } from '../../../store/mask';
import { HandleImageUpload } from '../../../components/ImageUpload/ImageUpload';
import { useChatStore } from '../../../store/chat';
import batch from '../../../utils/batch';
import { checkValueOfPressedKeyboard } from '../../../utils';
// import { useChatStore } from '../../../store/chat';
const PROMPT_TEMPLATE_TRIGGER_PREFIX = '/';
const ATTACH_TRIGGER_PREFIX = '@';

interface ChatTypeAheadProps {
  // 模拟属于这个 popover 内的元素，主要是对齐 outside click，避免某些点击事件不符合预期
  // 譬如说某个其他按钮被点击了，触发打开 popover，但由于 outside click 的问题，导致没法正确打开
  innerElementRefs: React.RefObject<HTMLElement>[];
  userInputRef: React.RefObject<HTMLTextAreaElement>;
  uploadImgRef: React.RefObject<HandleImageUpload>;
  onSubmit: (prompt: Prompt) => void;
}

interface TriggerFunction {
  (
    _mode: TypeAheadMode,
    _isOpen?: boolean,
    focusedType?: PromptCategoryType,
  ): void;
  (_mode: Exclude<TypeAheadMode, TypeAheadMode.Prompt>): void;
}
export interface ChatTypeAheadHandle {
  trigger: TriggerFunction;
}

const ChatTypeAhead = React.forwardRef<
  ChatTypeAheadHandle,
  React.PropsWithChildren<ChatTypeAheadProps>
>((props, ref) => {
  const { innerElementRefs, userInputRef, onSubmit, uploadImgRef } = props;
  const [userInputValue, setUserInputValue] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [mentionKeyword, setMentionKeyword] = React.useState<string>('');
  const [typeAheadMode, setTypeAheadMode] = React.useState<TypeAheadMode>();
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [focusedPromptType, setFocusedPromptType] =
    React.useState<PromptCategoryType>();

  const isDisabledAttachs = useMaskStore((state) => state.isDisabledAttachs());
  // const { prompts, shortcuts } = useUserPrompt();
  // const ide = useExtensionStore((state) => state.IDE);
  const chatType = useChatStore((state) => state.chatType);

  useOutsideClick({
    ref: popoverRef,
    handler: (e) => {
      for (const ref of innerElementRefs) {
        if (ref && ref.current && ref.current.contains(e.target as Node)) {
          // 暂时不通过这里出发，由 forwardRef + handle 来控制
          // setIsOpen(!isOpen);
          return;
        }
      }

      const otherInnerElements = document.getElementsByClassName(
        'chat-typeahead-inner-element',
      );
      for (const element of otherInnerElements) {
        if (element.contains(e.target as Node)) {
          return;
        }
      }

      // trigger context menu
      if ((e as MouseEvent).button === 2) {
        return;
      }
      const contextMenuElement = document.getElementById(
        'webview-context-menu',
      );
      if (contextMenuElement?.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    },
  });

  const reset = React.useCallback(() => {
    batch(() => {
      setFocusIndex(0);
      setIsOpen(false);
      setTypeAheadMode(undefined);
      setFocusedPromptType(undefined);
    });
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setFocusIndex(0);
    }
  }, [isOpen]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateMentionKeyword = React.useCallback(debounce((
    isOpen: boolean,
    userInputRef: React.RefObject<HTMLTextAreaElement>,
    userInputValue: string,
    typeAheadMode: TypeAheadMode | undefined,
  ) => {
    if (isOpen && userInputValue && userInputRef.current) {
      const { selectionStart = 0, value = '' } = userInputRef.current
      // 找指令 - 根据当前模式只查找对应的触发符号
      const includedMentionText = value.slice(0, selectionStart)
      let mentionCursor = -1

      // 根据当前模式决定要查找的触发符号
      let targetPrefix = ''
      if (typeAheadMode === TypeAheadMode.Prompt) {
        targetPrefix = PROMPT_TEMPLATE_TRIGGER_PREFIX
      } else if (typeAheadMode === TypeAheadMode.Attach) {
        targetPrefix = ATTACH_TRIGGER_PREFIX
      }

      // 从后向前查找最近的触发符号(离光标最近的)
      if (targetPrefix) {
        for (let i = includedMentionText.length - 1; i >= 0; i--) {
          if (includedMentionText[i] === targetPrefix) {
            mentionCursor = i
            break
          }
        }
      }

      if (mentionCursor>=0) {
        const searchText = value.slice(mentionCursor+1, selectionStart)
        const matchText = searchText
          .replace(/(\n)|(\r\n)/g, ' ')
          .match(/^([^\s]*)/)
        if (matchText) {
          setMentionKeyword(matchText[0])
          return
        }
      }
    }
    setMentionKeyword('')
  }, 300), []);

  React.useEffect(() => {
    updateMentionKeyword(isOpen, userInputRef, userInputValue, typeAheadMode)
  }, [userInputRef, isOpen, userInputValue, typeAheadMode, updateMentionKeyword])


  React.useEffect(() => {
    const element = userInputRef?.current;
    let isComposing = false;
    function handleCompositionStart() {
      isComposing = true;
    }
    function handleCompositionEnd(event: CompositionEvent) {
      isComposing = false;
      const userInputValue = (event.target as HTMLTextAreaElement).value;
      setUserInputValue(userInputValue);
    }
    function handlePanelOpen(charStr: string) {
      switch(charStr) {
        case ATTACH_TRIGGER_PREFIX: {
          if (isDisabledAttachs) {
            return;
          }
          setTypeAheadMode(TypeAheadMode.Attach);
          setIsOpen(true)
          break
        }
        case PROMPT_TEMPLATE_TRIGGER_PREFIX: {
          setTypeAheadMode(TypeAheadMode.Prompt);
          setIsOpen(true)
          break
        }
        default:
          break
      }
    }

    function addKeyDownEventListener(event: KeyboardEvent) {
      // 忽略输入法输入过程中的按键
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
      // if (event.isComposing || event.keyCode === 229) return;
      if (checkValueOfPressedKeyboard(event, ['ArrowDown', 'ArrowUp'])) {
        if (!isOpen) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        if ([event.code, event.key].includes("ArrowDown")) {
          setFocusIndex((prev) => prev + 1);
        } else if ([event.code, event.key].includes("ArrowUp")) {
          setFocusIndex((prev) => prev - 1);
        }
      } else if (checkValueOfPressedKeyboard(event, ['Enter'])) {
        if (!isOpen) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      } else if (checkValueOfPressedKeyboard(event, ['Tab'])) {
        const userInputValue = userInputRef.current?.value;
        if (!userInputValue) {
          return;
        }
        event.preventDefault();
        if (typeAheadMode && !isOpen) {
          setIsOpen(true);
          return;
        }
      } else if (checkValueOfPressedKeyboard(event, ['Backspace'])) {
        if (userInputRef.current) {
          const { selectionStart, value } = userInputRef.current
          if ([
            ATTACH_TRIGGER_PREFIX
          ].includes(value.charAt(selectionStart - 2))) {
            handlePanelOpen(value.charAt(selectionStart - 2))
          } else if ([
              ATTACH_TRIGGER_PREFIX
            ].includes(value.charAt(selectionStart - 1))) {
            // 回删时隐藏面板
            setIsOpen(false)
          } else if ([
            PROMPT_TEMPLATE_TRIGGER_PREFIX
          ].includes(value.charAt(selectionStart - 1)) && !value.charAt(selectionStart - 2)?.trim?.()) {
            // 回删时隐藏面板
            setIsOpen(false)
          }
        }
        return
      } else if (checkValueOfPressedKeyboard(event, ['Digit2', 'Slash', 'NumpadDivide'], [ATTACH_TRIGGER_PREFIX, PROMPT_TEMPLATE_TRIGGER_PREFIX])) {
        if (userInputRef.current) {
          if (event.ctrlKey || event.metaKey) return
          const { selectionStart, value } = userInputRef.current
          const preValue = value.charAt(selectionStart-1).trim()
          if (!preValue) handlePanelOpen(event.key)
        }
        return
      } else if (checkValueOfPressedKeyboard(event, ['Space'], [' '])) {
        if (!isComposing) {
          reset()
        }
      }
    }
    function addInputChangeEventListener(event: Event) {
      if (!isComposing) {
        const userInputValue = (event.target as HTMLTextAreaElement).value;
        setUserInputValue(userInputValue);
      }
    }

    function addBlurEventListener() {
      if (popoverRef.current) {
        // 说明有正在处理的 panel 未关闭
        const isOpenInnerPanel =
          document.querySelectorAll('.chat-typeahead-inner-element').length > 0;
        if (!isOpenInnerPanel) {
          setIsOpen(false);
        }
      }
    }
    function addEscapeEventListener(event: KeyboardEvent) {
      if (checkValueOfPressedKeyboard(event, ['Escape'])) {
        setIsOpen(false);
      }
    }
    function addFocusEventListener() {
      if (userInputRef.current) {
        const { selectionStart, value } = userInputRef.current
        handlePanelOpen(value.charAt(selectionStart-1))
      }
    }
    element?.addEventListener('compositionstart', handleCompositionStart);
    element?.addEventListener('compositionend', handleCompositionEnd);
    element?.addEventListener('keydown', addKeyDownEventListener);
    element?.addEventListener('input', addInputChangeEventListener);
    element?.addEventListener('focus', addFocusEventListener);
    window.addEventListener('keydown', addEscapeEventListener);
    window.addEventListener('blur', addBlurEventListener);
    return () => {
      element?.removeEventListener('compositionstart', handleCompositionStart);
      element?.removeEventListener('compositionend', handleCompositionEnd);
      element?.removeEventListener('keydown', addKeyDownEventListener);
      element?.removeEventListener('input', addInputChangeEventListener);
      element?.removeEventListener('focus', addFocusEventListener);
      window.removeEventListener('keydown', addEscapeEventListener);
      window.removeEventListener('blur', addBlurEventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, typeAheadMode, chatType, isDisabledAttachs, reset, userInputRef.current]);

  React.useImperativeHandle(ref, () => ({
    trigger: (
      _mode: TypeAheadMode = TypeAheadMode.Prompt,
      _isOpen?: boolean,
      focusedType?: PromptCategoryType,
    ) => {
      const nextOpenState = _isOpen === undefined ? !isOpen : !_isOpen;
      if (_mode === TypeAheadMode.Prompt) {
        if (userInputRef.current) {
          if (nextOpenState) {
            if (
              !userInputRef.current.value.startsWith(
                PROMPT_TEMPLATE_TRIGGER_PREFIX,
              )
            ) {
              // userInputRef.current.value = PROMPT_TEMPLATE_TRIGGER_PREFIX;
              setUserInputValue(PROMPT_TEMPLATE_TRIGGER_PREFIX);
              setIsOpen(true)
              setTypeAheadMode(TypeAheadMode.Prompt);
            }
            userInputRef.current.focus();
          } else {
            setIsOpen(nextOpenState);
          }
        }
        if (focusedType) {
          setFocusedPromptType(focusedType);
        }
      }
      if (_mode === TypeAheadMode.Mask) {
        setIsOpen(nextOpenState);
        if (nextOpenState) {
          setTypeAheadMode(_mode);
        }
        if (focusedType) {
          setFocusedPromptType(focusedType);
        }
      }
      if (_mode === TypeAheadMode.Plugin) {
        setIsOpen(nextOpenState);
        if (nextOpenState) {
          setTypeAheadMode(_mode);
        }
      }
      if (_mode === TypeAheadMode.Attach) {
        if (userInputRef.current) {
          if (nextOpenState) {
            // 像键盘输入@一样，直接添加@符号并打开面板
            const currentValue = userInputRef.current.value;
            const cursorPosition = userInputRef.current.selectionStart;

            // 在光标位置插入@符号
            const beforeCursor = currentValue.slice(0, cursorPosition);
            const afterCursor = currentValue.slice(cursorPosition);
            const newValue = beforeCursor + ATTACH_TRIGGER_PREFIX + afterCursor;

            userInputRef.current.value = newValue;
            setUserInputValue(newValue);

            // 设置光标位置到@符号后面
            const newCursorPosition = cursorPosition + 1;
            userInputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);

            setIsOpen(true);
            setTypeAheadMode(TypeAheadMode.Attach);
            userInputRef.current.focus();
          } else {
            setIsOpen(nextOpenState);
          }
        }
      }
    },
  }));

  const nextProps: TypeAheadSubProps = {
    inputValue: userInputValue,
    focusIndex,
    userInputRef,
    mentionKeyword,
    updateOpenState: setIsOpen,
    resetIndex: setFocusIndex,
    uploadImgRef: uploadImgRef,
  };

  const handleTypeAheadModeChange = (mode: TypeAheadMode) => {
    setTypeAheadMode(mode);
  };

  return (
    <div ref={popoverRef}>
      <Popover
        isOpen={isOpen}
        isLazy
        placement="top-start"
        autoFocus={false}
        matchWidth
        offset={[0, 8]}
      >
        <PopoverTrigger>{props.children}</PopoverTrigger>
        <PopoverContent style={{ width: 'calc(100vw - 16px)' }}>
          <PopoverBody display="flex" gap={0} p={0}>
            {typeAheadMode === TypeAheadMode.Prompt && (
              <PromptsPanel
                {...nextProps}
                onSubmit={onSubmit}
                focusedType={focusedPromptType}
                onTypeAheadModeChange={handleTypeAheadModeChange}
              />
            )}
            {typeAheadMode === TypeAheadMode.Attach && (
              <AttachSelectorPanel {...nextProps} />
            )}
            {typeAheadMode === TypeAheadMode.Mask && (
              <MasksPanel {...nextProps} focusedType={focusedPromptType} />
            )}
            {typeAheadMode === TypeAheadMode.Plugin && <PluginPanel />}
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </div>
  );
});

ChatTypeAhead.displayName = 'ChatTypeAhead';

export default ChatTypeAhead;
