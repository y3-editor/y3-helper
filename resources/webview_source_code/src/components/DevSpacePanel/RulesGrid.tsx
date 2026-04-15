import { Box, Button, Flex, Text, Grid, VStack, Icon, Link } from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";
import { useWorkspaceStore } from "../../store/workspace";
import PanelItem from "./PanelItem";
import { useRulesOptions } from "./useRulesOptions";
import { useMemo, useRef, useState } from "react";
import RulesManageModel, { RulesManageModelHandle } from "./RulesManageModel";
import RulesGuide from "./RulesGuide";
import { BsBook, BsGear, BsPlus, BsInfoCircle } from "react-icons/bs";
import { useTheme, ThemeStyle } from "../../ThemeContext";

export const SOURCE_TAG = {
  codemaker: 'Local',
  original: 'Local',
  cursor: 'Cursor',
  cline: 'Cline',
  devspace: 'Local'
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
  const { activeTheme } = useTheme()

  const hasRules = useMemo(() => {
    return rulesOptions.length > 0;
  }, [rulesOptions])

  return <Flex
    w="full"
    flexDirection={'column'}
    h="300px"
    bg="themeBgColor"
    color="text.primary"
  >
    <Flex my={3} placeContent="space-between" alignItems="center" h={'30px'} pl={2} pr={6}>
      <Text fontSize="sm" color="text.primary" >
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
        pr={2}
        align="stretch"
        gap="2"
        h="full"
        overflowY="auto"
        pb="60px"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--chakra-colors-whiteAlpha-300)',
            borderRadius: '24px',
          },
        }}
      >
        {(!hasRules || showGuide) ? <RulesGuide /> : rulesOptions.map((item, index) => {
          const active = selectedRules.includes(item.filePath) || teamRules.findIndex((rule) => rule.filePath === item.filePath) >= 0;
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
              py={2}
              color="text.secondary"
            >
              <Grid>
                <Flex mb={1} isTruncated>
                  <Text fontSize="14px">
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
                    h="20px"
                    maxW="120px"
                    color={active ? 'white' : 'blue.300'}
                    borderColor={active ? 'white' : 'blue.300'}
                  >
                    <Text
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {SOURCE_TAG[item.metaData.source || 'codemaker'] || 'Local'}
                    </Text>
                  </Box>
                  {active && (
                    <CheckIcon ml="auto" fontSize="14px" />
                  )}
                </Flex>
                <Text fontSize="12px" opacity="0.6" isTruncated>
                  {item.filePath}
                </Text>
              </Grid>
            </Box>
          </PanelItem>
        })}
      </VStack>
      <Flex
        width={'full'}
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="50px"
        hidden={true}
        align="center"
        justify="space-between"
        alignItems={'center'}
        px={4}
        bg={activeTheme === ThemeStyle.Dark ? 'blackAlpha.600' : 'whiteAlpha.800'}
        backdropFilter="blur(3px)"
        borderTop="1px solid"
        borderColor={activeTheme === ThemeStyle.Dark ? 'whiteAlpha.100' : 'blackAlpha.100'}
        zIndex={2}
      >
        <Text
          as={Flex}
          pl={2}
          color="text.secondary"
          fontSize="xs"
          opacity={.4}
          marginRight={'auto'}
          // hidden={!rulesOptions.length}
          alignItems="center"
          gap={1}
        >
          点击选中/取消选中
        </Text>

        <Flex>
          <Link
            href="https://github.com"
            isExternal
            fontSize="xs"
            color="gray.400"
            display="flex"
            alignItems="center"
            mr={4}
            _hover={{ color: "purple.300", textDecoration: "none" }}
          >
            <Icon as={BsBook} mr={1.5} />
            最佳实践文档
          </Link>
          <Button
            size="xs"
            bg={'purple.400'}
            _hover={{ bg: 'purple.400' }}
            leftIcon={<Icon as={BsPlus} />}
            onClick={() => {
              setIsRulesModelOpen(true);
              setTimeout(() => {
                rulesManageModelRef.current?.handleAddRule();
              }, 100);
            }}
          >
            新建 Rules
          </Button>
        </Flex>
      </Flex>
    </Box>
    <RulesManageModel
      ref={rulesManageModelRef}
      isOpen={isRulesModelOpen}
      onClose={() => setIsRulesModelOpen(false)}
    />
  </Flex>
}
