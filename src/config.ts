class Config {
    multiMode: boolean = false;
    multiPlayers: number[] = [1, 2];
    debugPlayers: number[] = [1];
    tracy: boolean = false;
    attachWhenLaunch: boolean = true;
    launchMap: ['option' | 'map', string] = ['option', 'entry'];
}

export let config = new Config();
