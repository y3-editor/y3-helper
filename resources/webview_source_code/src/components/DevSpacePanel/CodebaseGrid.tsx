import { Box, Button, Flex, Text, Grid, VStack } from "@chakra-ui/react";
import { useWorkspaceStore } from "../../store/workspace";
import PanelItem from "./PanelItem";
import { useCodebaseOptions } from "./useCodebaseOptions";
import { usePostMessage } from "../../PostMessageProvider";

export default function CodebaseGrid() {
  const codebasesOptions = useCodebaseOptions();
  const selectedCodebases = useWorkspaceStore((state) => state.selectedCodebases);
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
        代码地图
      </Text>
      <Button
        size="sm"
        variant="link"
        fontSize="14px"
        color="blue.400"
        fontWeight="normal"
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
        + 新建代码地图
      </Button>
    </Flex>
    <VStack
      pr={2}
      align="stretch"
      gap="2"
      minH="80px"
      overflowY="scroll"
    >
      {codebasesOptions.map((item, index) => {
        const active = selectedCodebases.includes(item._id);
        return <PanelItem
          key={index}
          active={selectedCodebases.includes(item._id)}
          onClick={() => {
            // if (selectedCodebases.includes(item._id)) {
            //   setSelectedCodebases(selectedCodebases.filter((id) => id !== item._id));
            // } else {
            //   setSelectedCodebases([...selectedCodebases, item._id]);
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
      点击选中/取消选中，双击打开代码地图
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
      当前研发知识集关联代码地图
    </Text>
  </Grid>
}