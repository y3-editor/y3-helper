import * as y3 from 'y3-helper';

export class Formatter {
    public callRules = new Map<string, string>();
    public valueRules = new Map<string, string>();
    public setCallRule(name: string, rule: string) {
        this.callRules.set(name, rule);
    }

    public setValueRule(name: string, rule: string) {
        this.valueRules.set(name, rule);
    }

    public formatCall(name: string, args: string[]) {
        let rule = this.callRules.get(name);
        if (!rule) {
            return `${name}(${args.join(', ')})`;
        }
        return `${name}(${args.join(', ')})`;
    }

    public formatValue(name: string, value: string | number | boolean) {
        let rule = this.valueRules.get(name);
        if (!rule) {
            return y3.lua.encode(value);
        }
        return y3.lua.encode(value);
    }
}
