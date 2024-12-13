export class VersionCache<T> {
    constructor(private maker: () => T | Promise<T>) { }

    private version = 0;

    private cache?: T;

    public updateVersion() {
        this.version++;
        this.cache = undefined;
    }
    
    public async get() {
        if (this.cache !== undefined) {
            return this.cache;
        }
        let version = this.version;
        let result = await this.maker();
        if (this.version === version) {
            this.cache = result;
        }
        return result;
    }
}
