import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { FieldInfo } from '../editorTable';
import * as jsonc from 'jsonc-parser';

interface ObjectResult {
    object: y3.table.EditorObject;
    query: string;
    other: string;
}

interface FieldResult {
    objectResult: ObjectResult;
    fieldInfo: FieldInfo;
    query: string;
    other: string;
}

class ObjectInfomation extends vscode.SymbolInformation {
    constructor(objectResult: ObjectResult) {
        super(
            objectResult.query,
            vscode.SymbolKind.File,
            `${objectResult.object.tableName}(${objectResult.other})`,
            new vscode.Location(
                objectResult.object.uri!,
                new vscode.Position(0, 0),
            ),
        );
    }
}

class FieldInfomation extends vscode.SymbolInformation {
    constructor(private fieldResult: FieldResult, sep: string) {
        super(
            `${fieldResult.objectResult.query}${sep}${fieldResult.query}`,
            vscode.SymbolKind.Field,
            `${fieldResult.objectResult.object.tableName}(${fieldResult.objectResult.other}${sep}${fieldResult.other})`,
            new vscode.Location(
                fieldResult.objectResult.object.uri!,
                new vscode.Position(0, 0),
            ),
        );
    }

    private computePosition(text: string, offset: number) {
        let line = 0;
        let character = 0;
        for (let i = 0; i < offset; i++) {
            if (text[i] === '\n') {
                line++;
                character = 0;
            } else {
                character++;
            }
        }
        return new vscode.Position(line, character);
    }

    async updateInformation() {
        const object = this.fieldResult.objectResult.object;
        const root = object.json?.tree;
        if (!root) {
            return;
        }
        for (const property of root.children!) {
            const key = property.children![0];
            if (key.value === this.fieldResult.fieldInfo.field) {
                this.location.range = new vscode.Range(
                    this.computePosition(object.text!, property.offset),
                    this.computePosition(object.text!, property.offset + property.length),
                );
                return;
            }
        }
    }
}

class Provider implements vscode.WorkspaceSymbolProvider {
    async provideWorkspaceSymbols(query: string, token: vscode.CancellationToken) {
        if (token.isCancellationRequested) {
            return;
        }
        let allObjects = await y3.table.getAllObjects();
        if (token.isCancellationRequested) {
            return;
        }
        let matchResult = query.match(/^([^\.\/、。]*)([\.\/、。]?)([^\.\/、。]*)?$/);
        if (!matchResult) {
            return;
        }
        let [_, name, sep, field] = matchResult;
        let objectResults = this.searchObject(allObjects, name);
        if (objectResults.length === 0) {
            return;
        }
        if (!sep) {
            let results = objectResults.map((objectResult) => new ObjectInfomation(objectResult));
            return results;
        }
        let fieldResults = this.searchObjectFields(objectResults, field ?? '');
        let results = fieldResults.map((FieldResult) => new FieldInfomation(FieldResult, sep));
        return results;
    }

    async resolveWorkspaceSymbol(symbol: ObjectInfomation | FieldInfomation, token: vscode.CancellationToken) {
        if (symbol instanceof FieldInfomation) {
            await symbol.updateInformation();
        }
        return symbol;
    }

    private compileString(str: string) {
        let result: { [key: number]: number } = {};
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            result[code] = (result[code] ?? 0) + 1;
        }
        return result;
    }

    private matchString(queryChars: { [key: number]: number }, target: string) {
        const targetChars = this.compileString(target);
        for (const code in queryChars) {
            if (!targetChars[code] || targetChars[code] < queryChars[code]) {
                return false;
            }
        }
        return true;
    }

    private searchObject(objects: y3.table.EditorObject[], query: string) {
        const queryChars = this.compileString(query);
        let result: ObjectResult[] = [];
        for (const object of objects) {
            if (this.matchString(queryChars, object.key.toString())) {
                result.push({
                    object,
                    query: object.key.toString(),
                    other: object.name,
                });
            } else if (this.matchString(queryChars, object.name)) {
                result.push({
                    object,
                    query: object.name,
                    other: object.key.toString(),
                });
            }
        }
        return result;
    }

    private searchObjectFields(objects: ObjectResult[], query: string) {
        const queryChars = this.compileString(query);
        let result: FieldResult[] = [];
        for (const objectResult of objects) {
            for (const field of objectResult.object.listFields()) {
                const fieldInfo = objectResult.object.getFieldInfo(field);
                if (!fieldInfo) {
                    continue;
                }
                if (fieldInfo.desc && this.matchString(queryChars, fieldInfo.desc)) {
                    result.push({
                        objectResult,
                        fieldInfo,
                        query: fieldInfo.desc,
                        other: field,
                    });
                } else if (this.matchString(queryChars, field)) {
                    result.push({
                        objectResult,
                        fieldInfo,
                        query: field,
                        other: fieldInfo.desc ?? '',
                    });
                }
            }
        }
        return result;
    }
}

export function init() {
    vscode.languages.registerWorkspaceSymbolProvider(new Provider());
}
