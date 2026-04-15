/**
 * 通过自定义的hash函数customHashFn来进行hash的HashSet,哈希值为string类型
 * 当customHashFn为空时，自动根据对象的属性值，而不是以对象的地址进行hash
 */
export class HashSet<T> {
    private map: Map<string, T> = new Map<string, T>();
    private readonly hash: (element: T) => string=this.defaultHash;
    private defaultHash(element: T):string {
        return JSON.stringify(element);
    }
    constructor(customHashFn?: (element: T) => string) {
        if (customHashFn) {
            this.hash = customHashFn;
        }
    }
    

    public add(element: T): void {
        const key = this.hash(element);
        this.map.set(key, element);
    }

    public delete( element: T): void {
        const key = this.hash(element);
        this.map.delete(key);
    }

    public has(element: T): boolean {
        const key = this.hash(element);
        return this.map.has(key);
    }

    public clear() {
        this.map.clear();
    }
    public forEach(callbackfn: (value: T, value2: T, set: HashSet<T>) => void, thisArg?: any): void{
        this.map.forEach(
            (value: T, key: string, map: Map<string, T>) => {
                callbackfn(value, value, this);
            },
            thisArg
        );
    }

    [Symbol.iterator](): Iterator<T> {
        let index = 0;
        let values = this.map.values();
        let items:T[] = [];
        for (let value of values) {
            items.push(value);
        }
        return {
            next(): IteratorResult<T> {
                if (index<items.length) {
                    return {
                        value: items[index++],
                        done: false
                    };
                } else {
                    return {
                        value: null as any,
                        done: true
                    };
                }
            }
        };
    }
    
    public get size() {
        return this.map.size;
    }
}