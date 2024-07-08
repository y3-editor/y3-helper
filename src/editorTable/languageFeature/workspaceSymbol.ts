import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

interface ObjectResult {
    object: y3.table.EditorObject;
    query: string;
    other: string;
}

interface FieldResult {
    objectResult: ObjectResult;
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
        let matchResult = query.match(/^([^\.\/]*)([\.\/]?)([^\.\/]*)?$/);
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
                        query: fieldInfo.desc,
                        other: field,
                    });
                } else if (this.matchString(queryChars, field)) {
                    result.push({
                        objectResult,
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
