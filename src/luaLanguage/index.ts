import * as vscode from 'vscode';
import { HoverProvider } from './hover';
import { InlayHintProvider } from './inlayHint';

class LanguageServer {
    constructor() {
        vscode.languages.registerHoverProvider('lua', new HoverProvider());
        vscode.languages.registerInlayHintsProvider('lua', new InlayHintProvider());
    }
}

export function init() {
    new LanguageServer();
}
