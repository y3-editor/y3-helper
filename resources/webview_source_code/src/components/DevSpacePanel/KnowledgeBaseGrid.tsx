import { Box, Button, Flex, Text, Grid, VStack } from "@chakra-ui/react";
import { useWorkspaceStore } from "../../store/workspace";
import PanelItem from "./PanelItem";
import { useKnowledgeBaseOptions } from "./useKnowledgeBaseOptions";
import { usePostMessage } from "../../PostMessageProvider";

export default function KnowledgeBaseGrid() {
  const knowledgeBaseOptions = useKnowledgeBaseOptions();
  const selectedKnowledgeBases = useWorkspaceStore((state) => state.selectedKnowledgeBases);
  const { postMessage } = usePostMessage();

  return <Grid
    w="full"
    p={2}
    gridTemplateRows='auto 1fr auto'
    h="256px"
    bg="themeBgColor"
    color="text.primary"
  >
    <Flex mb={2} placeContent="space-between" alignItems="center">
      <Text p={1} pb={2} fontSize="sm" color="text.primary">
        知识库
      </Text>
      <Button
        size="sm"
        variant="link"
        fontSize="14px"
        color="blue.400"
        fontWeight="600"
        p={2}
        h="auto"
        ml='auto'
        onClick={(e) => {
          e.stopPropagation();
          postMessage({
            type: "OPEN_IN_BROWSER",
            data: { url: 'http://localhost:3001' },
          });
        }}
      >
        + 新建知识库
      </Button>
    </Flex>
    <VStack
      pr={2}
      align="stretch"
      gap="2"
      minH="80px"
      overflowY="scroll"
    >
      {knowledgeBaseOptions.map((item, index) => {
        const active = selectedKnowledgeBases.includes(item._id);
        return <PanelItem
          key={index}
          active={active}
          onClick={() => {
            // if (active) {
            //   setSelectedKnowledgeBases(selectedKnowledgeBases.filter((id) => id !== item._id));
            // } else {
            //   setSelectedKnowledgeBases([...selectedKnowledgeBases, item._id]);
            // }
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
                {
                  item.source === 'devspace' && (
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
                        研发知识
                      </Text>
                    </Box>
                  )
                }
              </Flex>
              <Text fontSize="12px" opacity="0.6" isTruncated>
                {item.name}
              </Text>
            </Grid>
          </Box>
        </PanelItem>
      })}
    </VStack>
    {/* <Text
      as={Flex}
      mt={2}
      pl={2}
      color="text.secondary"
      fontSize="sm"
      alignItems="center"
      gap={1}
    >
      点击选中/取消选中，双击打开知识库
    </Text> */}
    <Text
      as={Flex}
      mt={2}
      pl={2}
      color="text.secondary"
      fontSize="sm"
      alignItems="center"
      gap={1}
    >
      当前研发知识集关联知识库
    </Text>
  </Grid>
}
