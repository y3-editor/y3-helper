import * as documentManager from './documentManager';
import * as documentSymbol from './documentSymbol';
import * as hover from './hover';
import * as inlayHints from './inlayHints';

export function init() {
    documentManager.init();
    documentSymbol.init();
    hover.init();
    inlayHints.init();
}
