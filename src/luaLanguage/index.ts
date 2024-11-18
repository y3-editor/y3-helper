import * as vscode from 'vscode';
import { HoverProvider } from './hover';
import { InlayHintProvider } from './inlayHint';
import { DefinitionProvider } from './definition';
import { CompletionProvider } from './completion';

class LanguageServer {
    constructor() {
        vscode.languages.registerHoverProvider('lua', new HoverProvider());
        vscode.languages.registerInlayHintsProvider('lua', new InlayHintProvider());
        vscode.languages.registerDefinitionProvider('lua', new DefinitionProvider());
        //vscode.languages.registerCompletionItemProvider('lua', new CompletionProvider(), ...'0123456789');
    }
}

export function init() {
    new LanguageServer();
}
