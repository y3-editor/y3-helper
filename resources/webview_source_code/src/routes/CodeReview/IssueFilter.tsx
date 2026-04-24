import { Box, FormControl, FormLabel, useOutsideClick } from '@chakra-ui/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './teamReview.module.scss';
import { AuthUser } from '../../store/auth';
import { Select } from 'chakra-react-select';
import { NO_LABEL_TITLE, NO_POSITIVE } from './TeamReview';
import { proxyRequest } from '../../services/common';
import { TEAM_REVIEW_API_URL } from './const';
import _ from 'lodash';

interface FileFilter {
  include_patterns: string[];
  exclude_patterns: string[];
  languages: string[];
  file_extensions: string[];
  max_file_size: number | null;
}

interface PromptSection {
  key: string;
  name: string;
  content: string;
  required: boolean;
  locked: boolean;
  order: number;
}
interface DiffReviewConfig {
  codemaker_url: string | null;
  agent_timeout: number;
  plan_mode: boolean;
  system_prompt_sections: PromptSection[];
  user_prompt_sections: PromptSection[];
  basic_mode: boolean;
}

interface ReviewAgent {
  _id: string;
  project: string;
  name: string;
  description: string;
  specialized_type: string;
  version: string;
  author: string | null;
  review_scope: string;
  min_confidence: number;
  severity: string | null;
  default_model: string | null;
  output_locale: string;
  file_filter: FileFilter;
  model_configs: any | null;
  enable: number;
  addresses: string[];
  file_review_config: any | null;
  diff_review_config: DiffReviewConfig | null;
  creator: {
    name: string;
    fullname: string;
  };
  editor: {
    name: string;
    fullname: string;
  };
  create_time: number;
  update_time: number;
}
interface GroupValue {
  label: string;
  value: string;
}

export interface IssueFilterState {
  assignees: string[];
  authors: string[];
  status: string;
  positive: string[] | boolean[];
  labels: string[];
  aiIssueTypes: string[];
  aiIssueSeverities: string[];
  aiReviewAgents: string[];
}

export const STATUS_OPTIONS = [
  {
    label: 'Open',
    value: 'open',
  },
  {
    label: 'Ignore',
    value: 'ignore',
  },
  {
    label: 'Closed',
    value: 'closed',
  },
  {
    label: 'Invalid',
    value: 'invalid',
  },
];

const POSITIVE_OPTIONS = [
  {
    label: NO_POSITIVE,
    value: NO_POSITIVE,
  },
  {
    label: '有效',
    value: true,
  },
  {
    label: '无效',
    value: false,
  },
];

const AI_ISSUE_TYPE_OPTIONS = [
  {
    label: '安全',
    value: 'security',
  },
  {
    label: '代码异味',
    value: 'code_smell',
  },
  {
    label: 'BUG',
    value: 'bug',
  },
];

const AI_ISSUE_SEVERITY_OPTIONS = [
  {
    label: '严重',
    value: 'critical',
  },
  {
    label: '警告',
    value: 'warning',
  },
  {
    label: '建议',
    value: 'suggestion',
  },
];

interface IProps {
  visible: boolean;
  repo: string;
  address: string;
  project: string;
  onClose: () => void;
  onChange?: (val: IssueFilterState) => void;
  shouldShowAIFilters: boolean;
  repoConfig: any;
}

const IssueFilter = forwardRef(
  (
    { visible, repo, project, onChange, onClose, shouldShowAIFilters, repoConfig, address }: IProps,
    eRef,
  ) => {
    const ref = useRef<HTMLDivElement>(null);
    const [userList, setUserList] = useState<AuthUser[]>([]);
    const [loadingUser, setLoadingUser] = useState(false);

    const [assignees, setAssignees] = useState<
      GroupValue[] | undefined | null
    >();
    const [assigneeSearchKey, setAssigneeSearchKey] = useState<string>('');
    const [authors, setAuthors] = useState<GroupValue[] | undefined | null>();
    const [authorSearchKey, setAuthorSearchKey] = useState<string>('');
    const [issueState, setIssueState] = useState<
      GroupValue | undefined | null
    >();
    const [labelList, setLabelList] = useState<string[]>([]);
    const [positives, setPositives] = useState<
      GroupValue[] | undefined | null
    >();
    const [labels, setLabels] = useState<GroupValue[] | undefined | null>();
    const [loadingLabel, setLoadingLabel] = useState(false);
    const [aiIssueTypes, setAiIssueTypes] = useState<
      GroupValue[] | undefined | null
    >();
    const [aiIssueSeverities, setAiIssueSeverities] = useState<
      GroupValue[] | undefined | null
    >();
    const [aiReviewAgents, setAiReviewAgents] = useState<GroupValue[] | undefined | null>();
    const [specAgentConfig, setSpecAgentConfig] = useState<ReviewAgent[]>([]);

    useImperativeHandle(eRef, () => ({
      reset: () => {
        setAssignees(null);
        setAuthors(null);
        setIssueState(null);
        setPositives(null);
        setLabels(null);
        setAiIssueTypes(null);
        setAiIssueSeverities(null);
      },
    }));

    useOutsideClick({
      ref: ref,
      handler: onClose,
    });

    useEffect(() => {
      getLabelList(repo, project);
      getUserList(repo, project);
      getSpecReviewAgentsConfig(project);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, project]);

    const getLabelList = useCallback(async (repo: string, project?: string) => {
      if (!repo) {
        setLabelList([NO_LABEL_TITLE]);
        return;
      }

      const requestData: Record<string, any> = { svnUrl: repo };
      if (project) {
        requestData.project = project;
      }

      try {
        setLoadingLabel(true);
        const config = await proxyRequest(
          {
            requestUrl: `${TEAM_REVIEW_API_URL}/review_requests/labels/query`,
            requestData,
          },
          60000,
          true,
        );
        const labels =
          _.map(_.get(config, 'labels'), (item: any) => item.title) || [];
        setLabelList([NO_LABEL_TITLE, ...labels]);
      } catch (error) {
        setLabelList([NO_LABEL_TITLE]);
      } finally {
        setLoadingLabel(false);
      }
    }, []);

    const getUserList = useCallback(async (repo: string, project?: string) => {
      if (!repo) {
        setUserList([]);
        return;
      }
      const requestData: Record<string, any> = { svnUrl: repo };
      if (project) {
        requestData.project = project;
      }
      try {
        setLoadingUser(true);
        const res = await proxyRequest(
          {
            method: 'post',
            requestUrl: `${TEAM_REVIEW_API_URL}/review_requests/reviewers/query`,
            requestData,
          },
          60000,
          true,
        );
        setUserList(_.get(res, 'items') || []);
      } catch (error) {
        setUserList([]);
      } finally {
        setLoadingUser(false);
      }
    }, []);

    const getSpecReviewAgentsConfig = useCallback(async (project: string) => {
      try {
        if (!project) return;
        const res = await proxyRequest(
          {
            method: 'get',
            requestUrl: `${TEAM_REVIEW_API_URL}/spec_review_agents?_num=-1`,
            requestHeaders: {
              'x-Auth-Project': project,
            }
          },
          60000,
          true,
        )
        const config = _.get(res, 'items', []);
        setSpecAgentConfig(config);
      } catch (error) {
        console.error(error);
      }
    }, []);

    const assigneeOptions = useMemo(() => {
      const key = assigneeSearchKey.trim().toLocaleLowerCase();
      return userList
        .filter((item) => {
          return (
            item.name?.toLocaleLowerCase().includes(key) ||
            item.fullname?.toLocaleLowerCase().includes(key)
          );
        })
        .map((item) => {
          return {
            label: `${item.fullname}(${item.name})`,
            value: item.name,
          };
        })
        .slice(0, 10);
    }, [userList, assigneeSearchKey]);

    const authorOptions = useMemo(() => {
      const key = authorSearchKey.trim().toLocaleLowerCase();
      const options = userList
        .filter((item) => {
          return (
            item.name?.toLocaleLowerCase().includes(key) ||
            item.fullname?.toLocaleLowerCase().includes(key)
          );
        })
        .map((item) => {
          return {
            label: `${item.fullname}(${item.name})`,
            value: item.name,
          };
        });

      if ('AI Reviewer'.toLocaleLowerCase().includes(key)) {
        options.push({
          label: 'AI Reviewer',
          value: 'AI_REVIEWER',
        });
      }
      return options.slice(0, 10);
    }, [userList, authorSearchKey]);

    const labelOptions = useMemo(() => {
      return _.map(labelList, (item) => {
        return {
          label: item,
          value: item,
        };
      });
    }, [labelList]);

    const aiReviewAgentOptions = useMemo(() => {
      const baseData = _.get(repoConfig, 'ai_review_specialized_info', []);
      const safeBaseData = Array.isArray(baseData) ? baseData : [];
      const specAgentData = _.filter(specAgentConfig, (config: ReviewAgent) => config.addresses.includes(address))
        .map((agent: ReviewAgent) => {
          const isEnable = _.get(agent, 'enable', 0) === 1 ? true : false; // 1 启用 0 禁用 2 草稿
          return {
            name: _.get(agent, 'specialized_type', ''),
            enabled: isEnable,
          }
        }) || [];

      return [...safeBaseData, ...specAgentData].filter((option) => option.enabled).map((option) => ({ value: option.name, label: option.name }));
    }, [address, repoConfig, specAgentConfig]);

    useEffect(() => {
      onChange?.({
        assignees: _.map(assignees, (item) => item.value),
        authors: _.map(authors, (item) => item.value),
        status: issueState?.value || '',
        positive: _.map(positives as any, (item) => item.value),
        labels: _.map(labels, (label) => label.value),
        aiIssueTypes: _.map(aiIssueTypes, (item) => item.value),
        aiIssueSeverities: _.map(aiIssueSeverities, (item) => item.value),
        aiReviewAgents: _.map(aiReviewAgents, (item) => item.value),
      });
    }, [
      onChange,
      assignees,
      issueState,
      labels,
      authors,
      positives,
      aiIssueTypes,
      aiIssueSeverities,
      aiReviewAgents,
    ]);

    return (
      <Box
        className={`${styles['issue-filter']} rounded ${!visible ? 'overflow-hidden' : ''
          }`}
        {...(!visible
          ? { style: { height: '0', padding: '0', border: 'none' } }
          : {})}
        onClick={(e) => {
          e.stopPropagation();
        }}
        ref={ref}
        //   onKeyDown={onKeyDown}
        bg="themeBgColor"
      >
        <FormControl>
          <FormLabel>Assignee</FormLabel>
          <Select
            value={assignees}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            isMulti
            onChange={(val) => {
              setAssignees(val as GroupValue[]);
            }}
            onInputChange={(val) => {
              setAssigneeSearchKey(val);
            }}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            size="sm"
            placeholder="请选择或搜索用户"
            options={assigneeOptions}
            noOptionsMessage={({ inputValue }) => {
              if (inputValue) {
                return '未搜索到用户';
              } else {
                return '请输入邮箱前缀搜索用户';
              }
            }}
            isLoading={loadingUser}
            isClearable
          />
        </FormControl>
        <FormControl className="mt-3">
          <FormLabel>Issue 创建人</FormLabel>
          <Select
            value={authors}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onChange={(val) => {
              setAuthors(val as GroupValue[]);
            }}
            onInputChange={(val) => {
              setAuthorSearchKey(val);
            }}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            isMulti
            size="sm"
            placeholder="请选择或搜索用户"
            options={authorOptions}
            noOptionsMessage={({ inputValue }) => {
              if (inputValue) {
                return '未搜索到用户';
              } else {
                return '请输入邮箱前缀搜索用户';
              }
            }}
            isLoading={loadingUser}
            isClearable
          />
        </FormControl>
        <FormControl className="mt-3">
          <FormLabel>Issue 状态</FormLabel>
          <Select
            onFocus={(e) => e.stopPropagation()}
            value={issueState}
            onChange={(val) => {
              setIssueState(val as GroupValue);
            }}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            size="sm"
            placeholder="请选择Issue状态"
            options={STATUS_OPTIONS}
            isClearable
          />
        </FormControl>
        <FormControl className="mt-3">
          <FormLabel>Issue 标签</FormLabel>
          <Select
            onFocus={(e) => e.stopPropagation()}
            value={labels}
            onChange={(val) => {
              setLabels(val as GroupValue[]);
            }}
            isMulti
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            size="sm"
            placeholder="请选择Issue标签"
            options={labelOptions}
            isClearable
            isLoading={loadingLabel}
          />
        </FormControl>
        <FormControl className="mt-3">
          <FormLabel>Issue 有效性</FormLabel>
          <Select
            onFocus={(e) => e.stopPropagation()}
            value={positives}
            onChange={(val) => {
              setPositives(val as GroupValue[]);
            }}
            isMulti
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            size="sm"
            placeholder="请选择Issue有效性"
            options={POSITIVE_OPTIONS as any}
            isClearable
          />
        </FormControl>
        {shouldShowAIFilters && (
          <>
            <FormControl className="mt-3">
              <FormLabel>
                AI Issue等级
                <span className="pl-2 text-[#8e8e8e] text-sm">
                  仅对AI Issue生效
                </span>
              </FormLabel>
              <Select
                onFocus={(e) => e.stopPropagation()}
                value={aiIssueSeverities}
                onChange={(val) => {
                  setAiIssueSeverities(val as GroupValue[]);
                }}
                isMulti
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                size="sm"
                placeholder="请选择Issue等级"
                options={AI_ISSUE_SEVERITY_OPTIONS}
                isClearable
              />
            </FormControl>
            <FormControl className="mt-3">
              <FormLabel>
                AI Issue类型
                <span className="pl-2 text-[#8e8e8e] text-sm">
                  仅对AI Issue生效
                </span>
              </FormLabel>
              <Select
                onFocus={(e) => e.stopPropagation()}
                value={aiIssueTypes}
                onChange={(val) => {
                  setAiIssueTypes(val as GroupValue[]);
                }}
                isMulti
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                size="sm"
                placeholder="请选择Issue类型"
                options={AI_ISSUE_TYPE_OPTIONS}
                isClearable
              />
            </FormControl>
            <FormControl className="mt-3">
              <FormLabel>
                AI Review Agent
                <span className="pl-2 text-[#8e8e8e] text-sm">
                  仅对AI Issue生效
                </span>
              </FormLabel>
              <Select
                onFocus={(e) => e.stopPropagation()}
                value={aiReviewAgents}
                onChange={(val) => {
                  setAiReviewAgents(val as GroupValue[]);
                }}
                isMulti
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                size="sm"
                placeholder="请选择Agent"
                options={aiReviewAgentOptions}
                isClearable
              />
            </FormControl>
          </>
        )}
      </Box>
    );
  },
);

export default IssueFilter;
