import * as React from 'react';
import { Select } from 'chakra-react-select';
import { Icon } from '@chakra-ui/react';
import { RiArrowDownSLine } from 'react-icons/ri';
import { useDocsetStore } from '../../store/docset';

type ValueOption = {
  label: string;
  value: string;
};

interface DocsetSelectProps {
  value: string;
  onChange: (value: string) => void;
  menuPortalTarget?: HTMLElement | null | undefined;
}

function DocsetSelect(props: DocsetSelectProps) {
  const [isInitial, userDocsets] = useDocsetStore((state) => [
    state.isInitial,
    state.docsets,
  ]);
  const [value, setValue] = React.useState<ValueOption | null>(null);

  const handleChange = (option: ValueOption | null) => {
    if (option) {
      setValue(option);
      props.onChange(option.value);
    }
  };

  React.useEffect(() => {
    if (isInitial) {
      const docset = userDocsets.get(props.value);
      if (docset) {
        setValue({
          label: docset.name,
          value: docset.code,
        });
      } else {
        setValue(null);
      }
    }
  }, [isInitial, props.value, userDocsets]);

  return (
    <Select
      inputId={`chakra-react-select-docset`}
      placeholder="请选择数据集"
      menuPortalTarget={props.menuPortalTarget}
      value={value}
      options={Array.from(userDocsets).map(([, docset]) => ({
        label: docset.name,
        value: docset.code,
      }))}
      onChange={handleChange}
      formatOptionLabel={(option) => (
        <div style={{ lineHeight: '20px' }}>{option.label}</div>
      )}
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

export default DocsetSelect;
