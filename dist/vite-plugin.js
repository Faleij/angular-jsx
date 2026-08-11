"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.angularJsx = angularJsx;
const tsx_to_angular_1 = require("./tsx-to-angular");
/** Vite plugin: lower angular-jsx templates to Angular HTML before esbuild/TSX. */
function angularJsx() {
    return {
        name: 'angular-jsx',
        enforce: 'pre',
        transform(code, id) {
            const filePath = id.split('?')[0];
            if (!filePath.endsWith('.tsx'))
                return null;
            if (!code.includes('jsxComponent') && !code.includes('jsxTemplate'))
                return null;
            const out = (0, tsx_to_angular_1.transformSource)(code, filePath);
            if (out === code)
                return null;
            return { code: out, map: null };
        },
    };
}
