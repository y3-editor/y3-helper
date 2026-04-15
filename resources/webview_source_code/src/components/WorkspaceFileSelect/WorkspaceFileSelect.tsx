import * as React from 'react';
import {
  components,
  Select,
  MultiValue,
  MultiValueGenericProps,
  ClearIndicatorProps,
  GroupBase,
} from 'chakra-react-select';
import { Box, Icon, Tooltip } from '@chakra-ui/react';
import { RiArrowDownSLine, RiCloseCircleLine } from 'react-icons/ri';
import { useDebounce } from '../../hooks/useDebounce';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
  usePostMessage,
} from '../../PostMessageProvider';
import useFirstFocusedEffect from '../../hooks/useFirstFocusEffect';

type ValueOption = {
  label: string;
  value: string;
};

export type FileMeta = {
  fileName: string;
  path: string;
  content: string;
};

interface WorkspaceFileSelectProps {
  value: FileMeta[];
  onChange: (value: FileMeta[]) => void;
}

function WorkspaceFileSelect(props: WorkspaceFileSelectProps) {
  const { postMessage } = usePostMessage();
  const [value, setValue] = React.useState<ValueOption[]>(() => {
    return (props.value || []).map((file) => ({
      label: file.fileName + `（${file.path}）`,
      value: file.path,
    }));
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const debouncedSearchKeyword = useDebounce(searchKeyword);
  const [workspaceFileMap, setWorkspaceFileMap] = React.useState<
    Map<string, FileMeta>
  >(new Map());
  const [fileOptions, setFileOptions] = React.useState<FileMeta[]>([]);
  const initialRef = React.useRef(false);

  const handleSubscribeWorkspaceFiles = React.useCallback(
    (keyword = '') => {
      setIsLoading(true);
      postMessage({
        type: BroadcastActions.GET_WORKSPACE_FILES,
        data: { keyword },
      });
    },
    [postMessage],
  );

  useFirstFocusedEffect(() => {
    handleSubscribeWorkspaceFiles(debouncedSearchKeyword);
  }, [debouncedSearchKeyword, handleSubscribeWorkspaceFiles]);

  React.useEffect(() => {
    async function handleLoadWorkspaceFiles(
      event: MessageEvent<PostMessageSubscribeType>,
    ) {
      const eventData = event.data as any;
      if (eventData?.type === SubscribeActions.WORKSPACE_FILES) {
        setIsLoading(false);
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
    window.addEventListener('message', handleLoadWorkspaceFiles);
    return () => {
      window.removeEventListener('message', handleLoadWorkspaceFiles);
    };
  }, []);

  useFirstFocusedEffect(() => {
    if (!initialRef.current) {
      for (const file of props.value) {
        handleSubscribeWorkspaceFiles(file.path);
      }
    }
  }, [handleSubscribeWorkspaceFiles, props.value]);

  const handleChangeFileSelect = async (data: MultiValue<ValueOption>) => {
    setValue(data.map((item) => item));
    const nextValues = [];
    for (const item of data) {
      const file = workspaceFileMap.get(item.value);
      if (file) {
        nextValues.push(file);
      }
    }
    props.onChange(nextValues);
  };

  return (
    <Select
      className="w-full"
      inputId={`chakra-react-select-locate-file`}
      isMulti
      placeholder="请选择本地文件"
      closeMenuOnSelect={false}
      onInputChange={setSearchKeyword}
      value={value}
      formatOptionLabel={(option) => (
        <div style={{ lineHeight: '20px' }}>{option.label}</div>
      )}
      options={fileOptions.map((file) => ({
        label: file.fileName + `（${file.path}）`,
        value: file.path,
      }))}
      isLoading={isLoading}
      onMenuOpen={handleSubscribeWorkspaceFiles}
      onChange={handleChangeFileSelect}
      components={{
        MultiValueLabel,
        DropdownIndicator: () => (
          <div className="mr-3">
            <Icon as={RiArrowDownSLine} />
          </div>
        ),
        IndicatorSeparator: () => null,
      }}
    />
  );
}

export const MultiValueLabel = (props: MultiValueGenericProps<ValueOption>) => {
  return (
    <Tooltip label={props.children}>
      <Box isTruncated maxW={32}>
        <components.MultiValueLabel {...props} />
      </Box>
    </Tooltip>
  );
};

export const ClearIndicator = (
  props: ClearIndicatorProps<ValueOption, boolean, GroupBase<ValueOption>>,
) => {
  return (
    <components.ClearIndicator {...props}>
      <Icon as={RiCloseCircleLine} cursor="pointer" />
    </components.ClearIndicator>
  );
};

export default WorkspaceFileSelect;
