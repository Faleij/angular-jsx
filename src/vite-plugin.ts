import { transformSource } from './tsx-to-angular';

/** Minimal Vite plugin shape — avoid depending on the `vite` package from this library. */
export interface AngularJsxVitePlugin {
    name: string;
    enforce?: 'pre' | 'post';
    transform: (
        code: string,
        id: string,
    ) => null | undefined | { code: string; map: null } | string;
}

/** Vite plugin: lower angular-jsx templates to Angular HTML before esbuild/TSX. */
export function angularJsx(): AngularJsxVitePlugin {
    return {
        name: 'angular-jsx',
        enforce: 'pre',
        transform(code, id) {
            const filePath = id.split('?')[0];
            if (!filePath.endsWith('.tsx')) return null;
            if (!code.includes('jsxComponent') && !code.includes('jsxTemplate')) return null;

            const out = transformSource(code, filePath);
            if (out === code) return null;
            return { code: out, map: null };
        },
    };
}
