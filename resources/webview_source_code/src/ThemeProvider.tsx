import * as React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { generateSpace } from './utils/generateSpace';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ThemeStyle, ThemeProviderContext } from './ThemeContext';
import { useExtensionStore, IDE } from './store/extension';
import { BroadcastActions } from './PostMessageProvider';
import userReporter from './utils/report';
import { UserEvent } from './types/report';

export const CODEMAKER_THEME_KEY = 'codemaker-theme';
export const CODEMAKER_THEME_PREFERENCE_KEY = 'codemaker-theme-preference'; // 用户的主题偏好设置
export const CODEMAKER_SYSTEM_THEME_CACHE_KEY = 'codemaker-system-theme-cache'; // 缓存的系统主题

// 从缓存中获取上次的系统主题
const getCachedSystemTheme = (): ThemeStyle => {
  const cached = localStorage.getItem(CODEMAKER_SYSTEM_THEME_CACHE_KEY);
  if (cached === ThemeStyle.Light || cached === ThemeStyle.Dark) {
    return cached as ThemeStyle;
  }
  return ThemeStyle.Dark;
};

const ThemeProvider = (props: { children: React.ReactNode }) => {
  const ide = useExtensionStore((state) => state.IDE);

  // 用户的主题偏好（可以是 light/dark/system）
  const [themePreference, setThemePreference] = useLocalStorage<ThemeStyle>(
    CODEMAKER_THEME_PREFERENCE_KEY,
    ThemeStyle.Dark,
  );

  // 计算实际应用的主题
  const getEffectiveTheme = React.useCallback(() => {
    if (themePreference === ThemeStyle.System) {
      return getCachedSystemTheme();
    }
    return themePreference || ThemeStyle.Dark;
  }, [themePreference]);

  const [activeTheme, setActiveTheme] = React.useState<ThemeStyle>(getEffectiveTheme);

  // 系统主题引用
  const systemThemeRef = React.useRef<ThemeStyle>(getCachedSystemTheme());

  const isLight = activeTheme === ThemeStyle.Light;

  const customTheme = React.useMemo(() => {
    return extendTheme({
      config: {
        initialColorMode: activeTheme,
        useSystemColorMode: false,
      },
      zIndices: {
        modal: 1000,
        popover: 900
      },
      components: {
        Tabs: {
          baseStyle: {
            tab: {
              _selected: {
                color: 'blue.300',
                bg: isLight ? '#F2F2F2' : '#131313',
              },
            },
            tablist: {
              bg: isLight ? '#DADADA' : '#181818',
              borderBottom: '1px solid',
              borderColor: isLight ? '#b3b1b1' : 'whiteAlpha.300',
            },
          },
        },
        Checkbox: {
          baseStyle: {
            control: {
              _checked: {
                bg: 'blue.300',
                borderColor: 'blue.300',
                color: 'white',
              },
              _checkedHover: {
                bg: 'blue.300',
                borderColor: 'blue.4300',
              },
            },
          },
        },
        Select: {
          baseStyle: {
            container: {
              bg: 'blue.500', // 设置 Select 组件的背景色
              color: 'white', // 设置 Select 组件的文本颜色
            },
          },
        },
        Modal: {
          baseStyle: {
            zIndex: 1000,
            dialog: {
              bg: isLight ? '#FFFFFF' : '#181818',
            },
          },
        },
        Input: {
          defaultProps: {
            variant: 'outline',
          },
          variants: {
            outline: {
              field: {
                borderColor: isLight ? 'gray.400' : 'whiteAlpha.300',
              },
            },
          },
        },
        Textarea: {
          defaultProps: {
            variant: 'outline',
          },
          variants: {
            outline: {
              borderColor: isLight ? 'gray.400' : 'whiteAlpha.300',
            },
          },
        },
        Tag: {
          baseStyle: {
            container: {
              bg: isLight ? '#F2F2F2' : '#343434',
              color: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            },
          },
        },
      },
      Popover: {
        baseStyle: {
          popper: {
            zIndex: 900, // 设置比 Modal 的 zIndex 小一点，避免影响到 Modal 的 zIndex
          },
        },
      },
      colors: {
        blue: {
          // 如果使用 colorScheme="blue" 的话，会默认选中blue.200，hover 的时候会变成 blue.300
          // 但是 blue.300 是我们的主题颜色，如果不想让 colorScheme="blue" hover 的时候颜色变动太大，需要把这两个颜色调整为一样
          200: '#786FFF',
          300: '#786FFF',
          400: '#786FFF',
          500: '#786FFF',
          600: '#786FFF',
        },
        // 选择器的背景颜色
        gray: {
          700: '#242424',
        },

        customBorder: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
        text: {
          primary: isLight ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)', // 主要
          secondary: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)', // 次要
          default: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)', // 默认
          muted: isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)', // 弱化
        },
        success: '#09D174',
        warning: '#FF9326',
        error: '#FF4747',
        info: '#786FFF', // 主题颜色
        // chat 回答部分背景颜色
        answerBgColor: isLight ? '#EFEFEF' : '#181818',
        // chat 提问部分背景颜色
        questionsBgColor: isLight ? '#FFFFFF' : '#1F1F1F',
        // 整体的背景颜色
        themeBgColor: isLight ? '#FFFFFF' : '#131313',
        // 展示一些列表可使用的背景颜色，例如：插件市场的列表
        listBgColor: isLight ? '#F2F2F2' : '#1D1D1D',
        itemBgColor: isLight ? '#FFFFFF' : '#373737',
        buttonBgColor: isLight ? '#FFFFFF' : '#1D1D1D',
        // 一些在黑底上高亮的颜色，例如 LocalReview
        panelBgColor: isLight ? '#FFFFFF' : '#373737',
        panelBlockBgColor: isLight ? '#F2F2F2' : '#2C2C2C',
      },
      space: generateSpace(4),
    });
  }, [activeTheme, isLight]);

  const switchTheme = React.useCallback(
    (theme: ThemeStyle) => {
      // 保存用户的主题偏好
      setThemePreference(theme);

      // 如果选择跟随系统，则使用系统主题；否则使用用户选择的主题
      const newActiveTheme = theme === ThemeStyle.System ? systemThemeRef.current : theme;

      if (activeTheme === newActiveTheme) return;

      setActiveTheme(newActiveTheme);
      userReporter.report({
        event: UserEvent.SETTING_SWITCH_THEME,
        extends: {
          theme,
        },
      });
      // 因为 VisualStudio 使用 window reload 会更新实例导致 VisualStudio 框架拿不到旧实例
      // 无法将事件绑定到 window 上，故需要发送事件，由 VisualStudio 触发 window.reload
      if (ide === IDE.VisualStudio) {
        window.postMessage({
          type: BroadcastActions.RELOAD,
        });
      } else {
        window.location.reload();
      }
    },
    [activeTheme, setThemePreference, ide],
  );

  // 设置系统主题（从插件端接收）
  const setSystemTheme = React.useCallback((theme: ThemeStyle) => {
    // 更新系统主题缓存
    localStorage.setItem(CODEMAKER_SYSTEM_THEME_CACHE_KEY, theme);

    const oldSystemTheme = systemThemeRef.current;
    systemThemeRef.current = theme;

    // 只有当用户选择了"跟随系统"且系统主题真的改变了，才刷新页面
    if (themePreference === ThemeStyle.System && oldSystemTheme !== theme) {
      setTimeout(() => {
        if (ide === IDE.VisualStudio) {
          window.postMessage({ type: BroadcastActions.RELOAD });
        } else {
          window.location.reload();
        }
      }, 100);
    }
  }, [ide, themePreference]);

  const context = React.useMemo(() => {
    return {
      activeTheme, // 返回实际应用的主题（只能是 light 或 dark）
      switchTheme,
      systemTheme: systemThemeRef.current,
      setSystemTheme,
    };
  }, [activeTheme, switchTheme, setSystemTheme]);

  return (
    <ThemeProviderContext.Provider value={context}>
      <ChakraProvider key={activeTheme} theme={customTheme}>
        {props.children}
      </ChakraProvider>
    </ThemeProviderContext.Provider>
  );
};

export default ThemeProvider;
