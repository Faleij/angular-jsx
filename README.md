# angular-jsx

Write AngularJS 1.x component templates in TSX. Expressions become Angular template strings. Use with TypeScript `jsxFactory: createElement`.

## Setup

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "createElement",
    "jsxFragmentFactory": "Fragment"
  }
}
```

Import the factories in each `.tsx` file that uses JSX or fragments:

```ts
import { createElement, Fragment, jsxComponent } from 'angular-jsx';
```

The runtime package uses ambient `angular` / `ng` types (no `import from 'angular'`), so linking this package does not load a second `@types/angular` and drop app augmentations such as `@types/angular-material`.

## Component

Two call forms:

```ts
// Register on the module (no nested app.component)
jsxComponent(app, 'jobAdCollection', {
  bindings: { isDialog: '<?' },
  controller: JobAdCollectionCtrl,
  template: (ctrl) => (
    <>
      <main-menu-button ng-if={() => !ctrl.isDialog}></main-menu-button>
      <input ng-model={ctrl.textSearch} ng-model-options={{ debounce: 300 }} />
    </>
  ),
});

// Or build options only (dialogs, or app.component(name, …))
app.component(
  'jobAdCollection',
  jsxComponent({
    controller: JobAdCollectionCtrl,
    template: (ctrl) => <input ng-model={ctrl.textSearch} />,
  }),
);
```

- First template parameter name becomes `controllerAs` (here `ctrl`).
- `template` may also be a plain HTML string (used after the compile-time loader runs).

## Expression rules

With the **compile-time** webpack loader or Vite plugin, attribute expressions are copied from the AST as Angular source (they are not run as JavaScript):

| TSX | Angular |
|-----|---------|
| `ng-model={ctrl.textSearch}` | `ng-model="ctrl.textSearch"` |
| `ng-if={!ctrl.isDialog}` | `ng-if="!ctrl.isDialog"` |
| `ng-if={() => !ctrl.isDialog}` | `ng-if="!ctrl.isDialog"` |
| `ng-change={ctrl.compileTerms()}` | `ng-change="ctrl.compileTerms()"` |
| `{ctrl.name}` (child) | `{{ctrl.name}}` |
| `{[ctrl.name, 'uppercase']}` | `{{ctrl.name\|uppercase}}` |
| `style={{ minWidth: '140px' }}` | `style="min-width:140px"` |
| `ng-model-options={{ debounce: 300 }}` | `ng-model-options="{debounce:300}"` |
| boolean prop `flex` | `flex=""` |

Without the loader/plugin (runtime Proxies), prefer arrows for boolean/call expressions: `ng-if={!ctrl.isDialog}` runs JavaScript `!` on a Proxy and is wrong.

## Fragment

`<>...</>` emits **children only** (no wrapper element):

```tsx
<>
  <md-toolbar>...</md-toolbar>
  <collection-vr ... />
</>
```

Import `Fragment` and set `jsxFragmentFactory` (see Setup).

## Helpers

- **`interpolation(expr, ...filters)`** — builds `{{expr|filter…}}`.
- **`ngRepeat(items, (item) => <el/>)`** — sets `ng-repeat="item in items"` on the element.
- **`ngRepeatObj(obj, (key, item) => <el/>)`** — sets `ng-repeat="(key, item) in obj"`.
- **`scope(fn)`** — compile a nested template function with Proxies.
- **`jsxTemplate(fn)`** — returns `() => html` for field templates and similar.
- **`filter(expr, ...filters)`** — string helper for filter chains.

`ngRepeat` needs a **single root element**. For several roots per item, keep a wrapper (or use `ng-repeat-start` / `ng-repeat-end` by hand). Fragment unwrap for multi-root repeats is not automatic yet.

## Compile-time transform (recommended)

Runtime compile uses `Function#toString()`. Minifiers can break that (for example `ctrl=>((0,createElement)…)`). Prefer the webpack loader or Vite plugin: both turn `jsxComponent` / `jsxTemplate` JSX into static Angular HTML **before** other TSX tooling. They need `typescript` from the host app (`peerDependencies`).

Build the package so `dist/` exists: `npm run build`

If a template cannot be lowered statically, the call is left unchanged and the runtime path still runs. Runtime `parseArguments` uses the same regex as `argumentNames` so minified `ctrl=>` forms still parse when needed.

The transform keeps the `ctrl.` prefix in the HTML and sets `controllerAs` from the template parameter name. After lowering, the template is a string, so minifiers do not rename those paths.

### Webpack loader

Loaders run right → left; put `angular-jsx/loader` **before** `ts-loader` (rightmost in `use`):

```js
{
  test: /\.tsx$/,
  use: [
    { loader: 'ts-loader', options: { allowTsInNodeModules: true } },
    { loader: 'angular-jsx/loader' },
  ],
},
{ test: /\.ts$/, loader: 'ts-loader', options: { allowTsInNodeModules: true } },
```

### Vite plugin

`angularJsx()` uses `enforce: 'pre'` so templates lower before esbuild TSX. The package ships CommonJS; from an ESM `vite.config.mts` use `createRequire`:

```ts
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const { angularJsx } = require('angular-jsx/vite');

export default defineConfig({
  plugins: [
    angularJsx(), // first / early in the list
    // …
  ],
  resolve: {
    // optional: point at a local checkout / symlink
    // alias: { 'angular-jsx': path.resolve('angular-jsx/loader') },
  },
  optimizeDeps: {
    // keep the runtime package out of prebundle if you alias to source
    exclude: ['angular-jsx'],
  },
});
```

Only `.tsx` files that contain `jsxComponent` or `jsxTemplate` are transformed.

### Exports

| Path | Role |
|------|------|
| `angular-jsx` | Runtime API (`src/angular-jsx.ts`) |
| `angular-jsx/loader` | Webpack loader (`dist/tsx-loader.js`) |
| `angular-jsx/vite` | Vite plugin (`dist/vite-plugin.js`) |
| `angular-jsx/tsx-to-angular` | Shared transform used by loader and Vite plugin |

## Scripts

```bash
npm run build       # tsc → dist/
npm run selfcheck   # build + assert job-ad-like transform
```

## License

MIT
