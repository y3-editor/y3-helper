import { env } from '../env';
import { log } from './log';
import { scanGmpProject } from './projectMaps';
import {
    GenerateGmpOptions,
    GenerateGmpResult,
    GmpProjectContext,
    generateProjectGmp,
} from './gmpGenerate';

export async function getGmpProjectContext(): Promise<GmpProjectContext | undefined> {
    if (!env.projectUri) {
        return undefined;
    }
    const snapshot = await scanGmpProject(env.projectUri.fsPath);
    for (const directory of snapshot.ignoredDirectories) {
        log.info(`忽略非关卡目录（缺少 header.map）：${directory}`);
    }
    if (snapshot.errors.length > 0) {
        throw new Error(snapshot.errors.join('\n'));
    }
    return snapshot.context;
}

export async function generateAllGmp(
    options: GenerateGmpOptions = {},
): Promise<GenerateGmpResult> {
    try {
        const context = await getGmpProjectContext();
        if (!context) {
            throw new Error('未找到 Y3 工程或有效入口关卡');
        }
        return await generateProjectGmp(context, options);
    } catch (error) {
        return {
            success: false,
            dryRun: options.dryRun === true,
            projectPath: env.projectUri?.fsPath,
            maps: [],
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
