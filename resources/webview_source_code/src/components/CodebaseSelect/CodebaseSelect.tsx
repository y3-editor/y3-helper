import { Icon } from '@chakra-ui/react';
import { GroupBase, MenuPlacement, Select } from 'chakra-react-select';
import { RiArrowDownSLine } from 'react-icons/ri';
import useCodeBase from '../../routes/CodeChat/ChatTypeAhead/Attach/CodeBase/useCodeBase';
import * as React from 'react';

interface GroupValue {
  label: string;
  value: string;
}

interface CodebaseSelectProps {
  value: string;
  onChange: (value: GroupValue | null) => void;
  menuPortalTarget?: HTMLElement | null | undefined;
  menuPlacement?: MenuPlacement;
  className?: string;
}

function CodebaseSelect(props: CodebaseSelectProps) {
  const [value, setValue] = React.useState<GroupValue | null>(null);
  const initialRef = React.useRef(false);
  const { codeOptions, loading } = useCodeBase();

  React.useEffect(() => {
    if (!initialRef.current) {
      const option = codeOptions
        .map((option) => option.options)
        .flat()
        .find((option) => option.value === props.value);
      if (option) {
        setValue({
          label: option.label,
          value: option.value,
        });
        initialRef.current = true;
      }
    }
  }, [codeOptions, props.value]);

  return (
    <Select<GroupValue, false, GroupBase<GroupValue>>
      name="code"
      chakraStyles={{
        menu: (provided) => ({
          ...provided,
          width: '300px',
        }),
      }}
      inputId="chakra-react-select-code"
      className={`${props.className || ''}`}
      placeholder="请选择代码地图"
      menuPortalTarget={props.menuPortalTarget}
      options={codeOptions}
      isClearable={true}
      menuPlacement={props.menuPlacement}
      value={value}
      formatGroupLabel={(group) => <div>{group.label}</div>}
      formatOptionLabel={(option) => (
        <div style={{ lineHeight: '20px' }} className="ml-2">
          {option.label}
        </div>
      )}
      isLoading={loading}
      onChange={(code) => {
        setValue({
          label: code?.label || '',
          value: code?.value || '',
        });
        props.onChange(code || null);
      }}
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

export default CodebaseSelect;
