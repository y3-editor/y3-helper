import util from 'util';
/**
 * 自旋锁
 */
export class SpinLock {
    private locked: boolean = false;
    private waitTime = 100;

    constructor(waitTime?: number) {
        if (waitTime) {
            this.waitTime = waitTime;
        }
    }

    public async acquire() {
        while (this.locked) {
            // 自旋等待直到锁可用
            await util.promisify(setTimeout)(this.waitTime);
        }
        this.locked = true;
    }

    public release(): void {
        this.locked = false;
    }
}
