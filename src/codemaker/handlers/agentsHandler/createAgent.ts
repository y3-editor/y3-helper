import * as os from 'os';
import * as vscode from 'vscode';
const printLog = (...args: any[]) => console.log('[AgentsHandler:createAgent]', ...args);
const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));
import type AgentsHandler from './index';
import { PROJECT_AGENT_DIR, USER_AGENT_DIR } from './index';
import { AgentScope, CreateAgentParams, CreateAgentResult } from './types';

function makeError(
  params: { identifier: string; scope: AgentScope },
  code: NonNullable<CreateAgentResult['code']>,
  message: string
): CreateAgentResult {
  return {
    success: false,
    identifier: params.identifier,
    scope: params.scope,
    code,
    message,
  };
}

function validateIdentifier(identifier: unknown): string | null {
  if (typeof identifier !== 'string' || identifier.length === 0) {
    return 'identifier must be a non-empty string';
  }
  if (
    identifier.includes('/') ||
    identifier.includes('\\') ||
    identifier.includes('..')
  ) {
    return 'identifier must not contain path separators or ".."';
  }
  return null;
}

function resolveTargetUri(
  scope: AgentScope
):
  | { ok: true; dirUri: vscode.Uri; fileUri: vscode.Uri }
  | { ok: false; message: string } {
  if (scope === 'project') {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return {
        ok: false,
        message: 'No workspace folder available for project agent',
      };
    }
    const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, PROJECT_AGENT_DIR);
    return { ok: true, dirUri, fileUri: dirUri };
  }

  const homeUri = vscode.Uri.file(os.homedir());
  const dirUri = vscode.Uri.joinPath(homeUri, USER_AGENT_DIR);
  return { ok: true, dirUri, fileUri: dirUri };
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function createAgent(
  _handler: AgentsHandler,
  params: CreateAgentParams
): Promise<CreateAgentResult> {
  const { identifier, scope, markdown, overwrite } = params;

  const identifierError = validateIdentifier(identifier);
  if (identifierError) {
    printLog(
      `[AgentsHandler] createAgent invalid identifier - identifier: ${String(
        identifier
      )}, reason: ${identifierError}`
    );
    return makeError(
      { identifier: String(identifier ?? ''), scope },
      'INVALID_IDENTIFIER',
      identifierError
    );
  }

  if (typeof markdown !== 'string') {
    return makeError(
      { identifier, scope },
      'WRITE_FAILED',
      'markdown must be a string'
    );
  }

  const resolved = resolveTargetUri(scope);
  if (!resolved.ok) {
    printLog(
      `[AgentsHandler] createAgent no workspace - scope: ${scope}`
    );
    return makeError(
      { identifier, scope },
      'NO_WORKSPACE',
      resolved.message
    );
  }

  const targetFileUri = vscode.Uri.joinPath(
    resolved.dirUri,
    `${identifier}.md`
  );

  try {
    const exists = await fileExists(targetFileUri);
    if (exists && overwrite !== true) {
      printLog(
        `[AgentsHandler] createAgent already exists - path: ${targetFileUri.fsPath}`
      );
      return makeError(
        { identifier, scope },
        'ALREADY_EXISTS',
        `Agent file already exists at ${targetFileUri.fsPath}`
      );
    }

    await vscode.workspace.fs.createDirectory(resolved.dirUri);
    await vscode.workspace.fs.writeFile(
      targetFileUri,
      Buffer.from(markdown, 'utf8')
    );

    return {
      success: true,
      identifier,
      scope,
      path: targetFileUri.fsPath,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    printLog(
      `[AgentsHandler] createAgent failed - path: ${targetFileUri.fsPath}, error: ${message}`
    );
    return makeError({ identifier, scope }, 'WRITE_FAILED', message);
  }
}