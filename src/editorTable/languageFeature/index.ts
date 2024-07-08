import * as documentManager from './documentManager';
import * as documentSymbol from './documentSymbol';
import * as hover from './hover';

export function init() {
    documentManager.init();
    documentSymbol.init();
    hover.init();
}
