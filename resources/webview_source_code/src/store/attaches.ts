import { SearchResult } from '../services/search';

export enum AttachType {
  Docset = 'docset',
  File = 'file',
  CodeBase = 'codebase',
  ImageUrl = 'imageUrl',
  NetworkModel = 'networkModel',
  KnowledgeAugmentation = 'knowledgeAugmentation',
  Folder = 'folder',
  Problems = 'Problems',
  MultiAttachment = 'multiAttachment',
  Rules = 'Rules'
}

export interface CodeBase {
  collection: string;
  label: string;
  branches?: string[];
  attachType: AttachType;
  searchResult?: SearchResult[];
}
