import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '../env';
import { addNewEditorTableItemInProject } from './editorTableUtility';
import { Table } from '../constants';
import { hash, toUnicodeIgnoreASCII } from '../utility';
import * as y3 from 'y3-helper';


export class EditorTableDataProvider implements vscode.TreeDataProvider<FileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined> = new vscode.EventEmitter<FileNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined> = this._onDidChangeTreeData.event;
  private editorTablePath: string = "";
  
  constructor() {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("当前未打开工作目录");
      return;
    }

    this.editorTablePath = env.editorTablePath;
  }
  

  /**
   * 为选择的节点添加新的物编数据(节点只能为九类物编数据文件夹)
   * @returns true or false 成功或失败
   */
  public createNewTableItemByFileNode(fileNode: FileNode,name:string) :boolean{
    let editorTableType = Table.name.fromCN[fileNode.label as Table.NameCN];
    if (!editorTableType) {
      return false;
    }
    if (addNewEditorTableItemInProject(editorTableType as Table.NameEN, name)) {
      this.refresh();
      return true;
    }
    return false;
  }
  /**
   * 重命名Y3项目中的物编项目
   * @returns true or false 成功或失败
   */
  public async renameEditorTableItemByFileNode(fileNode: FileNode, newName: string):Promise<boolean> {
    if (!fileNode.name) {
      vscode.window.showErrorMessage("该节点没有名称");
      return false;
    }
    let success = false;
    try {
      let newNameHashcode = hash(newName);
      let editorTableJsonStr = await fs.promises.readFile(fileNode.resourceUri.fsPath, 'utf8');
      let editorTableJson = JSON.parse(editorTableJsonStr);
      let k = y3.language.keyOf(newName);
      if (!k) {
        return false;
      }
      editorTableJson['name'] = k;
      await fs.promises.writeFile(fileNode.resourceUri.fsPath, toUnicodeIgnoreASCII(JSON.stringify(editorTableJson, null, 2)), 'utf8');
      this.refresh();
      success = true;
    }
    catch (error) {
      vscode.window.showErrorMessage("重命名物编项目时出错，错误为：" + error);
    }
    return success;
  }
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  getParent(element: FileNode): vscode.ProviderResult<FileNode> {
    return Promise.resolve(element.parent);
  }
  
  getTreeItem(element: FileNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileNode): Promise<FileNode[]> {
    if (!this.editorTablePath || this.editorTablePath === "") {
      vscode.window.showInformationMessage("未找到物编数据,请检查是否初始化开发环境");
      return [];
    }

    const files = await fs.promises.readdir(element ? element.resourceUri.fsPath : this.editorTablePath);
    const fileNodes: FileNode[] = [];

    for (const file of files) {
      const filePath = path.join(element ? element.resourceUri.fsPath : this.editorTablePath, file);
      const stat = await fs.promises.stat(filePath);

      // 如果这个是物编数据的Json文件 那么它的label就需要加上其名称
      let label: string = file;
      if (filePath.toLowerCase().endsWith('.json')) {
        let editorTableJsonData: any;
        try {
          editorTableJsonData = await fs.promises.readFile(filePath, 'utf8');
        }
        catch (error) {
          vscode.window.showErrorMessage("读取" + filePath + "时出错");
        }

        let editorTableJson: any = undefined;
        try {
          editorTableJson = JSON.parse(editorTableJsonData);

        }
        catch (error) {
          vscode.window.showErrorMessage("读取" + filePath + "时失败，错误为：" + error);
        }
        let name;
        if (editorTableJson.hasOwnProperty('name')) {
          let nameKey: any = editorTableJson['name'];
          name = y3.language.get(nameKey);
        }
        if (name !== undefined && typeof name === "string") {
          label = name + "(" + label.substring(0, label.length - 5) + ")";//显示为"这是一个单位(134219828)"的格式
        }
        let uid = editorTableJson['uid'];
        if (isNaN(uid)) {
          continue;
        }
      
        const fileNode = new FileNode(
          element,
          label,
          stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          stat.isDirectory() ? vscode.Uri.file(filePath) : vscode.Uri.file(filePath),
          stat.isDirectory(),
          uid,
          name
        );
        fileNodes.push(fileNode);
      }
      else if (stat.isDirectory()) {
        if (label in Table.path.toCN) {
          label = Table.path.toCN[label as Table.Path];
          const files = await fs.promises.readdir(filePath);// 检查此目录下有多少个物编文件
          label += '(' + files.length + ')';//显示为 单位(10) 括号内的数字为有多少个物编项目
          const fileNode = new FileNode(
            element,
            label,
            stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            stat.isDirectory() ? vscode.Uri.file(filePath) : vscode.Uri.file(filePath),
            stat.isDirectory()
          );
          fileNodes.push(fileNode);
        }
        else {
          continue;
        }
      }
      
    };

    return Promise.resolve(fileNodes);
  }
}

export class FileNode extends vscode.TreeItem {
  constructor(
    public readonly parent:FileNode|undefined,
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri: vscode.Uri,
    public readonly isDirectory: boolean,
    public readonly uid?: number,// 物编项目的uid
    public readonly name?:string // 物编项目的名称
  ) {
    super(label, collapsibleState);
    this.resourceUri = resourceUri;
    this.isDirectory = isDirectory;
    this.command = isDirectory ? undefined : {
      command: 'vscode.open',
      title: '打开文件',
      arguments: [resourceUri]
    };
    if (this.isDirectory) {
      this.contextValue = 'directory';
    }
    else if (resourceUri.fsPath.toLowerCase().endsWith('.json')) {
      this.contextValue = 'json';
    }
    else {
      this.contextValue = 'otherTypes';
    }
  }
}
