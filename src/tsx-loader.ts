import { transformSource } from './tsx-to-angular';

interface WebpackLoaderContext {
    resourcePath: string;
    callback: (err: Error | null, content?: string, sourceMap?: any) => void;
    async: () => (err: Error | null, content?: string, sourceMap?: any) => void;
}

/** Webpack loader: lower angular-jsx templates to Angular HTML before ts-loader. */
function angularJsxTsxLoader(this: WebpackLoaderContext, source: string): string | void {
    const callback = this.async();
    try {
        const out = transformSource(source, this.resourcePath);
        callback(null, out);
    } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
    }
}

export = angularJsxTsxLoader;
