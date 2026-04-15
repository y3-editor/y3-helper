import React from 'react';
import { Box, Flex, Grid, Icon, Text, useMediaQuery } from '@chakra-ui/react';
import { MultiValue, Select } from 'chakra-react-select';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../../../PostMessageProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import { ChatMask, VariableType, useMaskStore } from '../../../store/mask';
import { IDE, useExtensionStore } from '../../../store/extension';
import { RiArrowDownSLine } from 'react-icons/ri';
import CodebaseSelect from '../../../components/CodebaseSelect';
import { useChatAttach } from '../../../store/chat';
import { AttachType } from '../../../store/attaches';
import {
  MultiValueLabel,
  ClearIndicator,
} from '../../../components/WorkspaceFileSelect/WorkspaceFileSelect';
import DocsetSelect from '../../../components/DocsetSelect';
import { SmallScreenWidth, LargeScreenWidth } from '../../../const';
import { usePluginApp } from '../../../store/plugin-app';

type ValueOption = {
  label: string;
  value: string;
};

type FileMeta = {
  fileName: string;
  path: string;
  content: string;
};

function ChatMaskVariableForm() {
  const { postMessage } = usePostMessage();
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const [isLargerThan340] = useMediaQuery(LargeScreenWidth);
  const runner = usePluginApp((state) => state.runner);

  const variables = useMaskStore((state) => state.config.variables);
  const mask = useMaskStore((state) => state.currentMask());

  const updateMask = useMaskStore((state) => state.updateConfig);
  const ide = useExtensionStore((state) => state.IDE);
  const updateAttachs = useChatAttach((state) => state.update);
  const prevMask = React.useRef<ChatMask>();

  const [values, setValues] = React.useState<{
    knowledge: ValueOption[];
    file: ValueOption[];
    codebase: ValueOption | null;
  }>(() => ({
    knowledge: [],
    file:
      variables[VariableType.File]?.value.map((file) => ({
        label: file.fileName + `（${file.path}）`,
        value: file.path,
      })) || [],
    codebase: {
      label: '',
      value: '',
    },
  }));

  // file
  const [fileSearchKeyword, setFileSearchKeyword] = React.useState('');
  const debouncedSearchKeyword = useDebounce(fileSearchKeyword);
  const [isLoadingWorkspaceFiles, setIsLoadingWorkspaceFiles] =
    React.useState(false);
  const [workspaceFileMap, setWorkspaceFileMap] = React.useState(
    new Map<string, FileMeta>(),
  );
  const [fileOptions, setFileOptions] = React.useState<FileMeta[]>([]);

  const resetValue = React.useCallback(() => {
    setValues({
      knowledge: [],
      file:
        variables[VariableType.File]?.value.map((file) => ({
          label: file.fileName + `（${file.path}）`,
          value: file.path,
        })) || [],
      codebase: {
        label: variables[VariableType.Codebase]?.code || '',
        value: variables[VariableType.Codebase]?.value || '',
      },
    });
  }, [variables]);

  React.useEffect(() => {
    async function handleMessage(
      event: MessageEvent<PostMessageSubscribeType>,
    ) {
      const eventData = event.data as any;
      if (eventData?.type === SubscribeActions.WORKSPACE_FILES) {
        setIsLoadingWorkspaceFiles(false);
        const files = eventData.data || [];
        for (const file of files) {
          setWorkspaceFileMap((prev) => {
            const nextMap = new Map(prev);
            nextMap.set(file.path, file);
            return nextMap;
          });
        }
        setFileOptions(files);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  React.useEffect(() => {
    if (!prevMask.current || mask?._id !== prevMask.current._id) {
      // reset user input
      resetValue();
    }
    prevMask.current = mask;
  }, [mask, resetValue]);

  React.useEffect(() => {
    if (variables[VariableType.Codebase]) {
      const data = variables[VariableType.Codebase];
      updateAttachs({
        collection: data.value,
        branches: [],
        label: data.code,
        attachType: AttachType.CodeBase,
      });
    }
  }, [updateAttachs, variables]);

  const handleFetchWrokspaceFiles = React.useCallback(
    (keyword = '') => {
      setIsLoadingWorkspaceFiles(true);
      postMessage({
        type: BroadcastActions.GET_WORKSPACE_FILES,
        data: { keyword },
      });
    },
    [postMessage],
  );

  React.useEffect(() => {
    if (!variables[VariableType.File]) {
      return;
    }
    handleFetchWrokspaceFiles(debouncedSearchKeyword);
  }, [debouncedSearchKeyword, handleFetchWrokspaceFiles, variables]);

  const handleChangeFileSelect = React.useCallback(
    async (data: MultiValue<ValueOption>) => {
      setValues((prev) => ({
        ...prev,
        file: data.map((item) => item),
      }));
      updateMask((config) => {
        if (config.variables[VariableType.File]) {
          const fileData = [];
          for (const item of data) {
            const file = workspaceFileMap.get(item.value);
            if (file) {
              fileData.push(file);
            }
          }
          config.variables[VariableType.File].value = fileData;
        }
      });
    },
    [workspaceFileMap, updateMask],
  );

  const handleChangeCodebase = React.useCallback(
    (value: ValueOption | null) => {
      setValues((prev) => ({
        ...prev,
        codebase: value,
      }));
      updateAttachs({
        collection: value?.value || '',
        branches: [],
        label: value?.label || '',
        attachType: AttachType.CodeBase,
      });
    },
    [updateAttachs],
  );

  const renderPanel = React.useMemo(() => {
    if (isLargerThan340) {
      return (
        <>
          {variables[VariableType.Knowledge] && (
            <Grid
              gridTemplateColumns="100px auto"
              alignItems="baseline"
              gap={2}
            >
              <Box textAlign="right">知识库</Box>
              <Box>
                <DocsetSelect
                  value={variables[VariableType.Knowledge]?.value || ''}
                  onChange={(v) => {
                    updateMask((config) => {
                      if (config.variables[VariableType.Knowledge]) {
                        config.variables[VariableType.Knowledge].value = v;
                      }
                    });
                  }}
                  menuPortalTarget={document.body}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.Knowledge]?.description}
                </Text>
              </Box>
            </Grid>
          )}
          {variables[VariableType.File] && (
            <Grid
              gridTemplateColumns="100px auto"
              alignItems="baseline"
              gap={2}
            >
              <Box textAlign="right">本地文件</Box>
              <Box>
                <Select
                  name={VariableType.File}
                  inputId={`chakra-react-select-${VariableType.File}`}
                  menuPlacement="top"
                  isMulti
                  placeholder="请选择所需要使用的本地文件"
                  onInputChange={setFileSearchKeyword}
                  value={values.file}
                  options={fileOptions.map((file) => ({
                    label: file.fileName + `（${file.path}）`,
                    value: file.path,
                  }))}
                  isLoading={isLoadingWorkspaceFiles}
                  onMenuOpen={handleFetchWrokspaceFiles}
                  onChange={handleChangeFileSelect}
                  components={{
                    MultiValueLabel,
                    ClearIndicator,
                    DropdownIndicator: () => (
                      <div className="mr-3">
                        <Icon as={RiArrowDownSLine} />
                      </div>
                    ),
                    IndicatorSeparator: () => null,
                  }}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.File]?.description}
                </Text>
              </Box>
            </Grid>
          )}
          {variables[VariableType.Codebase] && (
            <Grid
              gridTemplateColumns="100px auto"
              alignItems="baseline"
              gap={2}
            >
              <Box textAlign="right">代码地图</Box>
              <Box>
                <CodebaseSelect
                  key={variables[VariableType.Codebase].value}
                  value={variables[VariableType.Codebase].value}
                  onChange={handleChangeCodebase}
                  menuPortalTarget={document.body}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.Codebase]?.description}
                </Text>
              </Box>
            </Grid>
          )}
        </>
      );
    } else {
      return (
        <>
          {variables[VariableType.Knowledge] && (
            <Grid alignItems="baseline" gap={2}>
              <Box textAlign="left">知识库</Box>
              <Box
                style={{
                  width: isSmallScreen ? '120px' : '100%',
                }}
              >
                <DocsetSelect
                  value={variables[VariableType.Knowledge]?.value || ''}
                  onChange={(v) => {
                    updateMask((config) => {
                      if (config.variables[VariableType.Knowledge]) {
                        config.variables[VariableType.Knowledge].value = v;
                      }
                    });
                  }}
                  menuPortalTarget={document.body}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.Knowledge]?.description}
                </Text>
              </Box>
            </Grid>
          )}
          {variables[VariableType.File] && (
            <Grid alignItems="baseline" gap={2}>
              <Box textAlign="left">本地文件</Box>
              <Box
                style={{
                  width: isSmallScreen ? '120px' : '100%',
                }}
              >
                <Select
                  name={VariableType.File}
                  inputId={`chakra-react-select-${VariableType.File}`}
                  menuPlacement="top"
                  isMulti
                  placeholder="请选择所需要使用的本地文件"
                  onInputChange={setFileSearchKeyword}
                  value={values.file}
                  options={fileOptions.map((file) => ({
                    label: file.fileName + `（${file.path}）`,
                    value: file.path,
                  }))}
                  isLoading={isLoadingWorkspaceFiles}
                  onMenuOpen={handleFetchWrokspaceFiles}
                  onChange={handleChangeFileSelect}
                  components={{
                    MultiValueLabel,
                    ClearIndicator,
                    DropdownIndicator: () => (
                      <div className="mr-3">
                        <Icon as={RiArrowDownSLine} />
                      </div>
                    ),
                    IndicatorSeparator: () => null,
                  }}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.File]?.description}
                </Text>
              </Box>
            </Grid>
          )}
          {variables[VariableType.Codebase] && (
            <Grid alignItems="baseline" gap={2}>
              <Box textAlign="left">代码地图</Box>
              <Box
                style={{
                  width: isSmallScreen ? '120px' : '100%',
                }}
              >
                <CodebaseSelect
                  key={variables[VariableType.Codebase].value}
                  value={variables[VariableType.Codebase].value}
                  onChange={handleChangeCodebase}
                  menuPortalTarget={document.body}
                />
                <Text opacity={0.6}>
                  {variables[VariableType.Codebase]?.description}
                </Text>
              </Box>
            </Grid>
          )}
        </>
      );
    }
  }, [
    isSmallScreen,
    isLargerThan340,
    fileOptions,
    handleChangeCodebase,
    handleChangeFileSelect,
    handleFetchWrokspaceFiles,
    isLoadingWorkspaceFiles,
    updateMask,
    values.file,
    variables,
  ]);

  // VisualStudio 暂不开放
  if (ide === IDE.VisualStudio) {
    return null;
  }

  if (!Object.keys(variables).length) {
    return null;
  }

  // 如果选了插件，那么不允许使用这个表单
  if (runner) {
    return null;
  }

  return (
    <Flex
      width="auto"
      marginX={2}
      mt={2}
      padding={2}
      flexDirection="column"
      borderRadius="4px"
      gap={2}
      alignItems={isLargerThan340 ? 'normal' : 'center'}
      bg="themeBgColor"
    >
      {renderPanel}
    </Flex>
  );
}

export default ChatMaskVariableForm;
