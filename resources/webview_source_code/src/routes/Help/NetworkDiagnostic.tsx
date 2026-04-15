import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
} from '@chakra-ui/icons';
import { Box, Button, Collapse, Flex, Spinner, Text } from '@chakra-ui/react';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { usePostMessage } from '../../PostMessageProvider';

// 网络类型分类
enum NetworkType {
  OFFICE = 'office', // 办公网地址
  IDC = 'idc', // IDC 地址（公司网络）
  INTERNET = 'internet', // 外网地址
}

// 测试 URL 配置
const TEST_TARGETS = [
  {
    url: 'http://localhost:3001',
    type: NetworkType.OFFICE,
  },
  {
    url: 'http://localhost:3001',
    type: NetworkType.OFFICE,
  },
  {
    url: 'http://localhost:3001',
    type: NetworkType.OFFICE,
  },
  {
    url: 'http://localhost:3001',
    type: NetworkType.OFFICE,
  },
  {
    url: 'http://localhost:3001',
    type: NetworkType.IDC,
  },
  {
    url: 'http://localhost:3001',
    type: NetworkType.INTERNET,
  },
];

interface DNSResult {
  domain: string;
  success: boolean;
  ip?: string;
  time: number;
  error?: string;
  nslookup?: NslookupResult;
}

interface NslookupResult {
  success: boolean;
  server?: string;
  output?: string;
  error?: string;
}

interface TCPResult {
  domain: string;
  port: number;
  success: boolean;
  time: number;
  error?: string;
}

interface PingResult {
  domain: string;
  success: boolean;
  avgLatency?: number;
  packetLoss?: number;
  error?: string;
}

interface HTTPResult {
  url: string;
  success: boolean;
  statusCode?: number;
  time: number;
  error?: string;
}

interface TaskState {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  summary?: string;
  logs: string[];
  expanded: boolean;
  results?: {
    dns?: DNSResult[];
    tcp?: TCPResult[];
    ping?: PingResult[];
    http?: HTTPResult[];
    curl?: HTTPResult[];
    ip?: string;
  };
}

const INIT_TASKS: TaskState[] = [
  { id: 'ip', name: 'IP', status: 'pending', logs: [], expanded: false },
  { id: 'dns', name: 'DNS', status: 'pending', logs: [], expanded: false },
  { id: 'tcp', name: 'TCP', status: 'pending', logs: [], expanded: false },
  { id: 'ping', name: 'Ping', status: 'pending', logs: [], expanded: false },
  { id: 'http', name: 'HTTP', status: 'pending', logs: [], expanded: false },
  { id: 'curl', name: 'Curl', status: 'pending', logs: [], expanded: false },
];

// 域名/URL 网络类型映射
const NETWORK_TYPE_MAP: Record<string, NetworkType> = {
  'office-code-maker.localhost': NetworkType.OFFICE,
  'devcloud-office.localhost': NetworkType.OFFICE,
  'api-code-maker.localhost': NetworkType.IDC,
  'sigma-tracker-dep305.proxima.localhost': NetworkType.INTERNET,
};

// 从 URL 或域名中提取主机名
const extractHostname = (urlOrDomain: string): string => {
  try {
    // 如果是完整的 URL
    if (
      urlOrDomain.startsWith('http://') ||
      urlOrDomain.startsWith('https://')
    ) {
      return new URL(urlOrDomain).hostname;
    }
    // 如果已经是域名（可能包含端口）
    return urlOrDomain.split(':')[0];
  } catch {
    return urlOrDomain.split(':')[0];
  }
};

// 获取网络类型
const getNetworkType = (urlOrDomain: string): NetworkType | undefined => {
  const hostname = extractHostname(urlOrDomain);
  return NETWORK_TYPE_MAP[hostname];
};

// 判断 IP 是否为办公网地址（暂定为 115）
const isOfficeIP = (ip: string): boolean => {
  return ip.startsWith('115.') || ip.startsWith('42.');
};

// 智能生成单个测试项的 summary
const generateTaskSummary = (task: TaskState): string => {
  const { id, status, results, summary } = task;

  // 特殊处理 IP 检测
  if (id === 'ip') {
    if (status === 'success' && results?.ip) {
      // 检测成功，显示 IP 地址并分类
      const classification = isOfficeIP(results.ip) ? '正常' : '外网';
      return `${results.ip} (${classification})`;
    }
    return '检测失败';
  }

  // 如果全部成功，返回"正常"
  if (status === 'success') {
    return '正常';
  }

  if (!results) {
    return '检测失败';
  }

  // 根据不同的任务类型提取失败列表
  let failedItems: string[] = [];

  if (id === 'dns' && results.dns) {
    failedItems = results.dns.filter((r) => !r.success).map((r) => r.domain);
  } else if (id === 'tcp' && results.tcp) {
    failedItems = results.tcp
      .filter((r) => !r.success)
      .map((r) => `${r.domain}:${r.port}`);
  } else if (id === 'ping' && results.ping) {
    failedItems = results.ping.filter((r) => !r.success).map((r) => r.domain);
  } else if (id === 'http' && results.http) {
    failedItems = results.http.filter((r) => !r.success).map((r) => r.url);
  } else if (id === 'curl' && results.curl) {
    failedItems = results.curl.filter((r) => !r.success).map((r) => r.url);
  }

  // 按网络类型分类失败项
  const failedByType: Record<NetworkType, string[]> = {
    [NetworkType.OFFICE]: [],
    [NetworkType.IDC]: [],
    [NetworkType.INTERNET]: [],
  };

  failedItems.forEach((item) => {
    const networkType = getNetworkType(item);
    if (networkType) {
      failedByType[networkType].push(item);
    }
  });

  const hasOfficeFailed = failedByType[NetworkType.OFFICE].length > 0;
  const hasIdcFailed = failedByType[NetworkType.IDC].length > 0;
  const hasInternetFailed = failedByType[NetworkType.INTERNET].length > 0;

  // 生成简洁的失败描述
  const failedTypes: string[] = [];
  if (hasOfficeFailed) failedTypes.push('办公网');
  if (hasIdcFailed) failedTypes.push('IDC');
  if (hasInternetFailed) failedTypes.push('外网');

  if (failedTypes.length === 3) {
    return '请求全部失败';
  } else if (failedTypes.length > 0) {
    return `请求${failedTypes.join('、')}失败`;
  }

  // 兜底：显示原始 summary
  return summary || '部分失败';
};

// 智能生成总体诊断建议（仅在有问题时返回建议文本，正常时返回空）
const generateDiagnosticSuggestion = (tasks: TaskState[]): string => {
  // 收集各个测试任务的状态
  const pingTask = tasks.find((t) => t.id === 'ping');
  const httpTask = tasks.find((t) => t.id === 'http');
  const curlTask = tasks.find((t) => t.id === 'curl');
  const dnsTask = tasks.find((t) => t.id === 'dns');
  const tcpTask = tasks.find((t) => t.id === 'tcp');

  // 收集所有失败的域名/URL
  const allFailedItems: string[] = [];

  tasks.forEach((task) => {
    if (task.results) {
      if (task.results.dns) {
        allFailedItems.push(
          ...task.results.dns.filter((r) => !r.success).map((r) => r.domain),
        );
      }
      if (task.results.tcp) {
        allFailedItems.push(
          ...task.results.tcp
            .filter((r) => !r.success)
            .map((r) => `${r.domain}:${r.port}`),
        );
      }
      if (task.results.ping) {
        allFailedItems.push(
          ...task.results.ping.filter((r) => !r.success).map((r) => r.domain),
        );
      }
      if (task.results.http) {
        allFailedItems.push(
          ...task.results.http.filter((r) => !r.success).map((r) => r.url),
        );
      }
      if (task.results.curl) {
        allFailedItems.push(
          ...task.results.curl.filter((r) => !r.success).map((r) => r.url),
        );
      }
    }
  });

  // 如果没有失败项，返回空字符串（不显示总结）
  if (allFailedItems.length === 0) {
    return '';
  }

  // 获取各测试的状态
  const pingSuccess = pingTask?.status === 'success';
  const httpFailed = httpTask?.status === 'failed';
  const curlFailed = curlTask?.status === 'failed';
  const curlSuccess = curlTask?.status === 'success';
  const dnsSuccess = dnsTask?.status === 'success';
  const tcpSuccess = tcpTask?.status === 'success';

  // 优先级 1: Curl 通但 HTTP 不通 - VSCode/Electron 层面的限制
  if (curlSuccess && httpFailed) {
    return '系统网络正常，但 VSCode 进程网络受限，请检查 VSCode 代理、防火墙应用、安全软件等配置或重启 VSCode 再试';
  }

  // 优先级 2: Ping 通但 HTTP 和 Curl 都不通 - 可能是应用层被拦截
  if (pingSuccess && httpFailed && curlFailed) {
    // DNS 和 TCP 也正常，但 HTTP/Curl 都不通，很可能是应用层被拦截
    if (dnsSuccess && tcpSuccess) {
      return '网络连接正常，但 HTTP 请求被拦截，请检查防火墙、安全软件或代理设置';
    }
    // Ping 通但 HTTP/Curl 不通
    return '网络连接不稳定，请检查防火墙、安全软件或代理设置';
  }

  // 优先级 3: 按网络类型分类失败项
  const failedByType: Record<NetworkType, string[]> = {
    [NetworkType.OFFICE]: [],
    [NetworkType.IDC]: [],
    [NetworkType.INTERNET]: [],
  };

  allFailedItems.forEach((item) => {
    const networkType = getNetworkType(item);
    if (networkType) {
      failedByType[networkType].push(item);
    }
  });

  const hasOfficeFailed = failedByType[NetworkType.OFFICE].length > 0;
  const hasIdcFailed = failedByType[NetworkType.IDC].length > 0;
  const hasInternetFailed = failedByType[NetworkType.INTERNET].length > 0;

  // 场景 1: 只有办公网地址失败
  if (hasOfficeFailed && !hasIdcFailed && !hasInternetFailed) {
    return '请连接办公网或启用 VPN';
  }

  // 场景 2: 办公网和 IDC 都失败，但外网正常
  if (hasOfficeFailed && hasIdcFailed && !hasInternetFailed) {
    return '请连接办公网或启用 VPN，并检查代理配置是否正确';
  }

  // 场景 3: 全部失败
  if (hasOfficeFailed && hasIdcFailed && hasInternetFailed) {
    return '网络异常，请检查网络连接';
  }

  // 场景 4: 只有 IDC 失败
  if (!hasOfficeFailed && hasIdcFailed && !hasInternetFailed) {
    return '公司网络访问异常';
  }

  // 场景 5: 只有外网失败
  if (!hasOfficeFailed && !hasIdcFailed && hasInternetFailed) {
    return '外网访问异常';
  }

  // 默认返回部分失败提示
  return '部分网络连接异常，请查看详细日志';
};

const NetworkDiagnostic: React.FC = () => {
  const { postMessage } = usePostMessage();
  const [isDetecting, setIsDetecting] = useState(false);
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'NETWORK_DIAGNOSTIC_PROGRESS') {
        updateTaskProgress(message.value);
      } else if (message.type === 'NETWORK_DIAGNOSTIC_COMPLETE') {
        setIsDetecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateTaskProgress = (progress: any) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === progress.taskType.toLowerCase()) {
          const updatedTask = {
            ...task,
            status: progress.status,
            logs: progress.log ? [...task.logs, progress.log] : task.logs,
            results: progress.results || task.results,
          };

          // 使用智能 summary 生成逻辑（仅对最终状态生成）
          if (progress.status === 'success' || progress.status === 'failed') {
            updatedTask.summary = generateTaskSummary(updatedTask);
          } else {
            // 运行中状态保持原来的 summary
            updatedTask.summary = progress.summary || task.summary;
          }

          return updatedTask;
        }
        return task;
      }),
    );
  };

  const startDiagnostic = () => {
    setIsDetecting(true);
    setHasStarted(true);
    setTasks(_.cloneDeep(INIT_TASKS));
    postMessage({
      type: 'START_NETWORK_DIAGNOSTIC',
      value: {
        testTargets: TEST_TARGETS,
      },
    });
  };

  const toggleExpanded = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, expanded: !task.expanded } : task,
      ),
    );
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Spinner w="12px" h="12px" color="blue.500" />;
      case 'success':
        return <CheckIcon w="12px" h="12px" color="blue.500" />;
      case 'failed':
        return (
          <CloseIcon w="12px" h="12px" color="var(--chakra-colors-red-500)" />
        );
      default:
        return (
          <Box
            w="16px"
            h="16px"
            borderRadius="full"
            border="2px solid"
            borderColor="gray.300"
          />
        );
    }
  };

  // 计算总体诊断建议
  const diagnosticSuggestion = generateDiagnosticSuggestion(tasks);

  return (
    <Box my="6">
      <Flex mb="4" align="center" justify="space-between" h="28px">
        <Flex align="center">
          <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
            网络诊断
          </Text>
          <Text>检查 Y3Maker 后端服务的网络连接</Text>
        </Flex>

        <Button
          color="white"
          colorScheme="blue.300"
          bg="blue.300"
          h="28px"
          fontSize="12px"
          borderRadius="16px"
          isDisabled={isDetecting}
          onClick={startDiagnostic}
        >
          开始检测
          {isDetecting && <Spinner size="sm" ml="2" />}
        </Button>
      </Flex>

      {hasStarted && (
        <>
          {/* 诊断建议总结 - 仅在有问题时显示 */}
          {diagnosticSuggestion && (
            <Flex
              mb="4"
              p="2"
              bg="orange.50"
              _dark={{ bg: 'orange.900' }}
              borderRadius="md"
              borderLeft="4px solid"
              borderColor="orange.400"
              align="center"
              gap="2"
            >
              <Box
                fontSize="14px"
                color="orange.500"
                _dark={{ color: 'orange.300' }}
              >
                💡
              </Box>
              <Box flex="1">
                <Text
                  fontSize="sm"
                  color="orange.700"
                  _dark={{ color: 'orange.300' }}
                >
                  {diagnosticSuggestion}
                </Text>
              </Box>
            </Flex>
          )}

          <Flex
            direction="column"
            py="2"
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
          >
            {tasks.map((task) => (
              <Box key={task.id}>
                <Flex
                  justify="space-between"
                  px="4"
                  py="2"
                  flexWrap="wrap"
                  cursor="pointer"
                  onClick={() => toggleExpanded(task.id)}
                >
                  <Flex align="center" gap="3">
                    {renderStatusIcon(task.status)}

                    <Text fontWeight="medium" _dark={{ color: 'gray.100' }}>
                      {task.name}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="3">
                    {task.summary && (
                      <Text
                        fontSize="sm"
                        color="gray.500"
                        _dark={{ color: 'gray.400' }}
                      >
                        {task.summary}
                      </Text>
                    )}

                    {task.logs.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        p="1"
                        minW="auto"
                        h="auto"
                      >
                        {task.expanded ? (
                          <ChevronDownIcon boxSize={5} />
                        ) : (
                          <ChevronRightIcon boxSize={5} />
                        )}
                      </Button>
                    )}
                  </Flex>
                </Flex>

                <Collapse in={task.expanded} animateOpacity>
                  {task.logs.length > 0 && (
                    <Box px="4" pb="4">
                      <Box
                        maxH="48"
                        overflowY="auto"
                        p="3"
                        bg="gray.900"
                        color="gray.100"
                        borderRadius="md"
                        fontSize="xs"
                        fontFamily="monospace"
                      >
                        {task.logs.map((log, index) => (
                          <Box key={index} mb="1">
                            {log}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Collapse>
              </Box>
            ))}
          </Flex>
        </>
      )}
    </Box>
  );
};

export default NetworkDiagnostic;
