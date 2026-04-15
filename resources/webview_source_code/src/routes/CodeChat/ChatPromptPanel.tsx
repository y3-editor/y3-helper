import {
  Box,
  Button,
  Text,
  WrapItem,
  Wrap,
  Image,
  Tooltip,
} from '@chakra-ui/react';
import {
  // DEFAULT_MODE_ID,
  // CODEMAKER_PYTHON_ID,
  // CODEMAKER_CPP_ID,
  // CODEMAKER_JAVA_ID,
  // CODEMAKER_LINUX_ID,
  // CODEMAKER_FRONTEND_ID,
  // CODEMAKER_BACKEND_ID,
  // CODEMAKER_UNITY_ID,
  // CODEMAKER_ALGORITHM_ID,
  // CODEMAKER_THINKING_CLAUDE_ID,
  DEFAULT_MODEL,
  PROGRAMMING_MODE,
  CODEMAKER_PYTHON_MODE,
  CODEMAKER_CPP_MODE,
  CODEMAKER_JAVA_MODE,
  CODEMAKER_LINUX_MODE,
  CODEMAKER_FRONTEND_MODE,
  CODEMAKER_BACKEND_MODE,
  CODEMAKER_UNITY_MODE,
  CODEMAKER_ALGORITHM_MODE,
  useMaskStore,
  ChatMask,
} from '../../store/mask';
// import { PROGRAMMING_MODE_ID } from '../../store/config';
import cImage from '../../assets/c++.png';
import pythonImage from '../../assets/python.png';
import javaImage from '../../assets/java.png';
import linuxImage from '../../assets/linux.png';
import unityImage from '../../assets/unity.png';
import tsImage from '../../assets/ts.png';
import algorithmImage from '../../assets/algorithm.png';
import shellImage from '../../assets/shell.png';
import programmingImage from '../../assets/programming.png';
import chatImage from '../../assets/chat.png';

// eslint-disable-next-line react-refresh/only-export-components
export const masks = [
  {
    // py
    ...CODEMAKER_PYTHON_MODE,
    icon: <Image src={pythonImage} w="4" h="4" />,
  },
  {
    // c++
    ...CODEMAKER_CPP_MODE,
    icon: <Image src={cImage} w="4" h="4" />,
  },
  {
    // java
    ...CODEMAKER_JAVA_MODE,
    icon: <Image src={javaImage} w="4" h="4" />,
  },
  {
    // linux
    ...CODEMAKER_LINUX_MODE,
    icon: <Image src={linuxImage} w="4" h="4" />,
  },
  {
    // Unity
    ...CODEMAKER_UNITY_MODE,
    icon: <Image src={unityImage} w="4" h="4" />,
  },
  {
    // 算法
    ...CODEMAKER_ALGORITHM_MODE,
    icon: <Image src={algorithmImage} w="4" h="4" />,
  },
  {
    // 前端
    ...CODEMAKER_FRONTEND_MODE,
    icon: <Image src={tsImage} w="4" h="4" />,
  },
  {
    // 后端
    ...CODEMAKER_BACKEND_MODE,
    icon: <Image src={shellImage} w="4" h="4" />,
  },
  // {
  //   // Thinking Claude
  //   ...CODEMAKER_THINKING_CLAUDE_MODE,
  //   icon: <Image src={thinkClaudeImage} w="4" h="4" />,
  // },
  {
    // 通用编程模式
    ...PROGRAMMING_MODE,
    icon: <Image src={programmingImage} w="4" h="4" />,
  },
  {
    // 普通闲聊模式
    ...DEFAULT_MODEL,
    icon: <Image src={chatImage} w="4" h="4" />,
  },
];

const ChatPromptPanel = (props: { onSelect: () => void }) => {
  const changeMask = useMaskStore((state) => state.changeMask);
  const handleChangeMask = (mark: ChatMask) => {
    changeMask(mark);
    props.onSelect();
  };

  return (
    <Box w="full">
      <Box w="full" mt="4" display="flex" justifyContent="center">
        <Box>
          <Box
            color="blue.300"
            textAlign="center"
            fontSize="24px"
            fontWeight="bold"
            mb="1"
          >
            挑选一个模式
          </Box>
          <Text color="text.default" fontSize="small">
            选择增强模式，解锁智能对话的无限潜能
          </Text>
        </Box>
      </Box>
      <Wrap id="prompt-selection" alignItems="center" justify="center" mt="4">
        {masks.map((mask) => (
          <WrapItem key={mask._id}>
            <Tooltip label={mask.description}>
              <Button
                h="auto"
                w="180px"
                px={2}
                py={4}
                mb="2"
                whiteSpace="normal"
                onClick={() => handleChangeMask(mask)}
                borderRadius="8px"
                bg="questionsBgColor"
                borderColor="customBorder"
                borderWidth="1px"
                _hover={{ borderColor: 'blue.300', color: 'blue.300' }}
              >
                <Box display="flex" alignItems="center">
                  <Box className="flex items-center" mr={2}>
                    {mask.icon}
                  </Box>
                  <Box fontSize="14px" fontWeight="bold" color="text.default">
                    {mask.name}
                  </Box>
                </Box>
              </Button>
            </Tooltip>
          </WrapItem>
        ))}
      </Wrap>
    </Box>
  );
};

export default ChatPromptPanel;
