import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Env } from './env';
import { isPathValid } from './utility';



export class Y3HelperDataProvider implements vscode.TreeDataProvider<FileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined> = new vscode.EventEmitter<FileNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined> = this._onDidChangeTreeData.event;

  constructor(private env: Env) { 

    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("当前未打开工作目录");
      return;
    }
    
    this.rootPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "../editor_table");
    
    
    if (!isPathValid(this.rootPath)) {
      this.rootPath = "";
    }
  }
  
  private rootPath: string="";
  getTreeItem(element: FileNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileNode): Thenable<FileNode[]> {
    if (!this.rootPath||this.rootPath==="") {
      vscode.window.showInformationMessage("未找到物编数据,请检查是否初始化开发环境");
      return Promise.resolve([]);
    }

    const files = fs.readdirSync(element ? element.resourceUri.fsPath : this.rootPath);
    const fileNodes: FileNode[] = [];

    files.forEach(file => {
      const filePath = path.join(element ? element.resourceUri.fsPath : this.rootPath, file);
      const stat = fs.statSync(filePath);
      const fileNode = new FileNode(
        file,
        stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        stat.isDirectory() ? vscode.Uri.file(filePath) : vscode.Uri.file(filePath),
        stat.isDirectory()
      );
      fileNodes.push(fileNode);
    });

    return Promise.resolve(fileNodes);
  }
}

class FileNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri: vscode.Uri,
    public readonly isDirectory: boolean
  ) {
    super(label, collapsibleState);
    this.resourceUri = resourceUri;
    this.isDirectory = isDirectory;
    this.command = isDirectory ? undefined : {
      command: 'y3-helper.openFile',
      title: '打开文件',
      arguments: [resourceUri]
    };
  }
}