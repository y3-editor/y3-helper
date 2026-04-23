import * as React from 'react';
import {
  Box,
  Card,
  CardBody,
  useColorModeValue,
  Flex,
  Code,
  Link,
  VStack,
  HStack,
  Circle,
  Collapse,
} from '@chakra-ui/react';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import Icon from '../../../components/Icon';
import Tree, { TreeNode } from '../../../components/Tree';
import { BsCheckCircleFill } from 'react-icons/bs';
import { MdError } from 'react-icons/md';
import { usePostMessage } from '../../../PostMessageProvider';
interface ICodewikiDirectory {
  title: string
  path: string
  description: string
  documents: string[]
  subdirectories: Record<string, ICodewikiDirectory>
  prompt: string
}

const PreviewCodewikiStructure: React.FC<{
  content: string
  hasError: boolean
  isLatest: boolean | undefined
}> = (props) => {
  const { postMessage } = usePostMessage();
  const { hasError, content } = props;
  const [isWikiExpanded] = React.useState(true);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = React.useState(false);

  // 基本主题颜色
  const cardBg = useColorModeValue('white', '#1E1E1E');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'whiteAlpha.900');
  // 代码样式
  const codeBg = useColorModeValue('gray.100', 'gray.700');
  const codeBorder = useColorModeValue('gray.200', 'gray.600');

  // 图标颜色
  const successIconColor = useColorModeValue('green.500', 'green.300');

  const stepNumberBg = useColorModeValue('blue.100', 'blue.900');
  const stepNumberColor = useColorModeValue('blue.600', 'blue.200');
  const linkColor = useColorModeValue('blue.500', 'blue.300');
  const tipColor = useColorModeValue('blackAlpha.600', 'whiteAlpha.600');


  const dfsDirectory = React.useCallback((directory: Record<string, ICodewikiDirectory>): TreeNode[] => {
    if (typeof directory !== 'object') return []
    return Object.keys(directory).map((name: string, index: number) => {
      const subdirectory = directory[name];
      return {
        key: subdirectory.path + index,
        title: name,
        path: subdirectory.path,
        // description: subdirectory.description,
        tooltip: subdirectory.prompt,
        children: dfsDirectory(subdirectory?.subdirectories || {}),
      }
    })
  }, [])

  const codewikiStructure = React.useMemo(() => {
    let data: TreeNode[] = []
    try {
      data = JSON.parse(content)
      data = dfsDirectory(data as unknown as Record<string, ICodewikiDirectory>)
    } catch (e) {
      data = []
    }
    return data
  }, [content, dfsDirectory])


  const previewError = React.useMemo(() => {
    if (!hasError) return null
    return (
      <Box color="red.400">
        {content}
      </Box>
    )
  }, [content, hasError])

  const previewCodewikiStructure = React.useMemo(() => {
    if (hasError) return null
    return (
      <VStack spacing={4} align="stretch" mt={2}>
        {/* Wiki Structure Card */}
        <Card
          variant="outline"
          size="sm"
          bg={cardBg}
          borderColor={cardBorder}
          borderRadius="lg"
          overflow="hidden"
          boxShadow="sm"
          transition="all 0.2s"
        >
          {/* <CardHeader
            bg={headerBg}
            borderBottomWidth={isWikiExpanded ? "1px" : "0"}
            borderColor={cardBorder}
            px={4}
            py={2}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
            onClick={() => setIsWikiExpanded(!isWikiExpanded)}
          >
            <Flex alignItems='item-end' style={{ zoom: .9 }} pt={1}>
              <Box
                as="img"
                src={CodemakerIcon}
                alt="model"
                w="16px"
                h="16px"
                objectFit="contain"
              />
              <Box>odewiki目录</Box>
            </Flex>
            <Icon as={isWikiExpanded ? FaAngleDown : FaAngleRight} size="xs" color="gray.500" />
          </CardHeader> */}
          {isWikiExpanded && (
            <CardBody px={2} py={1}>
              <Box
                maxH="300px"
                overflowY="auto"
                className="codeblock relative w-full font-sans px-2 py-2"
              >
                <Tree
                  dataSource={codewikiStructure}
                  selectable
                  expandIcon={true}
                  expandAll={false}
                  classname="tree-node-item"
                />
              </Box>
            </CardBody>
          )}
        </Card>
        {/* Instructions */}
        <Box
          px={4}
          borderRadius="lg"
        >
          <HStack
            color={successIconColor}
            mb={4}
            spacing={2}
            cursor="pointer"
            onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
            _hover={{ opacity: 0.8 }}
          >
            <BsCheckCircleFill />
            <Box fontWeight="bold" fontSize="sm" flex={1}>
              如果对生成的 Wiki 目录效果满意，点击查看后续步骤
            </Box>
            <Icon as={isInstructionsExpanded ? FaAngleDown : FaAngleRight} />
          </HStack>

          <Collapse in={isInstructionsExpanded} animateOpacity>
            <VStack spacing={3} align="stretch" pl={1}>
              {/* Step 1 */}
              <HStack align="flex-start" spacing={3}>
                <Circle size="20px" bg={stepNumberBg} color={stepNumberColor} fontSize="xs" fontWeight="bold" mt={0.5}>
                  1
                </Circle>
                <Box fontSize="sm">
                  先提交 <Code
                    px={1.5}
                    py={0.5}
                    bg={codeBg}
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    borderWidth="1px"
                    borderColor={codeBorder}
                    color={textColor}
                  >
                    .codemaker/codewiki/wiki.json
                  </Code> 更新文件到代码仓库
                </Box>
              </HStack>

              {/* Step 2 */}
              <HStack align="flex-start" spacing={3}>
                <Circle size="20px" bg={stepNumberBg} color={stepNumberColor} fontSize="xs" fontWeight="bold" mt={0.5}>
                  2
                </Circle>
                <VStack align="start" spacing={1} flex={1}>
                  <Box fontSize="sm">
                    进入
                    <Link
                      href='#'
                      color={linkColor}
                      mx={1}
                      fontWeight="medium"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        postMessage({
                          type: 'OPEN_IN_BROWSER',
                          data: {
                            url: 'https://devcloud-office.nie.netease.com/',
                          },
                        });
                      }}
                    >
                      Devcloud
                    </Link>
                    平台新建代码地图
                  </Box>

                  {/* Sub-steps (formerly 3 and 4) */}
                  <HStack align="flex-start" spacing={2} pt={1}>
                    <Box minW="4px" h="4px" borderRadius="full" bg="gray.400" mt={2} />
                    <Box fontSize="sm" color={textColor}>
                      初次新建Codewiki：选择 项目 → office环境 → 项目研发空间 → 项目代码地图，点击【新建】→【Gitlab仓库接入】，在【生成Codewiki】选项选择【是】，确认后提交到仓库
                    </Box>
                  </HStack>

                  <HStack align="flex-start" spacing={2}>
                    <Box minW="4px" h="4px" borderRadius="full" bg="gray.400" mt={2} />
                    <Box fontSize="sm" color={textColor}>
                      已有Codewiki：选择 项目 → office环境 → 项目研发空间 → 项目代码地图，定位已有代码地图，点击【更新】→【仅更新Codewiki】
                    </Box>
                  </HStack>
                </VStack>
              </HStack>
            </VStack>
          </Collapse>

          {/* Error/Feedback Hint */}
          <Flex
            // p={3}
            borderRadius="md"
            align="center"
            mt={4}
            mb={4}
            color={tipColor}
          >
            <Icon as={MdError} boxSize={5} />
            <Box fontSize="sm" fontWeight="medium" ml={2}>
              如果对生成效果不满意，可通过聊天更新 wiki.json 配置
            </Box>
          </Flex>
        </Box>

      </VStack>
    );
  }, [hasError, cardBg, cardBorder, isWikiExpanded, codewikiStructure, successIconColor, stepNumberBg, stepNumberColor, codeBg, codeBorder, textColor, linkColor, tipColor, postMessage, isInstructionsExpanded]);



  return <Box color={textColor}>
    {previewError}
    {previewCodewikiStructure}
  </Box>
};

export default PreviewCodewikiStructure;