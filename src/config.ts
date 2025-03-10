class Config {
    multiMode: boolean = false;
    multiPlayers: number[] = [1, 2];
    debugPlayers: number[] = [1];
    tracy: boolean = false;
    attachWhenLaunch: boolean = true;
}

export let config = new Config();
