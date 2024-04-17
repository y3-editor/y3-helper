export function castToType(value: any, type: string): any | undefined {
    let result = value;
    // 如果标注类型为number 那么尝试转化为number
    if (type === 'number') {
        value = Number(value);
        if (isNaN(value)) {
            return undefined;
        }
    }

    // 是boolean 就尝试转化为boolean
    else if (type === 'boolean') {
        if (String(value).toLowerCase() === 'true') {
            value = true;
        }
        else if (String(value).toLowerCase() === 'false') {
            value = false;
        }
    }
    return result;
}