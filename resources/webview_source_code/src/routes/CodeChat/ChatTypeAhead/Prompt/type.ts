import { PluginAppRunner } from '../../../../services/plugin';
import { Prompt } from '../../../../services/prompt';

export enum UnionType {
  Prompt,
  Plugin,
}

export type UnionData =
  | {
      name: string;
      description?: string;
      type: UnionType.Plugin;
      meta: PluginAppRunner;
    }
  | {
      name: string;
      description?: string;
      type: UnionType.Prompt;
      meta: Prompt;
      extra?: {
        source?: string;
      };
    };
