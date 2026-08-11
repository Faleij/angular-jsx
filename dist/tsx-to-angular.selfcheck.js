"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ponytail: assert compile-time JSX→Angular HTML for job-ad-like attrs.
 * Run: npm run selfcheck
 */
const tsx_to_angular_1 = require("./tsx-to-angular");
const input = `
import { jsxComponent, createElement, Fragment } from 'angular-jsx';
jsxComponent({
  bindings: { isDialog: '<?' },
  controller: class {},
  template: (ctrl) => (
    <>
      <main-menu-button ng-if={() => !ctrl.isDialog}></main-menu-button>
      <input
        type="search"
        ng-model={ctrl.textSearch}
        ng-model-options={{ debounce: 300 }}
      />
      <md-button ng-if={() => !ctrl.isDialog} ui-sref="jobAd.create"></md-button>
    </>
  ),
});
`;
const out = (0, tsx_to_angular_1.transformSource)(input, 'job-ad-like.tsx');
const templateMatch = out.match(/template:\s*("(?:\\.|[^"\\])*")/);
const templateLit = templateMatch ? templateMatch[1] : '';
const html = templateLit ? JSON.parse(templateLit) : '';
const checks = [
    ['has ng-model ctrl.textSearch', out.includes('ng-model') && out.includes('ctrl.textSearch')],
    ['has ng-if !ctrl.isDialog', out.includes('!ctrl.isDialog')],
    ['template is string (no arrow body)', /template:\s*"/.test(out)],
    ['no => in template string', templateLit.indexOf('=>') === -1],
    ['has controllerAs ctrl', out.includes('controllerAs') && out.includes('"ctrl"')],
    ['fragment unwraps (no wrapper fragment tag)', !html.includes('<>') && html.startsWith('<main-menu-button')],
    ['fragment children present', html.includes('main-menu-button') && html.includes('<input') && html.includes('md-button')],
];
const registerForm = `
jsxComponent(app, "jobAdCollection", {
  controller: class {},
  template: (ctrl) => <input ng-model={ctrl.textSearch} />,
});
`;
const outReg = (0, tsx_to_angular_1.transformSource)(registerForm, 'register.tsx');
checks.push(['3-arg form lowers template', /template:\s*"/.test(outReg) && outReg.includes('ctrl.textSearch')], ['3-arg keeps app+name args', outReg.includes('jsxComponent(app, "jobAdCollection"')]);
let failed = 0;
for (const [name, ok] of checks) {
    if (!ok) {
        console.error('FAIL:', name);
        failed++;
    }
    else {
        console.log('ok:', name);
    }
}
if (failed) {
    console.error('--- output ---');
    console.error(out);
    throw new Error(`tsx-to-angular selfcheck failed (${failed})`);
}
console.log('tsx-to-angular selfcheck passed');
