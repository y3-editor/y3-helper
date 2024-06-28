
// 每隔一段时间只能执行一次
export function throttle(wait: number) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        let isThrottled = false;

        descriptor.value = function(...args: any[]) {
            if (isThrottled) {
                return;
            };
            isThrottled = true;
            setTimeout(() => isThrottled = false, wait);
            return originalMethod.apply(this, args);
        };
    };
}
