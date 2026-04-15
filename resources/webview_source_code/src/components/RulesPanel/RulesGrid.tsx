import { Box, Button, Flex, Text, VStack, Icon } from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";
import { useWorkspaceStore } from "../../store/workspace";
import { useMemo, useRef, useState } from "react";
import RulesGuide from "./RulesGuide";
import { BsGear, BsInfoCircle } from "react-icons/bs";
import { useRulesOptions } from "./useRulesOptions";
import PanelItem from "./PanelItem";
import RulesManageModel, { RulesManageModelHandle } from "./RulesManageModel";

export const SOURCE_TAG = {
  codemaker: 'Y3Maker',
  original: 'Y3Maker',
  cursor: 'Cursor',
  cline: 'Cline',
  devspace: 'Y3Maker'
  // devspace: '研发知识集'
}

export default function RulesGrid() {
  const rulesOptions = useRulesOptions();
  const selectedRules = useWorkspaceStore((state) => state.selectedRules);
  const teamRules = useWorkspaceStore((state) => state.teamRules);
  const setSelectedRules = useWorkspaceStore((state) => state.setSelectedRules);
  const [isRulesModelOpen, setIsRulesModelOpen] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const rulesManageModelRef = useRef<RulesManageModelHandle>(null);

  const hasRules = useMemo(() => {
    return rulesOptions.length > 0;
  }, [rulesOptions])

  return <Flex
    w="full"
    flexDirection={'column'}
    h="300px"
    color="text.primary"
    px={4}
  >
    <Flex my={3} placeContent="space-between" alignItems="center" h={'20px'}>
      <Text fontSize="sm" color="text.primary" fontWeight={'extrabold'} >
        Rules
      </Text>
      <Flex alignItems="center">
        {hasRules && (
          <>
            <Button
              size="sm"
              variant="link"
              color="text.primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowGuide(!showGuide);
              }}
              leftIcon={<Icon as={BsInfoCircle} />}
              _hover={{ textDecoration: 'none', opacity: 0.8 }}
            >
              <Text fontSize="sm">{showGuide ? '关闭指南' : '使用指南'}</Text>
            </Button>
            <Box w="1px" h="14px" bg="gray.500" mx={3} />
          </>
        )}
        <Button
          size="sm"
          variant="link"
          color="blue.400"
          onClick={(e) => {
            e.stopPropagation();
            setIsRulesModelOpen(true);
          }}
          _hover={{ textDecoration: 'none', opacity: 0.8 }}
        >
          <Icon as={BsGear} size={20} mr={1} />
          <Text fontSize="sm">管理Rules</Text>
        </Button>
      </Flex>
    </Flex>
    <Box position="relative" overflow="hidden" flex="1">
      <VStack
        align="stretch"
        gap="2"
        h="full"
        overflowY="auto"
        pb="50px"
        maxH={'180px'}
      >
        {(!hasRules || showGuide) ? <RulesGuide /> : rulesOptions.map((item, index) => {
          const active = selectedRules.includes(item.filePath) || teamRules.findIndex((rule) => rule.filePath === item.filePath) >= 0;
          const hasGlobs = item.metaData.globs && item.metaData.globs.length > 0;
          const globsDisplay = hasGlobs ? (item?.metaData?.globs || []).join(', ') : '';

          return <PanelItem
            key={index}
            active={active}
            onClick={() => {
              if (active) {
                setSelectedRules(selectedRules.filter((path) => path !== item.filePath));
              } else {
                setSelectedRules([...selectedRules, item.filePath]);
              }
            }}
          >
            <Box
              position="relative"
              textAlign="left"
              w="full"
              h="full"
              py={1}
              color={active ? 'white' : 'text.secondary'}
            >
              <Flex mb={1} alignItems="flex-start" justify="space-between">
                <Box flex="1" minW={0}>
                  <Flex alignItems="center" mb={1}>
                    <Text fontSize="14px" fontWeight="500" color={active ? 'white' : 'text.primary'}>
                      {item.name}
                    </Text>
                    <Box
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                      ml="2"
                      px="2"
                      borderRadius="md"
                      borderWidth="1px"
                      fontSize="xs"
                      h="18px"
                      maxW="100px"
                      color={active ? 'white' : 'text.secondary'}
                      borderColor={active ? 'white' : 'gray.600'}
                    >
                      <Text
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {SOURCE_TAG[item.metaData.source || 'codemaker'] || 'Y3Maker'}
                      </Text>
                    </Box>
                    <Box
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                      ml="2"
                      px="2"
                      borderRadius="md"
                      borderWidth="1px"
                      fontSize="xs"
                      h="18px"
                      maxW="200px"
                      color={active ? 'white' : 'text.secondary'}
                      borderColor={active ? 'white' : 'gray.600'}
                    >
                      <Text
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {item.metaData.alwaysApply ? '始终生效' : (hasGlobs ? `指定文件: ${globsDisplay}` : '指定文件: **/*.ts')}
                      </Text>
                    </Box>
                  </Flex>
                  <Text fontSize="12px" opacity="0.7" isTruncated color={active ? '#c1c1c1' : 'text.secondary'}>
                    {item.filePath}
                  </Text>
                </Box>
                {active && (
                  <CheckIcon ml={2} fontSize="14px" color="white" />
                )}
              </Flex>
            </Box>
          </PanelItem>
        })}
      </VStack>
      {hasRules && !showGuide && (
        <Flex
          width={'full'}
          align="center"
          py={2}
        >
          <Text
            color="text.secondary"
            fontSize="xs"
            opacity={.5}
            textAlign="center"
          >
            点击选中/取消选中，双击打开Rules文件
          </Text>
        </Flex>
      )}
    </Box >
    <RulesManageModel
      ref={rulesManageModelRef}
      isOpen={isRulesModelOpen}
      onClose={() => setIsRulesModelOpen(false)}
    />
  </Flex >
}
