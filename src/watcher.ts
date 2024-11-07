import * as y3 from 'y3-helper';

function syncY3() {
    setInterval(async () => {
        if (!y3.env.globalScriptUri || !y3.env.scriptUri) {
            return;
        }
        let globalY3 = await y3.fs.readFile(y3.env.globalScriptUri, 'y3/init.lua');
        if (!globalY3) {
            return;
        }
        let myY3 = await y3.fs.readFile(y3.env.scriptUri, 'y3/init.lua');

        if (!myY3 || globalY3.string !== myY3.string) {
            await y3.fs.writeFile(y3.env.scriptUri, 'y3/init.lua', globalY3.string);
        }
    }, 1000);
}

export function init() {
    syncY3();
}
