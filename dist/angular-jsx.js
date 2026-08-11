"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxySymbol = void 0;
exports.Fragment = Fragment;
exports.interpolation = interpolation;
exports.scope = scope;
exports.createElement = createElement;
exports.argumentNames = argumentNames;
exports.compile = compile;
exports.inExpr = inExpr;
exports.jsxTemplateUrl = jsxTemplateUrl;
exports.jsxTemplate = jsxTemplate;
exports.jsxComponent = jsxComponent;
exports.ngRepeat = ngRepeat;
exports.ngRepeatObj = ngRepeatObj;
exports.filter = filter;
function once(fn) {
    let ran = false;
    let res;
    return ((...args) => {
        if (!ran) {
            ran = true;
            res = fn(...args);
        }
        return res;
    });
}
exports.ProxySymbol = Symbol('proxyPath');
/**
 * jsxFragmentFactory — children only, no wrapper element.
 * Must be a function (not a Symbol) so TypeScript accepts `<>...</>`.
 */
function Fragment(_props) {
    throw new Error('Fragment is only valid as a JSX fragment factory tag');
}
/** @deprecated Use `<>...</>` / `Fragment` instead of `jsx-unwrap`. Kept for runtime unwrap of Fragment roots. */
const JSX_UNWRAP = 'jsx-unwrap';
function transformFunction(fn) {
    let str = fn.toString().split('=>')[1].trim();
    if (str.startsWith('{') && str.endsWith('}'))
        str = str.slice(1, -1);
    return str;
}
/** returns str like: "{{ str | filter1 | filter2 ... }}" */
function interpolation(str, ...filters) {
    if (typeof str === 'string')
        str = `"${str}"`;
    else if (str instanceof Function) {
        if (!str[exports.ProxySymbol])
            str = transformFunction(str);
    }
    return `{{${str}${filters.length ? '|' : ''}${filters.join('|')}}}`;
}
function scope(fn) {
    return compile(fn);
}
function createElement(tagName, props, ...children) {
    const el = document.createElement(tagName === Fragment ? 'div' : tagName);
    if (tagName === Fragment)
        el.setAttribute(JSX_UNWRAP, '');
    else if (props)
        for (const [k, v] of Object.entries(props)) {
            el.setAttribute(k, renderValue(v, k));
        }
    for (const child of children) {
        if (Array.isArray(child)) {
            const [first, ...rest] = child;
            if (first?.[exports.ProxySymbol] && rest.every(v => typeof v === 'string')) {
                el.append(interpolation(first, ...rest));
            }
            else {
                for (const subChild of child) {
                    el.append(subChild instanceof Node ? subChild : renderValue(subChild));
                }
            }
        }
        else {
            el.append(child instanceof Node ? child : renderValue(child));
        }
    }
    return el;
}
function renderValue(v, key) {
    if (v instanceof Function && !v[exports.ProxySymbol]) {
        const expr = transformFunction(v);
        return key ? expr : `{{${expr}}}`;
    }
    if (typeof v === 'object' && key === 'style') {
        return Object.entries(v).map(([k, v]) => [k.replace(/([A-Z])/g, '-$1').toLowerCase(), v].join(':')).join(';');
    }
    else if (typeof v === 'object') {
        return `{${Object.entries(v).map(([k, v]) => [k, v].join(':')).join(',')}}`;
    }
    if (!key && v[exports.ProxySymbol]) {
        return `{{${v}}}`;
    }
    if (typeof v === 'boolean' || typeof v === 'undefined' || v === null)
        return '';
    return v.toString();
}
function createProxy(parts, scopeName = '$') {
    const render = (...args) => {
        const argsStr = args.join(',');
        if (parts.length === 1 && parts[0] === scopeName)
            return interpolation(args[0], ...args.slice(1));
        return `${renderPath(parts, scopeName)}(${argsStr})`;
    };
    return new Proxy(render, {
        get(_0, key) {
            if (key === exports.ProxySymbol)
                return () => true;
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
function pathReducer(p, c, i) {
    return p + (Number.isInteger(c) ? `[${c}]` : `.${c}`);
}
function renderPath(parts, scopeName) {
    if (parts[0] === scopeName)
        return parts.slice(1).reduce(pathReducer);
    return parts.reduce(pathReducer);
}
/** TODO: support all function types */
function argumentNames(fn) {
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
/** TODO: support destructured args; reuse argumentNames so minified `ctrl=>` survives. */
function parseArguments(fn) {
    return argumentNames(fn).map((arg) => {
        // ponytail: destructuring `{a,b}` not supported here; argumentNames returns raw text
        if (arg.startsWith('{') && arg.endsWith('}')) {
            return arg
                .slice(1, -1)
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length);
        }
        return arg;
    });
}
function compile(render, scopeName) {
    const args = parseArguments(render);
    const props = args.map(s => {
        if (Array.isArray(s))
            return Object.fromEntries(s.map(s => [s, createProxy([s], scopeName)]));
        return createProxy([s], scopeName);
    });
    return render(...props);
}
function inExpr(arr, itemName) {
    return `${itemName} in ${arr}`;
}
function jsxTemplateUrl(render) {
    const fn = once(($sce) => {
        const compiled = compile(render);
        let html = '';
        if (Array.isArray(compiled)) {
            html = compiled.map(el => el.innerHTML).join('\n');
        }
        else {
            html = compiled.innerHTML;
        }
        render = undefined; // mark render for GC
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        return $sce.trustAsResourceUrl(url);
    });
    return ($sce) => fn($sce);
}
function jsxTemplate(render, scopeName) {
    if (typeof render === 'string') {
        const html = render;
        return () => html;
    }
    const compiled = compile(render, scopeName);
    let html = '';
    if (Array.isArray(compiled))
        html = compiled.map(el => el.outerHTML).join('\n');
    else if (compiled.hasAttribute(JSX_UNWRAP))
        html = compiled.innerHTML;
    else
        html = compiled.outerHTML;
    return () => html;
}
function buildJsxComponentOptions({ template, controllerAs: controllerAsOpt, ...args }) {
    if (typeof template === 'string') {
        return {
            ...args,
            template,
            controllerAs: controllerAsOpt || '$ctrl',
        };
    }
    const [controllerAs, scopeName] = argumentNames(template);
    return {
        ...args,
        template: jsxTemplate(template, scopeName),
        controllerAs: controllerAsOpt || controllerAs,
    };
}
function jsxComponent(angularAppOrOptions, componentName, options) {
    if (componentName != null && options != null) {
        return angularAppOrOptions.component(componentName, buildJsxComponentOptions(options));
    }
    return buildJsxComponentOptions(angularAppOrOptions);
}
// https://docs.angularjs.org/api/ng/directive/ngRepeat
// TODO: support (key, value)
// TODO: support "track by $expr"
// TODO: support "ng-repeat-start" "ng-repeat-end"
// TODO: support filter "item in items | filter : x | orderBy : order | limitTo : limit as results track by item.id"
function ngRepeat(items, fn) {
    const args = argumentNames(fn);
    const item = args.find(el => !el.startsWith('$'));
    const el = compile(fn);
    el.setAttribute('ng-repeat', `${item} in ${items}`);
    return el;
}
function ngRepeatObj(items, fn) {
    const args = argumentNames(fn);
    const [key, item] = args.filter(el => !el.startsWith('$'));
    const el = compile(fn);
    el.setAttribute('ng-repeat', `(${key}, ${item}) in ${items}`);
    return el;
}
/** returns expression with filters applied; "expr|filter1|filter2..." */
function filter(expr, ...filters) {
    return `${expr}${filters.length ? '|' : ''}${filters.join('|')}`;
}
