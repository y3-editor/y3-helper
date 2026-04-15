import * as React from 'react';
import _ from 'lodash';
import { ChevronDownIcon, Tooltip } from '@chakra-ui/icons';
import styles from './index.module.scss';

export interface TreeNode {
  key: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tooltip?: string
  children?: TreeNode[];
  onClick?: (node: TreeNode) => void;
  isLeaf?: boolean;
  extra?: any;
  icon?: React.ReactNode;
  branch?: string;
  branchReport?: any;
  branchList?: any;
  titleClassName?: string;
}

interface TreeNodeProps {
  node: TreeNode;
  buildTree: (nodes: TreeNode[]) => React.ReactNode[] | undefined;
  expandedKeys: string[];
  onChangeExpandedKeys: (keys: string[]) => void;
  onTreeClick?: (node: TreeNode, e?: React.MouseEvent) => void;
  expandIcon: boolean;
  selectable: boolean;
  selectedKey: string;
  expandAll?: boolean;
  classname?: string;
}

const TreeNode = (props: TreeNodeProps) => {
  const {
    buildTree,
    node,
    expandedKeys,
    onChangeExpandedKeys,
    onTreeClick,
    expandIcon,
    selectable,
    selectedKey,
    expandAll = false,
    classname,
  } = props;

  const onSwitchExpand = React.useCallback(() => {
    const newKeys: string[] = [...expandedKeys];
    if (node?.children?.length) {
      if (newKeys.includes(node.key)) {
        _.remove(newKeys, (k) => k === node.key);
      } else {
        newKeys.push(node.key);
      }
    }
    onChangeExpandedKeys(newKeys);
  }, [node, expandedKeys, onChangeExpandedKeys]);

  return (
    <>
      <div
        className={`cursor-pointer w-full ${styles['tree-node']} ${selectable ? (selectedKey === node.key ? 'selected' : '') : ''
          } ${classname}`}
        onClick={(e) => {
          onTreeClick?.(node, e);
          node?.onClick?.(node);
          onSwitchExpand();
          e.stopPropagation();
        }}
      >
        {!!node?.children?.length && expandIcon ? (
          <div className='w-4 h-4'>
            <ChevronDownIcon
              className={`mr-1 ${styles['expand-icon']} ${expandAll || expandedKeys.includes(node.key)
                ? styles['expanded']
                : ''
                }`}
              onClick={(e) => {
                e.stopPropagation();
                onSwitchExpand();
              }}
            />
          </div>
        ) : (
          <div className='w-4 h-4'></div>
        )}
        <Tooltip label={node.tooltip} hidden={!node?.tooltip}>
          <div className={`flex-1 relative flex items-center ${node.titleClassName}`}>
            {node.icon} {node.title}
          </div>
        </Tooltip>
      </div>
      {node?.description && (
        <div
          className={`${styles['tree-node-description']} ${node?.children?.length ? 'pl-[18px]' : ''
            } flex`}
        >
          {node.description}
        </div>
      )}
      {node?.children && (
        <div
          className={`pl-[16px] ${styles['children-nodes']} ${!expandedKeys.includes(node.key) && !expandAll
            ? 'h-0 overflow-hidden'
            : ''
            }`}
        >
          {buildTree(node?.children || [])}
        </div>
      )}
    </>
  );
};

interface TreeProps {
  dataSource: TreeNode[];
  expandedKeys?: string[];
  selectedKey?: string;
  defaultExpandedKeys?: string[];
  onExpand?: (keys: string[]) => void;
  onClick?: (node: TreeNode, e?: React.MouseEvent) => void;
  expandIcon?: boolean;
  selectable?: boolean;
  expandAll?: boolean;
  classname?: string;
}

const Tree = (props: TreeProps) => {
  const {
    dataSource,
    expandedKeys,
    selectedKey,
    defaultExpandedKeys,
    onExpand,
    onClick,
    expandIcon = true,
    selectable = false,
    expandAll = false,
    classname,
  } = props;
  const [stateExpandedKeys, setStateExpandedKeys] = React.useState<string[]>(
    [],
  );
  const [stateSelectedKey, setStateSelectedKey] = React.useState<string>('');

  React.useEffect(() => {
    if (defaultExpandedKeys?.length) {
      setStateExpandedKeys(defaultExpandedKeys);
    }
  }, [defaultExpandedKeys]);

  const onChangeExpandedKeys = (keys: string[]) => {
    if (expandedKeys) {
      onExpand?.(keys);
    } else {
      setStateExpandedKeys(keys);
    }
  };

  const onTreeClick = (node: TreeNode, e?: React.MouseEvent) => {
    if (typeof selectedKey === 'undefined') {
      setStateSelectedKey(node.key);
    }
    onClick?.(node, e);
  };

  const buildTree = (data: TreeNode[]): React.ReactNode[] | undefined => {
    if (!data || !data.length) return;
    return _.map(data, (item: TreeNode) => {
      return (
        <div key={item.key} className='w-full'>
          <TreeNode
            classname={classname}
            expandedKeys={expandedKeys || stateExpandedKeys}
            node={item}
            buildTree={buildTree}
            onChangeExpandedKeys={onChangeExpandedKeys}
            onTreeClick={onTreeClick}
            expandIcon={expandIcon}
            selectable={selectable}
            expandAll={expandAll}
            selectedKey={
              typeof selectedKey === 'undefined'
                ? stateSelectedKey
                : selectedKey
            }
          />
        </div>
      );
    });
  };

  return <div>{buildTree(dataSource)}</div>;
};

export default Tree;
