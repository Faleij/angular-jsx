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

When this package is linked into an app that also uses `@types/angular-material` (or other `angular` module augmentations), pin a single `angular` types path in the app `tsconfig` so TypeScript does not pick up a nested `@types/angular` from this package:

```json
"paths": {
  "angular": ["node_modules/@types/angular/index.d.ts"]
}
```

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

| TSX | Angular |
|-----|---------|
| `ng-model={ctrl.textSearch}` | `ng-model="ctrl.textSearch"` |
| `ng-if={() => !ctrl.isDialog}` | `ng-if="!ctrl.isDialog"` |
| `{ctrl.name}` (child) | `{{ctrl.name}}` |
| `{[ctrl.name, 'uppercase']}` | `{{ctrl.name\|uppercase}}` |
| `style={{ minWidth: '140px' }}` | `style="min-width:140px"` |
| `ng-model-options={{ debounce: 300 }}` | `ng-model-options="{debounce:300}"` |
| boolean prop `flex` | `flex=""` |

Use an arrow for any expression that must stay as Angular source (do not write `ng-if={!ctrl.isDialog}` — that runs in JavaScript against a Proxy).

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

## Compile-time webpack loader (recommended)

Runtime compile uses `Function#toString()`. Minifiers can break that (for example `ctrl=>((0,createElement)…)`). Prefer the loader: it turns `jsxComponent` / `jsxTemplate` JSX into static Angular HTML **before** `ts-loader`. The loader needs `typescript` from the host app (`peerDependencies`).

1. Build the package so `dist/tsx-loader.js` exists: `npm run build`
2. Wire webpack (loaders run right → left):

```js
{
  test: /\.tsx$/,
  use: [
    { loader: 'ts-loader', options: { allowTsInNodeModules: true } },
    { loader: require.resolve('angular-jsx/loader') },
  ],
},
{ test: /\.ts$/, loader: 'ts-loader', options: { allowTsInNodeModules: true } },
```

If a template cannot be lowered statically, the call is left unchanged and the runtime path still runs. Runtime `parseArguments` uses the same regex as `argumentNames` so minified `ctrl=>` forms still parse when needed.

### Exports

| Path | Role |
|------|------|
| `angular-jsx` | Runtime API (`src/angular-jsx.ts`) |
| `angular-jsx/loader` | Webpack loader (`dist/tsx-loader.js`) |
| `angular-jsx/tsx-to-angular` | Transform used by the loader |

## Scripts

```bash
npm run build       # tsc → dist/
npm run selfcheck   # build + assert job-ad-like transform
```

## License

MIT
