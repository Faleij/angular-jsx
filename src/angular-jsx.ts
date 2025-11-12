import { IRootScopeService, IScope } from 'angular';

function once<T extends (...args: any[]) => any>(fn: T): T {
    let ran = false;
    let res;
    return ((...args) => {
        if (!ran) {
            ran = true;
            res = fn(...args);
        }
        return res;
    }) as any;
}

export const ProxySymbol = Symbol('proxyPath');

function transformFunction(fn) {
    let str = fn.toString().split('=>')[1].trim();
    if (str.startsWith('{') && str.endsWith('}')) str = str.slice(1, -1);
    return str;
}

/** returns str like: "{{ str | filter1 | filter2 ... }}" */
export function interpolation(str: string | Function | (() => any), ...filters: string[]) {
    if (typeof str === 'string') str = `"${str}"`;
    else if (str instanceof Function) {
        if (!str[ProxySymbol]) str = transformFunction(str);
    }
    return `{{${str}${filters.length?'|':''}${filters.join('|')}}}`;
}

export function scope(fn: (...args: any[]) => HTMLElement | HTMLElement[]) {
    return compile(fn);
}

export function createElement(tagName, props?: Record<string, any>, ...children) {
    const el = document.createElement(tagName);
    if (props) for (const [k, v] of Object.entries(props)) {
        el.setAttribute(k, renderValue(v, k));
    }
    for (const child of children) {
        if (Array.isArray(child)) {
            const [first, ...rest] = child;
            if (first?.[ProxySymbol] && rest.every(v => typeof v === 'string')) {
                el.append(interpolation(first, ...rest));
            } else {
                for (const subChild of child) {
                    el.append(subChild instanceof Node ? subChild : renderValue(subChild));
                }
            }
        } else {
            el.append(child instanceof Node ? child : renderValue(child));
        }
    }
    return el;
}

function renderValue(v, key?: string) {
    if (v instanceof Function && !v[ProxySymbol]) {
        const expr = transformFunction(v);
        return key ? expr : `{{${expr}}}`;
    }
    if (typeof v === 'object' && key === 'style') {
        return Object.entries(v).map(([k, v]) => [k.replace(/([A-Z])/g, '-$1').toLowerCase(), v].join(':')).join(';');
    } else if (typeof v === 'object') {
        return `{${Object.entries(v).map(([k, v]) => [k, v].join(':')).join(',')}}`;
    }
    if (!key && v[ProxySymbol]) {
        return `{{${v}}}`;
    }
    if (typeof v === 'boolean' || typeof v === 'undefined' || v === null) return '';
    return v.toString();
}

function createProxy(parts: Array<string | number>, scopeName = '$') {
    const render = (...args) => {
        const argsStr = args.join(',');
        if (parts.length === 1 && parts[0] === scopeName) return interpolation(args[0], ...args.slice(1));
        return `${renderPath(parts, scopeName)}(${argsStr})`;
    };
    return new Proxy(render, {
        get(_0, key) {
            if (key === ProxySymbol) return () => true;
            if (['valueOf', 'toString', 'toJSON', Symbol.toPrimitive].includes(key)) {
                return () => renderPath(parts, scopeName);
            }
            if (typeof key === 'symbol') {
                throw new Error('Symbol support not implemented');
            }
            return createProxy([...parts, Number.isInteger(+key) ? +key : key], scopeName);
        }
    });
}

function pathReducer(p: string | number, c: string | number, i: number) {
    return p + (Number.isInteger(c) ? `[${c}]` : `.${c}`);
}

function renderPath(parts: Array<string | number>, scopeName) {
    if (parts[0] === scopeName) return parts.slice(1).reduce(pathReducer);
    return parts.reduce(pathReducer);
}

/** TODO: support all function types */
export function argumentNames(fn: (...args: any) => void): string[] {
    if (typeof fn !== 'function') {
        throw new TypeError('Input must be a function');
    }

    // Convert the function to a string representation
    const fnStr = fn.toString().trim();

    // Match function arguments using a regular expression
    const argsMatch = fnStr.match(/(?:\(([^)]*)\)|([^=\s,]+))\s*=>|function\s*[^(]*\(([^)]*)\)/);

    if (!argsMatch) {
        return []; // No arguments found
    }

    // Extract the appropriate group (group 1, 2, or 3 depending on the match)
    const args = argsMatch[1] || argsMatch[2] || argsMatch[3] || '';

    // Split the arguments by comma, trim whitespace, and filter out empty values
    return args
        .split(',')
        .map(arg => arg.trim().replace(/\/\*.*?\*\//g, '')) // Remove inline comments
        .filter(arg => arg);
}

/** TODO: support all function types */
function parseArguments(fn: (...args: any) => void): Array<string | string[]> {
    const argsStr: string = fn.toString().slice(1).split(')')[0];
    return argsStr.split(/(\{.*\})/).flatMap(s => 
        s.startsWith('{') ?
        [s.slice(1, -1).split(',').map(s => s.trim()).filter(s => s.length)]
        :
        s.split(',').map(s => s.trim()) as any
    ).filter(s => s.length) as any;
}

export function compile(render: (...args: any) => HTMLElement | HTMLElement[], scopeName?: string): HTMLElement | HTMLElement[] {
    const args = parseArguments(render);
    const props = args.map(s => {
        if (Array.isArray(s)) return Object.fromEntries(s.map(s => [s, createProxy([s], scopeName)]));
        return createProxy([s], scopeName);
    });
    return render(...props);
}

export function inExpr(arr: any[] | Record<any, any>, itemName: string) {
    return `${itemName} in ${arr}`;
}

export function jsxTemplateUrl(render: (...args: any) => HTMLElement) {
    const fn = once(($sce: ng.ISCEService) => {
        const compiled = compile(render);
        let html = '';
        if (Array.isArray(compiled)) {
            html = compiled.map(el => el.innerHTML).join('\n');
        } else {
            html = compiled.innerHTML;
        }
        render = undefined as any; // mark render for GC
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        return $sce.trustAsResourceUrl(url);
    });
    return ($sce: ng.ISCEService) => fn($sce);
}

export function jsxTemplate(render: (...args: any) => HTMLElement | HTMLElement[], scopeName?: string) {
    const compiled = compile(render, scopeName);
    let html = '';
    if (Array.isArray(compiled)) html = compiled.map(el => el.outerHTML).join('\n');
    else if (compiled.hasAttribute('jsx-unwrap')) html = compiled.innerHTML;
    else html = compiled.outerHTML;
    return (): string => html;
}

type Cls = abstract new (...args: any) => any;

export interface IJsxComponentOptions<T extends Cls> extends Omit<ng.IComponentOptions, 'template' | 'templateUrl' | 'controller' | 'controllerAs'> {
    controller: T;
    template: ($ctrl: InstanceType<T>, ...args: [ControllerScope<T>, ...any]) => ReturnType<typeof compile>;
}

export type ControllerScope<T extends Cls, TScope = InstanceType<T>["$scope"]> = (TScope extends IScope ? TScope : IScope);

export function jsxComponent<T extends Cls>({ template, ...args}: IJsxComponentOptions<T>) {
    const [controllerAs, scopeName] = argumentNames(template);
    return {
        ...args,
        template: jsxTemplate(template, scopeName),
        controllerAs,
    }
}


export interface IngRepeatScope extends IScope {
    /** iterator offset of the repeated element (0..length-1) */
    $index: number;
    /** true if the repeated element is first in the iterator. */
    $first: boolean;
    /** true if the repeated element is between the first and last in the iterator. */
    $middle: boolean;
    /** true if the repeated element is last in the iterator. */
    $last: boolean;
    /** true if the iterator position $index is even (otherwise false). */
    $even: boolean;
    /** true if the iterator position $index is odd (otherwise false). */
    $odd: boolean;
}

interface ngRepeatFn<T extends Array<any>> {
    (item: T[0], scope: IngRepeatScope): HTMLElement;
}
interface ngRepeatFnObj<T extends Record<string | number, X>, X = any> {
    (key: string | number, item: X, scope: IngRepeatScope): HTMLElement;
}
// https://docs.angularjs.org/api/ng/directive/ngRepeat
// TODO: support (key, value)
// TODO: support "track by $expr"
// TODO: support "ng-repeat-start" "ng-repeat-end"
// TODO: support filter "item in items | filter : x | orderBy : order | limitTo : limit as results track by item.id"
export function ngRepeat<T extends Array<any>, F extends ngRepeatFn<T>>(items: T, fn: F) {
    const args = argumentNames(fn);
    const item = args.find(el => !el.startsWith('$'));
    const el = compile(fn) as HTMLElement;
    el.setAttribute('ng-repeat', `${item} in ${items}`);
    return el;
}
export function ngRepeatObj<T extends Record<string | number, any>, F extends ngRepeatFnObj<T>>(items: T, fn: F) {
    const args = argumentNames(fn);
    const [key, item] = args.filter(el => !el.startsWith('$'));
    const el = compile(fn) as HTMLElement;
    el.setAttribute('ng-repeat', `(${key}, ${item}) in ${items}`);
    return el;
}

/** returns expression with filters applied; "expr|filter1|filter2..." */
export function filter(expr: string, ...filters: string[]) {
    return `${expr}${filters.length?'|':''}${filters.join('|')}`;
}