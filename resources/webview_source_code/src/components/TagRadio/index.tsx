import { Tag, TagLeftIcon, TagLabel } from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';
import { map } from 'lodash';
import { useCallback } from 'react';

interface OptionType {
  label: string;
  value: string;
}

interface Props {
  values: string[];
  onChange: (newVal: string[]) => void;
  options: OptionType[];
  handleTagDisabled?: (value: string) => boolean;
}

export default function TagRadio(props: Props) {
  const { values, onChange, options, handleTagDisabled } = props;

  const onClickTag = useCallback(
    (key: string) => {
      if (values.includes(key)) {
        const newVal = values.filter((v) => v !== key);
        onChange(newVal);
      } else {
        onChange([...values, key]);
      }
    },
    [onChange, values],
  );

  return (
    <div>
      {map(options, (opt: OptionType, index: number) => {
        const { label, value } = opt;
        return (
          <div className={`${index > 0 ? 'mt-2' : ''}`} key={opt.value}>
            <Tag
              size="md"
              className="cursor-pointer"
              opacity={handleTagDisabled?.(value) ? 0.6 : 1}
              pointerEvents={handleTagDisabled?.(value) ? "none" : "auto"}
              cursor={handleTagDisabled?.(value) ? "not-allowed" : "pointer"}
              style={{
                width: '100%',
                padding: '6px 8px',
                ...(values.includes(value)
                  ? { color: 'var(--chakra-colors-blue-300)' }
                  : {}),
              }}
              onClick={() => onClickTag(value)}
            >
              <TagLeftIcon as={CheckCircleIcon} />
              <TagLabel>{label}</TagLabel>
            </Tag>
          </div>
        );
      })}
    </div>
  );
}
