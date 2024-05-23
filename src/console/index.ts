import { env } from '../env';
import { randomInt } from '../utility';
import * as tools from '../tools';
import { ConsoleServer } from './server';

function setPort(port: number) {
    if (!env.scriptUri) {
        return;
    }
    tools.writeFile(env.scriptUri, 'log/helper_port.lua', `return ${port}`);
}

let server: ConsoleServer | undefined;

export function init() {
    let port = randomInt(10000, 65535);

    server = new ConsoleServer(port);

    env.onDidChange(() => {
        setPort(port);
    });
    setPort(port);
}

export function getServer(): ConsoleServer {
    if (!server) {
        init();
    }
    return server!;
}
