import { execFile } from 'child_process';
import * as path from 'path';

export type NewProcessSelection =
    | { readonly kind: 'waiting' }
    | { readonly kind: 'selected'; readonly processId: number }
    | { readonly kind: 'ambiguous'; readonly processIds: readonly number[] };

export function shouldAutoAttachCloudScript(enabled: boolean, multiMode: boolean): boolean {
    return enabled && !multiMode;
}

export function isProcessInjectionFailure(error: unknown): boolean {
    const message = String(error);
    return message.includes('injectdll failed') || message.includes('Cannot attach process');
}

export interface ProcessSnapshotProvider {
    listMockMlsProcessIds(): Promise<readonly number[]>;
}

export interface EntryPointLogCandidate {
    readonly filePath: string;
    readonly modifiedAt: number;
    readonly content: string;
}

export function selectLatestEntryPointFailure(
    candidates: readonly EntryPointLogCandidate[],
    launchStartedAt: number,
): string | undefined {
    return candidates
        .filter((candidate) => candidate.modifiedAt >= launchStartedAt)
        .filter((candidate) => candidate.content.includes('EntryPoint failed'))
        .sort((a, b) => b.modifiedAt - a.modifiedAt)[0]?.filePath;
}

export function createCloudScriptDebugConfiguration(
    projectPath: string,
    processId: number,
    name: string,
) {
    return {
        type: 'lua',
        request: 'attach',
        name,
        processId,
        inject: 'hook',
        stopOnEntry: false,
        sourceCoding: 'utf8',
        sourceMaps: [['./*', path.join(projectPath, 'cloud_script', '*')]],
        y3HelperDebugKind: 'cloudScript',
    };
}

export function parseTasklistProcessIds(output: string): number[] {
    const processIds = new Set<number>();
    for (const line of output.split(/\r?\n/)) {
        const match = /^"MockMls\.exe","(\d+)"/i.exec(line.trim());
        if (match) {
            processIds.add(Number(match[1]));
        }
    }
    return [...processIds].sort((a, b) => a - b);
}

export class WindowsTasklistProcessProvider implements ProcessSnapshotProvider {
    async listMockMlsProcessIds(): Promise<readonly number[]> {
        const output = await new Promise<string>((resolve, reject) => {
            execFile(
                'tasklist.exe',
                ['/FI', 'IMAGENAME eq MockMls.exe', '/FO', 'CSV', '/NH'],
                { encoding: 'buffer', windowsHide: true },
                (error, stdout) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout.toString('latin1'));
                },
            );
        });
        return parseTasklistProcessIds(output);
    }
}


export interface WaitForNewProcessOptions {
    readonly timeoutMs: number;
    readonly pollIntervalMs: number;
    readonly signal?: AbortSignal;
}

export type WaitForNewProcessResult = Exclude<NewProcessSelection, { readonly kind: 'waiting' }>
    | { readonly kind: 'timeout' }
    | { readonly kind: 'cancelled' };

export function selectNewProcessId(
    processIdsBeforeLaunch: readonly number[],
    currentProcessIds: readonly number[],
): NewProcessSelection {
    const previousIds = new Set(processIdsBeforeLaunch);
    const newProcessIds = [...new Set(currentProcessIds)]
        .filter((processId) => !previousIds.has(processId))
        .sort((a, b) => a - b);

    if (newProcessIds.length === 0) {
        return { kind: 'waiting' };
    }
    if (newProcessIds.length === 1) {
        return { kind: 'selected', processId: newProcessIds[0] };
    }
    return { kind: 'ambiguous', processIds: newProcessIds };
}

function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve(true);
        }, delayMs);
        const onAbort = () => {
            clearTimeout(timer);
            resolve(false);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

export interface ProcessStabilityOptions {
    readonly delayMs: number;
    readonly signal?: AbortSignal;
    readonly delay?: (delayMs: number, signal?: AbortSignal) => Promise<boolean>;
}

export type ProcessStabilityResult =
    | { readonly kind: 'ready' }
    | { readonly kind: 'exited' }
    | { readonly kind: 'cancelled' };

export async function waitForProcessStability(
    provider: ProcessSnapshotProvider,
    processId: number,
    options: ProcessStabilityOptions,
): Promise<ProcessStabilityResult> {
    const delay = options.delay ?? waitForDelay;
    if (!await delay(options.delayMs, options.signal) || options.signal?.aborted) {
        return { kind: 'cancelled' };
    }
    const processIds = await provider.listMockMlsProcessIds();
    if (options.signal?.aborted) {
        return { kind: 'cancelled' };
    }
    return processIds.includes(processId) ? { kind: 'ready' } : { kind: 'exited' };
}

export async function waitForNewProcess(
    provider: ProcessSnapshotProvider,
    processIdsBeforeLaunch: readonly number[],
    options: WaitForNewProcessOptions,
): Promise<WaitForNewProcessResult> {
    const startedAt = Date.now();
    while (!options.signal?.aborted) {
        const currentProcessIds = await provider.listMockMlsProcessIds();
        if (options.signal?.aborted) {
            return { kind: 'cancelled' };
        }
        const selection = selectNewProcessId(
            processIdsBeforeLaunch,
            currentProcessIds,
        );
        if (selection.kind !== 'waiting') {
            return selection;
        }
        if (Date.now() - startedAt >= options.timeoutMs) {
            return { kind: 'timeout' };
        }
        if (!await waitForDelay(options.pollIntervalMs, options.signal)) {
            return { kind: 'cancelled' };
        }
    }
    return { kind: 'cancelled' };
}
