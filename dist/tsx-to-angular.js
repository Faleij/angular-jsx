"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformSource = transformSource;
const ts = __importStar(require("typescript"));
const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
/** Compile-time JSX → Angular HTML for jsxComponent / jsxTemplate. */
function transformSource(sourceText, fileName = 'source.tsx') {
    const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const replacements = [];
    const visit = (node) => {
        if (ts.isCallExpression(node)) {
            const jsxTpl = tryLowerJsxTemplateCall(node, sf);
            if (jsxTpl) {
                replacements.push(jsxTpl);
                return; // do not walk into replaced subtree
            }
            const jsxComp = tryLowerJsxComponentCall(node, sf);
            if (jsxComp) {
                replacements.push(...jsxComp);
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return applyReplacements(sourceText, replacements);
}
function applyReplacements(source, replacements) {
    const sorted = [...replacements].sort((a, b) => b.start - a.start);
    let out = source;
    for (const r of sorted) {
        out = out.slice(0, r.start) + r.text + out.slice(r.end);
    }
    return out;
}
function isCalleeNamed(node, name) {
    const c = node.expression;
    if (ts.isIdentifier(c))
        return c.text === name;
    if (ts.isPropertyAccessExpression(c))
        return c.name.text === name;
    return false;
}
function tryLowerJsxTemplateCall(node, sf) {
    // jsxTemplate(fn)() 
    if (node.arguments.length === 0 &&
        ts.isCallExpression(node.expression) &&
        isCalleeNamed(node.expression, 'jsxTemplate')) {
        const html = lowerTemplateFn(node.expression.arguments[0], sf);
        if (html == null)
            return null;
        return { start: node.getStart(sf), end: node.getEnd(), text: JSON.stringify(html) };
    }
    // jsxTemplate(fn)
    if (isCalleeNamed(node, 'jsxTemplate') && node.arguments.length >= 1) {
        const html = lowerTemplateFn(node.arguments[0], sf);
        if (html == null)
            return null;
        return {
            start: node.getStart(sf),
            end: node.getEnd(),
            text: `(() => ${JSON.stringify(html)})`,
        };
    }
    return null;
}
function tryLowerJsxComponentCall(node, sf) {
    if (!isCalleeNamed(node, 'jsxComponent'))
        return null;
    // jsxComponent(options) | jsxComponent(app, name, options)
    const arg = node.arguments.length >= 3 && ts.isObjectLiteralExpression(node.arguments[2])
        ? node.arguments[2]
        : node.arguments.length >= 1 && ts.isObjectLiteralExpression(node.arguments[0])
            ? node.arguments[0]
            : null;
    if (!arg)
        return null;
    const templateProp = arg.properties.find((p) => ts.isPropertyAssignment(p) &&
        ((ts.isIdentifier(p.name) && p.name.text === 'template') ||
            (ts.isStringLiteral(p.name) && p.name.text === 'template')));
    if (!templateProp)
        return null;
    const html = lowerTemplateFn(templateProp.initializer, sf);
    if (html == null)
        return null;
    const paramNames = getArrowParamNames(templateProp.initializer);
    const controllerAs = paramNames[0] || '$ctrl';
    const replacements = [
        {
            start: templateProp.initializer.getStart(sf),
            end: templateProp.initializer.getEnd(),
            text: JSON.stringify(html),
        },
    ];
    const existingAs = arg.properties.find((p) => ts.isPropertyAssignment(p) &&
        ((ts.isIdentifier(p.name) && p.name.text === 'controllerAs') ||
            (ts.isStringLiteral(p.name) && p.name.text === 'controllerAs')));
    if (existingAs) {
        replacements.push({
            start: existingAs.initializer.getStart(sf),
            end: existingAs.initializer.getEnd(),
            text: JSON.stringify(controllerAs),
        });
    }
    else {
        // insert after template property
        replacements.push({
            start: templateProp.getEnd(),
            end: templateProp.getEnd(),
            text: `,\n    controllerAs: ${JSON.stringify(controllerAs)}`,
        });
    }
    return replacements;
}
function getArrowParamNames(fn) {
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))
        return [];
    return fn.parameters.map((p) => {
        if (ts.isIdentifier(p.name))
            return p.name.text;
        return p.name.getText();
    }).filter((n) => n && !n.startsWith('{'));
}
function lowerTemplateFn(fn, sf) {
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))
        return null;
    const root = unwrapJsxRoot(fn.body);
    if (!root)
        return null;
    return jsxToHtml(root, sf);
}
function unwrapJsxRoot(body) {
    let expr = body;
    if (ts.isParenthesizedExpression(expr))
        expr = expr.expression;
    if (ts.isBlock(expr)) {
        const rets = expr.statements.filter(ts.isReturnStatement);
        if (rets.length !== 1 || !rets[0].expression)
            return null;
        expr = rets[0].expression;
        while (ts.isParenthesizedExpression(expr))
            expr = expr.expression;
    }
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) {
        return expr;
    }
    return null;
}
function jsxToHtml(node, sf) {
    if (ts.isJsxFragment(node)) {
        const parts = [];
        for (const child of node.children) {
            const html = jsxChildToHtml(child, sf);
            if (html == null)
                return null;
            parts.push(html);
        }
        return parts.join('');
    }
    if (ts.isJsxSelfClosingElement(node)) {
        return elementToHtml(node.tagName, node.attributes, [], sf, true);
    }
    if (ts.isJsxElement(node)) {
        const open = node.openingElement;
        const children = [];
        for (const child of node.children) {
            const html = jsxChildToHtml(child, sf);
            if (html == null)
                return null;
            children.push(html);
        }
        return elementToHtml(open.tagName, open.attributes, children, sf, false);
    }
    return null;
}
function jsxChildToHtml(child, sf) {
    if (ts.isJsxText(child)) {
        return child.getText(sf);
    }
    if (ts.isJsxExpression(child)) {
        if (!child.expression)
            return '';
        return expressionAsChild(child.expression, sf);
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
        return jsxToHtml(child, sf);
    }
    return null;
}
function elementToHtml(tagNameNode, attributes, children, sf, selfClosing) {
    const tag = tagNameNode.getText(sf);
    const attrs = [];
    let unwrap = false;
    for (const attr of attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr))
            return null;
        if (!ts.isJsxAttribute(attr))
            return null;
        const name = attr.name.getText(sf);
        // deprecated: prefer <>...</> / Fragment; still unwrap for old templates
        if (name === 'jsx-unwrap') {
            unwrap = true;
            continue;
        }
        if (!attr.initializer) {
            attrs.push(`${name}=""`);
            continue;
        }
        if (ts.isStringLiteral(attr.initializer) || ts.isNoSubstitutionTemplateLiteral(attr.initializer)) {
            attrs.push(`${name}=${JSON.stringify(attr.initializer.text)}`);
            continue;
        }
        if (ts.isJsxExpression(attr.initializer)) {
            if (!attr.initializer.expression) {
                attrs.push(`${name}=""`);
                continue;
            }
            const val = expressionAsAttr(attr.initializer.expression, name, sf);
            if (val == null)
                return null;
            if (val === '') {
                attrs.push(`${name}=""`);
            }
            else {
                attrs.push(`${name}=${JSON.stringify(val)}`);
            }
            continue;
        }
        return null;
    }
    if (unwrap) {
        return children.join('');
    }
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
    if (selfClosing || VOID_TAGS.has(tag.toLowerCase())) {
        return `<${tag}${attrStr}></${tag}>`;
    }
    return `<${tag}${attrStr}>${children.join('')}</${tag}>`;
}
function expressionAsAttr(expr, attrName, sf) {
    if (ts.isParenthesizedExpression(expr))
        return expressionAsAttr(expr.expression, attrName, sf);
    if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
        return '';
    }
    if (expr.kind === ts.SyntaxKind.NullKeyword || expr.kind === ts.SyntaxKind.UndefinedKeyword) {
        return '';
    }
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        return expr.text;
    }
    if (ts.isNumericLiteral(expr)) {
        return expr.text;
    }
    if (ts.isObjectLiteralExpression(expr)) {
        if (attrName === 'style')
            return styleObjectToCss(expr, sf);
        return objectToAngularExpr(expr, sf);
    }
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return arrowBodyToExpr(expr, sf);
    }
    if (ts.isCallExpression(expr) && isCalleeNamed(expr, 'interpolation')) {
        return interpolationCallToAttr(expr, sf);
    }
    // member / identifier / binary / etc. — take source text
    if (isStaticPathExpr(expr) || isStaticAngularExpr(expr)) {
        return stripParensText(expr, sf);
    }
    // template literal with only static + simple expr parts as attr value
    if (ts.isTemplateExpression(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        const t = templateToAngularString(expr, sf);
        return t;
    }
    return null;
}
function expressionAsChild(expr, sf) {
    if (ts.isParenthesizedExpression(expr))
        return expressionAsChild(expr.expression, sf);
    if (ts.isCallExpression(expr)) {
        if (isCalleeNamed(expr, 'ngRepeat'))
            return lowerNgRepeat(expr, sf, false);
        if (isCalleeNamed(expr, 'ngRepeatObj'))
            return lowerNgRepeat(expr, sf, true);
        if (isCalleeNamed(expr, 'scope')) {
            const html = lowerTemplateFn(expr.arguments[0], sf);
            return html;
        }
        if (isCalleeNamed(expr, 'interpolation')) {
            return interpolationCallToChild(expr, sf);
        }
        if (isCalleeNamed(expr, 'createElement'))
            return null;
    }
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) {
        return jsxToHtml(expr, sf);
    }
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        const body = arrowBodyToExpr(expr, sf);
        if (body == null)
            return null;
        return `{{${body}}}`;
    }
    if (ts.isArrayLiteralExpression(expr)) {
        // [proxy, 'filter1', ...] → {{proxy|filter1}}
        if (expr.elements.length >= 1) {
            const first = expr.elements[0];
            if (!first || ts.isSpreadElement(first))
                return null;
            const path = stripParensText(first, sf);
            const filters = expr.elements.slice(1).map((el) => {
                if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el))
                    return el.text;
                return null;
            });
            if (filters.every((f) => f != null)) {
                return `{{${path}${filters.length ? '|' : ''}${filters.join('|')}}}`;
            }
        }
        return null;
    }
    if (ts.isConditionalExpression(expr)) {
        // only if both branches lower to HTML strings — leave null (runtime)
        return null;
    }
    if (isStaticPathExpr(expr) || isStaticAngularExpr(expr)) {
        return `{{${stripParensText(expr, sf)}}}`;
    }
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        return expr.text;
    }
    if (ts.isTemplateExpression(expr)) {
        return templateToAngularString(expr, sf);
    }
    // null / undefined / false → empty
    if (expr.kind === ts.SyntaxKind.NullKeyword ||
        expr.kind === ts.SyntaxKind.UndefinedKeyword ||
        expr.kind === ts.SyntaxKind.FalseKeyword) {
        return '';
    }
    return null;
}
function lowerNgRepeat(call, sf, isObj) {
    if (call.arguments.length < 2)
        return null;
    const items = stripParensText(call.arguments[0], sf);
    const fn = call.arguments[1];
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))
        return null;
    const params = getArrowParamNames(fn);
    const html = lowerTemplateFn(fn, sf);
    if (html == null)
        return null;
    // inject ng-repeat onto root element
    const ngRepeat = isObj
        ? `(${params[0]}, ${params[1]}) in ${items}`
        : `${params.find((p) => !p.startsWith('$')) || params[0]} in ${items}`;
    return injectAttribute(html, 'ng-repeat', ngRepeat);
}
function injectAttribute(html, name, value) {
    const m = html.match(/^<([^\s>/]+)(\s[^>]*)?>/);
    if (!m)
        return null;
    const tag = m[1];
    const restAttrs = m[2] || '';
    const after = html.slice(m[0].length);
    return `<${tag}${restAttrs} ${name}=${JSON.stringify(value)}>${after}`;
}
function interpolationCallToChild(call, sf) {
    if (call.arguments.length < 1)
        return null;
    const first = call.arguments[0];
    let expr;
    if (ts.isArrowFunction(first) || ts.isFunctionExpression(first)) {
        const body = arrowBodyToExpr(first, sf);
        if (body == null)
            return null;
        expr = body;
    }
    else if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) {
        expr = `"${first.text}"`;
    }
    else {
        expr = stripParensText(first, sf);
    }
    const filters = call.arguments.slice(1).map((a) => {
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
            return a.text;
        return null;
    });
    if (filters.some((f) => f == null))
        return null;
    return `{{${expr}${filters.length ? '|' : ''}${filters.join('|')}}}`;
}
function interpolationCallToAttr(call, sf) {
    // interpolation used as attr value → without outer {{ }} when already inside attr that expects expr;
    // runtime put full {{ }} into attribute via toString of interpolation() return value.
    const child = interpolationCallToChild(call, sf);
    return child;
}
function arrowBodyToExpr(fn, sf) {
    let body = fn.body;
    if (ts.isBlock(body)) {
        const rets = body.statements.filter(ts.isReturnStatement);
        if (rets.length !== 1 || !rets[0].expression)
            return null;
        body = rets[0].expression;
    }
    if (ts.isParenthesizedExpression(body))
        body = body.expression;
    if (ts.isJsxElement(body) || ts.isJsxSelfClosingElement(body) || ts.isJsxFragment(body)) {
        return null; // JSX in arrow used as attr — not an expr
    }
    return stripParensText(body, sf);
}
function styleObjectToCss(obj, sf) {
    const parts = [];
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop))
            return null;
        const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        const valExpr = prop.initializer;
        let val;
        if (ts.isStringLiteral(valExpr) || ts.isNoSubstitutionTemplateLiteral(valExpr)) {
            val = valExpr.text;
        }
        else if (ts.isNumericLiteral(valExpr)) {
            val = valExpr.text;
        }
        else if (ts.isCallExpression(valExpr) && isCalleeNamed(valExpr, 'interpolation')) {
            const inner = interpolationCallToChild(valExpr, sf);
            if (inner == null)
                return null;
            val = inner;
        }
        else {
            val = stripParensText(valExpr, sf);
        }
        parts.push(`${cssKey}:${val}`);
    }
    return parts.join(';');
}
function objectToAngularExpr(obj, sf) {
    const parts = [];
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop))
            return null;
        const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
        const val = prop.initializer;
        let v;
        if (ts.isStringLiteral(val) || ts.isNoSubstitutionTemplateLiteral(val)) {
            v = JSON.stringify(val.text);
        }
        else if (ts.isNumericLiteral(val)) {
            v = val.text;
        }
        else if (val.kind === ts.SyntaxKind.TrueKeyword) {
            v = 'true';
        }
        else if (val.kind === ts.SyntaxKind.FalseKeyword) {
            v = 'false';
        }
        else {
            v = stripParensText(val, sf);
        }
        parts.push(`${key}:${v}`);
    }
    return `{${parts.join(',')}}`;
}
function templateToAngularString(expr, sf) {
    if (ts.isNoSubstitutionTemplateLiteral(expr))
        return expr.text;
    let out = expr.head.text;
    for (const span of expr.templateSpans) {
        const inner = span.expression;
        // ${interpolation(...)} or ${ctrl.x} or {{ already }}
        if (ts.isCallExpression(inner) && isCalleeNamed(inner, 'interpolation')) {
            const part = interpolationCallToChild(inner, sf);
            if (part == null)
                return null;
            out += part;
        }
        else if (isStaticPathExpr(inner)) {
            // runtime: `img/{{${ctrl.username}}}.jpg` embeds path inside {{ }}
            out += `{{${stripParensText(inner, sf)}}}`;
        }
        else {
            // allow {{ already in head }} patterns via getText of complex expr — reject
            return null;
        }
        out += span.literal.text;
    }
    return out;
}
function isStaticPathExpr(expr) {
    if (ts.isIdentifier(expr))
        return true;
    if (ts.isPropertyAccessExpression(expr))
        return isStaticPathExpr(expr.expression);
    if (ts.isElementAccessExpression(expr)) {
        return (isStaticPathExpr(expr.expression) &&
            !!expr.argumentExpression &&
            (ts.isStringLiteral(expr.argumentExpression) ||
                ts.isNumericLiteral(expr.argumentExpression) ||
                isStaticPathExpr(expr.argumentExpression)));
    }
    return false;
}
function isStaticAngularExpr(expr) {
    if (isStaticPathExpr(expr))
        return true;
    if (ts.isPrefixUnaryExpression(expr))
        return isStaticAngularExpr(expr.operand);
    if (ts.isBinaryExpression(expr)) {
        return isStaticAngularExpr(expr.left) && isStaticAngularExpr(expr.right);
    }
    if (ts.isConditionalExpression(expr)) {
        return (isStaticAngularExpr(expr.condition) &&
            isStaticAngularExpr(expr.whenTrue) &&
            isStaticAngularExpr(expr.whenFalse));
    }
    if (ts.isCallExpression(expr)) {
        // ctrl.fn() or ctrl.fn(a,b) — allow for ng-change etc. as attr expr bodies via arrow only;
        // bare call as path: allow if callee is static path and args are static
        if (!isStaticPathExpr(expr.expression) && !(ts.isPropertyAccessExpression(expr.expression) && isStaticPathExpr(expr.expression))) {
            // method call: ctrl.compileTerms()
            if (ts.isPropertyAccessExpression(expr.expression) && isStaticPathExpr(expr.expression.expression)) {
                return expr.arguments.every((a) => isStaticAngularExpr(a) ||
                    ts.isStringLiteral(a) ||
                    ts.isNumericLiteral(a));
            }
            return false;
        }
        return expr.arguments.every((a) => isStaticAngularExpr(a) ||
            ts.isStringLiteral(a) ||
            ts.isNumericLiteral(a));
    }
    if (ts.isParenthesizedExpression(expr))
        return isStaticAngularExpr(expr.expression);
    if (ts.isNumericLiteral(expr) || ts.isStringLiteral(expr))
        return true;
    if (expr.kind === ts.SyntaxKind.TrueKeyword ||
        expr.kind === ts.SyntaxKind.FalseKeyword ||
        expr.kind === ts.SyntaxKind.NullKeyword) {
        return true;
    }
    return false;
}
function stripParensText(expr, sf) {
    let n = expr;
    while (ts.isParenthesizedExpression(n))
        n = n.expression;
    return n.getText(sf).replace(/\s+/g, ' ').trim();
}
