import {
  Docset,
  DocsetItem,
  DocsetFile,
  DocsetType,
} from '../../../../../services/docsets';
import { nanoid } from 'nanoid';

export const CODEMAKER_TAG = 'codemaker';
export const LABEL_TAG = 'label:';
export const OFFICIAL = '官方';

type DocsetMap = Map<string, DocsetItem>;
export function generateDocsetOptions(
  docsets: Docset[] | undefined,
): DocsetItem[] {
  if (!docsets) return [];

  const labelMap: DocsetMap = new Map();

  docsets.forEach((item) => {
    const labelTag = item.tags.find((tag) => tag.startsWith(LABEL_TAG));
    const [, label] = labelTag?.split(':') ?? [];
    if (label) {
      handleLabeledDocset(labelMap, label, item);
    } else {
      handleUnlabeledDocset(labelMap, item);
    }
  });

  return Array.from(labelMap.values());
}

function handleLabeledDocset(
  map: DocsetMap,
  label: string,
  item: Docset,
): void {
  if (!map.has(label)) {
    map.set(label, createNewLabel(label));
  }
  const labelItem = map.get(label) as DocsetFile;
  addDocsetToLabel(labelItem, item);
}

function handleUnlabeledDocset(map: DocsetMap, item: Docset): void {
  if (!item.folders?.length || item.folders.length === 1) {
    const docset = {
      label: item.name,
      ...item,
      docsetType: DocsetType.Docset,
    };
    map.set(item.name, docset);
  } else {
    map.set(item.name, createMultiFolderDocset(item));
  }
}

function createMultiFolderDocset(item: Docset): DocsetItem {
  const folderOptions =
    item?.folders?.map((folder) => ({
      ...item,
      name: folder.name,
      _id: folder._id,
      label: folder.name,
      folder_names: [folder.name],
      docsetType: DocsetType.Docset,
    })) || [];
  const allOptions = {
    ...item,
    label: `${item.name}-全部文件`,
    name: `${item.name}-全部文件`,
    folder_names: [],
    _id: nanoid(10),
    docsetType: DocsetType.Docset,
  };

  return {
    ...item,
    label: item.name,
    docsetType: DocsetType.Folder,
    children: [allOptions, ...folderOptions],
  };
}
function createNewLabel(label: string): DocsetItem {
  return {
    label,
    children: [],
    _id: nanoid(10),
    name: label,
    tags: [OFFICIAL],
    docsetType: DocsetType.Label,
  };
}

function addDocsetToLabel(labelItem: DocsetFile, item: Docset) {
  if (item.folders?.length && item.folders.length > 1) {
    const newDocsetOptions = item.folders.map((folder) => ({
      ...item,
      name: folder.name,
      _id: folder._id,
      label: folder.name,
      folder_names: [folder.name],
      docsetType: DocsetType.Docset,
    }));
    const allOptions = {
      ...item,
      label: `${item.name}-全部文件`,
      name: `${item.name}-全部文件`,
      folder_names: [],
      _id: nanoid(10),
      docsetType: DocsetType.Docset,
    };
    labelItem.children!.push({
      ...item,
      label: item.name,
      docsetType: DocsetType.Folder,
      children: [allOptions, ...newDocsetOptions],
    });
  } else {
    labelItem.children!.push({
      label: item.name,
      ...item,
      docsetType: DocsetType.Docset,
    });
  }
}
