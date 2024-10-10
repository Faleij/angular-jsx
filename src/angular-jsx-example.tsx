import { IScope } from 'angular';
import { jsxComponent, ngRepeat, createElement, interpolation, ControllerScope } from './angular-jsx';
import { Window } from 'happy-dom';

// happy-dom is only used to mock DOM in node
const window = new Window({ url: 'http://localhost' });
(globalThis as any).document = window.document;
(globalThis as any).Node = window.Node;
(globalThis as any).createElement = createElement;


interface myScope extends IScope {
    myScopedVar: string;
}

class ExampleControllerClass {
    str = 'lol!';
    arr = ['str1', 'str2', 1337];
    username = 'myUsername';

    constructor(
        readonly $scope: myScope,
    ) {}
}

// {$.scopedVariable}
// {$(scopedVariable)}

// use: angular.module('myApp').component('myComponent', jsxComponent({...}));
const componentConfig = jsxComponent({
    controller: ExampleControllerClass,
    // template function automagically sets "controllerAs" from first argument name
    // second argument is always scope, inferred from controller if available
    template: (ctrl, $, someOtherAvailableVariable) => (
<div>
    <span>Type-safe ctrl variable access: {ctrl.str}</span>
    <span>Type-safe ctrl scope access: {ctrl.$scope.myScopedVar}</span>
    <span>Type-safe ctrl scope access: {$.myScopedVar}</span>
    <a ng-href={`img/{{${ctrl.username}}}.jpg`}>IMG</a>
    <a ng-href={`img/${interpolation(ctrl.username, 'uppercase')}.jpg`}>IMG2</a>
    <a ng-href={`img/{{${ctrl.username}|uppercase}}.jpg`}>IMG2</a>
    { /** all ngRepeat scope variables are typed, first non-$ prefixed variable is used as item name, other ngRepeat functionality not yet implemented */ }
    {ngRepeat(ctrl.arr, (deez, { $index }) => (<div class="repeated">{$index}: {deez}</div>))}
    {ngRepeat(ctrl.arr, (nutz, { $index, $odd, $even, $first, $last, $middle }) => (<div class="repeated">{$index}: {nutz}</div>))}
    Username: {interpolation(ctrl.username, 'capitalize')}
    Username: {[ctrl.username, 'uppercase']}
    Username: {[ctrl.username]}
    {[1,2].map((i) => (<i>{i}</i>))}
    {[1,2,3]}
</div>
    ),
})

console.log(componentConfig.template());