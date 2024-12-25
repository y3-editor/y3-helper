import * as y3 from 'y3-helper';

export class VersionCache<T> {
    constructor(private maker: () => T | Promise<T>, private cache: T) { }

    private version = 0;
    private hasNew = false;

    public updateVersion() {
        this.version++;
        this.hasNew = true;
    }
    
    public async get() {
        if (!this.hasNew) {
            return this.cache;
        }
        let version = this.version;
        try {
            let result = await this.maker();
            if (this.version === version) {
                this.cache = result;
                this.hasNew = false;
            }
            return result;
        } catch (e) {
            y3.log.error(e as Error);
            return this.cache;
        }
    }
}
