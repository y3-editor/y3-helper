import * as React from 'react';
import { Flex, Grid, Box, useMediaQuery } from '@chakra-ui/react';
import { usePluginApp } from '../../../store/plugin-app';
import { Select } from 'chakra-react-select';
import Icon from '../../../components/Icon';
import { RiArrowDownSLine } from 'react-icons/ri';
import { SmallScreenWidth } from '../../../const';

const SCAN_RULE_APPID = 'scan_rule';

const PluginAppVariableFrom = () => {
  const [runner, runnerExtends, updateRunnerExtends] = usePluginApp((state) => [
    state.runner,
    state.runnerExtends,
    state.updateRunnerExtends,
  ]);
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);

  const handleUpdate = React.useCallback(
    (id: string, value: unknown) => {
      if (!updateRunnerExtends) return;
      updateRunnerExtends({ ...runnerExtends, [id]: value });
    },
    [runnerExtends, updateRunnerExtends],
  );

  const fieldEnumMap = React.useMemo(() => {
    if (!runner || !runnerExtends || !Object.keys(runnerExtends).length) {
      return {};
    }
    const obj: Record<string, string[]> = {};
    runner?.app_shortcut?.params?.forEach((item) => {
      // 针对自定义规则专门定制：可选项关联依赖项，目前只支持第一个 dependency 匹配
      if (runner?.app_id === SCAN_RULE_APPID && item.dependencies?.length) {
        const { field, mapping } = item.dependencies[0];
        const dependentFieldValue = runnerExtends[field] as string;
        const target = mapping[dependentFieldValue] || mapping.default;
        obj[item.id] = target.enum || [];
        return;
      }
      obj[item.id] = item.enum || [];
    });
    return obj;
  }, [runner, runnerExtends]);

  // 针对自定义规则专门定制：检查值是否在有效的枚举中
  React.useEffect(() => {
    if (!runner || !runnerExtends || !Object.keys(runnerExtends).length) return;
    if (runner.app_id !== SCAN_RULE_APPID) return;
    Object.keys(runnerExtends).map((key) => {
      const value = runnerExtends[key] as string;
      const fieldEnum = fieldEnumMap[key] || [];
      if (fieldEnum.length && !fieldEnum.includes(value as string)) {
        handleUpdate(key, fieldEnum[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, runnerExtends, fieldEnumMap]);

  if (!runner || !runnerExtends || !Object.keys(runnerExtends).length) {
    return null;
  }

  return (
    <Flex
      width="auto"
      p="2"
      marginX={2}
      mt={2}
      padding={2}
      flexDirection="column"
      borderRadius="4px"
      bg="themeBgColor"
      gap={2}
    >
      {runner.app_shortcut?.params?.map((item) => {
        const { id, default_value, description, title } = item;

        const fieldEnum = fieldEnumMap[id] || [];
        const value = runnerExtends[id] || default_value;

        // TODO: 目前只是根据 enum 长度来判断是否为下拉选框，后续有需求可以根据类型来扩展更多的表单
        if (fieldEnum?.length) {
          const gridStyle = isSmallScreen
            ? {}
            : { gridTemplateColumns: '100px auto' };
          return (
            <Grid {...gridStyle} gap={2} alignItems="center" key={id}>
              <Box textAlign={isSmallScreen ? 'left' : 'right'}>{title}</Box>
              <Select
                value={{
                  label: value,
                  value: value,
                }}
                inputId="chakra-react-select-model"
                className="w-full z-60"
                placeholder={description}
                options={fieldEnum.map((i) => ({
                  label: i,
                  value: i,
                }))}
                onChange={(v) => {
                  if (!v?.value) return;
                  handleUpdate(id, v.value);
                }}
                menuPortalTarget={document.body}
                components={{
                  DropdownIndicator: () => (
                    <div className="mr-4">
                      <Icon
                        as={RiArrowDownSLine}
                        size="xs"
                        color="text.default"
                      />
                    </div>
                  ),
                  IndicatorSeparator: () => null,
                }}
              ></Select>
            </Grid>
          );
        }
        // TODO: 后续需要 Input 框可以继续扩展
        return null;
      })}
    </Flex>
  );
};

export default PluginAppVariableFrom;
