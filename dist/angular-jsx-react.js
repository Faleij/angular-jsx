"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useState = useState;
exports.useEffect = useEffect;
exports.aJsxDirective = aJsxDirective;
exports.aJsxDirective2 = aJsxDirective2;
exports.createElement = createElement;
// useState - signal wrapper, adds signal to "unscopedSignals", aJsxComponent consumes all "unscopedSignals"
const angular_jsx_1 = require("./angular-jsx");
const signals_core_1 = require("@preact/signals-core");
const unscopedSignals = [];
let useStateHook;
function useState(initialValue) {
    if (useStateHook)
        return useStateHook(initialValue);
    const sig = (0, signals_core_1.signal)(initialValue);
    unscopedSignals.push(sig);
    const out = [sig.value, (v) => { sig.value = v; }];
    out.signal = sig;
    return out;
}
const unscopedEffects = [];
function useEffect(setup, dependencies) {
    unscopedEffects.push([setup, dependencies]);
}
/*
function aJsxComponent(componentFn, componentName, $compile, $scope, $timeout) {
  const $digest = $timeout(() => $scope.digest());
  const template = componentFn();
  const signals = useState.unscoped.splice(0, useState.unscoped.length);
  for (const signal of signals) signal.observe($digest);
  $compile(template)($scope);
}
*/
function aJsxDirective(reactComponentFn) {
    const jsx = reactComponentFn();
    const signals = unscopedSignals.splice(0, unscopedSignals.length);
    const effects = unscopedEffects.splice(0, unscopedEffects.length);
    const template = (0, angular_jsx_1.jsxTemplate)(jsx);
    return () => {
        return {
            restrict: 'E',
            scope: {},
            controller: ['$scope', '$timeout', ($scope, $timeout) => {
                    const digest = () => $scope.digest();
                    (0, signals_core_1.effect)(() => {
                        // access all signal values
                        for (const signal of signals)
                            signal.value;
                        $timeout(digest);
                    });
                }],
            template,
        };
    };
}
function aJsxDirective2(reactComponentFn) {
    return () => {
        return {
            restrict: 'E',
            scope: {},
            controller: ($scope, $timeout, $element, $compile) => {
                const digest = () => $scope.digest();
                const states = [];
                let stateIndex = 0;
                const useState = (initialValue) => {
                    if (states[stateIndex]) {
                        return states[stateIndex];
                    }
                    const sig = (0, signals_core_1.signal)(initialValue);
                    states.push(sig);
                    const out = [sig.value, (v) => { sig.value = v; }];
                    out.signal = sig;
                    states[stateIndex] = out;
                    stateIndex++;
                    return out;
                };
                (0, signals_core_1.effect)(() => {
                    useStateHook = useState;
                    const jsx = reactComponentFn($scope);
                    $element.empty().append($compile(jsx)($scope));
                    // $timeout(digest); // needed?
                    console.log('html', $element.html());
                });
            },
            template: '',
        };
    };
}
function interceptProp(k, v, el) {
    console.log({ k, v });
    if (k === 'onChange') {
        el.addEventListener('change', v);
        return true;
    }
    if (k === 'onClick') {
        el.addEventListener('click', v);
        window.angular.element(el).on('click', v);
        return true;
    }
    return false;
}
function createElement(tagName, props, ...children) {
    const el = document.createElement(tagName);
    if (props)
        for (const [k, v] of Object.entries(props)) {
            if (!interceptProp(k, v, el))
                el.setAttribute(k, renderValue(v, k));
        }
    for (const child of children) {
        el.append(child instanceof Node ? child : renderValue(child));
    }
    return el;
}
function renderValue(v, key) {
    if (v instanceof Function) {
        const expr = v.toString().split('=>')[1].trim();
        return key ? expr : `{{${expr}}}`;
    }
    if (typeof v === 'object' && key === 'style') {
        return Object.entries(v).map(([k, v]) => [k.replace(/([A-Z])/g, '-$1').toLowerCase(), v].join(':')).join(';');
    }
    else if (v === null) {
        return ``;
    }
    else if (typeof v === 'object') {
        return `{${Object.entries(v).map(([k, v]) => [k, v].join(':')).join(',')}}`;
    }
    if (!key) {
        return `{{${v}}}`;
    }
    return v.toString();
}
