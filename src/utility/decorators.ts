
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
