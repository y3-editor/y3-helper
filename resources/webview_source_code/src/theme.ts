import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { generateSpace } from './utils/generateSpace';
// 跟随系统主题
export const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  components: {
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
  },
  colors: {
    blue: {
      // 如果使用 colorScheme="blue" 的话，会默认选中blue.200，hover 的时候会变成 blue.300
      // 但是 blue.300 是我们的主题颜色，如果不想让 colorScheme="blue" hover 的时候颜色变动太大，需要把这两个颜色调整为一样
      200: '#786FFF',
      300: '#786FFF',
    },
    // 选择器的背景颜色
    gray: {
      700: '#242424',
    },

    questionsBgColor: '#1F1F1F',
    answerBgColor: '#181818',
    customBorder: 'rgba(255, 255, 255, 0.1)',
    text: {
      primary: 'rgba(255, 255, 255, 1)', // 主要
      secondary: 'rgba(255, 255, 255, 0.8)', // 次要
      default: 'rgba(255, 255, 255, 0.6)', // 默认
      muted: 'rgba(255, 255, 255, 0.3)', // 弱化
    },
    success: '#09D174',
    warning: '#FF9326',
    error: '#FF4747',
    info: '#786FFF', // 主题颜色
  },
  space: generateSpace(4),
  // TODO: 新增了一个 Tab，宽度由 344px 改为了 440px
  sizes: { globalMinWidth: '460px' },
});

export default theme;
