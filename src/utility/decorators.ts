// 每隔一段时间只能执行一次
export function throttle(wait: number) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        let isThrottled = new Set<any>();

        descriptor.value = function(...args: any[]) {
            if (isThrottled.has(this)) {
                return;
            };
            isThrottled.add(this);
            setTimeout(() => {
                isThrottled.delete(this);
                originalMethod.apply(this, args);
            }, wait);
        };
    };
}

// 请求需要排队，禁止重入（只能用于异步函数）
export function queue() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod: (...args: any[]) => Promise<any> = descriptor.value;
        let runningMap = new Map<any, (() => void)[]>();

        descriptor.value = async function(...args: any[]) {
            let queue = runningMap.get(this);
            if (!queue) {
                queue = [];
                runningMap.set(this, queue);
            }

            let myTurn = new Promise<void>((resolve) => {
                queue.push(resolve);
            });

            let promise = new Promise(async (resolve) => {
                // 等待轮到自己
                await myTurn;
                // 执行真正的操作
                let result = await originalMethod.apply(this, args);
                // 返回当前的请求
                resolve(result);
                // 把自己移出队列
                queue.shift();
                // 处理下一个请求
                queue[0]?.();
            });

            if (queue.length === 1) {
                // 处理第一个请求
                queue[0]?.();
            }

            return promise;
        };
    };
}
