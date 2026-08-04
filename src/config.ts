class Config {
    multiMode: boolean = false;
    multiPlayers: number[] = [];
    multiPlayerNicknames: Record<number, string> = {};
    debugPlayers: number[] = [];
    tracy: boolean = false;
    attachWhenLaunch: boolean = true;
    launchMap: ['option' | 'map', string] = ['option', 'entry'];
}

export let config = new Config();
