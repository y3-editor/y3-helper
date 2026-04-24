import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Text,
  PopoverTrigger,
  Box,
  Flex,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  Icon,
  Link,
  Progress,
  Button,
} from '@chakra-ui/react';
// import { InfoIcon } from '@chakra-ui/icons';
import { getUserDashboard, UseDashboardData } from '../../services/userDashboard';
import { isNumber } from 'lodash';
import { RiWechatLine } from 'react-icons/ri';
import { BiCodeCurly } from 'react-icons/bi';
import { AiOutlineQuestionCircle, AiOutlineWarning } from 'react-icons/ai';
import { usePostMessage } from '../../PostMessageProvider';
import { useChatBillStore } from '../../store/chatBill';


const UserDashboard = (props: { open: boolean; onClose: () => void }) => {
  const { open, onClose } = props;
  const { postMessage } = usePostMessage();
  // const [showMore, setShowMore] = React.useState(false);
  const [data, setData] = React.useState<UseDashboardData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const billLoading = useChatBillStore(state => state.billLoading)
  const monthlyBills = useChatBillStore(state => state.monthlyBills)
  const maxCostPerMonth = useChatBillStore(state => state.maxCostPerMonth)
  const { currentMonth = '-', lastMonth = '-', prevMonth = '-' } = React.useMemo(() => {
    if (!monthlyBills.length) return {}
    return {
      currentMonth: monthlyBills[0].time,
      lastMonth: monthlyBills[1].time,
      prevMonth: monthlyBills[2].time
    };
  }, [monthlyBills]);

  // 设置默认选中当前月份
  const [selectedMonth, setSelectedMonth] = React.useState('');

  React.useEffect(() => {
    setSelectedMonth(currentMonth)
  }, [currentMonth])

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      getUserDashboard()
        .then((data) => {
          if (data) {
            setData(data);
          }
        }).finally(() => {
          setLoading(false);
        })
    }
  }, [open]);



  // 格式化月份显示
  const formatMonthDisplay = React.useCallback((monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    return `${year || '-'}年 ${month || '-'}月`;
  }, []);


  // 获取统计时间范围（往前倒退90天）
  const getTime = React.useCallback((): string => {
    const { last_access_time } = data || {};
    let endDate: Date;

    if (last_access_time) {
      // 如果存在 last_access_time，使用这个时间作为结束时间
      // last_access_time 是秒级时间戳，需要转换为毫秒级
      const timestamp = typeof last_access_time === 'string' ? parseInt(last_access_time, 10) : last_access_time;
      endDate = new Date(timestamp * 1000);

      // 检查日期是否有效
      if (isNaN(endDate.getTime())) {
        // 如果解析失败，使用今天的0点
        endDate = new Date();
        endDate.setHours(0, 0, 0, 0);
      }
    } else {
      // 如果不存在，使用今天的0点作为结束时间
      endDate = new Date();
      endDate.setHours(0, 0, 0, 0);
    }

    // 计算开始时间（往前倒退90天）
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);

    return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
  }, [data]);


  const currentCost = React.useMemo(() => {
    const bill = monthlyBills.find(item => item.time === selectedMonth);
    return bill?.usageCost || 0;
  }, [monthlyBills, selectedMonth]);
  const currentPoints = React.useMemo(() => Math.floor(currentCost * 100), [currentCost]);
  const maxIntegral = React.useMemo(() => Math.floor(maxCostPerMonth * 100), [maxCostPerMonth]);
  const isExceeded = React.useMemo(() => currentPoints > maxIntegral, [currentPoints, maxIntegral]);
  const progressValue = React.useMemo(() => {
    if (maxIntegral <= 0) return 0;
    return Math.min((currentPoints / maxIntegral) * 100, 100);
  }, [currentPoints, maxIntegral]);

  return (
    <>
      <Popover
        placement="top-end"
        isOpen={open}
        onClose={onClose}
        closeOnBlur={false}
      >
        <PopoverTrigger>
          <Box
            position="fixed"
            top="0px"
            right="10px"
            width="1px"
            height="1px"
            opacity={0}
            pointerEvents="none"
          />
        </PopoverTrigger>
        <PopoverContent bg="#1A1A1A" borderColor="#343434" color="white" w="320px" boxShadow={'base'}>
          <PopoverHeader borderBottom="none" pt={4} px={4}>
            <Flex alignItems="center">
              <Box as="span" mr={2} color="blue.400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" />
                </svg>
              </Box>
              <Text fontWeight="bold" fontSize="md">CodeMaker 数据统计</Text>
            </Flex>
          </PopoverHeader>
          <PopoverCloseButton top="12px" color="gray.400" />

          <PopoverBody p={0}>
            <Tabs isFitted variant="unstyled" mt={2}>
              <TabList mx={4} bg="#242525" borderRadius="md" p={1}>
                <Tab
                  _selected={{ bg: '#454545', color: 'white' }}
                  color="gray.400"
                  borderRadius="md"
                  fontSize="sm"
                  py={1}
                >
                  消耗统计
                </Tab>
                <Tab
                  _selected={{ bg: '#454545', color: 'white' }}
                  color="gray.400"
                  borderRadius="md"
                  fontSize="sm"
                  py={1}
                >
                  功能用量
                </Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={6} py={4}>
                  {
                    billLoading ? (
                      <Flex w="full" minH="200px" direction="column" alignItems="center" justifyContent="center">
                        <Spinner />
                        <Text mt="2" color={'gray.400'}>正在为您加载数据，请稍候...</Text>
                      </Flex>
                    ) : (
                      <>
                        <Flex justifyContent="space-between" alignItems="center" mb={4}>
                          <Flex alignItems={'center'} justifyContent={'center'}>
                            <Text fontWeight="bold" fontSize="sm">仓库智聊消耗情况</Text>
                          </Flex>
                          <Select
                            size="sm"
                            w="110px"
                            borderColor="gray.600"
                            value={selectedMonth}
                            style={{ zoom: .9 }}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                          >
                            <option value={currentMonth}>{formatMonthDisplay(currentMonth)}</option>
                            <option value={lastMonth}>{formatMonthDisplay(lastMonth)}</option>
                            <option value={prevMonth}>{formatMonthDisplay(prevMonth)}</option>
                          </Select>
                        </Flex>

                        <Box bg="#2d2e30" borderRadius="md" p={4} mb={4}>
                          <Flex color="gray.400" fontSize="sm" mb={2}>
                            截止当月累计消耗
                            <ConsumeTenkenTip className='mb-1' />
                          </Flex>
                          <Flex alignItems="baseline" mb={3} flexWrap={'wrap'}>
                            <Text fontSize="xl" fontWeight="bold" mr={2}>
                              {billLoading ? '-' : currentPoints.toLocaleString()} 积分
                            </Text>
                            <Text color="gray.500" fontSize="sm">({billLoading ? '-' : currentCost.toFixed(1)} 元)</Text>
                          </Flex>

                          <Progress
                            value={progressValue}
                            size="sm"
                            colorScheme="blue"
                            borderRadius="full"
                            bg="gray.600"
                            mb={2}
                            sx={{
                              '& > div': {
                                backgroundColor: 'blue.400'
                              }
                            }}
                          />

                          <Flex justifyContent="space-between" alignItems="center" fontSize="xs">
                            <Flex alignItems="center" visibility={isExceeded ? 'visible' : 'hidden'}>
                              <Icon as={AiOutlineWarning} color="blue.400" mr={1} />
                              <Text color="blue.300">已超出限额</Text>
                            </Flex>
                            <Text color="gray.500">
                              {currentPoints.toLocaleString()}/{maxIntegral.toLocaleString()} 积分
                            </Text>
                          </Flex>
                        </Box>
                        {
                          (
                            <Box color={'gray.500'} fontSize={'small'} style={{ zoom: .92 }}>
                              若因工作需要提升积分额度，可参阅
                              <Button
                                size="sm"
                                variant="link"
                                color="blue.600"
                                fontWeight="600"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  postMessage({
                                    type: "OPEN_IN_BROWSER",
                                    data: { url: `https://g.126.fm/01ePpyp` },
                                  });
                                }}
                                _hover={{ textDecoration: 'none', opacity: 0.8 }}
                              >
                                《积分申请》
                              </Button>
                            </Box>
                          )
                        }
                      </>
                    )
                  }
                </TabPanel>
                <TabPanel px={6} py={4}>
                  <Text color="gray.400" fontSize="sm" mb={1}>
                    近 3 个月你的 CodeMaker 用量为：
                  </Text>
                  <Text color="gray.400" fontSize="sm" mb={4}>
                    {getTime()}
                  </Text>
                  {loading ? (
                    <Flex w="full" minH="200px" direction="column" alignItems="center" justifyContent="center">
                      <Spinner />
                      <Text mt="2" color={'gray.400'}>正在为您加载数据，请稍候...</Text>
                    </Flex>
                  ) : (
                    <>
                      <Box mb="4">
                        <Flex alignItems="center" mb={2}>
                          <Text color="#50A9DE"><BiCodeCurly /></Text>
                          <Text fontWeight="bold">【代码补全】</Text>
                        </Flex>
                        <Box ml="6" fontSize="sm" color="gray.300">
                          <Flex justifyContent="space-between" mb={1}>
                            <Text>• 累计使用天数：</Text>
                            <Text>{data?.complete_use_days || 0}天</Text>
                          </Flex>
                          <Flex justifyContent="space-between" mb={1}>
                            <Text>• 累计采纳代码次数：</Text>
                            <Text>{data?.complete_accept_nums || 0}次</Text>
                          </Flex>
                          <Flex justifyContent="space-between">
                            <Text>• 代码补全接受率：</Text>
                            <Text>
                              {isNumber(data?.complete_accept_ratio)
                                ? (data?.complete_accept_ratio * 100).toFixed(2)
                                : 0}
                              %
                            </Text>
                          </Flex>
                        </Box>
                      </Box>

                      <Box mb="4">
                        <Flex alignItems="center" mb={2}>
                          <Text color="blue.300"><RiWechatLine color="blue.300" size={16} /></Text>
                          <Text fontWeight="bold">【仓库智聊】</Text>
                        </Flex>
                        <Box ml="6" fontSize="sm" color="gray.300">
                          <Flex justifyContent="space-between" mb={1}>
                            <Text>• 聊天次数：</Text>
                            <Text>{data?.gitchat_total || 0}次</Text>
                          </Flex>
                          <Flex justifyContent="space-between">
                            <Text>• 生成与应用代码行数：</Text>
                            <Text>{data?.gitchat_generate_lines || 0}行</Text>
                          </Flex>
                        </Box>
                      </Box>

                      <Box mb="2">
                        <Flex alignItems="center" mb={2}>
                          <Icon viewBox="0 0 24 24" color="green.300">
                            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                          </Icon>
                          <Text fontWeight="bold">【Local AI Review】</Text>
                        </Flex>
                        <Box ml="6" fontSize="sm" color="gray.300">
                          <Flex justifyContent="space-between" mb={1}>
                            <Text>• 发起 AI Review 次数：</Text>
                            <Text>{data?.localreview_start_nums || 0}次</Text>
                          </Flex>
                          <Flex justifyContent="space-between">
                            <Text>• 反馈有效/无效问题个数：</Text>
                            <Text>{data?.localreview_post_issue_nums || 0}个</Text>
                          </Flex>
                        </Box>
                      </Box>
                    </>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default UserDashboard;


export const ConsumeTenkenTip = ({
  className,
}: {
  className?: string;
}) => {
  const { postMessage } = usePostMessage();
  const QAGroup = React.useMemo(() => ([
    {
      title: '什么是积分？',
      content: '积分是AIGW用于统一模型消耗的统一单位，1积分等于0.01元，具体可用Token数与所选模型单价相关。'
    },
    {
      title: '为什么展示积分？',
      content: '近期发现部分用户无节制的使用CodeMaker，产生了超出正常使用的成本，也影响到其他人使用。为了量化每个会话资源消耗，方便CodeMaker团队分析成本构成，推进技术优化，我们将消耗Token数升级为积分数，并给出实际成本消耗预估。'
    },
    {
      title: '私有模型也算积分吗？',
      content: '私有部署也是要服务器的，目前我们用的有道的私有部署服务，单价由有道来定。',
    },
    {
      title: '后续CodeMaker是否会收费，面向团队或是个人？',
      content: '不会面向个人收费，具体分摊方案还在制定中。',
    },
    {
      title: '如何高效使用？',
      content: (
        <>
          <Text mb={1}>* 按需选模型（省流）： 不同模型成本差异巨大。对于翻译、简单润色等任务，推荐使用高性价比模型（如 Claude Haiku）。</Text>
          <Text mb={1}>* 及时开启新对话（提速）： 避免在一个会话中无限追加提问。历史记录过长不仅消耗成倍的 Token，还会影响模型响应速度。开启新会话，从头开始更高效。</Text>
          <Text>* 优化提示词（精准）： 尽量一次性给出清晰、完整的指令和背景信息，减少反复纠偏造成的额度浪费。</Text>
        </>
      )
    },
    {
      title: '哪个模型最便宜？各模型单价在哪看？',
      content: (
        <>
          <Link
            color="blue.300"
            px="1"
            onClick={() => {
              postMessage({
                type: 'OPEN_IN_BROWSER',
                data: {
                  url: 'https://modelspace.netease.com/model_app',
                },
              });
            }}
          >
            模型详细介绍
          </Link>
          (费用 = 模型单价 * tokens)
        </>
      )
    }
  ]), [postMessage])

  return (
    <Box className={className}>
      <Popover placement="top-start" trigger="hover" openDelay={0} closeDelay={200}>
        <PopoverTrigger>
          <Box ml={1}>
            <Icon as={AiOutlineQuestionCircle} size="sm" />
          </Box>
        </PopoverTrigger>
        <PopoverContent
          boxShadow="xl"
          minWidth={"320px"}
          _focus={{ boxShadow: "xl" }}
          borderRadius="lg"
        >
          <PopoverBody px={4} py={2}>
            <Box className='space-y-4'>
              {QAGroup.map((group, index) => (
                <Box key={group.title + index}>
                  <Box fontWeight={'bold'} mb={1}>
                    {index + 1}. {group.title}
                  </Box>
                  <Box>{group.content}</Box>
                </Box>
              ))}
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover >
    </Box>
  )
}
