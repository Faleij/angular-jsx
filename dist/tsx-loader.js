"use strict";
const tsx_to_angular_1 = require("./tsx-to-angular");
/** Webpack loader: lower angular-jsx templates to Angular HTML before ts-loader. */
function angularJsxTsxLoader(source) {
    const callback = this.async();
    try {
        const out = (0, tsx_to_angular_1.transformSource)(source, this.resourcePath);
        callback(null, out);
    }
    catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
    }
}
module.exports = angularJsxTsxLoader;
