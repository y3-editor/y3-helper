import * as React from 'react';
import { Select, SingleValue, Props } from 'chakra-react-select';
import { PromptCategoryType, getPromptCategories } from '../../services/prompt';
import useService from '../../hooks/useService';
import { Icon } from '@chakra-ui/react';
import { RiArrowDownSLine } from 'react-icons/ri';

type ValueOption = {
  label: string;
  value: string;
};

interface PromptCategorySelectProps {
  value: string | undefined;
  onChange: (id: string) => void;
  isDisabled?: Props['isDisabled'];
}

function PromptCategorySelect(props: PromptCategorySelectProps) {
  const [value, setValue] = React.useState<ValueOption | undefined>(() => {
    if (!props.value) {
      return;
    }
    return {
      label: props.value,
      value: props.value,
    };
  });
  const initialRef = React.useRef(false);
  const { data, isValidating } = useService(getPromptCategories, [{}]);

  React.useEffect(() => {
    const category: any = data?.find((item: any) => item._id === value?.value);
    if (category && !initialRef.current) {
      setValue({
        label:
          category.name +
          (category.description ? `（${category.description}）` : ''),
        value: category._id,
      });
      initialRef.current = true;
    }
  }, [value, data]);

  const options = React.useMemo(() => {
    if (!data) {
      return [];
    }
    // 过滤规则：
    // 1. 过滤 is_global，此表示是 codemaker 通用词库
    // 2. 过滤出 type 为 project 的词库
    return data
      .filter((item: any) => !item.is_global)
      .filter((item: any) => item.type === PromptCategoryType.Project)
      .map((item: any) => ({
        label: item.name + (item.description ? `（${item.description}）` : ''),
        value: item._id,
      }));
  }, [data]);

  const handleChangePromptCategory = (option: SingleValue<ValueOption>) => {
    if (option?.value) {
      setValue(option);
      props.onChange(option?.value);
    }
  };
  return (
    <Select
      inputId={`chakra-react-select-prompt-category`}
      placeholder="请选择所归属的词库"
      isDisabled={props.isDisabled}
      value={value}
      options={options}
      isLoading={isValidating}
      onChange={handleChangePromptCategory}
      components={{
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

export default PromptCategorySelect;
