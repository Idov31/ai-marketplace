import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path2) {
      const ctrl = callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visit_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = visit_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path2) {
      const ctrl = await callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visitAsync_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path2) {
      if (typeof visitor === "function")
        return visitor(key, node, path2);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path2);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path2);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path2);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path2);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path2);
      return void 0;
    }
    function replaceNode(key, path2, node) {
      const parent = path2[path2.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name2 = parts.shift();
        switch (name2) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name2}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name2 = `${prefix}${i}`;
        if (!exclude.has(name2))
          return name2;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path2, value) {
      let v = value;
      for (let i = path2.length - 1; i >= 0; --i) {
        const k = path2[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path2, value) {
        if (isEmptyPath(path2))
          this.add(value);
        else {
          const [key, ...rest] = path2;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        const [key, ...rest] = path2;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        const [key, ...rest] = path2;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name2} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path2, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path2, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name2) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name2 || prev.has(name2) ? anchors.findNewAnchor(name2 || "a", prev) : name2;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        if (Collection.isEmptyPath(path2)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        if (Collection.isEmptyPath(path2))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path2) {
        if (Collection.isEmptyPath(path2))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        if (Collection.isEmptyPath(path2)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path2), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path2, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name2, pos, code, message5) {
        super();
        this.name = name2;
        this.code = code;
        this.message = message5;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message5) {
        super("YAMLParseError", pos, code, message5);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message5) {
        super("YAMLWarning", pos, code, message5);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === "{";
      const fcName = isMap2 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name2 = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message5 = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message5);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message5 = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message5);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message5 = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message5);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message5 = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message5);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message5 = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message5);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message5 = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message5);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message5 = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message5);
          }
          break;
        default: {
          const message5 = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message5);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message5, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message5));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message5));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message5, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message5, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message5) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message5);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message5);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path2) => {
      let item = cst;
      for (const [field, index] of path2) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path2) => {
      const parent = visit.itemAtPath(cst, path2.slice(0, -1));
      const field = path2[path2.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path2, item, visitor) {
      let ctrl = visitor(item, path2);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path2.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path2);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message5 = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message: message5, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message5 = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message: message5 };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument3(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument3(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument3;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// packages/marketplace-core/out/types/packages.js
var require_packages = __commonJS({
  "packages/marketplace-core/out/types/packages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.repositoryProviders = exports.installScopes = exports.platforms = exports.packageTypes = void 0;
    exports.packageTypes = ["skill", "command", "mcp", "agent", "hook", "rule"];
    exports.platforms = ["codex", "cursor", "github-copilot", "claude", "deepseek-harness"];
    exports.installScopes = ["workspace", "global", "cloud"];
    exports.repositoryProviders = ["github", "azure-devops", "gitlab"];
  }
});

// packages/marketplace-core/out/ports.js
var require_ports = __commonJS({
  "packages/marketplace-core/out/ports.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.systemClock = void 0;
    exports.systemClock = { now: () => /* @__PURE__ */ new Date() };
  }
});

// packages/marketplace-core/out/services/pathPlanning.js
var require_pathPlanning = __commonJS({
  "packages/marketplace-core/out/services/pathPlanning.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PathSafetyError = void 0;
    exports.installRelativePath = installRelativePath3;
    exports.installRootRelativePath = installRootRelativePath2;
    exports.codexAgentConfigRelativePath = codexAgentConfigRelativePath2;
    exports.offloadRelativePath = offloadRelativePath3;
    exports.offloadRootRelativePath = offloadRootRelativePath2;
    exports.cloudInstallPath = cloudInstallPath2;
    exports.stateRelativePath = stateRelativePath2;
    exports.mcpPayloadRelativePath = mcpPayloadRelativePath3;
    exports.legacyStateRelativePath = legacyStateRelativePath2;
    exports.safeJoinRelative = safeJoinRelative2;
    exports.toPosixRelativePath = toPosixRelativePath2;
    exports.repoJoin = repoJoin2;
    var path2 = __importStar(__require("path"));
    var PathSafetyError2 = class extends Error {
      constructor(message5) {
        super(message5);
        this.name = "PathSafetyError";
      }
    };
    exports.PathSafetyError = PathSafetyError2;
    var defaultInstallRoots2 = {
      codex: {
        skill: ".codex/skills",
        command: ".codex/commands",
        mcp: ".codex/mcps",
        agent: ".codex/agents",
        hook: ".codex/hooks",
        rule: ".codex/rules"
      },
      cursor: {
        skill: ".cursor/skills",
        command: ".cursor/commands",
        mcp: ".cursor/mcps",
        agent: ".cursor/agents",
        hook: ".cursor/hooks",
        rule: ".cursor/rules"
      },
      "github-copilot": {
        skill: ".github/skills",
        command: ".github/commands",
        mcp: ".github/mcps",
        agent: ".github/agents",
        hook: ".github/hooks",
        rule: ".github/rules"
      },
      claude: {
        skill: ".claude/skills",
        command: ".claude/commands",
        mcp: ".claude/mcps",
        agent: ".claude/agents",
        hook: ".claude/hooks",
        rule: ".claude/rules"
      },
      "deepseek-harness": {
        skill: ".dsh/skills",
        command: ".ai_marketplace/deepseek-harness/bundles",
        mcp: ".ai_marketplace/deepseek-harness/bundles",
        agent: ".ai_marketplace/deepseek-harness/bundles",
        hook: ".ai_marketplace/deepseek-harness/bundles",
        rule: ".dsh/rules"
      }
    };
    function installRelativePath3(platform, packageType, packageId, overrides) {
      const base = safeJoinRelative2(installRootRelativePath2(platform, packageType, overrides), packageId);
      return platform === "claude" && isClaudeFlatFileType2(packageType) ? `${base}.md` : base;
    }
    function isClaudeFlatFileType2(packageType) {
      return packageType === "command" || packageType === "agent" || packageType === "rule";
    }
    function installRootRelativePath2(platform, packageType, overrides) {
      const overrideRoot = overrides[platform]?.[packageType];
      return safeJoinRelative2(overrideRoot && overrideRoot.trim().length > 0 ? overrideRoot : defaultInstallRoots2[platform][packageType]);
    }
    function codexAgentConfigRelativePath2(packageId, overrides) {
      return `${safeJoinRelative2(installRootRelativePath2("codex", "agent", overrides), packageId)}.toml`;
    }
    function offloadRelativePath3(platform, packageType, packageId) {
      return safeJoinRelative2(offloadRootRelativePath2(platform, packageType), packageId);
    }
    function offloadRootRelativePath2(platform, packageType) {
      return safeJoinRelative2(".offload", platform, pluralizePackageType2(packageType));
    }
    function cloudInstallPath2(platform, packageType, packageId) {
      return safeJoinRelative2("cloud", platform, pluralizePackageType2(packageType), packageId);
    }
    function stateRelativePath2() {
      return ".ai_marketplace/installed.json";
    }
    function mcpPayloadRelativePath3(platform, sourceId, packageId) {
      return safeJoinRelative2(".ai_marketplace", "mcp-packages", platform, sourceId, packageId);
    }
    function legacyStateRelativePath2() {
      return ".ai-marketplace/installed.json";
    }
    function safeJoinRelative2(...segments) {
      const raw = segments.join("/");
      const slashNormalized = raw.replaceAll("\\", "/");
      if (slashNormalized.startsWith("/") || /^[a-zA-Z]:/.test(slashNormalized)) {
        throw new PathSafetyError2(`Unsafe relative path '${raw}'.`);
      }
      const cleaned = slashNormalized.replace(/\/+$/, "");
      if (cleaned.split("/").some((part) => part === "..")) {
        throw new PathSafetyError2(`Unsafe relative path '${raw}'.`);
      }
      const normalized = path2.posix.normalize(cleaned);
      if (normalized === "." || normalized.length === 0) {
        throw new PathSafetyError2("Path must not be empty.");
      }
      if (path2.posix.isAbsolute(normalized) || normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
        throw new PathSafetyError2(`Unsafe relative path '${raw}'.`);
      }
      if (normalized.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
        throw new PathSafetyError2(`Unsafe relative path '${raw}'.`);
      }
      return normalized;
    }
    function toPosixRelativePath2(value) {
      return safeJoinRelative2(value);
    }
    function repoJoin2(...segments) {
      const raw = segments.join("/");
      const slashNormalized = raw.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
      if (/^[a-zA-Z]:/.test(slashNormalized)) {
        throw new PathSafetyError2(`Unsafe repository path '${raw}'.`);
      }
      if (slashNormalized.split("/").some((part) => part === "..")) {
        throw new PathSafetyError2(`Unsafe repository path '${raw}'.`);
      }
      const normalized = path2.posix.normalize(slashNormalized);
      if (normalized === "." || normalized.length === 0) {
        return "/";
      }
      if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
        throw new PathSafetyError2(`Unsafe repository path '${raw}'.`);
      }
      return `/${normalized}`;
    }
    function pluralizePackageType2(type) {
      switch (type) {
        case "skill":
          return "skills";
        case "command":
          return "commands";
        case "mcp":
          return "mcps";
        case "agent":
          return "agents";
        case "hook":
          return "hooks";
        case "rule":
          return "rules";
      }
    }
  }
});

// packages/marketplace-core/out/services/manifestSchema.js
var require_manifestSchema = __commonJS({
  "packages/marketplace-core/out/services/manifestSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.canonicalManifestFields = exports.currentManifestReaderSchemaVersion = exports.canonicalManifestFileName = void 0;
    exports.manifestFieldDisposition = manifestFieldDisposition2;
    exports.isManifestPath = isManifestPath2;
    exports.manifestSourcePath = manifestSourcePath2;
    exports.selectManifestCandidates = selectManifestCandidates2;
    exports.selectManifestInFolder = selectManifestInFolder2;
    exports.isRootManifestFile = isRootManifestFile2;
    exports.createMarketplaceManifestJsonSchema = createMarketplaceManifestJsonSchema;
    exports.canonicalManifestFileName = "ai_marketplace.yaml";
    exports.currentManifestReaderSchemaVersion = 1;
    function manifestFieldDisposition2(lifecycle, schemaVersion, replacementPresent) {
      if (schemaVersion < lifecycle.introducedIn)
        return "reject-not-introduced";
      if (lifecycle.removedIn !== null && schemaVersion >= lifecycle.removedIn)
        return "reject-removed";
      if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn && lifecycle.replacement !== null && replacementPresent) {
        return "prefer-replacement";
      }
      return "accept";
    }
    var activeV12 = { introducedIn: 1, deprecatedIn: null, removedIn: null, replacement: null };
    exports.canonicalManifestFields = Object.freeze(Object.fromEntries([
      "schema_version",
      "minimum_reader_schema_version",
      "package",
      "package.name",
      "package.type",
      "package.version",
      "package.description",
      "package.group",
      "package.entrypoint",
      "targets",
      "targets.platforms",
      "targets.delivery",
      "installation",
      "installation.default",
      "metadata",
      "metadata.tags",
      "metadata.icon",
      "metadata.evaluation_score",
      "history",
      "history.previous_revision",
      "history.migrations",
      "history.migrations[]",
      "history.migrations[].from",
      "history.migrations[].from.source_id",
      "history.migrations[].from.name",
      "history.migrations[].from.repository",
      "history.migrations[].from.branch",
      "history.migrations[].from.path"
    ].map((path2) => [path2, activeV12])));
    function isManifestPath2(path2) {
      const name2 = path2.replace(/\\/g, "/").split("/").at(-1);
      return name2 === exports.canonicalManifestFileName;
    }
    function manifestSourcePath2(manifestPath) {
      const normalized = manifestPath.replace(/\\/g, "/");
      if (!isManifestPath2(normalized))
        throw new Error(`Unsupported AI Marketplace manifest path '${manifestPath}'.`);
      return normalized.slice(0, -exports.canonicalManifestFileName.length).replace(/\/$/, "");
    }
    function selectManifestCandidates2(paths) {
      const folders = /* @__PURE__ */ new Map();
      for (const path2 of paths) {
        if (!isManifestPath2(path2))
          continue;
        const sourcePath = manifestSourcePath2(path2);
        folders.set(sourcePath, path2);
      }
      return [...folders.entries()].map(([sourcePath, path2]) => ({ path: path2, sourcePath }));
    }
    function selectManifestInFolder2(paths, sourcePath) {
      return selectManifestCandidates2(paths).find((candidate) => candidate.sourcePath === sourcePath.replace(/\/$/, ""));
    }
    function isRootManifestFile2(relativePath) {
      return relativePath === exports.canonicalManifestFileName;
    }
    function createMarketplaceManifestJsonSchema() {
      const property = (path2, schema) => ({
        ...schema,
        "x-ai-marketplace-introduced-in": exports.canonicalManifestFields[path2].introducedIn,
        "x-ai-marketplace-deprecated-in": exports.canonicalManifestFields[path2].deprecatedIn,
        "x-ai-marketplace-removed-in": exports.canonicalManifestFields[path2].removedIn,
        "x-ai-marketplace-replacement": exports.canonicalManifestFields[path2].replacement
      });
      const string = (path2, extra = {}) => property(path2, { type: "string", minLength: 1, ...extra });
      const migrationFromProperties = {
        source_id: string("history.migrations[].from.source_id"),
        name: string("history.migrations[].from.name"),
        repository: string("history.migrations[].from.repository"),
        branch: string("history.migrations[].from.branch"),
        path: string("history.migrations[].from.path")
      };
      return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "AI Marketplace package manifest",
        type: "object",
        required: ["schema_version", "minimum_reader_schema_version", "package", "targets"],
        additionalProperties: true,
        properties: {
          schema_version: property("schema_version", { type: "integer", minimum: 1 }),
          minimum_reader_schema_version: property("minimum_reader_schema_version", { type: "integer", minimum: 1 }),
          package: property("package", { type: "object", required: ["name", "type", "version", "description", "entrypoint"], additionalProperties: true, properties: {
            name: string("package.name"),
            type: string("package.type", { enum: ["skill", "command", "mcp", "agent", "hook", "rule"] }),
            version: string("package.version", { pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$" }),
            description: string("package.description"),
            group: string("package.group"),
            entrypoint: string("package.entrypoint")
          } }),
          targets: property("targets", { type: "object", required: ["platforms", "delivery"], additionalProperties: true, properties: {
            platforms: property("targets.platforms", { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["codex", "cursor", "github-copilot", "claude", "deepseek-harness"] } }),
            delivery: property("targets.delivery", { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["workspace", "global", "cloud"] } })
          } }),
          installation: property("installation", { type: "object", additionalProperties: true, properties: { default: property("installation.default", { type: "boolean", default: false }) } }),
          metadata: property("metadata", { type: "object", additionalProperties: true, properties: {
            tags: property("metadata.tags", { type: "array", uniqueItems: true, default: [], items: { type: "string", minLength: 1 } }),
            icon: string("metadata.icon"),
            evaluation_score: property("metadata.evaluation_score", { type: "number", minimum: 0, maximum: 10 })
          } }),
          history: property("history", { type: "object", additionalProperties: true, properties: {
            previous_revision: string("history.previous_revision", { pattern: "^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$" }),
            migrations: property("history.migrations", { type: "array", minItems: 1, uniqueItems: true, items: property("history.migrations[]", { type: "object", required: ["from"], additionalProperties: true, properties: {
              from: property("history.migrations[].from", { type: "object", minProperties: 1, additionalProperties: true, properties: migrationFromProperties })
            } }) })
          } })
        }
      };
    }
  }
});

// packages/marketplace-core/out/services/versioning.js
var require_versioning = __commonJS({
  "packages/marketplace-core/out/services/versioning.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compareVersions = compareVersions2;
    exports.isSemanticVersion = isSemanticVersion2;
    exports.isUpdateAvailable = isUpdateAvailable3;
    function compareVersions2(left, right) {
      const leftSemver = parseSemanticVersion2(left);
      const rightSemver = parseSemanticVersion2(right);
      if (leftSemver && rightSemver)
        return compareSemanticVersions2(leftSemver, rightSemver);
      const leftParts = tokenizeVersion2(left);
      const rightParts = tokenizeVersion2(right);
      const maxLength = Math.max(leftParts.length, rightParts.length);
      for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] ?? { kind: "number", value: 0 };
        const rightPart = rightParts[index] ?? { kind: "number", value: 0 };
        const compared = compareVersionPart2(leftPart, rightPart);
        if (compared !== 0) {
          return compared;
        }
      }
      return 0;
    }
    function isSemanticVersion2(value) {
      return parseSemanticVersion2(value) !== void 0;
    }
    function parseSemanticVersion2(value) {
      const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
      if (!match)
        return void 0;
      return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4]?.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part) ?? [] };
    }
    function compareSemanticVersions2(left, right) {
      for (const key of ["major", "minor", "patch"])
        if (left[key] !== right[key])
          return Math.sign(left[key] - right[key]);
      if (left.prerelease.length === 0 || right.prerelease.length === 0)
        return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length === 0 ? 1 : -1;
      const length = Math.max(left.prerelease.length, right.prerelease.length);
      for (let index = 0; index < length; index += 1) {
        const l = left.prerelease[index];
        const r = right.prerelease[index];
        if (l === void 0 || r === void 0)
          return l === r ? 0 : l === void 0 ? -1 : 1;
        if (l === r)
          continue;
        if (typeof l === "number" && typeof r === "number")
          return Math.sign(l - r);
        if (typeof l === "number")
          return -1;
        if (typeof r === "number")
          return 1;
        return l.localeCompare(r);
      }
      return 0;
    }
    function isUpdateAvailable3(installedVersion, availableVersion) {
      return compareVersions2(installedVersion, availableVersion) < 0;
    }
    function tokenizeVersion2(version) {
      return version.trim().split(/[.+_-]/).filter(Boolean).map((part) => {
        if (/^\d+$/.test(part)) {
          return { kind: "number", value: Number(part) };
        }
        return { kind: "text", value: part.toLowerCase() };
      });
    }
    function compareVersionPart2(left, right) {
      if (left.kind === "number" && right.kind === "number") {
        return Math.sign(left.value - right.value);
      }
      if (left.kind === "number") {
        return 1;
      }
      if (right.kind === "number") {
        return -1;
      }
      return left.value.localeCompare(right.value);
    }
  }
});

// packages/marketplace-core/out/services/validation.js
var require_validation = __commonJS({
  "packages/marketplace-core/out/services/validation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValidationError = void 0;
    exports.isPackageType = isPackageType2;
    exports.isPlatform = isPlatform2;
    exports.validateMarketplaceManifest = validateMarketplaceManifest2;
    exports.validateMigrationSourceIdentity = validateMigrationSourceIdentity2;
    exports.parseHotloadFlag = parseHotloadFlag2;
    var packages_1 = require_packages();
    var pathPlanning_1 = require_pathPlanning();
    var manifestSchema_1 = require_manifestSchema();
    var versioning_1 = require_versioning();
    var idPattern2 = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
    var groupPattern2 = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/;
    var gitRevisionPattern2 = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
    var ValidationError2 = class extends Error {
      constructor(message5) {
        super(message5);
        this.name = "ValidationError";
      }
    };
    exports.ValidationError = ValidationError2;
    function isPackageType2(value) {
      return packages_1.packageTypes.includes(value);
    }
    function isPlatform2(value) {
      return packages_1.platforms.includes(value);
    }
    function validateMarketplaceManifest2(value, source) {
      if (!isRecord7(value)) {
        throw new ValidationError2(`AI Marketplace manifest at ${source} must be an object.`);
      }
      const schemaVersion = readPositiveInteger2(value, "schema_version", source);
      const minimumReaderSchemaVersion = readPositiveInteger2(value, "minimum_reader_schema_version", source);
      if (minimumReaderSchemaVersion > schemaVersion)
        throw new ValidationError2(`Manifest at ${source} has minimum_reader_schema_version greater than schema_version.`);
      if (minimumReaderSchemaVersion > manifestSchema_1.currentManifestReaderSchemaVersion) {
        throw new ValidationError2(`Manifest at ${source} requires reader schema ${minimumReaderSchemaVersion}, but this client supports ${manifestSchema_1.currentManifestReaderSchemaVersion}.`);
      }
      const diagnostics = canonicalDiagnostics2(value, schemaVersion, source);
      const pkg = readRecord2(value, "package", source);
      const targets = readRecord2(value, "targets", source);
      const installation = optionalRecord2(value, "installation", source) ?? {};
      const metadata = optionalRecord2(value, "metadata", source) ?? {};
      const history = optionalRecord2(value, "history", source) ?? {};
      const canonicalPlatforms = readCanonicalStringArray2(targets, "platforms", source);
      const canonicalDelivery = readCanonicalStringArray2(targets, "delivery", source);
      const tags = metadata["tags"] === void 0 ? [] : readCanonicalStringArray2(metadata, "tags", source, true);
      const defaultInstall = optionalBoolean2(installation, "default", source) ?? false;
      const flat = {
        name: pkg["name"],
        type: pkg["type"],
        version: pkg["version"],
        description: pkg["description"],
        group: pkg["group"],
        entrypoint: pkg["entrypoint"],
        platforms: canonicalPlatforms,
        delivery: canonicalDelivery,
        keywords: tags,
        icon: metadata["icon"],
        "evaluation-score": metadata["evaluation_score"],
        previous_version: history["previous_revision"],
        migrations: history["migrations"]
      };
      if (!(0, versioning_1.isSemanticVersion)(readString2(pkg, "version", source)))
        throw new ValidationError2(`Manifest at ${source} has an invalid SemVer 2.0 package.version.`);
      for (const [path2, values] of [["targets.platforms", canonicalPlatforms], ["targets.delivery", canonicalDelivery], ["metadata.tags", tags]])
        assertUniqueStrings2(values, path2, source);
      const manifest = { ...validateNormalizedManifest2(flat, source), defaultInstall };
      return { manifest, compatibility: { schemaVersion, minimumReaderSchemaVersion }, diagnostics };
    }
    function validateNormalizedManifest2(value, source) {
      const qualifiedName = readString2(value, "name", source);
      const id = packageIdFromQualifiedName2(qualifiedName, source);
      const group = optionalString2(value, "group", source) ?? groupFromQualifiedName2(qualifiedName, source);
      const type = readString2(value, "type", source);
      const version = readString2(value, "version", source);
      const description = readString2(value, "description", source);
      const entrypoint = readString2(value, "entrypoint", source);
      const manifestPlatforms = readStringArray2(value, "platforms", source);
      const manifestDelivery = readStringArray2(value, "delivery", source);
      const tags = readStringArray2(value, "keywords", source);
      const icon = optionalString2(value, "icon", source);
      const previousVersion = optionalString2(value, "previous_version", source);
      const migrations = optionalMigrations2(value, source, qualifiedName);
      if (!isSafeGroup2(group)) {
        throw new ValidationError2(`Manifest at ${source} has an unsafe group.`);
      }
      if (!isPackageType2(type)) {
        throw new ValidationError2(`Manifest at ${source} has unsupported type '${type}'.`);
      }
      if (previousVersion !== void 0 && !gitRevisionPattern2.test(previousVersion)) {
        throw new ValidationError2(`Manifest at ${source} has an invalid 'previous_version'. Expected a full 40 or 64 character hexadecimal Git revision.`);
      }
      if (entrypoint.length === 0 || entrypoint.includes("\\") || entrypoint.startsWith("/") || entrypoint.includes("..")) {
        throw new ValidationError2(`Manifest at ${source} has an unsafe entrypoint.`);
      }
      const parsedPlatforms = manifestPlatforms.map((platform) => {
        if (!isPlatform2(platform)) {
          throw new ValidationError2(`Manifest at ${source} has unsupported platform '${platform}'.`);
        }
        return platform;
      });
      if (parsedPlatforms.length === 0) {
        throw new ValidationError2(`Manifest at ${source} must include at least one platform.`);
      }
      if (type === "hook" && parsedPlatforms.some((platform) => platform !== "codex" && platform !== "github-copilot" && platform !== "claude" && platform !== "deepseek-harness")) {
        throw new ValidationError2(`Manifest at ${source} has an unsupported platform for hook packages.`);
      }
      const delivery = parseDelivery2(manifestDelivery, type, source);
      if (delivery.includes("cloud") && parsedPlatforms.includes("claude")) {
        throw new ValidationError2(`Manifest at ${source} cannot use cloud delivery for the Claude platform.`);
      }
      if (parsedPlatforms.length === 1 && parsedPlatforms[0] === "deepseek-harness") {
        if (delivery.includes("cloud"))
          throw new ValidationError2(`Manifest at ${source} cannot use cloud delivery for DeepSeek Harness.`);
        if (type !== "skill" && type !== "rule" && delivery.includes("workspace")) {
          throw new ValidationError2(`Manifest at ${source} supports only global delivery for DeepSeek Harness ${type} packages.`);
        }
      }
      const evaluationScore = type === "skill" || type === "command" ? optionalEvaluationScore2(value, source) : void 0;
      return {
        id,
        qualifiedName,
        name: qualifiedName,
        group,
        type,
        version,
        description,
        entrypoint,
        platforms: parsedPlatforms,
        delivery,
        tags,
        ...previousVersion === void 0 ? {} : { previousVersion: previousVersion.toLowerCase() },
        ...icon === void 0 ? {} : { icon },
        ...evaluationScore === void 0 ? {} : { evaluationScore },
        ...migrations === void 0 ? {} : { migrations }
      };
    }
    function validateMigrationSourceIdentity2(manifest, sourceId, source) {
      const self = (manifest.migrations ?? []).find((migration) => (migration.from.sourceId ?? sourceId) === sourceId && (migration.from.name ?? manifest.qualifiedName) === manifest.qualifiedName && migration.from.repository === void 0);
      if (self)
        throw new ValidationError2(`Manifest at ${source} contains a migration that maps the package to itself.`);
    }
    function optionalMigrations2(record, source, destinationName) {
      const value = record["migrations"];
      if (value === void 0)
        return void 0;
      if (!Array.isArray(value) || value.length === 0)
        throw new ValidationError2(`Manifest at ${source} has invalid 'migrations'. Expected a non-empty array.`);
      const migrations = value.map((item, index) => {
        if (!isRecord7(item) || !isRecord7(item["from"])) {
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} must contain only a 'from' mapping.`);
        }
        const from = item["from"];
        const allowed = /* @__PURE__ */ new Set(["source_id", "name", "repository", "branch", "path"]);
        const unknown = Object.keys(from).find((key) => !allowed.has(key));
        if (unknown)
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} contains unknown field '${unknown}'.`);
        const sourceId = optionalString2(from, "source_id", source);
        const name2 = optionalString2(from, "name", source);
        const repository = optionalString2(from, "repository", source);
        const branch = optionalString2(from, "branch", source);
        const migrationPath = optionalString2(from, "path", source);
        if (sourceId !== void 0 && !idPattern2.test(sourceId))
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} has an unsafe source_id.`);
        if (name2 !== void 0)
          packageIdFromQualifiedName2(name2, source);
        const provenanceCount = [repository, branch, migrationPath].filter((field) => field !== void 0).length;
        if (provenanceCount !== 0 && provenanceCount !== 3)
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} must provide repository, branch, and path together.`);
        if (branch !== void 0 && (branch.includes("..") || branch.includes("\\") || branch.startsWith("/")))
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} has an unsafe branch.`);
        if (repository !== void 0 && !isSafeRepository2(repository))
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} has an unsafe repository.`);
        let normalizedPath;
        try {
          normalizedPath = migrationPath === void 0 ? void 0 : (0, pathPlanning_1.repoJoin)(migrationPath);
        } catch {
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} has an unsafe path.`);
        }
        if (sourceId === void 0 && name2 === void 0 && repository === void 0)
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} does not identify a predecessor.`);
        if (sourceId === void 0 && name2 === destinationName && repository === void 0)
          throw new ValidationError2(`Manifest at ${source} migration ${index + 1} maps the package to itself.`);
        return { from: {
          ...sourceId === void 0 ? {} : { sourceId },
          ...name2 === void 0 ? {} : { name: name2 },
          ...repository === void 0 ? {} : { repository, branch, path: normalizedPath }
        } };
      });
      const keys = migrations.map(({ from }) => JSON.stringify(from));
      if (new Set(keys).size !== keys.length)
        throw new ValidationError2(`Manifest at ${source} contains duplicate migration entries.`);
      return migrations;
    }
    function isSafeRepository2(repository) {
      return !repository.includes("\\") && !repository.startsWith("/") && repository.split("/").length <= 2 && repository.split("/").every((segment) => idPattern2.test(segment) && segment !== "." && segment !== "..");
    }
    function parseDelivery2(values, type, source) {
      const delivery = values.map((value) => {
        if (!packages_1.installScopes.includes(value)) {
          throw new ValidationError2(`Manifest at ${source} has unsupported delivery '${value}'.`);
        }
        return value;
      });
      if (delivery.length === 0) {
        throw new ValidationError2(`Manifest at ${source} must include at least one delivery target.`);
      }
      if (type === "mcp" && (delivery.length !== 1 || delivery[0] !== "global")) {
        throw new ValidationError2(`Manifest at ${source} must use only global delivery for MCP packages.`);
      }
      if (delivery.includes("cloud") && type !== "agent") {
        throw new ValidationError2(`Manifest at ${source} uses cloud delivery, which is currently supported only for agent packages.`);
      }
      return [...new Set(delivery)];
    }
    function packageIdFromQualifiedName2(qualifiedName, source) {
      const segments = qualifiedName.split("/");
      const id = segments.at(-1) ?? "";
      if (!idPattern2.test(id)) {
        throw new ValidationError2(`Manifest at ${source} has an unsafe package name.`);
      }
      if (qualifiedName.includes("\\") || segments.some((segment) => segment.trim().length === 0 || segment === "." || segment === "..") || segments.length > 1 && !qualifiedName.startsWith("@")) {
        throw new ValidationError2(`Manifest at ${source} has an invalid scoped package name.`);
      }
      return id;
    }
    function groupFromQualifiedName2(qualifiedName, source) {
      const slashIndex = qualifiedName.lastIndexOf("/");
      if (slashIndex <= 1 || !qualifiedName.startsWith("@")) {
        throw new ValidationError2(`Manifest at ${source} must include 'group' when its package name is unscoped.`);
      }
      const group = qualifiedName.slice(1, slashIndex);
      if (!isSafeGroup2(group)) {
        throw new ValidationError2(`Manifest at ${source} has an unsafe group derived from its package name.`);
      }
      return group;
    }
    function isSafeGroup2(group) {
      return groupPattern2.test(group) && !group.includes("\\") && group.split("/").every((segment) => segment !== "." && segment !== ".." && segment.length > 0);
    }
    function parseHotloadFlag2(entrypointContent) {
      const normalized = entrypointContent.replace(/^\uFEFF/, "");
      const lines = normalized.split(/\r?\n/).slice(0, 80);
      const prologueLines = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" && prologueLines.length === 0) {
          continue;
        }
        if (trimmed === "---" || trimmed === "+++") {
          if (prologueLines.length === 0) {
            prologueLines.push(trimmed);
            continue;
          }
          break;
        }
        if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.includes(":")) {
          prologueLines.push(trimmed.replace(/^[/#*\s]+/, ""));
          continue;
        }
        break;
      }
      return prologueLines.some((line) => /^hotload\s*:\s*true\s*$/i.test(line));
    }
    function readString2(record, key, source) {
      const value = record[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new ValidationError2(`Manifest at ${source} must include a non-empty '${key}' string.`);
      }
      return value.trim();
    }
    function optionalString2(record, key, source) {
      const value = record[key];
      if (value === void 0) {
        return void 0;
      }
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new ValidationError2(`Manifest at ${source} has invalid '${key}'.`);
      }
      return value.trim();
    }
    function readStringArray2(record, key, source) {
      const value = record[key];
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new ValidationError2(`Manifest at ${source} must include '${key}' as a string array.`);
      }
      return value.map((item) => item.trim()).filter(Boolean);
    }
    function optionalEvaluationScore2(record, source) {
      const value = record["evaluation-score"];
      if (value === void 0) {
        return void 0;
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
        throw new ValidationError2(`Manifest at ${source} has invalid 'evaluation-score'. Expected a finite number from 0 to 10.`);
      }
      return value;
    }
    function canonicalDiagnostics2(value, schemaVersion, source) {
      const diagnostics = [];
      visitKnownFields2(value, value, "", schemaVersion, source, diagnostics);
      return diagnostics.slice(0, 50);
    }
    function visitKnownFields2(root, value, parent, schemaVersion, source, diagnostics) {
      for (const [key, child] of Object.entries(value)) {
        const path2 = parent ? `${parent}.${key}` : key;
        const lifecycle = manifestSchema_1.canonicalManifestFields[path2];
        if (!lifecycle) {
          diagnostics.push({ kind: "unknown-field", field: path2 });
          continue;
        }
        const disposition = (0, manifestSchema_1.manifestFieldDisposition)(lifecycle, schemaVersion, lifecycle.replacement !== null && hasManifestPath2(root, lifecycle.replacement));
        if (disposition === "reject-not-introduced")
          throw new ValidationError2(`Manifest at ${source} uses '${path2}' before schema version ${lifecycle.introducedIn}.`);
        if (disposition === "reject-removed")
          throw new ValidationError2(`Manifest at ${source} uses removed field '${path2}'.`);
        if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn)
          diagnostics.push({ kind: "deprecated-field", field: path2, ...lifecycle.replacement ? { replacement: lifecycle.replacement } : {} });
        if (disposition === "prefer-replacement")
          continue;
        if (isRecord7(child))
          visitKnownFields2(root, child, path2, schemaVersion, source, diagnostics);
        else if (Array.isArray(child) && path2 === "history.migrations") {
          for (const item of child)
            if (isRecord7(item))
              visitKnownFields2(root, item, `${path2}[]`, schemaVersion, source, diagnostics);
        }
      }
    }
    function hasManifestPath2(root, path2) {
      let current = root;
      for (const segment of path2.replaceAll("[]", "").split(".")) {
        if (!isRecord7(current) || !(segment in current))
          return false;
        current = current[segment];
      }
      return true;
    }
    function readRecord2(record, key, source) {
      const value = record[key];
      if (!isRecord7(value))
        throw new ValidationError2(`Manifest at ${source} must include '${key}' as a mapping.`);
      return value;
    }
    function optionalRecord2(record, key, source) {
      const value = record[key];
      if (value === void 0)
        return void 0;
      if (!isRecord7(value))
        throw new ValidationError2(`Manifest at ${source} has invalid '${key}'. Expected a mapping.`);
      return value;
    }
    function readPositiveInteger2(record, key, source) {
      const value = record[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1)
        throw new ValidationError2(`Manifest at ${source} must include '${key}' as a positive integer.`);
      return value;
    }
    function optionalBoolean2(record, key, source) {
      const value = record[key];
      if (value === void 0)
        return void 0;
      if (typeof value !== "boolean")
        throw new ValidationError2(`Manifest at ${source} has invalid '${key}'. Expected a boolean.`);
      return value;
    }
    function readCanonicalStringArray2(record, key, source, allowEmpty = false) {
      const value = record[key];
      if (!Array.isArray(value) || !allowEmpty && value.length === 0 || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
        throw new ValidationError2(`Manifest at ${source} must include '${key}' as ${allowEmpty ? "a" : "a non-empty"} string array without blank entries.`);
      }
      return value.map((item) => item.trim());
    }
    function assertUniqueStrings2(values, path2, source) {
      const normalized = values.filter((value) => typeof value === "string").map((value) => value.trim());
      if (new Set(normalized).size !== normalized.length)
        throw new ValidationError2(`Manifest at ${source} contains duplicate '${path2}' entries.`);
    }
    function isRecord7(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
  }
});

// packages/marketplace-core/out/services/marketplaceYaml.js
var require_marketplaceYaml = __commonJS({
  "packages/marketplace-core/out/services/marketplaceYaml.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseMarketplaceYaml = parseMarketplaceYaml2;
    var yaml_1 = require_dist();
    var validation_1 = require_validation();
    var maxManifestBytes2 = 128 * 1024;
    function parseMarketplaceYaml2(text, source) {
      if (Buffer.byteLength(text, "utf8") > maxManifestBytes2)
        throw new validation_1.ValidationError(`AI Marketplace manifest at ${source} exceeds the 128 KiB size limit.`);
      const document = (0, yaml_1.parseDocument)(text, { strict: true, uniqueKeys: true, prettyErrors: false });
      if (document.errors.length > 0)
        throw new validation_1.ValidationError(`AI Marketplace manifest at ${source} is invalid YAML: ${document.errors[0].message}`);
      if (!(0, yaml_1.isMap)(document.contents))
        throw new validation_1.ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
      let value;
      try {
        value = document.toJS({ maxAliasCount: 0 });
      } catch (error) {
        throw new validation_1.ValidationError(`AI Marketplace manifest at ${source} contains unsafe YAML aliases: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!isRecord7(value))
        throw new validation_1.ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
      return value;
    }
    function isRecord7(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
  }
});

// packages/marketplace-core/out/services/manifestDiagnostics.js
var require_manifestDiagnostics = __commonJS({
  "packages/marketplace-core/out/services/manifestDiagnostics.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ManifestDiagnosticCollector = void 0;
    var ManifestDiagnosticCollector2 = class {
      unknownFields = /* @__PURE__ */ new Set();
      deprecatedFields = /* @__PURE__ */ new Map();
      record(diagnostics) {
        for (const diagnostic of diagnostics) {
          if (diagnostic.kind === "unknown-field")
            this.unknownFields.add(diagnostic.field);
          else
            this.deprecatedFields.set(diagnostic.field, diagnostic.replacement);
        }
      }
      summary(sourceLabel) {
        const parts = [];
        if (this.unknownFields.size)
          parts.push(`unknown forward-compatible field(s): ${bounded2(this.unknownFields)}`);
        if (this.deprecatedFields.size)
          parts.push(`deprecated field(s): ${bounded2(this.deprecatedFields.keys())}`);
        return parts.length ? `Source '${sourceLabel}' manifest compatibility summary: ${parts.join("; ")}.` : void 0;
      }
    };
    exports.ManifestDiagnosticCollector = ManifestDiagnosticCollector2;
    function bounded2(values) {
      const all = [...values].sort();
      return `${all.slice(0, 20).join(", ")}${all.length > 20 ? `, and ${all.length - 20} more` : ""}`;
    }
  }
});

// packages/marketplace-core/out/services/mcpScripts.js
var require_mcpScripts = __commonJS({
  "packages/marketplace-core/out/services/mcpScripts.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mcpScriptTimeoutMs = exports.mcpUninstallScript = exports.mcpInstallScript = void 0;
    exports.assertMcpPackageScripts = assertMcpPackageScripts2;
    exports.assertMcpScriptPaths = assertMcpScriptPaths2;
    var validation_1 = require_validation();
    exports.mcpInstallScript = "install.py";
    exports.mcpUninstallScript = "uninstall.py";
    exports.mcpScriptTimeoutMs = 10 * 60 * 1e3;
    function assertMcpPackageScripts2(pkg, files) {
      if (pkg.manifest.type !== "mcp")
        return;
      const paths = new Set(files.map((file) => file.relativePath));
      assertMcpScriptPaths2(pkg.manifestPath, paths);
    }
    function assertMcpScriptPaths2(source, paths) {
      for (const script of [exports.mcpInstallScript, exports.mcpUninstallScript]) {
        if (!paths.has(script)) {
          throw new validation_1.ValidationError(`MCP package at ${source} must contain root-level '${script}'.`);
        }
      }
    }
  }
});

// packages/marketplace-core/out/services/repositoryUrl.js
var require_repositoryUrl = __commonJS({
  "packages/marketplace-core/out/services/repositoryUrl.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseRepositoryUrl = parseRepositoryUrl2;
    exports.parseGitHub = parseGitHub2;
    exports.parseAzureDevOps = parseAzureDevOps;
    exports.parseGitLab = parseGitLab;
    exports.toRepositoryConfig = toRepositoryConfig2;
    exports.repositoryIdentity = repositoryIdentity3;
    exports.repositoryUrl = repositoryUrl;
    exports.packageSourceFromConfig = packageSourceFromConfig2;
    exports.sourceMatchesConfig = sourceMatchesConfig2;
    exports.normalizedSourceCredentialId = normalizedSourceCredentialId3;
    var safeSegment = /^[A-Za-z0-9_.-]+$/;
    function parseRepositoryUrl2(value, explicitProvider) {
      const github = parseGitHub2(value);
      const azure = parseAzureDevOps(value);
      const gitlab = parseGitLab(value, explicitProvider === "gitlab");
      const parsed = github ?? azure ?? gitlab;
      if (!parsed || explicitProvider !== void 0 && parsed.provider !== explicitProvider)
        return void 0;
      return parsed;
    }
    function parseGitHub2(value) {
      const trimmed = value.trim().replace(/\.git$/i, "");
      if (!trimmed)
        return void 0;
      const direct = trimmed.split("/");
      if (direct.length === 2 && direct.every((part) => safeSegment.test(part))) {
        return { provider: "github", host: "github.com", owner: direct[0], repository: direct[1] };
      }
      if (/^https:\/\/github\.com:/i.test(trimmed))
        return void 0;
      const parsed = safeUrl(trimmed);
      if (!parsed || parsed.hostname.toLowerCase() !== "github.com" || parsed.port !== "")
        return void 0;
      const segments = decodedSegments(parsed);
      if (!segments || segments.length !== 2 || !segments.every((part) => safeSegment.test(part)))
        return void 0;
      return { provider: "github", host: "github.com", owner: segments[0], repository: segments[1].replace(/\.git$/i, "") };
    }
    function parseAzureDevOps(value) {
      const trimmed = value.trim();
      if (/^https:\/\/dev\.azure\.com:/i.test(trimmed))
        return void 0;
      const parsed = safeUrl(trimmed);
      if (!parsed || parsed.hostname.toLowerCase() !== "dev.azure.com" || parsed.port !== "")
        return void 0;
      const segments = decodedSegments(parsed);
      if (!segments || segments.length !== 4 || segments[2].toLowerCase() !== "_git")
        return void 0;
      if (![segments[0], segments[1], segments[3]].every(isSafeDecodedSegment))
        return void 0;
      return { provider: "azure-devops", host: "dev.azure.com", organization: segments[0], project: segments[1], repository: segments[3].replace(/\.git$/i, "") };
    }
    function parseGitLab(value, allowSelfManaged = false) {
      const parsed = safeUrl(value.trim());
      if (!parsed)
        return void 0;
      const host = parsed.host.toLowerCase();
      if (!allowSelfManaged && parsed.hostname.toLowerCase() !== "gitlab.com")
        return void 0;
      const segments = decodedSegments(parsed);
      if (!segments || segments.length < 2 || segments.includes("-") || !segments.every(isSafeDecodedSegment))
        return void 0;
      const repository = segments.at(-1).replace(/\.git$/i, "");
      const namespace = segments.slice(0, -1).join("/");
      if (!isSafeDecodedSegment(repository) || namespace.length === 0)
        return void 0;
      return { provider: "gitlab", host, namespace, repository };
    }
    function toRepositoryConfig2(parts, common) {
      if (parts.provider === "github")
        return { ...common, provider: "github", host: "github.com", owner: parts.owner, repository: parts.repository };
      if (parts.provider === "azure-devops")
        return { ...common, provider: "azure-devops", host: "dev.azure.com", organization: parts.organization, project: parts.project, repository: parts.repository };
      return { ...common, provider: "gitlab", host: parts.host, namespace: parts.namespace, repository: parts.repository };
    }
    function repositoryIdentity3(source) {
      switch (source.provider) {
        case "github":
          return `${source.owner}/${source.repository}`;
        case "azure-devops":
          return `${source.organization}/${source.project}/${source.repository}`;
        case "gitlab":
          return `${source.namespace}/${source.repository}`;
      }
    }
    function repositoryUrl(source) {
      switch (source.provider) {
        case "github":
          return `https://github.com/${source.owner}/${source.repository}`;
        case "azure-devops":
          return `https://dev.azure.com/${source.organization}/${source.project}/_git/${source.repository}`;
        case "gitlab":
          return `https://${source.host}/${source.namespace}/${source.repository}`;
      }
    }
    function packageSourceFromConfig2(source) {
      const common = { id: source.id, label: source.label, repository: source.repository, branch: source.branch };
      switch (source.provider) {
        case "github":
          return { ...common, provider: "github", host: "github.com", owner: source.owner };
        case "azure-devops":
          return { ...common, provider: "azure-devops", host: "dev.azure.com", organization: source.organization, project: source.project };
        case "gitlab":
          return { ...common, provider: "gitlab", host: source.host, namespace: source.namespace };
      }
    }
    function sourceMatchesConfig2(source, configured) {
      return source.provider === configured.provider && source.id === configured.id && source.branch === configured.branch && repositoryIdentity3(source) === repositoryIdentity3(configured) && source.host === configured.host;
    }
    function normalizedSourceCredentialId3(id) {
      return id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    }
    function safeUrl(value) {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        return void 0;
      }
      if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.search !== "" || parsed.hash !== "")
        return void 0;
      return parsed;
    }
    function decodedSegments(parsed) {
      try {
        return parsed.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
      } catch {
        return void 0;
      }
    }
    function isSafeDecodedSegment(value) {
      return value.length > 0 && value !== "." && value !== ".." && !/[\\/\0]/.test(value);
    }
  }
});

// packages/marketplace-core/out/services/repositoryHttp.js
var require_repositoryHttp = __commonJS({
  "packages/marketplace-core/out/services/repositoryHttp.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requestWithCredentials = requestWithCredentials2;
    exports.credentialHeaders = credentialHeaders2;
    exports.isAuthenticationFailureResponse = isAuthenticationFailureResponse2;
    exports.repositorySources = repositorySources2;
    exports.configuredSource = configuredSource2;
    exports.packageSource = packageSource2;
    exports.isFullGitRevision = isFullGitRevision2;
    exports.safeReadErrorBody = safeReadErrorBody2;
    exports.describeRequest = describeRequest3;
    var repositoryUrl_1 = require_repositoryUrl();
    var retryableStatuses2 = /* @__PURE__ */ new Set([408, 429, 500, 502, 503, 504]);
    var retryDelaysMs2 = [250, 750, 1500];
    async function requestWithCredentials2(options) {
      const shared = await options.credentials.sharedCredentials(options.source.provider);
      let response = await attemptCredentials2(options, shared.length > 0 ? shared : [void 0]);
      if (!isAuthenticationFailureResponse2(response, options.source.provider))
        return response;
      const sourceCredentials2 = await options.credentials.sourceCredentials(options.source);
      const prior = new Set(shared.map(credentialKey2));
      const unique = sourceCredentials2.filter((credential2) => !prior.has(credentialKey2(credential2)));
      if (unique.length === 0)
        return response;
      options.log(`Retrying ${providerLabel2(options.source.provider)} request with a repository-specific credential for source '${options.source.id}'.`);
      response = await attemptCredentials2(options, unique);
      return response;
    }
    async function attemptCredentials2(options, credentials) {
      let response = await fetchWithRetry2(options, credentials[0]);
      for (const credential2 of credentials.slice(1)) {
        if (!isAuthenticationFailureResponse2(response, options.source.provider))
          break;
        options.log(`Retrying ${providerLabel2(options.source.provider)} request with an alternate credential for source '${options.source.id}'.`);
        response = await fetchWithRetry2(options, credential2);
      }
      return response;
    }
    async function fetchWithRetry2(options, credential2) {
      let lastError;
      for (let attempt = 0; attempt <= retryDelaysMs2.length; attempt += 1) {
        try {
          const response = await fetch(options.url, { headers: { ...options.headers, ...credentialHeaders2(credential2, options.accept) } });
          if (!retryableStatuses2.has(response.status) || attempt === retryDelaysMs2.length)
            return response;
          options.log(`${providerLabel2(options.source.provider)} returned ${response.status} ${response.statusText}; retrying ${describeRequest3(options.url)}.`);
        } catch (error) {
          lastError = error;
          if (attempt === retryDelaysMs2.length)
            throw error;
          options.log(`${providerLabel2(options.source.provider)} request failed transiently; retrying ${describeRequest3(options.url)}.`);
        }
        await delay2(retryDelaysMs2[attempt]);
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    function credentialHeaders2(credential2, accept = "application/json") {
      const headers = { Accept: accept };
      if (!credential2)
        return headers;
      switch (credential2.kind) {
        case "bearer":
          headers.Authorization = `Bearer ${credential2.token}`;
          break;
        case "basic-pat":
          headers.Authorization = `Basic ${Buffer.from(`:${credential2.token}`, "utf8").toString("base64")}`;
          break;
        case "private-token":
          headers["PRIVATE-TOKEN"] = credential2.token;
          break;
      }
      return headers;
    }
    function isAuthenticationFailureResponse2(response, provider) {
      if (response.status === 401 || response.status === 403)
        return true;
      if (provider !== "azure-devops")
        return false;
      return response.status === 203 || Boolean(response.headers.get("content-type")?.toLowerCase().includes("text/html"));
    }
    function repositorySources2(config) {
      return (config.repositories ?? [{
        id: "default",
        label: "Default repository",
        provider: "github",
        host: "github.com",
        owner: config.repository.split("/")[0] ?? "",
        repository: config.repository.split("/")[1] ?? config.repository,
        branch: config.branch,
        enabled: true,
        allowDefaultPackages: true,
        packageFolders: config.packageFolders
      }]).filter((source) => source.enabled);
    }
    function configuredSource2(config, source) {
      const candidate = repositorySources2(config).find((item) => item.id === source.id);
      if (!candidate)
        throw new Error(`Package source '${source.id}' is no longer configured.`);
      if (!(0, repositoryUrl_1.sourceMatchesConfig)(source, candidate))
        throw new Error(`Package source '${source.id}' no longer matches the loaded catalog.`);
      return candidate;
    }
    function packageSource2(source) {
      return (0, repositoryUrl_1.packageSourceFromConfig)(source);
    }
    function isFullGitRevision2(value) {
      return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
    }
    async function safeReadErrorBody2(response) {
      try {
        const text = await response.text();
        if (!text)
          return "";
        try {
          const json = JSON.parse(text);
          const candidate = typeof json.message === "string" ? json.message : typeof json.error === "string" ? json.error : text;
          return summarizeErrorBody2(candidate);
        } catch {
          return summarizeErrorBody2(text);
        }
      } catch {
        return "";
      }
    }
    function describeRequest3(rawUrl) {
      const url = new URL(rawUrl);
      return `host=${url.host}, route=${url.pathname}`;
    }
    function credentialKey2(credential2) {
      return `${credential2.kind}:${credential2.token}`;
    }
    function providerLabel2(provider) {
      return provider === "github" ? "GitHub" : provider === "azure-devops" ? "Azure DevOps" : "GitLab";
    }
    function summarizeErrorBody2(text) {
      return text.replace(/\s+/g, " ").trim().slice(0, 600);
    }
    async function delay2(milliseconds) {
      await new Promise((resolve5) => setTimeout(resolve5, milliseconds));
    }
  }
});

// packages/marketplace-core/out/services/azureDevOpsClient.js
var require_azureDevOpsClient = __commonJS({
  "packages/marketplace-core/out/services/azureDevOpsClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AzureDevOpsRequestError = exports.AzureDevOpsClient = void 0;
    var node_util_1 = __require("node:util");
    var pathPlanning_1 = require_pathPlanning();
    var marketplaceYaml_1 = require_marketplaceYaml();
    var manifestSchema_1 = require_manifestSchema();
    var manifestDiagnostics_1 = require_manifestDiagnostics();
    var mcpScripts_1 = require_mcpScripts();
    var validation_1 = require_validation();
    var repositoryHttp_1 = require_repositoryHttp();
    var AzureDevOpsClient2 = class {
      config;
      credentials;
      log;
      decoder = new node_util_1.TextDecoder();
      loggedCredentialFallbacks = /* @__PURE__ */ new Set();
      constructor(config, credentials, log) {
        this.config = config;
        this.credentials = credentials;
        this.log = log;
      }
      async checkConnection() {
        for (const source of this.sources())
          await this.resolveSourceRevision(source);
      }
      async listBranches() {
        const source = this.sources()[0];
        if (!source)
          return [];
        const json = await this.requestJson(source, this.buildUrl(source, "/refs", { filter: "heads/", "api-version": "7.1" }));
        return (json.value ?? []).map((ref) => ref.name?.replace(/^refs\/heads\//, "")).filter((name2) => Boolean(name2)).sort((left, right) => left.localeCompare(right));
      }
      async listMarketplacePackages(onSourceComplete) {
        const results = await Promise.all(this.sources().map(async (source) => {
          const packages = [];
          try {
            await this.listSourcePackages(source, packages);
          } catch (error) {
            this.log(`Unable to refresh source '${source.label}': ${message5(error)}`);
            return packages;
          }
          packages.sort(comparePackages3);
          this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
          await onSourceComplete?.({ source: (0, repositoryHttp_1.packageSource)(source), packages });
          return packages;
        }));
        return results.flat().sort(comparePackages3);
      }
      async fetchPackageFiles(pkg) {
        const source = this.sourceForPackage(pkg.source);
        const items = await this.listItems(source, pkg.sourcePath, { revision: pkg.sourceRevision });
        const files = [];
        for (const item of items) {
          if (!isFile3(item) || !item.path)
            continue;
          const relativePath = item.path.slice(pkg.sourcePath.length).replace(/^\/+/, "");
          files.push({ relativePath: (0, pathPlanning_1.toPosixRelativePath)(relativePath), content: await this.getBytes(source, item.path, pkg.sourceRevision) });
        }
        return files;
      }
      async fetchPackageAtRevision(pkg, revision) {
        if (!(0, repositoryHttp_1.isFullGitRevision)(revision) || revision.length !== 40)
          throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
        const source = this.sourceForPackage(pkg.source);
        const commit = revision.toLowerCase();
        await this.validateCommit(source, commit);
        const items = await this.listItems(source, pkg.sourcePath, { revision: commit });
        const selection = (0, manifestSchema_1.selectManifestInFolder)(items.flatMap((item) => isFile3(item) && item.path ? [item.path] : []), pkg.sourcePath);
        if (!selection)
          throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
        const manifestText = await this.getText(source, selection.path, commit);
        const manifest = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(manifestText, selection.path), selection.path).manifest;
        (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, selection.path);
        const sourcePath = selection.sourcePath;
        if (sourcePath !== pkg.sourcePath || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
          throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
        }
        if (manifest.type === "mcp")
          (0, mcpScripts_1.assertMcpScriptPaths)(selection.path, packageRelativePaths3(items, sourcePath));
        const entrypoint = await this.getText(source, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint), commit);
        return { manifest, sourcePath, manifestPath: selection.path, hotload: (0, validation_1.parseHotloadFlag)(entrypoint), source: (0, repositoryHttp_1.packageSource)(source), sourceRevision: commit };
      }
      async listSourcePackages(source, packages) {
        const revision = await this.resolveSourceRevision(source);
        const diagnostics = new manifestDiagnostics_1.ManifestDiagnosticCollector();
        for (const [type, folder] of Object.entries(source.packageFolders)) {
          const root = (0, pathPlanning_1.repoJoin)(folder);
          const items = await this.listItems(source, root, { allowMissingFolder: true, revision });
          const selections = (0, manifestSchema_1.selectManifestCandidates)(items.flatMap((item) => isFile3(item) && item.path && (0, manifestSchema_1.isManifestPath)(item.path) ? [item.path] : []));
          this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
          for (const selection of selections) {
            const item = items.find((candidate) => candidate.path === selection.path && isFile3(candidate));
            if (!item?.path)
              continue;
            try {
              const validated = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(await this.getText(source, item.path, revision), item.path), item.path);
              const manifest = validated.manifest;
              diagnostics.record(validated.diagnostics);
              (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, item.path);
              if (manifest.type !== type) {
                this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
                continue;
              }
              const sourcePath = selection.sourcePath;
              if (manifest.type === "mcp")
                (0, mcpScripts_1.assertMcpScriptPaths)(item.path, packageRelativePaths3(items, sourcePath));
              const entrypoint = await this.getText(source, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint), revision);
              packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: (0, validation_1.parseHotloadFlag)(entrypoint), source: (0, repositoryHttp_1.packageSource)(source), sourceRevision: revision });
              this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
            } catch (error) {
              this.log(`Skipping invalid package at ${item.path}: ${message5(error)}`);
            }
          }
        }
        const summary = diagnostics.summary(source.label);
        if (summary)
          this.log(summary);
      }
      async resolveSourceRevision(source) {
        const json = await this.requestJson(source, this.buildUrl(source, "/refs", { filter: `heads/${source.branch}`, "api-version": "7.1" }));
        const revision = json.value?.find((ref) => ref.name === `refs/heads/${source.branch}`)?.objectId;
        if (!revision || !/^[0-9a-f]{40}$/i.test(revision))
          throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
        return revision.toLowerCase();
      }
      async validateCommit(source, revision) {
        const commit = await this.requestJson(source, this.buildUrl(source, `/commits/${encodeURIComponent(revision)}`, { "api-version": "7.1" }));
        if (commit.commitId?.toLowerCase() !== revision)
          throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
      }
      async listItems(source, scopePath, options = {}) {
        const revision = options.revision ?? source.branch;
        const url = this.buildUrl(source, "/items", {
          scopePath,
          recursionLevel: "Full",
          includeContentMetadata: "true",
          "versionDescriptor.version": revision,
          "versionDescriptor.versionType": options.revision ? "commit" : "branch",
          "api-version": "7.1"
        });
        try {
          return (await this.requestJson(source, url)).value ?? [];
        } catch (error) {
          if (options.allowMissingFolder && isMissingPathError2(error)) {
            this.log(`Skipping missing package folder ${scopePath}.`);
            return [];
          }
          throw error;
        }
      }
      async getText(source, path2, revision) {
        return this.decoder.decode(await this.getBytes(source, path2, revision));
      }
      async getBytes(source, path2, revision) {
        const url = this.buildUrl(source, "/items", {
          path: path2,
          download: "true",
          "versionDescriptor.version": revision ?? source.branch,
          "versionDescriptor.versionType": revision ? "commit" : "branch",
          "api-version": "7.1"
        });
        const response = await (0, repositoryHttp_1.requestWithCredentials)({ source, url, accept: "*/*", credentials: this.credentials, log: (line) => this.logRequest(source, line) });
        if ((0, repositoryHttp_1.isAuthenticationFailureResponse)(response, source.provider))
          throw authenticationError2(response, url);
        if (!response.ok)
          throw new AzureDevOpsRequestError2(response.status, response.statusText, await (0, repositoryHttp_1.safeReadErrorBody)(response), (0, repositoryHttp_1.describeRequest)(url));
        return new Uint8Array(await response.arrayBuffer());
      }
      async requestJson(source, url) {
        const response = await (0, repositoryHttp_1.requestWithCredentials)({ source, url, credentials: this.credentials, log: (line) => this.logRequest(source, line) });
        if ((0, repositoryHttp_1.isAuthenticationFailureResponse)(response, source.provider))
          throw authenticationError2(response, url);
        if (!response.ok)
          throw new AzureDevOpsRequestError2(response.status, response.statusText, await (0, repositoryHttp_1.safeReadErrorBody)(response), (0, repositoryHttp_1.describeRequest)(url));
        try {
          return await response.json();
        } catch {
          throw new AzureDevOpsRequestError2(response.status, response.statusText, "Azure DevOps returned a non-JSON response.", (0, repositoryHttp_1.describeRequest)(url));
        }
      }
      buildUrl(source, route, params) {
        const url = new URL(`https://dev.azure.com/${encodeURIComponent(source.organization)}/${encodeURIComponent(source.project)}/_apis/git/repositories/${encodeURIComponent(source.repository)}${route}`);
        for (const [key, value] of Object.entries(params))
          url.searchParams.set(key, value);
        return url.toString();
      }
      sources() {
        return (0, repositoryHttp_1.repositorySources)(this.config).filter((source) => source.provider === "azure-devops");
      }
      sourceForPackage(source) {
        if (source.provider !== "azure-devops")
          throw new Error(`Package source '${source.id}' is not an Azure DevOps source.`);
        return (0, repositoryHttp_1.configuredSource)(this.config, source);
      }
      logRequest(source, line) {
        if (line.startsWith("Retrying Azure DevOps request with a repository-specific credential")) {
          if (this.loggedCredentialFallbacks.has(source.id))
            return;
          this.loggedCredentialFallbacks.add(source.id);
        }
        this.log(line);
      }
    };
    exports.AzureDevOpsClient = AzureDevOpsClient2;
    var AzureDevOpsRequestError2 = class extends Error {
      status;
      body;
      constructor(status, statusText, body, request) {
        super(`Azure DevOps request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`);
        this.status = status;
        this.body = body;
        this.name = "AzureDevOpsRequestError";
      }
    };
    exports.AzureDevOpsRequestError = AzureDevOpsRequestError2;
    function isFile3(item) {
      return item.gitObjectType === "blob" || item.isFolder === false;
    }
    function packageRelativePaths3(items, sourcePath) {
      const prefix = `${sourcePath}/`;
      return new Set(items.flatMap((item) => isFile3(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
    }
    function isMissingPathError2(error) {
      return error instanceof AzureDevOpsRequestError2 && (error.status === 400 || error.status === 404) && /tf401174|could not be found|not found/i.test(error.body);
    }
    function authenticationError2(response, url) {
      return new AzureDevOpsRequestError2(response.status, response.statusText, "Authentication was rejected or redirected to the Azure DevOps sign-in page. Verify the selected OAuth/PAT credential type and repository access.", (0, repositoryHttp_1.describeRequest)(url));
    }
    function comparePackages3(left, right) {
      return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`);
    }
    function message5(error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
});

// packages/marketplace-core/out/services/githubClient.js
var require_githubClient = __commonJS({
  "packages/marketplace-core/out/services/githubClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GitHubRequestError = exports.GitHubClient = void 0;
    var util_1 = __require("util");
    var pathPlanning_1 = require_pathPlanning();
    var marketplaceYaml_1 = require_marketplaceYaml();
    var manifestSchema_1 = require_manifestSchema();
    var manifestDiagnostics_1 = require_manifestDiagnostics();
    var mcpScripts_1 = require_mcpScripts();
    var validation_1 = require_validation();
    var repositoryHttp_1 = require_repositoryHttp();
    var GitHubClient2 = class {
      config;
      log;
      decoder = new util_1.TextDecoder();
      treeCache = /* @__PURE__ */ new Map();
      constructor(config, credentialsOrToken, log, sourceToken) {
        this.config = config;
        this.log = log;
        this.credentials = isCredentialProvider2(credentialsOrToken) ? credentialsOrToken : legacyCredentialProvider2(credentialsOrToken, sourceToken);
      }
      credentials;
      async checkConnection() {
        for (const source of this.sources()) {
          await this.getTree(source);
        }
      }
      async listBranches() {
        const source = this.sources()[0];
        if (!source) {
          return [];
        }
        const branches = await this.requestJson(source, this.apiUrl(source, `/repos/${source.owner}/${source.repository}/branches`, { per_page: "100" }));
        return branches.map((branch) => branch.name).filter((name2) => typeof name2 === "string" && name2.length > 0).sort((left, right) => left.localeCompare(right));
      }
      async listMarketplacePackages(onSourceComplete) {
        const results = await Promise.all(this.sources().map(async (source) => {
          const packages = [];
          try {
            await this.listSourcePackages(source, packages);
          } catch (error) {
            this.log(`Unable to refresh source '${source.label}': ${error instanceof Error ? error.message : String(error)}`);
            return packages;
          }
          packages.sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
          this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
          await onSourceComplete?.({ source: (0, repositoryHttp_1.packageSource)(source), packages });
          return packages;
        }));
        return results.flat().sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
      }
      async fetchPackageFiles(pkg) {
        const source = this.sourceForPackage(pkg.source);
        const tree = (await this.getTree(source, pkg.sourceRevision)).items;
        const sourcePrefix = stripLeadingSlash2((0, pathPlanning_1.repoJoin)(pkg.sourcePath));
        const files = [];
        for (const item of tree) {
          if (!isBlob3(item) || !item.path || !item.sha || !isWithinFolder2(item.path, sourcePrefix)) {
            continue;
          }
          const relativePath = item.path.slice(sourcePrefix.length).replace(/^\/+/, "");
          files.push({
            relativePath: (0, pathPlanning_1.toPosixRelativePath)(relativePath),
            content: await this.getBlobBytes(source, item.sha)
          });
        }
        return files;
      }
      /** Reads and validates the exact package snapshot selected by a manifest rollback revision. */
      async fetchPackageAtRevision(pkg, revision) {
        if (!(0, repositoryHttp_1.isFullGitRevision)(revision)) {
          throw new Error("Rollback revision must be a full 40 or 64 character hexadecimal Git revision.");
        }
        const source = this.sourceForPackage(pkg.source);
        const commit = revision.toLowerCase();
        const treeResult = await this.getTree(source, await this.getCommitTreeSha(source, commit));
        this.treeCache.set(`${source.id}:${commit}`, treeResult);
        const selection = (0, manifestSchema_1.selectManifestInFolder)(treeResult.items.flatMap((item) => isBlob3(item) && item.path ? [item.path] : []), stripLeadingSlash2(pkg.sourcePath));
        if (!selection)
          throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
        const manifestPath = selection.path;
        const manifestItem = treeResult.items.find((item) => item.path === manifestPath && isBlob3(item));
        if (!manifestItem?.sha) {
          throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
        }
        const manifest = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(this.decoder.decode(await this.getBlobBytes(source, manifestItem.sha)), manifestPath), manifestPath).manifest;
        (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, manifestPath);
        const sourcePath = selection.sourcePath;
        if (sourcePath !== pkg.sourcePath || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
          throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
        }
        if (manifest.type === "mcp")
          (0, mcpScripts_1.assertMcpScriptPaths)(manifestPath, packageRelativeBlobPaths2(treeResult.items, sourcePath));
        const entrypoint = await this.getText(source, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint), void 0, treeResult.items);
        return {
          manifest,
          sourcePath,
          manifestPath,
          hotload: (0, validation_1.parseHotloadFlag)(entrypoint),
          source: (0, repositoryHttp_1.packageSource)(source),
          sourceRevision: commit
        };
      }
      async listSourcePackages(source, packages) {
        const treeResult = await this.getTree(source);
        const tree = treeResult.items;
        const diagnostics = new manifestDiagnostics_1.ManifestDiagnosticCollector();
        for (const [type, folder] of Object.entries(source.packageFolders)) {
          const root = stripLeadingSlash2((0, pathPlanning_1.repoJoin)(folder));
          const items = tree.filter((item) => isWithinFolder2(item.path, root));
          const selections = (0, manifestSchema_1.selectManifestCandidates)(items.flatMap((item) => isBlob3(item) && item.path && (0, manifestSchema_1.isManifestPath)(item.path) ? [item.path] : []));
          this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
          for (const selection of selections) {
            const item = items.find((candidate) => candidate.path === selection.path && isBlob3(candidate));
            if (!item?.path)
              continue;
            try {
              const manifestText = await this.getText(source, item.path);
              const validated = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(manifestText, item.path), item.path);
              const manifest = validated.manifest;
              diagnostics.record(validated.diagnostics);
              (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, item.path);
              if (manifest.type !== type) {
                this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
                continue;
              }
              const sourcePath = selection.sourcePath;
              if (manifest.type === "mcp")
                (0, mcpScripts_1.assertMcpScriptPaths)(item.path, packageRelativeBlobPaths2(tree, sourcePath));
              const entrypointContent = await this.getText(source, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint));
              packages.push({
                manifest,
                sourcePath,
                manifestPath: item.path,
                hotload: (0, validation_1.parseHotloadFlag)(entrypointContent),
                source: (0, repositoryHttp_1.packageSource)(source),
                ...treeResult.revision === void 0 ? {} : { sourceRevision: treeResult.revision }
              });
              this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
            } catch (error) {
              this.log(`Skipping invalid package at ${item.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        const summary = diagnostics.summary(source.label);
        if (summary)
          this.log(summary);
      }
      async getTree(source, revision = source.branch) {
        const cacheKey = `${source.id}:${revision}`;
        const cached = this.treeCache.get(cacheKey);
        if (cached) {
          return cached;
        }
        this.log(`Listing GitHub tree: source=${source.id}, repo=${source.owner}/${source.repository}, branch=${source.branch}`);
        const tree = await this.requestJson(source, this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/trees/${encodeURIComponent(revision)}`, {
          recursive: "1"
        }));
        if (tree.truncated) {
          throw new Error(`GitHub repository tree is truncated for source '${source.id}'; its catalog is too large to load safely.`);
        }
        if (!(0, repositoryHttp_1.isFullGitRevision)(tree.sha ?? "")) {
          throw new Error(`GitHub tree for source '${source.id}' did not return an immutable revision SHA.`);
        }
        const result = { items: tree.tree ?? [], revision: tree.sha.toLowerCase() };
        this.treeCache.set(cacheKey, result);
        return result;
      }
      async getCommitTreeSha(source, revision) {
        const commit = await this.requestJson(source, this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/commits/${encodeURIComponent(revision)}`, {}));
        if (typeof commit.sha !== "string" || commit.sha.toLowerCase() !== revision || !(0, repositoryHttp_1.isFullGitRevision)(commit.tree?.sha ?? "")) {
          throw new Error(`Rollback revision '${revision}' is not an exact Git commit with a valid tree.`);
        }
        return commit.tree.sha.toLowerCase();
      }
      async getText(source, path2, revision, providedTree) {
        const tree = providedTree ?? (await this.getTree(source, revision)).items;
        const normalized = stripLeadingSlash2((0, pathPlanning_1.repoJoin)(path2));
        const item = tree.find((candidate) => candidate.path === normalized && isBlob3(candidate));
        if (!item?.sha) {
          throw new GitHubRequestError2(404, "Not Found", "", `source=${source.id}, path=${path2}, branch=${source.branch}`);
        }
        return this.decoder.decode(await this.getBlobBytes(source, item.sha));
      }
      async getBlobBytes(source, sha) {
        const blob = await this.requestJson(source, this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/blobs/${encodeURIComponent(sha)}`, {}));
        if (blob.encoding !== "base64" || typeof blob.content !== "string") {
          throw new Error(`GitHub blob ${sha} did not return base64 content.`);
        }
        return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
      }
      async requestJson(source, url) {
        const response = await this.request(source, url);
        if (!response.ok) {
          throw new GitHubRequestError2(response.status, response.statusText, await (0, repositoryHttp_1.safeReadErrorBody)(response), describeRequest3(url));
        }
        return await response.json();
      }
      async request(source, url) {
        return (0, repositoryHttp_1.requestWithCredentials)({
          source,
          url,
          accept: "application/vnd.github+json",
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
          credentials: this.credentials,
          log: this.log
        });
      }
      apiUrl(_source, route, params) {
        const url = new URL(`https://api.github.com${route}`);
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
        return url.toString();
      }
      sources() {
        return (0, repositoryHttp_1.repositorySources)(this.config).filter((source) => source.provider === "github");
      }
      sourceForPackage(source) {
        if (source.provider !== "github")
          throw new Error(`Package source '${source.id}' is not a GitHub source.`);
        return (0, repositoryHttp_1.configuredSource)(this.config, source);
      }
    };
    exports.GitHubClient = GitHubClient2;
    var GitHubRequestError2 = class extends Error {
      status;
      body;
      constructor(status, statusText, body, requestDescription) {
        super(`GitHub request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${requestDescription})`);
        this.status = status;
        this.body = body;
        this.name = "GitHubRequestError";
      }
    };
    exports.GitHubRequestError = GitHubRequestError2;
    function isBlob3(item) {
      return item.type === "blob";
    }
    function packageRelativeBlobPaths2(items, sourcePath) {
      const prefix = `${stripLeadingSlash2(sourcePath)}/`;
      return new Set(items.flatMap((item) => isBlob3(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
    }
    function isWithinFolder2(pathValue, folder) {
      return typeof pathValue === "string" && (pathValue === folder || pathValue.startsWith(`${folder}/`));
    }
    function stripLeadingSlash2(value) {
      return value.replace(/^\/+/, "");
    }
    function describeRequest3(rawUrl) {
      const url = new URL(rawUrl);
      return `route=${url.pathname}`;
    }
    function isCredentialProvider2(value) {
      return typeof value === "object" && value !== null && "sharedCredentials" in value;
    }
    function legacyCredentialProvider2(token, sourceToken) {
      return {
        sharedCredentials: async (provider) => provider === "github" && token ? [{ kind: "bearer", token }] : [],
        sourceCredentials: async (source) => {
          const value = sourceToken ? await sourceToken(source) : void 0;
          return source.provider === "github" && value ? [{ kind: "bearer", token: value }] : [];
        }
      };
    }
  }
});

// packages/marketplace-core/out/services/gitLabClient.js
var require_gitLabClient = __commonJS({
  "packages/marketplace-core/out/services/gitLabClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GitLabRequestError = exports.GitLabClient = void 0;
    var node_util_1 = __require("node:util");
    var pathPlanning_1 = require_pathPlanning();
    var marketplaceYaml_1 = require_marketplaceYaml();
    var manifestSchema_1 = require_manifestSchema();
    var manifestDiagnostics_1 = require_manifestDiagnostics();
    var mcpScripts_1 = require_mcpScripts();
    var validation_1 = require_validation();
    var repositoryHttp_1 = require_repositoryHttp();
    var GitLabClient2 = class {
      config;
      credentials;
      log;
      decoder = new node_util_1.TextDecoder();
      treeCache = /* @__PURE__ */ new Map();
      constructor(config, credentials, log) {
        this.config = config;
        this.credentials = credentials;
        this.log = log;
      }
      async checkConnection() {
        for (const source of this.sources())
          await this.resolveSourceRevision(source);
      }
      async listBranches() {
        const source = this.sources()[0];
        if (!source)
          return [];
        const values = await this.requestPaged(source, this.apiUrl(source, "/repository/branches", { per_page: "100" }));
        return values.map((branch) => branch.name).filter((name2) => Boolean(name2)).sort((a, b) => a.localeCompare(b));
      }
      async listMarketplacePackages(onSourceComplete) {
        const results = await Promise.all(this.sources().map(async (source) => {
          const packages = [];
          try {
            await this.listSourcePackages(source, packages);
          } catch (error) {
            this.log(`Unable to refresh source '${source.label}': ${message5(error)}`);
            return packages;
          }
          packages.sort(comparePackages3);
          this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
          await onSourceComplete?.({ source: (0, repositoryHttp_1.packageSource)(source), packages });
          return packages;
        }));
        return results.flat().sort(comparePackages3);
      }
      async fetchPackageFiles(pkg) {
        const source = this.sourceForPackage(pkg.source);
        const revision = pkg.sourceRevision ?? source.branch;
        const tree = await this.getTree(source, revision);
        const prefix = stripSlash2(pkg.sourcePath);
        const files = [];
        for (const item of tree) {
          if (!isBlob3(item) || !item.id || !item.path || !isWithin2(item.path, prefix))
            continue;
          files.push({ relativePath: (0, pathPlanning_1.toPosixRelativePath)(item.path.slice(prefix.length).replace(/^\/+/, "")), content: await this.getBlobBytes(source, item.id) });
        }
        return files;
      }
      async fetchPackageAtRevision(pkg, revision) {
        if (!(0, repositoryHttp_1.isFullGitRevision)(revision) || revision.length !== 40)
          throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
        const source = this.sourceForPackage(pkg.source);
        const commit = revision.toLowerCase();
        await this.validateCommit(source, commit);
        const tree = await this.getTree(source, commit);
        const selection = (0, manifestSchema_1.selectManifestInFolder)(tree.flatMap((item) => isBlob3(item) && item.path ? [item.path] : []), stripSlash2(pkg.sourcePath));
        if (!selection)
          throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
        const manifestPath = selection.path;
        const manifestItem = tree.find((item) => isBlob3(item) && item.path === manifestPath);
        if (!manifestItem?.id)
          throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
        const manifest = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(this.decoder.decode(await this.getBlobBytes(source, manifestItem.id)), manifestPath), manifestPath).manifest;
        (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, manifestPath);
        const sourcePath = selection.sourcePath;
        if (sourcePath !== stripSlash2(pkg.sourcePath) || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
          throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
        }
        if (manifest.type === "mcp")
          (0, mcpScripts_1.assertMcpScriptPaths)(manifestPath, packageRelativePaths3(tree, sourcePath));
        const entrypoint = await this.getTextFromTree(source, tree, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint));
        return { manifest, sourcePath, manifestPath, hotload: (0, validation_1.parseHotloadFlag)(entrypoint), source: (0, repositoryHttp_1.packageSource)(source), sourceRevision: commit };
      }
      async listSourcePackages(source, packages) {
        const revision = await this.resolveSourceRevision(source);
        const tree = await this.getTree(source, revision);
        const diagnostics = new manifestDiagnostics_1.ManifestDiagnosticCollector();
        for (const [type, folder] of Object.entries(source.packageFolders)) {
          const root = stripSlash2((0, pathPlanning_1.repoJoin)(folder));
          const items = tree.filter((item) => isWithin2(item.path, root));
          const selections = (0, manifestSchema_1.selectManifestCandidates)(items.flatMap((item) => isBlob3(item) && item.path && (0, manifestSchema_1.isManifestPath)(item.path) ? [item.path] : []));
          this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
          for (const selection of selections) {
            const item = items.find((candidate) => candidate.path === selection.path && isBlob3(candidate));
            if (!item?.path || !item.id)
              continue;
            try {
              const validated = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(this.decoder.decode(await this.getBlobBytes(source, item.id)), item.path), item.path);
              const manifest = validated.manifest;
              diagnostics.record(validated.diagnostics);
              (0, validation_1.validateMigrationSourceIdentity)(manifest, source.id, item.path);
              if (manifest.type !== type) {
                this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
                continue;
              }
              const sourcePath = selection.sourcePath;
              if (manifest.type === "mcp")
                (0, mcpScripts_1.assertMcpScriptPaths)(item.path, packageRelativePaths3(tree, sourcePath));
              const entrypoint = await this.getTextFromTree(source, tree, (0, pathPlanning_1.repoJoin)(sourcePath, manifest.entrypoint));
              packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: (0, validation_1.parseHotloadFlag)(entrypoint), source: (0, repositoryHttp_1.packageSource)(source), sourceRevision: revision });
              this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
            } catch (error) {
              this.log(`Skipping invalid package at ${item.path}: ${message5(error)}`);
            }
          }
        }
        const summary = diagnostics.summary(source.label);
        if (summary)
          this.log(summary);
      }
      async resolveSourceRevision(source) {
        const commit = await this.requestJson(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(source.branch)}`, { stats: "false" }));
        if (!commit.id || !/^[0-9a-f]{40}$/i.test(commit.id))
          throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
        return commit.id.toLowerCase();
      }
      async validateCommit(source, revision) {
        const commit = await this.requestJson(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(revision)}`, { stats: "false" }));
        if (commit.id?.toLowerCase() !== revision)
          throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
      }
      async getTree(source, revision) {
        const key = `${source.id}:${revision}`;
        const cached = this.treeCache.get(key);
        if (cached)
          return cached;
        const url = this.apiUrl(source, "/repository/tree", { ref: revision, recursive: "true", per_page: "100", pagination: "keyset" });
        let tree;
        try {
          tree = await this.requestPaged(source, url);
        } catch (error) {
          if (error instanceof GitLabRequestError2 && error.status === 404)
            tree = [];
          else
            throw error;
        }
        this.treeCache.set(key, tree);
        return tree;
      }
      async getTextFromTree(source, tree, path2) {
        const normalized = stripSlash2(path2);
        const item = tree.find((candidate) => isBlob3(candidate) && candidate.path === normalized);
        if (!item?.id)
          throw new GitLabRequestError2(404, "Not Found", "", `source=${source.id}, path=${normalized}`);
        return this.decoder.decode(await this.getBlobBytes(source, item.id));
      }
      async getBlobBytes(source, sha) {
        const blob = await this.requestJson(source, this.apiUrl(source, `/repository/blobs/${encodeURIComponent(sha)}`, {}));
        if (blob.encoding !== "base64" || typeof blob.content !== "string" || blob.sha && blob.sha.toLowerCase() !== sha.toLowerCase())
          throw new Error(`GitLab blob ${sha} did not return valid base64 content.`);
        return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
      }
      async requestPaged(source, firstUrl) {
        const values = [];
        let next = firstUrl;
        for (let page = 0; next && page < 1e3; page += 1) {
          const response = await (0, repositoryHttp_1.requestWithCredentials)({ source, url: next, credentials: this.credentials, log: this.log });
          if (!response.ok)
            throw new GitLabRequestError2(response.status, response.statusText, await (0, repositoryHttp_1.safeReadErrorBody)(response), (0, repositoryHttp_1.describeRequest)(next));
          const pageValues = await response.json();
          if (!Array.isArray(pageValues))
            throw new Error(`GitLab returned a malformed paginated response (${(0, repositoryHttp_1.describeRequest)(next)}).`);
          values.push(...pageValues);
          next = validatedNextLink2(response.headers.get("link"), source);
        }
        if (next)
          throw new Error(`GitLab pagination exceeded the safe page limit for source '${source.id}'.`);
        return values;
      }
      async requestJson(source, url) {
        const response = await (0, repositoryHttp_1.requestWithCredentials)({ source, url, credentials: this.credentials, log: this.log });
        if (!response.ok)
          throw new GitLabRequestError2(response.status, response.statusText, await (0, repositoryHttp_1.safeReadErrorBody)(response), (0, repositoryHttp_1.describeRequest)(url));
        return await response.json();
      }
      apiUrl(source, route, params) {
        const project = encodeURIComponent(`${source.namespace}/${source.repository}`);
        const url = new URL(`https://${source.host}/api/v4/projects/${project}${route}`);
        for (const [key, value] of Object.entries(params))
          url.searchParams.set(key, value);
        return url.toString();
      }
      sources() {
        return (0, repositoryHttp_1.repositorySources)(this.config).filter((source) => source.provider === "gitlab");
      }
      sourceForPackage(source) {
        if (source.provider !== "gitlab")
          throw new Error(`Package source '${source.id}' is not a GitLab source.`);
        return (0, repositoryHttp_1.configuredSource)(this.config, source);
      }
    };
    exports.GitLabClient = GitLabClient2;
    var GitLabRequestError2 = class extends Error {
      status;
      body;
      constructor(status, statusText, body, request) {
        super(`GitLab request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`);
        this.status = status;
        this.body = body;
        this.name = "GitLabRequestError";
      }
    };
    exports.GitLabRequestError = GitLabRequestError2;
    function validatedNextLink2(header, source) {
      if (!header)
        return void 0;
      const entry = header.split(",").map((part) => part.trim()).find((part) => /;\s*rel="?next"?$/i.test(part));
      const raw = entry?.match(/^<([^>]+)>/)?.[1];
      if (!raw)
        return void 0;
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.host.toLowerCase() !== source.host.toLowerCase() || !url.pathname.startsWith("/api/v4/projects/"))
        throw new Error(`GitLab returned an unsafe pagination URL for source '${source.id}'.`);
      return url.toString();
    }
    function isBlob3(item) {
      return item.type === "blob";
    }
    function isWithin2(path2, folder) {
      return typeof path2 === "string" && (path2 === folder || path2.startsWith(`${folder}/`));
    }
    function stripSlash2(value) {
      return value.replace(/^\/+/, "");
    }
    function packageRelativePaths3(items, sourcePath) {
      const prefix = `${stripSlash2(sourcePath)}/`;
      return new Set(items.flatMap((item) => isBlob3(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
    }
    function message5(error) {
      return error instanceof Error ? error.message : String(error);
    }
    function comparePackages3(left, right) {
      return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`);
    }
  }
});

// packages/marketplace-core/out/services/repositoryClient.js
var require_repositoryClient = __commonJS({
  "packages/marketplace-core/out/services/repositoryClient.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RepositoryClient = void 0;
    var azureDevOpsClient_1 = require_azureDevOpsClient();
    var githubClient_1 = require_githubClient();
    var gitLabClient_1 = require_gitLabClient();
    var repositoryHttp_1 = require_repositoryHttp();
    var RepositoryClient2 = class {
      github;
      azureDevOps;
      gitlab;
      constructor(config, credentials, log) {
        this.github = new githubClient_1.GitHubClient(config, credentials, log);
        this.azureDevOps = new azureDevOpsClient_1.AzureDevOpsClient(config, credentials, log);
        this.gitlab = new gitLabClient_1.GitLabClient(config, credentials, log);
        this.config = config;
      }
      config;
      async checkConnection() {
        await this.github.checkConnection();
        await this.azureDevOps.checkConnection();
        await this.gitlab.checkConnection();
      }
      async listBranches() {
        const provider = (0, repositoryHttp_1.repositorySources)(this.config)[0]?.provider;
        return provider === "azure-devops" ? this.azureDevOps.listBranches() : provider === "gitlab" ? this.gitlab.listBranches() : this.github.listBranches();
      }
      async listMarketplacePackages(onProgress) {
        const completedPackages = [];
        const onSourceComplete = async (snapshot) => {
          completedPackages.push(...snapshot.packages);
          await onProgress?.({ ...snapshot, catalog: sortPackages2(completedPackages) });
        };
        const results = await Promise.all([
          this.github.listMarketplacePackages(onSourceComplete),
          this.azureDevOps.listMarketplacePackages(onSourceComplete),
          this.gitlab.listMarketplacePackages(onSourceComplete)
        ]);
        return sortPackages2(results.flat());
      }
      fetchPackageFiles(pkg) {
        return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageFiles(pkg) : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageFiles(pkg) : this.github.fetchPackageFiles(pkg);
      }
      fetchPackageAtRevision(pkg, revision) {
        return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageAtRevision(pkg, revision) : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageAtRevision(pkg, revision) : this.github.fetchPackageAtRevision(pkg, revision);
      }
    };
    exports.RepositoryClient = RepositoryClient2;
    function sortPackages2(packages) {
      return [...packages].sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
    }
  }
});

// packages/marketplace-core/out/services/installPlanning.js
var require_installPlanning = __commonJS({
  "packages/marketplace-core/out/services/installPlanning.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.uninstallTargetPaths = uninstallTargetPaths3;
    var pathPlanning_1 = require_pathPlanning();
    function uninstallTargetPaths3(installed, config) {
      return uniquePaths2([
        installed.installedPath,
        (0, pathPlanning_1.installRelativePath)(installed.platform, installed.type, installed.id, config.platformPathOverrides),
        ...installed.managedConfig?.kind === "codex-agent" ? [installed.managedConfig.configPath] : [],
        (0, pathPlanning_1.offloadRelativePath)(installed.platform, installed.type, installed.id)
      ]);
    }
    function uniquePaths2(paths) {
      return [...new Set(paths)];
    }
  }
});

// packages/marketplace-core/out/services/installedState.js
var require_installedState = __commonJS({
  "packages/marketplace-core/out/services/installedState.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InstalledStateStore = void 0;
    var packages_1 = require_packages();
    var pathPlanning_1 = require_pathPlanning();
    var InstalledStateStore3 = class {
      storage;
      scope;
      constructor(storage, scope) {
        this.storage = storage;
        this.scope = scope;
      }
      async read() {
        for (const relativePath of [(0, pathPlanning_1.stateRelativePath)(), (0, pathPlanning_1.legacyStateRelativePath)()]) {
          const bytes = await this.storage.readFile(this.scope, relativePath);
          if (bytes !== void 0) {
            const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
            return {
              schemaVersion: 2,
              packages: Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage2) : []
            };
          }
        }
        return { schemaVersion: 2, packages: [] };
      }
      async upsert(pkg) {
        const state = await this.read();
        const packages = state.packages.filter((item) => !sameInstallIdentity2(item, pkg.id, pkg.platform, pkg.scope, pkg.sourceId));
        packages.push(pkg);
        await this.write({ ...state, packages: packages.sort(compareInstalledPackages2) });
      }
      async remove(id, platform, scope, sourceId) {
        const state = await this.read();
        const existing = state.packages.find((item) => sameInstallIdentity2(item, id, platform, scope, sourceId));
        if (!existing) {
          return void 0;
        }
        await this.write({ ...state, packages: state.packages.filter((item) => !sameInstallIdentity2(item, id, platform, scope, sourceId)) });
        return existing;
      }
      /** Removes one exact persisted installation without broad legacy identity matching. */
      async removeInstalled(pkg) {
        const state = await this.read();
        const existing = state.packages.find((item) => sameInstalledRecord3(item, pkg));
        if (!existing)
          return void 0;
        await this.write({ ...state, packages: state.packages.filter((item) => !sameInstalledRecord3(item, pkg)) });
        return existing;
      }
      /** Atomically swaps one installation identity for another in a single state write. */
      async replace(previous, next) {
        const state = await this.read();
        const existing = state.packages.find((item) => sameInstalledRecord3(item, previous));
        if (!existing)
          throw new Error(`Installed predecessor '${previous.qualifiedName ?? previous.id}' was not found.`);
        const collision = state.packages.find((item) => sameInstallIdentity2(item, next.id, next.platform, next.scope, next.sourceId) && !sameInstalledRecord3(item, previous));
        if (collision)
          throw new Error(`Destination package '${next.qualifiedName ?? next.id}' is already installed.`);
        const packages = state.packages.filter((item) => !sameInstalledRecord3(item, previous));
        packages.push(next);
        await this.write({ ...state, packages: packages.sort(compareInstalledPackages2) });
      }
      async discardLegacyAutomationPreferences() {
        let changed = false;
        for (const relativePath of [(0, pathPlanning_1.stateRelativePath)(), (0, pathPlanning_1.legacyStateRelativePath)()]) {
          const bytes = await this.storage.readFile(this.scope, relativePath);
          if (bytes === void 0)
            continue;
          let parsed;
          try {
            parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
          } catch {
            continue;
          }
          if (!("autoUpdateEnabled" in parsed) && !("autoUpdateChangedAt" in parsed) && !("autoInstallGroups" in parsed) && !("autoInstallGroupsChangedAt" in parsed))
            continue;
          const packages = Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage2) : [];
          await this.storage.writeFileAtomic(this.scope, relativePath, Buffer.from(`${JSON.stringify({ schemaVersion: 2, packages }, null, 2)}
`, "utf8"));
          changed = true;
        }
        return changed;
      }
      async write(state) {
        await this.storage.writeFileAtomic(this.scope, (0, pathPlanning_1.stateRelativePath)(), Buffer.from(`${JSON.stringify({ ...state, schemaVersion: 2 }, null, 2)}
`, "utf8"));
      }
    };
    exports.InstalledStateStore = InstalledStateStore3;
    function compareInstalledPackages2(left, right) {
      return `${left.scope}:${left.platform}:${left.type}:${left.sourceId ?? ""}:${left.qualifiedName ?? left.id}`.localeCompare(`${right.scope}:${right.platform}:${right.type}:${right.sourceId ?? ""}:${right.qualifiedName ?? right.id}`);
    }
    function sameInstallIdentity2(pkg, id, platform, scope, sourceId) {
      if (pkg.id !== id || pkg.platform !== platform || pkg.scope !== scope) {
        return false;
      }
      return sourceId === void 0 || pkg.sourceId === sourceId;
    }
    function sameInstalledRecord3(left, right) {
      return left.id === right.id && left.platform === right.platform && left.scope === right.scope && left.sourceId === right.sourceId && left.qualifiedName === right.qualifiedName && left.sourceRepo === right.sourceRepo && left.sourceBranch === right.sourceBranch && left.sourcePath === right.sourcePath;
    }
    function isInstalledPackage2(value) {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      const record = value;
      const scope = record.scope === void 0 ? "workspace" : record.scope;
      if (!packages_1.installScopes.includes(scope)) {
        return false;
      }
      if (record.scope === void 0) {
        record.scope = "workspace";
      }
      return typeof record.id === "string" && typeof record.type === "string" && typeof record.platform === "string" && packages_1.platforms.includes(record.platform) && typeof record.scope === "string" && typeof record.version === "string" && typeof record.sourceRepo === "string" && typeof record.sourceBranch === "string" && typeof record.sourcePath === "string" && typeof record.installedPath === "string" && typeof record.installedAt === "string" && (record.sourceId === void 0 || typeof record.sourceId === "string") && (record.qualifiedName === void 0 || typeof record.qualifiedName === "string") && (record.group === void 0 || typeof record.group === "string") && (record.managedConfig === void 0 || isManagedConfigContribution2(record.managedConfig)) && (record.managedPayloadPath === void 0 || typeof record.managedPayloadPath === "string") && (record.harnessBundle === void 0 || isHarnessBundle2(record.harnessBundle)) && (record.harnessProfile === void 0 || typeof record.harnessProfile === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(record.harnessProfile)) && (record.hotloaded === void 0 || typeof record.hotloaded === "boolean") && (record.hotloadRequestedAt === void 0 || typeof record.hotloadRequestedAt === "string") && (record.offloadRequestedAt === void 0 || typeof record.offloadRequestedAt === "string") && (record.autoUpdate === void 0 || typeof record.autoUpdate === "boolean") && (record.autoUpdateChangedAt === void 0 || typeof record.autoUpdateChangedAt === "string") && (record.sourceRevision === void 0 || typeof record.sourceRevision === "string") && (record.revertedAt === void 0 || typeof record.revertedAt === "string") && (record.revertedFromVersion === void 0 || typeof record.revertedFromVersion === "string") && (record.migrationHistory === void 0 || Array.isArray(record.migrationHistory) && record.migrationHistory.every(isMigrationHistoryEntry2));
    }
    function isHarnessBundle2(value) {
      return isPlainRecord2(value) && typeof value.profile === "string" && typeof value.name === "string" && typeof value.contentSha256 === "string" && /^[0-9a-f]{64}$/.test(value.contentSha256) && Array.isArray(value.files) && value.files.every((file) => isPlainRecord2(file) && typeof file.path === "string" && typeof file.sha256 === "string" && /^[0-9a-f]{64}$/.test(file.sha256));
    }
    function isMigrationHistoryEntry2(value) {
      if (!isPlainRecord2(value) || typeof value.migratedAt !== "string")
        return false;
      return isMigrationSnapshot2(value.from) && isMigrationSnapshot2(value.to);
    }
    function isMigrationSnapshot2(value) {
      if (!isPlainRecord2(value))
        return false;
      return typeof value.id === "string" && typeof value.qualifiedName === "string" && (value.sourceId === void 0 || typeof value.sourceId === "string") && typeof value.version === "string" && typeof value.repository === "string" && typeof value.branch === "string" && typeof value.path === "string";
    }
    function isManagedConfigContribution2(value) {
      if (!isPlainRecord2(value)) {
        return false;
      }
      if (value.kind === "mcp") {
        return typeof value.serverName === "string" && isPlainRecord2(value.serverConfig);
      }
      if (value.kind === "hook") {
        return isPlainRecord2(value.hooks) && Object.values(value.hooks).every(Array.isArray);
      }
      if (value.kind === "codex-agent") {
        return typeof value.configPath === "string" && typeof value.contentSha256 === "string" && /^[0-9a-f]{64}$/.test(value.contentSha256);
      }
      return false;
    }
    function isPlainRecord2(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
  }
});

// packages/marketplace-core/out/services/packageFiles.js
var require_packageFiles = __commonJS({
  "packages/marketplace-core/out/services/packageFiles.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.filterPackageFilesForPlatform = filterPackageFilesForPlatform2;
    function filterPackageFilesForPlatform2(files, platform) {
      if (platform === "codex") {
        return files;
      }
      return files.filter((file) => !isOpenAIYaml2(file.relativePath));
    }
    function isOpenAIYaml2(relativePath) {
      const parts = relativePath.replaceAll("\\", "/").split("/");
      return parts[parts.length - 1]?.toLowerCase() === "openai.yaml";
    }
  }
});

// packages/marketplace-core/out/services/migrationPlanning.js
var require_migrationPlanning = __commonJS({
  "packages/marketplace-core/out/services/migrationPlanning.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.planPackageMigrations = planPackageMigrations3;
    exports.matchesMigration = matchesMigration2;
    exports.migrationFor = migrationFor2;
    var versioning_1 = require_versioning();
    function planPackageMigrations3(catalog, installed) {
      const raw = [];
      const ineligible = [];
      for (const destination of catalog) {
        for (const migration of destination.manifest.migrations ?? []) {
          for (const predecessor of installed.filter((item) => matchesMigration2(destination, migration, item))) {
            const reason = incompatibilityReason2(destination, predecessor, installed);
            if (reason)
              ineligible.push({ destination, predecessor, reason });
            else
              raw.push({ destination, predecessor });
          }
        }
      }
      const eligible = [];
      for (const candidate of deduplicate2(raw)) {
        const predecessorClaims = raw.filter((item) => installKey2(item.predecessor) === installKey2(candidate.predecessor));
        const destinationClaims = raw.filter((item) => targetKey2(item) === targetKey2(candidate));
        const reason = new Set(predecessorClaims.map((item) => destinationIdentity2(item.destination))).size > 1 ? "Multiple destination packages claim this predecessor installation." : new Set(destinationClaims.map((item) => installKey2(item.predecessor))).size > 1 ? "Multiple predecessor installations target the same destination platform and scope." : void 0;
        if (reason)
          ineligible.push({ ...candidate, reason });
        else
          eligible.push(candidate);
      }
      return { eligible, ineligible: deduplicateIneligible2(ineligible) };
    }
    function matchesMigration2(destination, migration, installed) {
      const sourceId = migration.from.sourceId ?? destination.source.id;
      const qualifiedName = migration.from.name ?? destination.manifest.qualifiedName;
      const id = qualifiedName.split("/").at(-1);
      if (installed.sourceId !== void 0)
        return installed.sourceId === sourceId && (installed.qualifiedName ?? installed.id) === qualifiedName;
      return migration.from.repository !== void 0 && installed.id === id && installed.sourceRepo === migration.from.repository && installed.sourceBranch === migration.from.branch && normalizeRepoPath2(installed.sourcePath) === normalizeRepoPath2(migration.from.path);
    }
    function migrationFor2(destination, predecessor, catalog, installed) {
      return planPackageMigrations3(catalog, installed).eligible.find((item) => destinationIdentity2(item.destination) === destinationIdentity2(destination) && installKey2(item.predecessor) === installKey2(predecessor));
    }
    function incompatibilityReason2(destination, predecessor, installed) {
      if (destination.manifest.type !== predecessor.type)
        return "Destination package type does not match the predecessor.";
      if (!destination.manifest.platforms.includes(predecessor.platform))
        return "Destination package does not support the installed platform.";
      if (!destination.manifest.delivery.includes(predecessor.scope))
        return "Destination package does not support the installed scope.";
      if ((0, versioning_1.compareVersions)(destination.manifest.version, predecessor.version) < 0)
        return "Destination version is older than the installed predecessor.";
      const collision = installed.some((item) => item.platform === predecessor.platform && item.scope === predecessor.scope && item.sourceId === destination.source.id && item.qualifiedName === destination.manifest.qualifiedName);
      return collision ? "Destination package is already installed for this platform and scope." : void 0;
    }
    function deduplicate2(candidates) {
      const seen = /* @__PURE__ */ new Set();
      return candidates.filter((item) => {
        const key = `${destinationIdentity2(item.destination)}:${installKey2(item.predecessor)}`;
        if (seen.has(key))
          return false;
        seen.add(key);
        return true;
      });
    }
    function deduplicateIneligible2(candidates) {
      const seen = /* @__PURE__ */ new Set();
      return candidates.filter((item) => {
        const key = `${destinationIdentity2(item.destination)}:${installKey2(item.predecessor)}:${item.reason}`;
        if (seen.has(key))
          return false;
        seen.add(key);
        return true;
      });
    }
    function destinationIdentity2(pkg) {
      return `${pkg.source.id}:${pkg.manifest.qualifiedName}`;
    }
    function installKey2(item) {
      return `${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}:${item.platform}:${item.scope}`;
    }
    function targetKey2(item) {
      return `${destinationIdentity2(item.destination)}:${item.predecessor.platform}:${item.predecessor.scope}`;
    }
    function normalizeRepoPath2(value) {
      return `/${value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")}`;
    }
  }
});

// packages/marketplace-core/out/services/mcpConfig.js
var require_mcpConfig = __commonJS({
  "packages/marketplace-core/out/services/mcpConfig.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mcpConfigRelativePath = mcpConfigRelativePath2;
    exports.readMcpHostConfig = readMcpHostConfig2;
    exports.validateMcpEntrypoint = validateMcpEntrypoint2;
    exports.upsertJsonMcpServer = upsertJsonMcpServer2;
    exports.removeJsonMcpServer = removeJsonMcpServer2;
    exports.readClaudeHookConfig = readClaudeHookConfig2;
    exports.upsertClaudeHookConfig = upsertClaudeHookConfig2;
    exports.removeClaudeHookConfig = removeClaudeHookConfig2;
    exports.upsertCodexMcpServer = upsertCodexMcpServer2;
    exports.removeCodexMcpServer = removeCodexMcpServer2;
    var validation_1 = require_validation();
    function mcpConfigRelativePath2(platform) {
      switch (platform) {
        case "codex":
          return ".codex/config.toml";
        case "cursor":
          return ".cursor/mcp.json";
        case "github-copilot":
          return ".copilot/mcp-config.json";
        case "claude":
          return ".claude.json";
        case "deepseek-harness":
          throw new Error("DeepSeek Harness MCP servers are installed through profile bundles.");
      }
    }
    function readMcpHostConfig2(pkg, platform, files) {
      const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
      if (!entrypoint) {
        throw new validation_1.ValidationError(`MCP package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
      }
      return validateMcpEntrypoint2(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.id, platform, pkg.manifest.entrypoint);
    }
    function validateMcpEntrypoint2(content, packageId, platform, source) {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new validation_1.ValidationError(`MCP entrypoint at ${source} must be valid JSON.`);
      }
      if (!isRecord7(parsed)) {
        throw new validation_1.ValidationError(`MCP entrypoint at ${source} must be a JSON object.`);
      }
      const platformConfig = isRecord7(parsed[platform]) ? parsed[platform] : parsed;
      const servers = platform === "codex" ? platformConfig["mcp_servers"] ?? platformConfig["mcpServers"] : platformConfig["mcpServers"];
      if (!isRecord7(servers)) {
        if (looksLikeServerConfig2(platformConfig)) {
          return { serverName: packageId, serverConfig: normalizeServerConfig2(platform, platformConfig) };
        }
        throw new validation_1.ValidationError(`MCP entrypoint at ${source} must include a supported MCP servers object or a direct MCP server config.`);
      }
      const serverNames = Object.keys(servers);
      if (serverNames.length !== 1) {
        throw new validation_1.ValidationError(`MCP entrypoint at ${source} must define exactly one MCP server.`);
      }
      const serverConfig = servers[serverNames[0]];
      if (!isRecord7(serverConfig)) {
        throw new validation_1.ValidationError(`MCP entrypoint at ${source} must define its MCP server as a JSON object.`);
      }
      return { serverName: packageId, serverConfig: normalizeServerConfig2(platform, serverConfig) };
    }
    function upsertJsonMcpServer2(existingContent, serverName, serverConfig, expectedExisting) {
      const config = parseExistingJsonObject2(existingContent, "MCP configuration");
      const existingServers = isRecord7(config["mcpServers"]) ? config["mcpServers"] : {};
      const existing = existingServers[serverName];
      if (existing !== void 0 && (!expectedExisting || !sameJsonValue2(existing, expectedExisting))) {
        throw new validation_1.ValidationError(`MCP server '${serverName}' already exists and is not managed by AI Marketplace.`);
      }
      return `${JSON.stringify({
        ...config,
        mcpServers: {
          ...existingServers,
          [serverName]: serverConfig
        }
      }, null, 2)}
`;
    }
    function removeJsonMcpServer2(existingContent, serverName, expectedServerConfig) {
      const config = parseExistingJsonObject2(existingContent, "MCP configuration");
      if (!isRecord7(config["mcpServers"]) || !(serverName in config["mcpServers"])) {
        return existingContent;
      }
      if (expectedServerConfig && !sameJsonValue2(config["mcpServers"][serverName], expectedServerConfig)) {
        throw new validation_1.ValidationError(`MCP server '${serverName}' was changed outside AI Marketplace and will not be removed.`);
      }
      const remainingServers = { ...config["mcpServers"] };
      delete remainingServers[serverName];
      return `${JSON.stringify({ ...config, mcpServers: remainingServers }, null, 2)}
`;
    }
    function readClaudeHookConfig2(content, source) {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new validation_1.ValidationError(`Claude hook entrypoint at ${source} must be valid JSON.`);
      }
      if (!isRecord7(parsed) || !isRecord7(parsed["hooks"])) {
        throw new validation_1.ValidationError(`Claude hook entrypoint at ${source} must contain a 'hooks' object.`);
      }
      const hooks = {};
      for (const [event, entries] of Object.entries(parsed["hooks"])) {
        if (!Array.isArray(entries)) {
          throw new validation_1.ValidationError(`Claude hook entrypoint at ${source} has a non-array '${event}' hook list.`);
        }
        hooks[event] = entries;
      }
      return hooks;
    }
    function upsertClaudeHookConfig2(existingContent, contribution) {
      const config = parseExistingJsonObject2(existingContent, ".claude/settings.json");
      const existingHooks = isRecord7(config["hooks"]) ? config["hooks"] : {};
      const hooks = { ...existingHooks };
      for (const [event, entries] of Object.entries(contribution)) {
        const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
        hooks[event] = [...existing, ...entries.filter((entry) => !existing.some((candidate) => sameJsonValue2(candidate, entry)))];
      }
      return `${JSON.stringify({ ...config, hooks }, null, 2)}
`;
    }
    function removeClaudeHookConfig2(existingContent, contribution) {
      const config = parseExistingJsonObject2(existingContent, ".claude/settings.json");
      if (!isRecord7(config["hooks"])) {
        return existingContent;
      }
      const hooks = { ...config["hooks"] };
      let changed = false;
      for (const [event, entries] of Object.entries(contribution)) {
        const existing = hooks[event];
        if (!Array.isArray(existing)) {
          continue;
        }
        const remaining = existing.filter((candidate) => !entries.some((entry) => sameJsonValue2(candidate, entry)));
        if (remaining.length !== existing.length) {
          changed = true;
          if (remaining.length === 0)
            delete hooks[event];
          else
            hooks[event] = remaining;
        }
      }
      return changed ? `${JSON.stringify({ ...config, hooks }, null, 2)}
` : existingContent;
    }
    function upsertCodexMcpServer2(existingContent, serverName, serverConfig, expectedExisting) {
      const base = removeCodexMcpServerUnchecked2(existingContent, serverName) ?? "";
      if (existingContent !== void 0 && base !== existingContent && (!expectedExisting || normalizeToml2(existingContent) !== normalizeToml2(appendCodexServer2(base, serverName, expectedExisting)))) {
        throw new validation_1.ValidationError(`MCP server '${serverName}' already exists or changed outside AI Marketplace.`);
      }
      return appendCodexServer2(base, serverName, serverConfig);
    }
    function appendCodexServer2(base, serverName, serverConfig) {
      const separator = base.trim().length > 0 && !base.endsWith("\n\n") ? "\n" : "";
      return `${base}${separator}${codexServerToml2(serverName, serverConfig)}`;
    }
    function normalizeToml2(value) {
      return value.replace(/\r\n/g, "\n").trim();
    }
    function removeCodexMcpServer2(existingContent, serverName, expectedExisting) {
      const base = removeCodexMcpServerUnchecked2(existingContent, serverName);
      if (existingContent !== void 0 && base !== existingContent && expectedExisting && normalizeToml2(existingContent) !== normalizeToml2(appendCodexServer2(base ?? "", serverName, expectedExisting))) {
        throw new validation_1.ValidationError(`MCP server '${serverName}' changed outside AI Marketplace and will not be removed.`);
      }
      return base;
    }
    function removeCodexMcpServerUnchecked2(existingContent, serverName) {
      if (existingContent === void 0) {
        return void 0;
      }
      const lines = existingContent.split(/\r?\n/);
      const kept = [];
      let removing = false;
      for (const line of lines) {
        const header = parseTomlTableHeader2(line);
        if (header) {
          removing = isManagedCodexMcpHeader2(header, serverName);
        }
        if (!removing) {
          kept.push(line);
        }
      }
      const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
      return result.trim().length === 0 ? "" : `${result.replace(/\n*$/, "")}
`;
    }
    function parseExistingJsonObject2(content, source) {
      if (!content || content.trim().length === 0) {
        return {};
      }
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new validation_1.ValidationError(`${source} must contain valid JSON.`);
      }
      if (!isRecord7(parsed)) {
        throw new validation_1.ValidationError(`${source} must contain a JSON object.`);
      }
      return parsed;
    }
    function codexServerToml2(serverName, serverConfig) {
      const lines = [];
      appendTomlTable2(lines, ["mcp_servers", serverName], serverConfig);
      return `${lines.join("\n")}
`;
    }
    function appendTomlTable2(lines, path2, record) {
      lines.push(`[${path2.map(quoteTomlKey2).join(".")}]`);
      const nested = [];
      for (const [key, value] of Object.entries(record)) {
        if (isRecord7(value)) {
          nested.push([key, value]);
          continue;
        }
        lines.push(`${quoteTomlKey2(key)} = ${formatTomlValue2(value)}`);
      }
      for (const [key, value] of nested) {
        lines.push("");
        appendTomlTable2(lines, [...path2, key], value);
      }
    }
    function formatTomlValue2(value) {
      if (typeof value === "string") {
        return JSON.stringify(value);
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      if (Array.isArray(value)) {
        return `[${value.map(formatTomlValue2).join(", ")}]`;
      }
      throw new validation_1.ValidationError("Codex MCP server config contains an unsupported TOML value.");
    }
    function quoteTomlKey2(value) {
      return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
    }
    function parseTomlTableHeader2(line) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("[") || !trimmed.endsWith("]") || trimmed.startsWith("[[")) {
        return void 0;
      }
      return splitTomlDottedKey2(trimmed.slice(1, -1));
    }
    function splitTomlDottedKey2(value) {
      const parts = [];
      let current = "";
      let quoted = false;
      let escaping = false;
      for (const char of value) {
        if (escaping) {
          current += char;
          escaping = false;
          continue;
        }
        if (quoted && char === "\\") {
          escaping = true;
          current += char;
          continue;
        }
        if (char === '"') {
          quoted = !quoted;
          current += char;
          continue;
        }
        if (!quoted && char === ".") {
          parts.push(parseTomlKeyPart2(current.trim()));
          current = "";
          continue;
        }
        current += char;
      }
      parts.push(parseTomlKeyPart2(current.trim()));
      return parts;
    }
    function parseTomlKeyPart2(value) {
      if (value.startsWith('"') && value.endsWith('"')) {
        return JSON.parse(value);
      }
      return value;
    }
    function isManagedCodexMcpHeader2(header, serverName) {
      return header.length >= 2 && header[0] === "mcp_servers" && header[1] === serverName;
    }
    function normalizeServerConfig2(platform, config) {
      if (platform !== "codex") {
        return config;
      }
      const normalized = { ...config };
      if (normalized["type"] === "stdio") {
        delete normalized["type"];
      }
      return normalized;
    }
    function looksLikeServerConfig2(value) {
      return typeof value["command"] === "string" || typeof value["url"] === "string";
    }
    function isRecord7(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function sameJsonValue2(left, right) {
      return JSON.stringify(canonicalize2(left)) === JSON.stringify(canonicalize2(right));
    }
    function canonicalize2(value) {
      if (Array.isArray(value)) {
        return value.map(canonicalize2);
      }
      if (isRecord7(value)) {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize2(value[key])]));
      }
      return value;
    }
  }
});

// packages/marketplace-core/out/services/harnessBundle.js
var require_harnessBundle = __commonJS({
  "packages/marketplace-core/out/services/harnessBundle.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateHarnessBundle = validateHarnessBundle2;
    var node_crypto_1 = __require("node:crypto");
    var yaml_1 = require_dist();
    var pathPlanning_1 = require_pathPlanning();
    var validation_1 = require_validation();
    function validateHarnessBundle2(pkg, files) {
      if (pkg.manifest.entrypoint !== "package.json") {
        throw new validation_1.ValidationError(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' must use package.json as its entrypoint.`);
      }
      const entrypoint = files.find((file) => file.relativePath === "package.json");
      if (!entrypoint)
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing package.json.`);
      let parsed;
      try {
        parsed = JSON.parse(Buffer.from(entrypoint.content).toString("utf8"));
      } catch {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid package.json.`);
      }
      if (!isRecord7(parsed) || typeof parsed.name !== "string" || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(parsed.name) || parsed.version !== pkg.manifest.version || !isRecord7(parsed.dsh) || !isRecord7(parsed.dsh.bundle)) {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a matching npm name, version, and dsh.bundle declaration.`);
      }
      const patch = parsed.dsh.bundle.patch;
      if (typeof patch !== "string")
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires dsh.bundle.patch.`);
      const patchPath = (0, pathPlanning_1.safeJoinRelative)(patch.replace(/^\.\//, ""));
      if (!/^cordis\.patch\.ya?ml$/.test(patchPath)) {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must use a root cordis.patch.yml file.`);
      }
      const patchFile = files.find((file) => file.relativePath === patchPath);
      if (!patchFile)
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing '${patchPath}'.`);
      const document = (0, yaml_1.parseDocument)(Buffer.from(patchFile.content).toString("utf8"), { uniqueKeys: true });
      const patchValue = document.toJS();
      if (document.errors.length > 0 || !Array.isArray(patchValue) || patchValue.length === 0) {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an invalid or empty Cordis patch.`);
      }
      const rows = patchValue.flatMap((operation) => isRecord7(operation) && Array.isArray(operation.insert) ? operation.insert : []);
      const expectedName = parsed.name;
      const hasContribution = rows.some((row) => isRecord7(row) && typeof row.id === "string" && row.id.length > 0 && typeof row.name === "string" && (row.name === expectedName || row.name.startsWith(`${expectedName}/`) || pkg.manifest.type === "mcp" && row.name === "@deepseek-ai/dsh-mcp-client"));
      if (!hasContribution) {
        throw new validation_1.ValidationError(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' must insert a plugin contribution from its bundle.`);
      }
      const scripts = parsed.scripts;
      if (isRecord7(scripts) && ["preinstall", "install", "postinstall", "prepare"].some((key) => key in scripts)) {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must be prebuilt and contain no install lifecycle scripts.`);
      }
      const paths = /* @__PURE__ */ new Set();
      for (const file of files) {
        const path2 = (0, pathPlanning_1.safeJoinRelative)(file.relativePath);
        if (paths.has(path2))
          throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' contains duplicate file '${path2}'.`);
        paths.add(path2);
      }
      const entry = typeof parsed.main === "string" ? parsed.main : void 0;
      if (entry) {
        const mainPath = (0, pathPlanning_1.safeJoinRelative)(entry.replace(/^\.\//, ""));
        if (!paths.has(mainPath))
          throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing main module '${mainPath}'.`);
      } else if (pkg.manifest.type !== "mcp") {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a prebuilt main module.`);
      }
      const exportsValue = parsed.exports;
      if (exportsValue !== void 0 && !isRecord7(exportsValue) && typeof exportsValue !== "string") {
        throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid exports.`);
      }
      const checkReference = (reference) => {
        if (typeof reference === "string") {
          if (!reference.startsWith("./"))
            throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an external entrypoint reference.`);
          const target = (0, pathPlanning_1.safeJoinRelative)(reference.slice(2));
          if (!paths.has(target))
            throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing referenced file '${target}'.`);
        } else if (isRecord7(reference)) {
          for (const nested of Object.values(reference))
            checkReference(nested);
        } else {
          throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid entrypoint exports.`);
        }
      };
      if (exportsValue !== void 0)
        checkReference(exportsValue);
      if (isRecord7(parsed.dsh.client)) {
        if (!isRecord7(exportsValue) || exportsValue["./client"] === void 0) {
          throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' declares dsh.client without a client export.`);
        }
      }
      for (const row of rows) {
        if (!isRecord7(row) || typeof row.name !== "string" || !row.name.startsWith(`${expectedName}/`))
          continue;
        const subpath = `.${row.name.slice(expectedName.length)}`;
        if (!isRecord7(exportsValue) || exportsValue[subpath] === void 0) {
          throw new validation_1.ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has no export for patch plugin '${row.name}'.`);
        }
      }
      const digest = (0, node_crypto_1.createHash)("sha256");
      for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
        digest.update(file.relativePath).update("\0").update(file.content).update("\0");
      }
      return { name: parsed.name, patchPath, contentSha256: digest.digest("hex") };
    }
    function isRecord7(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
  }
});

// packages/marketplace-core/out/services/packageInstaller.js
var require_packageInstaller = __commonJS({
  "packages/marketplace-core/out/services/packageInstaller.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PackageInstaller = void 0;
    var node_crypto_1 = __require("node:crypto");
    var pathPlanning_1 = require_pathPlanning();
    var installPlanning_1 = require_installPlanning();
    var installedState_1 = require_installedState();
    var packageFiles_1 = require_packageFiles();
    var migrationPlanning_1 = require_migrationPlanning();
    var versioning_1 = require_versioning();
    var mcpConfig_1 = require_mcpConfig();
    var mcpScripts_1 = require_mcpScripts();
    var repositoryUrl_1 = require_repositoryUrl();
    var manifestSchema_1 = require_manifestSchema();
    var harnessBundle_1 = require_harnessBundle();
    var PackageInstaller2 = class {
      storage;
      config;
      fetchFiles;
      mcpScriptRunner;
      harnessProfileManager;
      constructor(storage, config, fetchFiles, mcpScriptRunner, harnessProfileManager) {
        this.storage = storage;
        this.config = config;
        this.fetchFiles = fetchFiles;
        this.mcpScriptRunner = mcpScriptRunner;
        this.harnessProfileManager = harnessProfileManager;
      }
      async listInstalled() {
        await this.recoverMigration("workspace");
        await this.recoverMigration("global");
        const workspace = await this.stateStore("workspace").read();
        const global = await this.stateStore("global").read();
        return [...workspace.packages, ...global.packages];
      }
      async install(pkg, platform, scope) {
        if (platform === "deepseek-harness") {
          this.assertHarnessDelivery(pkg, scope);
          if (pkg.manifest.type !== "skill" && pkg.manifest.type !== "rule")
            return this.installHarnessBundle(pkg);
          const files = await this.fetchFiles(pkg);
          this.assertHarnessDocument(pkg, files);
          if (pkg.manifest.type === "rule") {
            if (!this.harnessProfileManager)
              throw new Error("This host cannot activate DeepSeek Harness rules.");
            await this.harnessProfileManager.ensureBridge(this.config.deepseekHarnessProfile ?? "web");
          }
        }
        if (pkg.manifest.type === "mcp") {
          return this.installMcp(pkg, platform, "install");
        }
        if (pkg.manifest.type === "hook" && platform === "claude") {
          return this.installClaudeHook(pkg, scope);
        }
        const installPath = scope === "cloud" ? (0, pathPlanning_1.cloudInstallPath)(platform, pkg.manifest.type, pkg.manifest.id) : (0, pathPlanning_1.installRelativePath)(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
        let managedConfig;
        if (scope !== "cloud") {
          await this.assertNoInstallCollision(pkg, platform, scope, installPath);
          const files = (0, packageFiles_1.filterPackageFilesForPlatform)(await this.fetchFiles(pkg), platform);
          managedConfig = codexAgentContribution2(pkg, platform, files, this.config);
          await this.assertCodexAgentConfigAvailable(pkg, scope, installPath, managedConfig);
          await this.replacePackage(scope, installPath, files, pkg, platform);
        }
        const installed = {
          id: pkg.manifest.id,
          type: pkg.manifest.type,
          platform,
          scope,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository2(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...sourceMetadata2(pkg),
          ...managedConfig === void 0 ? {} : { managedConfig },
          ...platform === "deepseek-harness" && pkg.manifest.type === "rule" ? { harnessProfile: this.config.deepseekHarnessProfile ?? "web" } : {},
          installedPath: installPath,
          installedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await this.stateStore(scope).upsert(installed);
        return installed;
      }
      async update(pkg, platform, scope) {
        return this.install(pkg, platform, scope);
      }
      async updateInstalled(pkg, installed) {
        if (installed.harnessBundle) {
          this.assertHarnessBundleSource(pkg, installed);
          return this.installHarnessBundle(pkg, installed);
        }
        if (pkg.manifest.type === "mcp") {
          return this.installMcp(pkg, installed.platform, "update", installed.installedAt, installed, true, (updated2) => ({
            ...updated2,
            autoUpdate: void 0,
            autoUpdateChangedAt: void 0,
            revertedAt: void 0,
            revertedFromVersion: void 0
          }));
        }
        const updated = await this.mutateInstalled(pkg, installed);
        const current = {
          ...updated,
          autoUpdate: void 0,
          autoUpdateChangedAt: void 0,
          revertedAt: void 0,
          revertedFromVersion: void 0
        };
        await this.stateStore(installed.scope).upsert(current);
        return current;
      }
      async revertInstalled(pkg, installed, expectedRevision) {
        if (pkg.sourceRevision === void 0 || pkg.sourceRevision !== expectedRevision) {
          throw new Error("Rollback snapshot revision does not match the current manifest previous_version.");
        }
        if (installed.harnessBundle) {
          this.assertHarnessBundleSource(pkg, installed);
          return this.installHarnessBundle(pkg, installed, true);
        }
        this.assertCompatibleRollback(pkg, installed);
        if (pkg.manifest.type === "mcp") {
          return this.installMcp(pkg, installed.platform, "revert", installed.installedAt, installed, true, (updated2) => ({
            ...updated2,
            autoUpdate: false,
            autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(),
            revertedAt: (/* @__PURE__ */ new Date()).toISOString(),
            revertedFromVersion: installed.version
          }));
        }
        const updated = await this.mutateInstalled(pkg, installed);
        const reverted = {
          ...updated,
          autoUpdate: false,
          autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(),
          revertedAt: (/* @__PURE__ */ new Date()).toISOString(),
          revertedFromVersion: installed.version
        };
        await this.stateStore(installed.scope).upsert(reverted);
        return reverted;
      }
      /** Replaces an explicitly declared predecessor while preserving its target and user metadata. */
      async migrateInstalled(pkg, predecessor) {
        if (!(pkg.manifest.migrations ?? []).some((migration) => (0, migrationPlanning_1.matchesMigration)(pkg, migration, predecessor))) {
          throw new Error("Destination package does not declare the selected predecessor.");
        }
        if (pkg.manifest.type !== predecessor.type || !pkg.manifest.platforms.includes(predecessor.platform) || !pkg.manifest.delivery.includes(predecessor.scope) || (0, versioning_1.compareVersions)(pkg.manifest.version, predecessor.version) < 0) {
          throw new Error("Destination package is not compatible with the selected predecessor installation.");
        }
        if (predecessor.harnessBundle)
          return this.migrateHarnessBundle(pkg, predecessor);
        if (predecessor.platform === "codex" && predecessor.type === "agent") {
          throw new Error("Codex agent identity migrations are not yet supported; uninstall the predecessor before installing the destination.");
        }
        if (!isCanonicalInstalledPath2(predecessor, this.config))
          throw new Error("Installed predecessor uses an unexpected managed path.");
        const files = await this.fetchFiles(pkg);
        (0, mcpScripts_1.assertMcpPackageScripts)(pkg, files);
        const offloaded = predecessor.installedPath.startsWith(".offload/");
        const targetPath = predecessor.type === "mcp" ? predecessor.installedPath : predecessor.scope === "cloud" ? (0, pathPlanning_1.cloudInstallPath)(predecessor.platform, predecessor.type, pkg.manifest.id) : offloaded ? (0, pathPlanning_1.offloadRelativePath)(predecessor.platform, predecessor.type, pkg.manifest.id) : (0, pathPlanning_1.installRelativePath)(predecessor.platform, predecessor.type, pkg.manifest.id, this.config.platformPathOverrides);
        await this.assertMigrationDestinationAvailable(pkg, predecessor, targetPath);
        const operationId = (0, node_crypto_1.randomUUID)();
        const journalPath = migrationJournalPath2();
        const backupRoot = `.ai_marketplace/migrations/${operationId}`;
        const payloadBackup = predecessor.scope === "cloud" || predecessor.type === "mcp" ? void 0 : `${backupRoot}/payload`;
        const configPath2 = migrationConfigPath2(predecessor);
        const configBackup = configPath2 ? `${backupRoot}/config` : void 0;
        const existingConfig = configPath2 ? await this.readOptionalText(predecessor.scope, configPath2) : void 0;
        const nextConfig = !configPath2 ? void 0 : predecessor.type === "mcp" ? this.migratedMcpConfig(pkg, predecessor, files, existingConfig) : this.migratedClaudeHookConfig(pkg, predecessor, files, existingConfig);
        if (predecessor.type === "mcp") {
          const destinationPayload = (0, pathPlanning_1.mcpPayloadRelativePath)(predecessor.platform, pkg.source.id, pkg.manifest.id);
          if (await this.storage.exists("global", destinationPayload) && predecessor.managedPayloadPath !== destinationPayload) {
            throw new Error(`Managed MCP payload path '${destinationPayload}' already exists without matching installed ownership.`);
          }
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const next = this.migratedRecord(pkg, predecessor, targetPath, now, files);
        const journal = { operationId, previous: migrationJournalPrevious2(predecessor), next: migrationJournalNext2(next), targetPath, payloadBackup, configPath: configPath2, configBackup };
        await this.writeText(predecessor.scope, journalPath, `${JSON.stringify(journal, null, 2)}
`);
        let preparedMcpPayload;
        let stateCommitted = false;
        try {
          if (predecessor.type === "mcp") {
            if (predecessor.managedPayloadPath) {
              await this.runMcpScript(predecessor.managedPayloadPath, mcpScripts_1.mcpUninstallScript, "migrate", predecessor.platform);
            }
            preparedMcpPayload = await this.prepareMcpPayload(pkg, predecessor.platform, files, "migrate", predecessor.managedPayloadPath);
          }
          if (configPath2) {
            if (await this.storage.exists(predecessor.scope, configPath2))
              await this.storage.move(predecessor.scope, configPath2, configBackup);
          }
          if (payloadBackup && await this.storage.exists(predecessor.scope, predecessor.installedPath)) {
            await this.storage.move(predecessor.scope, predecessor.installedPath, payloadBackup);
          }
          if (nextConfig !== void 0 && configPath2)
            await this.writeText(predecessor.scope, configPath2, nextConfig);
          if (predecessor.scope !== "cloud" && predecessor.type !== "mcp") {
            await this.replacePackage(predecessor.scope, targetPath, (0, packageFiles_1.filterPackageFilesForPlatform)(files, predecessor.platform), pkg, predecessor.platform);
          }
          await this.stateStore(predecessor.scope).replace(predecessor, next);
          stateCommitted = true;
          if (predecessor.type === "mcp" && preparedMcpPayload) {
            if (predecessor.managedPayloadPath && predecessor.managedPayloadPath !== preparedMcpPayload.path) {
              await this.storage.remove("global", predecessor.managedPayloadPath).catch(() => void 0);
            }
            await this.commitMcpPayload(preparedMcpPayload);
          }
          await this.storage.remove(predecessor.scope, backupRoot).catch(() => void 0);
          await this.storage.remove(predecessor.scope, journalPath).catch(() => void 0);
          return next;
        } catch (error) {
          if (preparedMcpPayload && !stateCommitted)
            await this.rollbackMcpPayload(preparedMcpPayload).catch(() => void 0);
          await this.rollbackMigration(journal).catch(() => void 0);
          throw error;
        }
      }
      async mutateInstalled(pkg, installed) {
        let updated;
        if (pkg.manifest.type === "hook" && installed.platform === "claude") {
          updated = isOffloaded2(installed) ? await this.updateOffloadedClaudeHook(pkg, installed) : await this.installClaudeHook(pkg, installed.scope, installed.installedAt, installed, false);
        } else {
          if (installed.scope !== "cloud") {
            const files = (0, packageFiles_1.filterPackageFilesForPlatform)(await this.fetchFiles(pkg), installed.platform);
            if (installed.platform === "deepseek-harness" && (installed.type === "skill" || installed.type === "rule")) {
              this.assertHarnessDocument(pkg, files);
              if (installed.type === "rule")
                await this.harnessProfileManager?.ensureBridge(installed.harnessProfile ?? "web");
            }
            const managedConfig = codexAgentContribution2(pkg, installed.platform, files, this.config);
            await this.assertCodexAgentConfigAvailable(pkg, installed.scope, installed.installedPath, managedConfig, installed);
            await this.replacePackage(installed.scope, installed.installedPath, files, pkg, installed.platform);
            updated = {
              ...installed,
              version: pkg.manifest.version,
              sourceRepo: sourceRepository2(pkg),
              sourceBranch: pkg.source.branch,
              sourcePath: pkg.sourcePath,
              ...sourceMetadata2(pkg),
              ...managedConfig === void 0 ? {} : { managedConfig }
            };
            return updated;
          }
          updated = {
            ...installed,
            version: pkg.manifest.version,
            sourceRepo: sourceRepository2(pkg),
            sourceBranch: pkg.source.branch,
            sourcePath: pkg.sourcePath,
            ...sourceMetadata2(pkg)
          };
        }
        return updated;
      }
      async uninstall(installed) {
        if (installed.harnessBundle) {
          await this.uninstallHarnessBundle(installed);
          return;
        }
        if (installed.type === "mcp") {
          await this.uninstallMcp(installed);
          return;
        }
        if (installed.type === "hook" && installed.platform === "claude") {
          await this.uninstallClaudeHook(installed);
          return;
        }
        if (installed.scope !== "cloud") {
          await this.assertManagedCodexAgentConfigUnmodified(installed);
          for (const path2 of (0, installPlanning_1.uninstallTargetPaths)(installed, this.config)) {
            await this.deleteRelativeDirectory(installed.scope, path2);
          }
        }
        await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
      }
      async offload(installed) {
        if (installed.harnessBundle)
          return this.offloadHarnessBundle(installed);
        if (installed.scope === "cloud") {
          throw new Error("Cloud packages cannot be offloaded.");
        }
        if (installed.type === "mcp") {
          throw new Error("MCP packages cannot be offloaded.");
        }
        if (installed.type === "hook" && installed.platform === "claude") {
          await this.removeClaudeHookContribution(installed);
        }
        await this.assertManagedCodexAgentConfigUnmodified(installed);
        const offloadPath = (0, pathPlanning_1.offloadRelativePath)(installed.platform, installed.type, installed.id);
        await this.moveDirectory(installed.scope, installed.installedPath, offloadPath);
        if (installed.managedConfig?.kind === "codex-agent") {
          await this.deleteRelativeDirectory(installed.scope, installed.managedConfig.configPath);
        }
        const moved = {
          ...installed,
          installedPath: offloadPath,
          hotloaded: false,
          offloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await this.stateStore(installed.scope).upsert(moved);
        return moved;
      }
      async hotload(installed) {
        if (installed.harnessBundle)
          return this.hotloadHarnessBundle(installed);
        if (installed.scope === "cloud") {
          throw new Error("Cloud packages cannot be hotloaded.");
        }
        if (installed.type === "mcp") {
          throw new Error("MCP packages cannot be hotloaded.");
        }
        if (installed.platform === "deepseek-harness" && installed.type === "rule") {
          if (!this.harnessProfileManager)
            throw new Error("This host cannot activate DeepSeek Harness rules.");
          await this.harnessProfileManager.ensureBridge(installed.harnessProfile ?? "web");
        }
        if (installed.type === "hook" && installed.platform === "claude") {
          await this.restoreClaudeHookContribution(installed);
        }
        await this.assertManagedCodexAgentConfigUnmodified(installed);
        const activePath = (0, pathPlanning_1.installRelativePath)(installed.platform, installed.type, installed.id, this.config.platformPathOverrides);
        if (installed.managedConfig?.kind === "codex-agent" && await this.storage.exists(installed.scope, installed.managedConfig.configPath)) {
          throw new Error(`Codex agent config '${installed.managedConfig.configPath}' already exists while the package is offloaded.`);
        }
        await this.moveDirectory(installed.scope, installed.installedPath, activePath);
        if (installed.managedConfig?.kind === "codex-agent") {
          await this.materializeCodexAgentConfig(installed.scope, activePath, installed.id, installed.managedConfig);
        }
        const moved = {
          ...installed,
          installedPath: activePath,
          hotloaded: true,
          hotloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await this.stateStore(installed.scope).upsert(moved);
        return moved;
      }
      assertHarnessDelivery(pkg, scope) {
        if (!pkg.manifest.platforms.includes("deepseek-harness") || !pkg.manifest.delivery.includes(scope) || scope === "cloud") {
          throw new Error(`DeepSeek Harness package '${pkg.manifest.id}' does not support ${scope} delivery.`);
        }
        if (scope === "workspace" && pkg.manifest.type !== "skill" && pkg.manifest.type !== "rule") {
          throw new Error(`DeepSeek Harness ${pkg.manifest.type} packages require global profile delivery.`);
        }
      }
      assertHarnessDocument(pkg, files) {
        const entry = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
        if (!entry || !pkg.manifest.entrypoint.toLowerCase().endsWith(".md")) {
          throw new Error(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' requires a Markdown entrypoint.`);
        }
        if (pkg.manifest.type === "skill" && pkg.manifest.entrypoint !== "SKILL.md") {
          throw new Error(`DeepSeek Harness skill '${pkg.manifest.id}' must use SKILL.md as its entrypoint.`);
        }
        if (pkg.manifest.type === "rule" && pkg.manifest.entrypoint !== "RULE.md") {
          throw new Error(`DeepSeek Harness rule '${pkg.manifest.id}' must use RULE.md as its entrypoint.`);
        }
      }
      assertHarnessBundleSource(pkg, installed) {
        if (installed.platform !== "deepseek-harness" || installed.scope !== "global" || pkg.source.id !== installed.sourceId || pkg.manifest.qualifiedName !== installed.qualifiedName || pkg.manifest.id !== installed.id || pkg.manifest.type !== installed.type || sourceRepository2(pkg) !== installed.sourceRepo || pkg.source.branch !== installed.sourceBranch || pkg.sourcePath !== installed.sourcePath || !isCanonicalInstalledPath2(installed, this.config)) {
          throw new Error("DeepSeek Harness bundle source or installed path does not match Marketplace ownership.");
        }
      }
      async migrateHarnessBundle(pkg, predecessor) {
        this.assertHarnessDelivery(pkg, "global");
        if (!this.harnessProfileManager || !predecessor.harnessBundle || !isCanonicalInstalledPath2(predecessor, this.config)) {
          throw new Error("DeepSeek Harness bundle migration requires a valid owned profile installation.");
        }
        await this.assertHarnessBundleUnmodified(predecessor);
        const files = (0, packageFiles_1.filterPackageFilesForPlatform)(await this.fetchFiles(pkg), "deepseek-harness").filter((file) => !(0, manifestSchema_1.isRootManifestFile)(file.relativePath));
        const bundle = (0, harnessBundle_1.validateHarnessBundle)(pkg, files);
        const offloaded = isOffloaded2(predecessor);
        const targetPath = offloaded ? (0, pathPlanning_1.offloadRelativePath)("deepseek-harness", pkg.manifest.type, pkg.manifest.id) : (0, pathPlanning_1.installRelativePath)("deepseek-harness", pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
        await this.assertMigrationDestinationAvailable(pkg, predecessor, targetPath);
        const profile = predecessor.harnessBundle.profile;
        const backupPath = `${predecessor.installedPath}.backup-${(0, node_crypto_1.randomUUID)()}`;
        await this.storage.move("global", predecessor.installedPath, backupPath);
        let removed = false;
        let added = false;
        try {
          if (!offloaded) {
            await this.harnessProfileManager.remove(profile, predecessor.harnessBundle.name, predecessor.installedPath);
            removed = true;
          }
          await this.replaceDirectory("global", targetPath, files);
          if (!offloaded) {
            await this.harnessProfileManager.add(profile, bundle.name, targetPath);
            added = true;
          }
          const migrated = {
            ...predecessor,
            id: pkg.manifest.id,
            type: pkg.manifest.type,
            version: pkg.manifest.version,
            sourceRepo: sourceRepository2(pkg),
            sourceBranch: pkg.source.branch,
            sourcePath: pkg.sourcePath,
            ...sourceMetadata2(pkg),
            installedPath: targetPath,
            harnessBundle: {
              profile,
              name: bundle.name,
              contentSha256: bundle.contentSha256,
              files: files.map((file) => ({ path: file.relativePath, sha256: sha2562(file.content) }))
            },
            migrationHistory: [...predecessor.migrationHistory ?? [], {
              migratedAt: (/* @__PURE__ */ new Date()).toISOString(),
              from: migrationSnapshot2(predecessor),
              to: migrationSnapshotForPackage2(pkg)
            }]
          };
          await this.stateStore("global").replace(predecessor, migrated);
          await this.storage.remove("global", backupPath).catch(() => void 0);
          return migrated;
        } catch (error) {
          if (added)
            await this.harnessProfileManager.remove(profile, bundle.name, targetPath).catch(() => void 0);
          await this.storage.remove("global", targetPath).catch(() => void 0);
          await this.storage.move("global", backupPath, predecessor.installedPath).catch(() => void 0);
          if (removed)
            await this.harnessProfileManager.add(profile, predecessor.harnessBundle.name, predecessor.installedPath).catch(() => void 0);
          throw error;
        }
      }
      async installHarnessBundle(pkg, previous, revert = false) {
        this.assertHarnessDelivery(pkg, "global");
        const manager = this.harnessProfileManager;
        if (!manager)
          throw new Error("This host cannot manage DeepSeek Harness profiles.");
        if (previous)
          await this.assertHarnessBundleUnmodified(previous);
        const files = (0, packageFiles_1.filterPackageFilesForPlatform)(await this.fetchFiles(pkg), "deepseek-harness").filter((file) => !(0, manifestSchema_1.isRootManifestFile)(file.relativePath));
        const bundle = (0, harnessBundle_1.validateHarnessBundle)(pkg, files);
        const profile = previous?.harnessBundle?.profile ?? this.config.deepseekHarnessProfile ?? "web";
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(profile))
          throw new Error("Invalid DeepSeek Harness profile name.");
        const activePath = (0, pathPlanning_1.installRelativePath)("deepseek-harness", pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
        const targetPath = previous?.installedPath.startsWith(".offload/") ? (0, pathPlanning_1.offloadRelativePath)("deepseek-harness", pkg.manifest.type, pkg.manifest.id) : activePath;
        await this.assertNoInstallCollision(pkg, "deepseek-harness", "global", targetPath);
        const allInstalled = await this.listInstalled();
        if (allInstalled.some((item) => !(previous && item.id === previous.id && item.sourceId === previous.sourceId && item.platform === previous.platform && item.scope === previous.scope) && item.harnessBundle?.profile === profile && item.harnessBundle.name === bundle.name)) {
          throw new Error(`DeepSeek Harness bundle '${bundle.name}' is already owned by another Marketplace package.`);
        }
        if (!previous && await this.storage.exists("global", targetPath)) {
          throw new Error(`DeepSeek Harness bundle path '${targetPath}' exists without Marketplace ownership.`);
        }
        const backupPath = `${targetPath}.backup-${(0, node_crypto_1.randomUUID)()}`;
        const hadPrevious = previous !== void 0 && await this.storage.exists("global", targetPath);
        if (hadPrevious)
          await this.storage.move("global", targetPath, backupPath);
        let added = false;
        try {
          await this.replaceDirectory("global", targetPath, files);
          if (!targetPath.startsWith(".offload/")) {
            if (previous?.harnessBundle && previous.harnessBundle.name !== bundle.name) {
              await manager.remove(profile, previous.harnessBundle.name, targetPath);
            }
            await manager.add(profile, bundle.name, targetPath);
            added = true;
          }
          const installed = {
            id: pkg.manifest.id,
            type: pkg.manifest.type,
            platform: "deepseek-harness",
            scope: "global",
            version: pkg.manifest.version,
            sourceRepo: sourceRepository2(pkg),
            sourceBranch: pkg.source.branch,
            sourcePath: pkg.sourcePath,
            ...sourceMetadata2(pkg),
            installedPath: targetPath,
            installedAt: previous?.installedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
            harnessBundle: {
              profile,
              name: bundle.name,
              contentSha256: bundle.contentSha256,
              files: files.map((file) => ({ path: file.relativePath, sha256: sha2562(file.content) }))
            },
            ...previous?.hotloaded === void 0 ? {} : { hotloaded: previous.hotloaded },
            ...revert ? { autoUpdate: false, autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(), revertedAt: (/* @__PURE__ */ new Date()).toISOString(), revertedFromVersion: previous.version } : {}
          };
          await this.stateStore("global").upsert(installed);
          if (hadPrevious)
            await this.storage.remove("global", backupPath).catch(() => void 0);
          return installed;
        } catch (error) {
          if (added)
            await manager.remove(profile, bundle.name, targetPath).catch(() => void 0);
          await this.storage.remove("global", targetPath).catch(() => void 0);
          if (hadPrevious) {
            await this.storage.move("global", backupPath, targetPath).catch(() => void 0);
            if (previous?.harnessBundle && !previous.installedPath.startsWith(".offload/")) {
              await manager.add(profile, previous.harnessBundle.name, targetPath).catch(() => void 0);
            }
          }
          throw error;
        }
      }
      async assertHarnessBundleUnmodified(installed) {
        const bundle = installed.harnessBundle;
        if (!bundle || installed.platform !== "deepseek-harness" || installed.scope !== "global") {
          throw new Error("Invalid DeepSeek Harness bundle ownership metadata.");
        }
        if (!this.storage.listFiles)
          throw new Error("This host cannot verify DeepSeek Harness bundle ownership.");
        const actualPaths = (await this.storage.listFiles("global", installed.installedPath)).map((path2) => (0, pathPlanning_1.safeJoinRelative)(path2)).sort();
        const ownedPaths = bundle.files.map((file) => (0, pathPlanning_1.safeJoinRelative)(file.path)).sort();
        if (actualPaths.length !== ownedPaths.length || actualPaths.some((path2, index) => path2 !== ownedPaths[index])) {
          throw new Error(`DeepSeek Harness bundle '${bundle.name}' contains unowned or missing files.`);
        }
        for (const file of bundle.files) {
          const relativePath = (0, pathPlanning_1.safeJoinRelative)(installed.installedPath, file.path);
          const content = await this.storage.readFile("global", relativePath);
          if (!content || sha2562(content) !== file.sha256) {
            throw new Error(`DeepSeek Harness bundle '${bundle.name}' was modified after installation.`);
          }
        }
      }
      async uninstallHarnessBundle(installed) {
        await this.assertHarnessBundleUnmodified(installed);
        const bundle = installed.harnessBundle;
        const manager = this.harnessProfileManager;
        if (!installed.installedPath.startsWith(".offload/")) {
          if (!manager)
            throw new Error("This host cannot manage DeepSeek Harness profiles.");
          await manager.remove(bundle.profile, bundle.name, installed.installedPath);
        }
        try {
          await this.stateStore("global").remove(installed.id, installed.platform, installed.scope, installed.sourceId);
          await this.storage.remove("global", installed.installedPath);
        } catch (error) {
          await this.stateStore("global").upsert(installed).catch(() => void 0);
          if (!installed.installedPath.startsWith(".offload/") && manager) {
            await manager.add(bundle.profile, bundle.name, installed.installedPath).catch(() => void 0);
          }
          throw error;
        }
      }
      async offloadHarnessBundle(installed) {
        await this.assertHarnessBundleUnmodified(installed);
        if (!this.harnessProfileManager)
          throw new Error("This host cannot manage DeepSeek Harness profiles.");
        const bundle = installed.harnessBundle;
        const offloadPath = (0, pathPlanning_1.offloadRelativePath)("deepseek-harness", installed.type, installed.id);
        if (await this.storage.exists("global", offloadPath))
          throw new Error(`Offload path '${offloadPath}' already exists.`);
        await this.harnessProfileManager.remove(bundle.profile, bundle.name, installed.installedPath);
        try {
          await this.moveDirectory("global", installed.installedPath, offloadPath);
          const moved = { ...installed, installedPath: offloadPath, hotloaded: false, offloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString() };
          await this.stateStore("global").upsert(moved);
          return moved;
        } catch (error) {
          if (await this.storage.exists("global", offloadPath)) {
            await this.moveDirectory("global", offloadPath, installed.installedPath).catch(() => void 0);
          }
          await this.harnessProfileManager.add(bundle.profile, bundle.name, installed.installedPath).catch(() => void 0);
          throw error;
        }
      }
      async hotloadHarnessBundle(installed) {
        await this.assertHarnessBundleUnmodified(installed);
        if (!this.harnessProfileManager)
          throw new Error("This host cannot manage DeepSeek Harness profiles.");
        const bundle = installed.harnessBundle;
        const activePath = (0, pathPlanning_1.installRelativePath)("deepseek-harness", installed.type, installed.id, this.config.platformPathOverrides);
        if (await this.storage.exists("global", activePath))
          throw new Error(`Active path '${activePath}' already exists.`);
        await this.moveDirectory("global", installed.installedPath, activePath);
        let added = false;
        try {
          await this.harnessProfileManager.add(bundle.profile, bundle.name, activePath);
          added = true;
          const moved = { ...installed, installedPath: activePath, hotloaded: true, hotloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString() };
          await this.stateStore("global").upsert(moved);
          return moved;
        } catch (error) {
          if (added)
            await this.harnessProfileManager.remove(bundle.profile, bundle.name, activePath).catch(() => void 0);
          await this.moveDirectory("global", activePath, installed.installedPath).catch(() => void 0);
          throw error;
        }
      }
      stateStore(scope) {
        return new installedState_1.InstalledStateStore(this.storage, scope);
      }
      async installMcp(pkg, platform, action, installedAt = (/* @__PURE__ */ new Date()).toISOString(), previous, persistState = true, transform = (installed) => installed) {
        await this.assertNoMcpCollision(pkg, platform, previous);
        const files = await this.fetchFiles(pkg);
        (0, mcpScripts_1.assertMcpPackageScripts)(pkg, files);
        const hostConfig = (0, mcpConfig_1.readMcpHostConfig)(pkg, platform, files);
        const installedPath = (0, mcpConfig_1.mcpConfigRelativePath)(platform);
        const existingContent = await this.readOptionalText("global", installedPath);
        const nextContent = platform === "codex" ? (0, mcpConfig_1.upsertCodexMcpServer)(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig2(previous)?.serverConfig) : (0, mcpConfig_1.upsertJsonMcpServer)(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig2(previous)?.serverConfig);
        const preparedPayload = await this.prepareMcpPayload(pkg, platform, files, action, previous?.managedPayloadPath);
        let configWritten = false;
        try {
          await this.writeText("global", installedPath, nextContent);
          configWritten = true;
          const installed = transform({
            id: pkg.manifest.id,
            type: "mcp",
            platform,
            scope: "global",
            version: pkg.manifest.version,
            sourceRepo: sourceRepository2(pkg),
            sourceBranch: pkg.source.branch,
            sourcePath: pkg.sourcePath,
            ...sourceMetadata2(pkg),
            managedConfig: { kind: "mcp", serverName: hostConfig.serverName, serverConfig: hostConfig.serverConfig },
            managedPayloadPath: preparedPayload.path,
            installedPath,
            installedAt
          });
          if (persistState)
            await this.stateStore("global").upsert(installed);
          await this.removeLegacyMcpInstallations(pkg.manifest.id, platform, installedPath).catch(() => void 0);
          await this.commitMcpPayload(preparedPayload);
          return installed;
        } catch (error) {
          await this.rollbackMcpPayload(preparedPayload).catch(() => void 0);
          if (configWritten) {
            if (existingContent === void 0)
              await this.storage.remove("global", installedPath).catch(() => void 0);
            else
              await this.writeText("global", installedPath, existingContent).catch(() => void 0);
          }
          throw error;
        }
      }
      async uninstallMcp(installed) {
        const configPath2 = (0, mcpConfig_1.mcpConfigRelativePath)(installed.platform);
        if (installed.scope !== "global" || installed.installedPath !== configPath2) {
          for (const path2 of (0, installPlanning_1.uninstallTargetPaths)(installed, this.config)) {
            await this.deleteRelativeDirectory(installed.scope, path2);
          }
          await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
          return;
        }
        if (installed.managedPayloadPath) {
          if (!installed.sourceId || installed.managedPayloadPath !== (0, pathPlanning_1.mcpPayloadRelativePath)(installed.platform, installed.sourceId, installed.id)) {
            throw new Error(`MCP package '${installed.id}' has an unexpected managed payload path and will not execute it.`);
          }
          await this.runMcpScript(installed.managedPayloadPath, mcpScripts_1.mcpUninstallScript, "uninstall", installed.platform);
        }
        const existingContent = await this.readOptionalText("global", configPath2);
        const nextContent = installed.platform === "codex" ? (0, mcpConfig_1.removeCodexMcpServer)(existingContent, installed.id) : (0, mcpConfig_1.removeJsonMcpServer)(existingContent, installed.id, managedMcpConfig2(installed)?.serverConfig);
        if (nextContent !== void 0 && nextContent !== existingContent) {
          await this.writeText("global", configPath2, nextContent);
        }
        await this.stateStore("global").remove(installed.id, installed.platform, "global", installed.sourceId);
        if (installed.managedPayloadPath)
          await this.storage.remove("global", installed.managedPayloadPath);
      }
      async prepareMcpPayload(pkg, platform, files, action, existingOwnerPath) {
        const path2 = (0, pathPlanning_1.mcpPayloadRelativePath)(platform, pkg.source.id, pkg.manifest.id);
        const backupPath = `${path2}.backup-${(0, node_crypto_1.randomUUID)()}`;
        const hadPrevious = await this.storage.exists("global", path2);
        if (hadPrevious && existingOwnerPath !== path2) {
          throw new Error(`Managed MCP payload path '${path2}' already exists without matching installed ownership.`);
        }
        if (hadPrevious)
          await this.storage.move("global", path2, backupPath);
        try {
          await this.replaceDirectory("global", path2, files);
          await this.runMcpScript(path2, mcpScripts_1.mcpInstallScript, action, platform);
          return { path: path2, ...hadPrevious ? { backupPath } : {} };
        } catch (error) {
          await this.storage.remove("global", path2).catch(() => void 0);
          if (hadPrevious && await this.storage.exists("global", backupPath)) {
            await this.storage.move("global", backupPath, path2).catch(() => void 0);
          }
          throw error;
        }
      }
      async commitMcpPayload(prepared) {
        if (prepared.backupPath)
          await this.storage.remove("global", prepared.backupPath).catch(() => void 0);
      }
      async rollbackMcpPayload(prepared) {
        await this.storage.remove("global", prepared.path);
        if (prepared.backupPath && await this.storage.exists("global", prepared.backupPath)) {
          await this.storage.move("global", prepared.backupPath, prepared.path);
        }
      }
      async runMcpScript(packagePath, script, action, platform) {
        if (!this.mcpScriptRunner)
          throw new Error("This host cannot execute MCP package lifecycle scripts.");
        await this.mcpScriptRunner.run({ scope: "global", packagePath, script, action, platform, timeoutMs: mcpScripts_1.mcpScriptTimeoutMs });
      }
      async removeLegacyMcpInstallations(id, platform, configPath2) {
        for (const scope of ["workspace", "global"]) {
          const stateStore = this.stateStore(scope);
          const legacy = (await stateStore.read()).packages.filter((item) => item.id === id && item.type === "mcp" && item.platform === platform && item.installedPath !== configPath2);
          for (const installed of legacy) {
            for (const path2 of (0, installPlanning_1.uninstallTargetPaths)(installed, this.config)) {
              await this.deleteRelativeDirectory(scope, path2);
            }
            await stateStore.removeInstalled(installed);
          }
        }
      }
      async installClaudeHook(pkg, scope, installedAt = (/* @__PURE__ */ new Date()).toISOString(), previous, persistState = true) {
        const files = await this.fetchFiles(pkg);
        const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
        if (!entrypoint) {
          throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
        }
        const contribution = (0, mcpConfig_1.readClaudeHookConfig)(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
        const installPath = (0, pathPlanning_1.installRelativePath)("claude", "hook", pkg.manifest.id, this.config.platformPathOverrides);
        await this.assertNoInstallCollision(pkg, "claude", scope, installPath);
        await this.replacePackage(scope, installPath, files, pkg, "claude");
        const settingsPath = ".claude/settings.json";
        const settings = await this.readOptionalText(scope, settingsPath);
        if (previous?.managedConfig?.kind === "hook") {
          const withoutPrevious = (0, mcpConfig_1.removeClaudeHookConfig)(settings, previous.managedConfig.hooks);
          await this.writeText(scope, settingsPath, (0, mcpConfig_1.upsertClaudeHookConfig)(withoutPrevious, contribution));
        } else {
          await this.writeText(scope, settingsPath, (0, mcpConfig_1.upsertClaudeHookConfig)(settings, contribution));
        }
        const installed = {
          id: pkg.manifest.id,
          type: "hook",
          platform: "claude",
          scope,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository2(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...sourceMetadata2(pkg),
          managedConfig: { kind: "hook", hooks: contribution },
          installedPath: installPath,
          installedAt
        };
        if (persistState) {
          await this.stateStore(scope).upsert(installed);
        }
        return installed;
      }
      async updateOffloadedClaudeHook(pkg, installed) {
        const files = await this.fetchFiles(pkg);
        const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
        if (!entrypoint) {
          throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
        }
        const contribution = (0, mcpConfig_1.readClaudeHookConfig)(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
        await this.replacePackage(installed.scope, installed.installedPath, files, pkg, "claude");
        return {
          ...installed,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository2(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...sourceMetadata2(pkg),
          managedConfig: { kind: "hook", hooks: contribution }
        };
      }
      async uninstallClaudeHook(installed) {
        await this.removeClaudeHookContribution(installed);
        for (const target of (0, installPlanning_1.uninstallTargetPaths)(installed, this.config)) {
          await this.deleteRelativeDirectory(installed.scope, target);
        }
        await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
      }
      async removeClaudeHookContribution(installed) {
        if (installed.managedConfig?.kind !== "hook") {
          throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and will not be removed.`);
        }
        const settingsPath = ".claude/settings.json";
        const existing = await this.readOptionalText(installed.scope, settingsPath);
        const next = (0, mcpConfig_1.removeClaudeHookConfig)(existing, installed.managedConfig.hooks);
        if (next !== void 0 && next !== existing) {
          await this.writeText(installed.scope, settingsPath, next);
        }
      }
      async restoreClaudeHookContribution(installed) {
        if (installed.managedConfig?.kind !== "hook") {
          throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and cannot be hotloaded.`);
        }
        const settingsPath = ".claude/settings.json";
        const existing = await this.readOptionalText(installed.scope, settingsPath);
        await this.writeText(installed.scope, settingsPath, (0, mcpConfig_1.upsertClaudeHookConfig)(existing, installed.managedConfig.hooks));
      }
      async replacePackage(scope, installPath, files, pkg, platform) {
        const payloadFiles = files.filter((file) => !(0, manifestSchema_1.isRootManifestFile)(file.relativePath));
        const codexAgent = codexAgentContribution2(pkg, platform, files, this.config);
        if (codexAgent) {
          const entrypoint2 = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint);
          await this.replaceDirectory(scope, installPath, payloadFiles);
          const activePath = (0, pathPlanning_1.installRelativePath)(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
          if (installPath === activePath)
            await this.storage.writeFileAtomic(scope, codexAgent.configPath, entrypoint2.content);
          return;
        }
        if (platform !== "claude" || !isClaudeFlatFilePackage2(pkg)) {
          await this.replaceDirectory(scope, installPath, payloadFiles);
          return;
        }
        const entrypoint = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint);
        if (!entrypoint) {
          throw new Error(`Claude package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
        }
        if (payloadFiles.some((file) => file !== entrypoint)) {
          throw new Error(`Claude ${pkg.manifest.type} package '${pkg.manifest.id}' must contain only its Markdown entrypoint.`);
        }
        await this.deleteRelativeDirectory(scope, installPath);
        await this.storage.writeFile(scope, installPath, entrypoint.content);
      }
      async assertCodexAgentConfigAvailable(pkg, scope, installPath, contribution, knownOwner) {
        if (contribution?.kind !== "codex-agent" || !await this.storage.exists(scope, contribution.configPath))
          return;
        const owner = knownOwner ?? (await this.listInstalled()).find((item) => item.type === "agent" && item.platform === "codex" && item.scope === scope && item.installedPath === installPath && item.sourceId === pkg.source.id && (item.qualifiedName ?? item.id) === pkg.manifest.qualifiedName);
        if (owner?.managedConfig?.kind !== "codex-agent") {
          throw new Error(`Codex agent config '${contribution.configPath}' already exists without matching installed ownership.`);
        }
        await this.assertManagedCodexAgentConfigUnmodified(owner);
      }
      async assertManagedCodexAgentConfigUnmodified(installed) {
        const managed = installed.managedConfig;
        if (managed?.kind !== "codex-agent")
          return;
        const expectedPath = (0, pathPlanning_1.codexAgentConfigRelativePath)(installed.id, this.config.platformPathOverrides);
        if (installed.platform !== "codex" || installed.type !== "agent" || managed.configPath !== expectedPath || !/^[0-9a-f]{64}$/.test(managed.contentSha256)) {
          throw new Error(`Codex agent '${installed.id}' has invalid managed config ownership metadata.`);
        }
        const content = await this.storage.readFile(installed.scope, managed.configPath);
        if (content === void 0)
          return;
        if (sha2562(content) !== managed.contentSha256) {
          throw new Error(`Codex agent config '${managed.configPath}' was modified after installation; refusing to overwrite or remove it.`);
        }
      }
      async materializeCodexAgentConfig(scope, activePath, packageId, managed) {
        const content = await this.storage.readFile(scope, (0, pathPlanning_1.safeJoinRelative)(activePath, `${packageId}.toml`));
        if (content === void 0 || sha2562(content) !== managed.contentSha256) {
          throw new Error(`Codex agent '${packageId}' managed payload does not match its recorded TOML config.`);
        }
        await this.storage.writeFileAtomic(scope, managed.configPath, content);
      }
      async assertNoInstallCollision(pkg, platform, scope, installPath) {
        const collision = (await this.listInstalled()).find((item) => item.platform === platform && item.scope === scope && item.installedPath === installPath && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName));
        if (collision) {
          throw new Error(`Install path '${installPath}' is already managed by '${collision.qualifiedName ?? collision.id}' from another source.`);
        }
      }
      async assertMigrationDestinationAvailable(pkg, predecessor, destination) {
        const state = await this.stateStore(predecessor.scope).read();
        const collision = state.packages.find((item) => item.platform === predecessor.platform && item.scope === predecessor.scope && item.sourceId === pkg.source.id && item.qualifiedName === pkg.manifest.qualifiedName);
        if (collision)
          throw new Error(`Destination package '${pkg.manifest.qualifiedName}' is already installed.`);
        const pathOwner = state.packages.find((item) => item.platform === predecessor.platform && item.installedPath === destination && !(item.id === predecessor.id && item.sourceId === predecessor.sourceId && item.qualifiedName === predecessor.qualifiedName && item.sourceRepo === predecessor.sourceRepo && item.sourceBranch === predecessor.sourceBranch && item.sourcePath === predecessor.sourcePath));
        if (pathOwner)
          throw new Error(`Managed destination '${destination}' is already owned by '${pathOwner.sourceId ?? "legacy"}:${pathOwner.qualifiedName ?? pathOwner.id}'.`);
        if (destination !== predecessor.installedPath && !pathOwner && await this.storage.exists(predecessor.scope, destination)) {
          throw new Error(`Managed destination '${destination}' already exists without marketplace ownership.`);
        }
      }
      migratedRecord(pkg, predecessor, installedPath, migratedAt, files) {
        const { revertedAt: _revertedAt, revertedFromVersion: _revertedFromVersion, managedConfig: _managedConfig, managedPayloadPath: _managedPayloadPath, sourceRevision: _sourceRevision, ...preserved } = predecessor;
        const managedConfig = pkg.manifest.type === "mcp" ? (() => {
          const config = (0, mcpConfig_1.readMcpHostConfig)(pkg, predecessor.platform, files);
          return { kind: "mcp", serverName: config.serverName, serverConfig: config.serverConfig };
        })() : pkg.manifest.type === "hook" && predecessor.platform === "claude" ? (() => {
          const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
          if (!entrypoint)
            throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
          return { kind: "hook", hooks: (0, mcpConfig_1.readClaudeHookConfig)(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint) };
        })() : void 0;
        return {
          ...preserved,
          id: pkg.manifest.id,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository2(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...pkg.sourceRevision ? { sourceRevision: pkg.sourceRevision } : {},
          ...sourceMetadata2(pkg),
          installedPath,
          ...pkg.manifest.type === "mcp" ? { managedPayloadPath: (0, pathPlanning_1.mcpPayloadRelativePath)(predecessor.platform, pkg.source.id, pkg.manifest.id) } : {},
          ...managedConfig === void 0 ? {} : { managedConfig },
          migrationHistory: [...predecessor.migrationHistory ?? [], { migratedAt, from: migrationSnapshot2(predecessor), to: migrationSnapshotForPackage2(pkg) }]
        };
      }
      migratedMcpConfig(pkg, predecessor, files, existing) {
        const previous = managedMcpConfig2(predecessor);
        if (!previous)
          throw new Error(`MCP package '${predecessor.id}' has no tracked configuration contribution and cannot be migrated safely.`);
        const next = (0, mcpConfig_1.readMcpHostConfig)(pkg, predecessor.platform, files);
        const removed = predecessor.platform === "codex" ? (0, mcpConfig_1.removeCodexMcpServer)(existing, previous.serverName, previous.serverConfig) : (0, mcpConfig_1.removeJsonMcpServer)(existing, previous.serverName, previous.serverConfig);
        return predecessor.platform === "codex" ? (0, mcpConfig_1.upsertCodexMcpServer)(removed, next.serverName, next.serverConfig) : (0, mcpConfig_1.upsertJsonMcpServer)(removed, next.serverName, next.serverConfig);
      }
      migratedClaudeHookConfig(pkg, predecessor, files, existing) {
        const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
        if (!entrypoint)
          throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
        const previous = predecessor.managedConfig?.kind === "hook" ? predecessor.managedConfig : void 0;
        if (!previous)
          throw new Error(`Claude hook '${predecessor.id}' has no tracked settings contribution and cannot be migrated safely.`);
        const removed = (0, mcpConfig_1.removeClaudeHookConfig)(existing, previous.hooks);
        return (0, mcpConfig_1.upsertClaudeHookConfig)(removed, (0, mcpConfig_1.readClaudeHookConfig)(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint));
      }
      async rollbackMigration(journal) {
        const scope = journal.previous.scope;
        const state = await this.stateStore(scope).read();
        const committed = state.packages.some((item) => item.id === journal.next.id && item.platform === journal.next.platform && item.scope === journal.next.scope && item.sourceId === journal.next.sourceId);
        if (committed) {
          await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
          await this.storage.remove(scope, migrationJournalPath2());
          return;
        }
        if (journal.targetPath !== journal.previous.installedPath)
          await this.storage.remove(scope, journal.targetPath);
        if (journal.payloadBackup && await this.storage.exists(scope, journal.payloadBackup)) {
          await this.storage.remove(scope, journal.previous.installedPath);
          await this.storage.move(scope, journal.payloadBackup, journal.previous.installedPath);
        }
        if (journal.configPath && journal.configBackup && await this.storage.exists(scope, journal.configBackup)) {
          await this.storage.remove(scope, journal.configPath);
          await this.storage.move(scope, journal.configBackup, journal.configPath);
        }
        await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
        await this.storage.remove(scope, migrationJournalPath2());
      }
      async recoverMigration(scope) {
        const content = await this.readOptionalText(scope, migrationJournalPath2());
        if (!content)
          return;
        const parsed = this.validateMigrationJournal(JSON.parse(content), scope);
        await this.rollbackMigration(parsed);
      }
      validateMigrationJournal(value, scope) {
        if (!isRecord7(value) || typeof value.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.operationId) || !isRecord7(value.previous) || !isRecord7(value.next) || typeof value.targetPath !== "string") {
          throw new Error("Migration recovery journal is malformed.");
        }
        const previous = value.previous;
        const next = value.next;
        if (!isMigrationJournalPrevious2(previous) || !isMigrationJournalNext2(next) || previous.scope !== scope || next.scope !== scope || previous.platform !== next.platform) {
          throw new Error("Migration recovery journal has incompatible identities or scope.");
        }
        if (!isCanonicalInstalledPath2(previous, this.config))
          throw new Error("Migration recovery journal contains an unexpected predecessor path.");
        const expectedTarget = previous.type === "mcp" ? previous.installedPath : previous.scope === "cloud" ? (0, pathPlanning_1.cloudInstallPath)(previous.platform, previous.type, next.id) : previous.installedPath.startsWith(".offload/") ? (0, pathPlanning_1.offloadRelativePath)(previous.platform, previous.type, next.id) : (0, pathPlanning_1.installRelativePath)(previous.platform, previous.type, next.id, this.config.platformPathOverrides);
        const backupRoot = `.ai_marketplace/migrations/${value.operationId}`;
        const expectedPayloadBackup = previous.scope === "cloud" || previous.type === "mcp" ? void 0 : `${backupRoot}/payload`;
        const expectedConfigPath = migrationConfigPath2(previous);
        const expectedConfigBackup = expectedConfigPath ? `${backupRoot}/config` : void 0;
        if (value.targetPath !== expectedTarget || value.payloadBackup !== expectedPayloadBackup || value.configPath !== expectedConfigPath || value.configBackup !== expectedConfigBackup) {
          throw new Error("Migration recovery journal contains unexpected managed paths.");
        }
        return value;
      }
      assertCompatibleRollback(pkg, installed) {
        if (sourceRepository2(pkg) !== installed.sourceRepo || pkg.source.branch !== installed.sourceBranch || installed.sourceId !== void 0 && pkg.source.id !== installed.sourceId || pkg.sourcePath !== installed.sourcePath || pkg.manifest.id !== installed.id || pkg.manifest.qualifiedName !== (installed.qualifiedName ?? installed.id) || pkg.manifest.type !== installed.type || !pkg.manifest.platforms.includes(installed.platform) || !pkg.manifest.delivery.includes(installed.scope) || !isCanonicalInstalledPath2(installed, this.config)) {
          throw new Error("Rollback snapshot is not compatible with the installed package source, identity, platform, or scope.");
        }
      }
      async assertNoMcpCollision(pkg, platform, previous) {
        const collision = (await this.listInstalled()).find((item) => item.type === "mcp" && item.platform === platform && item.id === pkg.manifest.id && (item.sourceId !== void 0 || item.installedPath === (0, mcpConfig_1.mcpConfigRelativePath)(platform)) && !sameInstalledRecord3(item, previous) && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName));
        if (collision) {
          throw new Error(`MCP server '${pkg.manifest.id}' is already managed by another package source.`);
        }
      }
      async replaceDirectory(scope, relativeDirectory, files) {
        await this.storage.replaceDirectory(scope, relativeDirectory, files.map((file) => ({
          relativePath: (0, pathPlanning_1.safeJoinRelative)(file.relativePath),
          content: file.content
        })));
      }
      async moveDirectory(scope, fromRelativePath, toRelativePath) {
        await this.storage.move(scope, fromRelativePath, toRelativePath);
      }
      async deleteRelativeDirectory(scope, relativeDirectory) {
        await this.storage.remove(scope, relativeDirectory);
      }
      async readOptionalText(scope, relativePath) {
        const bytes = await this.storage.readFile(scope, relativePath);
        return bytes === void 0 ? void 0 : Buffer.from(bytes).toString("utf8");
      }
      async writeText(scope, relativePath, content) {
        await this.storage.writeFileAtomic(scope, relativePath, Buffer.from(content, "utf8"));
      }
    };
    exports.PackageInstaller = PackageInstaller2;
    function sameInstalledRecord3(left, right) {
      return right !== void 0 && left.id === right.id && left.platform === right.platform && left.scope === right.scope && left.installedAt === right.installedAt && left.installedPath === right.installedPath;
    }
    function isClaudeFlatFilePackage2(pkg) {
      return pkg.manifest.type === "command" || pkg.manifest.type === "agent" || pkg.manifest.type === "rule";
    }
    function codexAgentContribution2(pkg, platform, files, config) {
      if (platform !== "codex" || pkg.manifest.type !== "agent")
        return void 0;
      const expectedEntrypoint = `${pkg.manifest.id}.toml`;
      if (pkg.manifest.entrypoint !== expectedEntrypoint) {
        throw new Error(`Codex agent '${pkg.manifest.id}' entrypoint must be '${expectedEntrypoint}'.`);
      }
      const entrypoint = files.find((file) => file.relativePath === expectedEntrypoint);
      if (!entrypoint)
        throw new Error(`Codex agent '${pkg.manifest.id}' is missing entrypoint '${expectedEntrypoint}'.`);
      return {
        kind: "codex-agent",
        configPath: (0, pathPlanning_1.codexAgentConfigRelativePath)(pkg.manifest.id, config.platformPathOverrides),
        contentSha256: sha2562(entrypoint.content)
      };
    }
    function sha2562(content) {
      return (0, node_crypto_1.createHash)("sha256").update(content).digest("hex");
    }
    function isOffloaded2(installed) {
      return installed.installedPath === (0, pathPlanning_1.offloadRelativePath)(installed.platform, installed.type, installed.id);
    }
    function isCanonicalInstalledPath2(installed, config) {
      if (installed.harnessBundle) {
        return installed.platform === "deepseek-harness" && installed.scope === "global" && (installed.installedPath === (0, pathPlanning_1.installRelativePath)(installed.platform, installed.type, installed.id, config.platformPathOverrides) || isOffloaded2(installed));
      }
      if (installed.type === "mcp") {
        return installed.scope === "global" && installed.installedPath === (0, mcpConfig_1.mcpConfigRelativePath)(installed.platform) && (installed.managedPayloadPath === void 0 || installed.sourceId !== void 0 && installed.managedPayloadPath === (0, pathPlanning_1.mcpPayloadRelativePath)(installed.platform, installed.sourceId, installed.id));
      }
      if (installed.scope === "cloud") {
        return installed.installedPath === (0, pathPlanning_1.cloudInstallPath)(installed.platform, installed.type, installed.id);
      }
      if (installed.scope !== "workspace" && installed.scope !== "global") {
        return false;
      }
      return installed.installedPath === (0, pathPlanning_1.installRelativePath)(installed.platform, installed.type, installed.id, config.platformPathOverrides) || isOffloaded2(installed);
    }
    function managedMcpConfig2(installed) {
      return installed?.managedConfig?.kind === "mcp" ? installed.managedConfig : void 0;
    }
    function sourceRepository2(pkg) {
      return (0, repositoryUrl_1.repositoryIdentity)(pkg.source);
    }
    function sourceMetadata2(pkg) {
      return {
        sourceId: pkg.source.id,
        qualifiedName: pkg.manifest.qualifiedName,
        group: pkg.manifest.group,
        sourceRevision: pkg.sourceRevision
      };
    }
    function migrationJournalPrevious2(installed) {
      return { id: installed.id, ...installed.qualifiedName === void 0 ? {} : { qualifiedName: installed.qualifiedName }, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, sourceRepo: installed.sourceRepo, sourceBranch: installed.sourceBranch, sourcePath: installed.sourcePath, type: installed.type, platform: installed.platform, scope: installed.scope, installedPath: installed.installedPath };
    }
    function migrationJournalNext2(installed) {
      return { id: installed.id, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, platform: installed.platform, scope: installed.scope };
    }
    function isMigrationJournalPrevious2(value) {
      return typeof value.id === "string" && typeof value.sourceRepo === "string" && typeof value.sourceBranch === "string" && typeof value.sourcePath === "string" && typeof value.type === "string" && typeof value.platform === "string" && typeof value.scope === "string" && typeof value.installedPath === "string" && (value.qualifiedName === void 0 || typeof value.qualifiedName === "string") && (value.sourceId === void 0 || typeof value.sourceId === "string");
    }
    function isMigrationJournalNext2(value) {
      return typeof value.id === "string" && typeof value.platform === "string" && typeof value.scope === "string" && (value.sourceId === void 0 || typeof value.sourceId === "string");
    }
    function isRecord7(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function migrationJournalPath2() {
      return ".ai_marketplace/migration-journal.json";
    }
    function migrationConfigPath2(installed) {
      if (installed.type === "mcp")
        return (0, mcpConfig_1.mcpConfigRelativePath)(installed.platform);
      return installed.type === "hook" && installed.platform === "claude" ? ".claude/settings.json" : void 0;
    }
    function migrationSnapshot2(installed) {
      return { id: installed.id, qualifiedName: installed.qualifiedName ?? installed.id, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, version: installed.version, repository: installed.sourceRepo, branch: installed.sourceBranch, path: installed.sourcePath };
    }
    function migrationSnapshotForPackage2(pkg) {
      return { id: pkg.manifest.id, qualifiedName: pkg.manifest.qualifiedName, sourceId: pkg.source.id, version: pkg.manifest.version, repository: sourceRepository2(pkg), branch: pkg.source.branch, path: pkg.sourcePath };
    }
  }
});

// packages/marketplace-core/out/services/marketplaceModel.js
var require_marketplaceModel = __commonJS({
  "packages/marketplace-core/out/services/marketplaceModel.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.packageIdentity = packageIdentity3;
    exports.installedIdentity = installedIdentity3;
    exports.toSerializableMarketplaceModel = toSerializableMarketplaceModel2;
    exports.installOptionsForPackage = installOptionsForPackage3;
    exports.eligibleInstallPlatforms = eligibleInstallPlatforms;
    exports.supportsPlatformScope = supportsPlatformScope2;
    exports.repositoryFilterKey = repositoryFilterKey2;
    exports.mcpInstallPlatformCandidates = mcpInstallPlatformCandidates2;
    exports.platformLabel = platformLabel2;
    var versioning_1 = require_versioning();
    var packages_1 = require_packages();
    var migrationPlanning_1 = require_migrationPlanning();
    function packageIdentity3(pkg) {
      return `${pkg.source.id}:${pkg.manifest.qualifiedName}`;
    }
    function installedIdentity3(installed) {
      return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
    }
    function toSerializableMarketplaceModel2(model) {
      const packagesByIdentity = new Map(model.packages.map((pkg) => [packageIdentity3(pkg), pkg]));
      const migrations = (0, migrationPlanning_1.planPackageMigrations)(model.packages, model.installed).eligible;
      const installed = model.installed.map((item) => {
        const pkg = packagesByIdentity.get(installedIdentity3(item));
        const latestVersion = pkg?.manifest.version;
        const installOptions = pkg ? installOptionsForPackage3(pkg, model.installed.filter((candidate) => installedIdentity3(candidate) === packageIdentity3(pkg)), model.defaultPlatform) : [];
        const updateAvailable = latestVersion ? (0, versioning_1.isUpdateAvailable)(item.version, latestVersion) || isRollbackPinned2(item) : false;
        const migration = migrations.find((candidate) => sameInstallation2(candidate.predecessor, item));
        const card = installedCardActions2(item, pkg, installOptions, updateAvailable, migration);
        return {
          ...item,
          sourceLabel: pkg?.source.label ?? item.sourceRepo,
          repositoryKey: repositoryFilterKey2(item),
          group: pkg?.manifest.group ?? item.group ?? "unknown",
          qualifiedName: pkg?.manifest.qualifiedName ?? item.qualifiedName ?? item.id,
          latestVersion,
          updateAvailable,
          name: pkg?.manifest.name ?? item.id,
          description: pkg?.manifest.description ?? item.installedPath,
          tags: pkg?.manifest.tags ?? [item.type, item.platform],
          evaluationScore: pkg?.manifest.evaluationScore,
          installOptions,
          ...card,
          ...migration === void 0 ? {} : { migration: serializeMigration2(migration) }
        };
      });
      const packages = model.packages.map((pkg) => {
        const matchingInstalled = model.installed.filter((item) => installedIdentity3(item) === packageIdentity3(pkg));
        const packageMigrations = migrations.filter((candidate) => packageIdentity3(candidate.destination) === packageIdentity3(pkg));
        const migration = packageMigrations[0];
        const installOptions = installOptionsForPackage3(pkg, matchingInstalled, model.defaultPlatform);
        const primaryAction = migration ? { action: "migrate", label: "Migrate", tone: "primary", platform: migration.predecessor.platform, scope: migration.predecessor.scope } : installOptions[0] ? cardAction2(installOptions[0], "primary") : void 0;
        return {
          id: pkg.manifest.id,
          qualifiedName: pkg.manifest.qualifiedName,
          sourceId: pkg.source.id,
          sourceLabel: pkg.source.label,
          repositoryKey: repositoryFilterKey2({ sourceId: pkg.source.id, sourceLabel: pkg.source.label, sourceRepo: pkg.source.repository }),
          group: pkg.manifest.group,
          name: pkg.manifest.name,
          type: pkg.manifest.type,
          version: pkg.manifest.version,
          description: pkg.manifest.description,
          platforms: pkg.manifest.platforms,
          tags: pkg.manifest.tags,
          evaluationScore: pkg.manifest.evaluationScore,
          hotload: pkg.hotload,
          updateAvailable: matchingInstalled.some((item) => (0, versioning_1.isUpdateAvailable)(item.version, pkg.manifest.version) || isRollbackPinned2(item)),
          installOptions,
          status: { kind: "available", label: "Available" },
          ...primaryAction === void 0 ? {} : { primaryAction },
          moreActions: (migration ? installOptions : installOptions.slice(1)).map((option) => cardAction2(option, "secondary")),
          ...migration === void 0 ? {} : { migration: packageMigrations.length === 1 ? serializeMigration2(migration) : { destinationSourceId: pkg.source.id, destinationQualifiedName: pkg.manifest.qualifiedName } }
        };
      }).filter((pkg) => pkg.installOptions.length > 0).sort((left, right) => Number(right.updateAvailable) - Number(left.updateAvailable) || left.name.localeCompare(right.name));
      return {
        configured: model.configured,
        autoUpdateEnabled: model.autoUpdateEnabled,
        defaultPlatform: model.defaultPlatform,
        autoInstallGroups: model.autoInstallGroups ?? [],
        knownGroups: model.knownGroups ?? [],
        extensionVersion: model.extensionVersion ?? "0.0.0",
        packages,
        installed
      };
    }
    function isRollbackPinned2(installed) {
      return installed.autoUpdate === false && installed.revertedAt !== void 0;
    }
    function cardAction2(option, tone) {
      return { ...option, tone };
    }
    function installedCardActions2(installed, pkg, installOptions, updateAvailable, migration) {
      const pinned = isRollbackPinned2(installed);
      const isMcp = installed.type === "mcp" && !installed.harnessBundle;
      const isCloud = installed.scope === "cloud";
      const offloaded = !isCloud && !isMcp && installed.installedPath.startsWith(".offload/");
      const status = migration ? { kind: "migration", label: "Migration available" } : pinned ? { kind: "reverted", label: "Reverted, pinned" } : isMcp ? { kind: "mcp", label: "Installed and configured" } : isCloud ? { kind: "cloud", label: "Cloud" } : offloaded ? { kind: "offloaded", label: "Offloaded" } : updateAvailable ? { kind: "outdated", label: "Update available" } : { kind: "installed", label: "Installed" };
      const more = installOptions.map((option) => cardAction2(option, "secondary"));
      if (migration && updateAvailable)
        more.unshift({ action: "migrate", label: "Migrate", tone: "secondary", platform: installed.platform, scope: installed.scope });
      if (pkg?.manifest.previousVersion && !pinned)
        more.push(!updateAvailable ? { action: "revert", label: "Revert to previous version", tone: "secondary", platform: installed.platform, scope: installed.scope } : { action: "revert", label: "Revert to previous version (update first)", tone: "secondary", platform: installed.platform, scope: installed.scope, disabled: true });
      if (updateAvailable && !isCloud && !isMcp)
        more.push({ action: offloaded ? "hotload" : "offload", label: offloaded ? "Hotload" : "Offload", tone: "secondary", platform: installed.platform, scope: installed.scope });
      more.push({ action: "uninstall", label: "Uninstall", tone: "danger", platform: installed.platform, scope: installed.scope });
      const primaryAction = migration && !updateAvailable ? { action: "migrate", label: "Migrate", tone: "primary", platform: installed.platform, scope: installed.scope } : updateAvailable ? { action: "update", label: pinned ? "Update to latest" : "Update", tone: "primary", platform: installed.platform, scope: installed.scope } : !isCloud && !isMcp ? { action: offloaded ? "hotload" : "offload", label: offloaded ? "Hotload" : "Offload", tone: "primary", platform: installed.platform, scope: installed.scope } : void 0;
      return { status, ...primaryAction === void 0 ? {} : { primaryAction }, moreActions: more };
    }
    function serializeMigration2(candidate) {
      return {
        destinationSourceId: candidate.destination.source.id,
        destinationQualifiedName: candidate.destination.manifest.qualifiedName,
        predecessorId: candidate.predecessor.id,
        ...candidate.predecessor.sourceId === void 0 ? {} : { predecessorSourceId: candidate.predecessor.sourceId },
        ...candidate.predecessor.qualifiedName === void 0 ? {} : { predecessorQualifiedName: candidate.predecessor.qualifiedName },
        platform: candidate.predecessor.platform,
        scope: candidate.predecessor.scope
      };
    }
    function sameInstallation2(left, right) {
      return left.id === right.id && left.sourceId === right.sourceId && left.platform === right.platform && left.scope === right.scope;
    }
    function installOptionsForPackage3(pkg, installed, defaultPlatform) {
      if (pkg.manifest.type === "mcp") {
        return installOptionsForMcpPackage2(pkg, installed, defaultPlatform);
      }
      const options = [];
      const orderedPlatforms2 = orderPlatforms2(pkg.manifest.platforms, defaultPlatform);
      const delivery = pkg.manifest.delivery;
      const workspacePlatform = delivery.includes("workspace") ? orderedPlatforms2.find((platform) => supportsPlatformScope2(pkg, platform, "workspace") && !isInstalled2(installed, platform, "workspace")) : void 0;
      if (workspacePlatform) {
        options.push(installed.some((item) => item.scope === "workspace") ? {
          action: "installDifferentPlatform",
          scope: "workspace",
          platform: workspacePlatform,
          label: "Install in workspace for different platform"
        } : {
          action: "install",
          scope: "workspace",
          platform: workspacePlatform,
          label: workspacePlatform === defaultPlatform ? "Install" : `Install for ${platformLabel2(workspacePlatform)}`
        });
      }
      const globalPlatform = delivery.includes("global") ? orderedPlatforms2.find((platform) => supportsPlatformScope2(pkg, platform, "global") && !isInstalled2(installed, platform, "global")) : void 0;
      if (globalPlatform) {
        options.push(installed.some((item) => item.scope === "global") ? {
          action: "installDifferentPlatform",
          scope: "global",
          platform: globalPlatform,
          label: "Install in user directory for different platform"
        } : {
          action: "installGlobal",
          scope: "global",
          platform: globalPlatform,
          label: "Install in user directory"
        });
      }
      const cloudPlatform = delivery.includes("cloud") ? orderedPlatforms2.find((platform) => supportsPlatformScope2(pkg, platform, "cloud") && !isInstalled2(installed, platform, "cloud")) : void 0;
      if (cloudPlatform) {
        options.push({
          action: "installCloud",
          scope: "cloud",
          platform: cloudPlatform,
          label: `Install to ${platformLabel2(cloudPlatform)} cloud`
        });
      }
      return dedupeOptions2(options);
    }
    function eligibleInstallPlatforms(pkg, installed, scope) {
      const identity = packageIdentity3(pkg);
      const matchingInstalled = installed.filter((item) => installedIdentity3(item) === identity);
      return packages_1.platforms.filter((platform) => pkg.manifest.platforms.includes(platform)).filter((platform) => supportsPlatformScope2(pkg, platform, scope)).filter((platform) => !matchingInstalled.some((item) => item.platform === platform && item.scope === scope));
    }
    function supportsPlatformScope2(pkg, platform, scope) {
      if (!pkg.manifest.platforms.includes(platform) || !pkg.manifest.delivery.includes(scope))
        return false;
      if (platform !== "deepseek-harness")
        return true;
      return scope === "global" || scope === "workspace" && (pkg.manifest.type === "skill" || pkg.manifest.type === "rule");
    }
    function repositoryFilterKey2(item) {
      return item.sourceId ? `source:${item.sourceId}` : `legacy:${item.sourceRepo ?? item.sourceLabel ?? "unknown"}`;
    }
    function installOptionsForMcpPackage2(pkg, installed, defaultPlatform) {
      const platform = mcpInstallPlatformCandidates2(pkg, installed, defaultPlatform)[0];
      return platform ? [{ action: "installGlobal", scope: "global", platform, label: `Configure for ${platformLabel2(platform)} in user directory` }] : [];
    }
    function mcpInstallPlatformCandidates2(pkg, installed, defaultPlatform) {
      return orderPlatforms2(pkg.manifest.platforms, defaultPlatform).filter((platform) => !isInstalled2(installed, platform, "global"));
    }
    function isInstalled2(installed, platform, scope) {
      return installed.some((item) => item.platform === platform && item.scope === scope);
    }
    function orderPlatforms2(available, defaultPlatform) {
      return [...available].sort((left, right) => {
        if (left === defaultPlatform)
          return -1;
        if (right === defaultPlatform)
          return 1;
        return packages_1.platforms.indexOf(left) - packages_1.platforms.indexOf(right);
      });
    }
    function dedupeOptions2(options) {
      const seen = /* @__PURE__ */ new Set();
      return options.filter((option) => {
        const key = `${option.action}:${option.scope}:${option.platform}`;
        if (seen.has(key))
          return false;
        seen.add(key);
        return true;
      });
    }
    function platformLabel2(platform) {
      switch (platform) {
        case "codex":
          return "Codex";
        case "cursor":
          return "Cursor";
        case "github-copilot":
          return "GitHub Copilot";
        case "claude":
          return "Claude";
        case "deepseek-harness":
          return "DeepSeek Harness";
      }
    }
  }
});

// packages/marketplace-core/out/services/autoDiscovery.js
var require_autoDiscovery = __commonJS({
  "packages/marketplace-core/out/services/autoDiscovery.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.discoverInstalledPackages = discoverInstalledPackages2;
    var packages_1 = require_packages();
    var pathPlanning_1 = require_pathPlanning();
    var validation_1 = require_validation();
    var marketplaceYaml_1 = require_marketplaceYaml();
    var manifestSchema_1 = require_manifestSchema();
    var manifestDiagnostics_1 = require_manifestDiagnostics();
    var repositoryUrl_1 = require_repositoryUrl();
    async function discoverInstalledPackages2(options) {
      if (options.scope === "cloud") {
        return [];
      }
      const discovered = [];
      const seen = new Set(options.existing.map(installIdentity2));
      const diagnostics = new manifestDiagnostics_1.ManifestDiagnosticCollector();
      for (const platform of packages_1.platforms) {
        for (const packageType of packages_1.packageTypes) {
          if (packageType === "mcp") {
            continue;
          }
          await discoverRoot2(options, discovered, seen, diagnostics, platform, packageType, (0, pathPlanning_1.installRootRelativePath)(platform, packageType, options.config.platformPathOverrides), true);
          await discoverRoot2(options, discovered, seen, diagnostics, platform, packageType, (0, pathPlanning_1.offloadRootRelativePath)(platform, packageType), false);
        }
      }
      const summary = diagnostics.summary("local auto-discovery");
      if (summary)
        options.log(summary);
      return discovered;
    }
    async function discoverRoot2(options, discovered, seen, diagnostics, platform, packageType, rootRelativePath, hotloaded) {
      let entries;
      try {
        entries = await options.fileSystem.readDirectory(rootRelativePath) ?? [];
      } catch (error) {
        options.log(`Auto-discovery skipped ${rootRelativePath}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory || entry.isSymbolicLink) {
          continue;
        }
        const packageRoot = (0, pathPlanning_1.safeJoinRelative)(rootRelativePath, entry.name);
        await discoverPackage2(options, discovered, seen, diagnostics, platform, packageType, packageRoot, entry.name, hotloaded);
      }
    }
    async function discoverPackage2(options, discovered, seen, diagnostics, platform, packageType, packageRoot, directoryName, hotloaded) {
      const manifestPath = (0, pathPlanning_1.safeJoinRelative)(packageRoot, manifestSchema_1.canonicalManifestFileName);
      try {
        const text = await options.fileSystem.readText(manifestPath);
        const validated = (0, validation_1.validateMarketplaceManifest)((0, marketplaceYaml_1.parseMarketplaceYaml)(text, manifestPath), manifestPath);
        diagnostics.record(validated.diagnostics);
        const manifest = validated.manifest;
        if (manifest.id !== directoryName) {
          options.log(`Auto-discovery skipped ${manifestPath}: manifest id does not match containing folder.`);
          return;
        }
        if (manifest.type !== packageType) {
          options.log(`Auto-discovery skipped ${manifestPath}: manifest type does not match containing folder.`);
          return;
        }
        if (!manifest.platforms.includes(platform)) {
          options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${platform}.`);
          return;
        }
        if (!manifest.delivery.includes(options.scope)) {
          options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${options.scope} delivery.`);
          return;
        }
        const catalogMatches = options.catalog.filter((pkg) => pkg.manifest.qualifiedName === manifest.qualifiedName);
        if (catalogMatches.length !== 1) {
          options.log(`Auto-discovery skipped ${manifestPath}: package must resolve to exactly one source-qualified catalog entry.`);
          return;
        }
        const catalogPackage = catalogMatches[0];
        if (catalogPackage.manifest.type !== manifest.type || !catalogPackage.manifest.platforms.includes(platform) || !catalogPackage.manifest.delivery.includes(options.scope)) {
          options.log(`Auto-discovery skipped ${manifestPath}: catalog package does not support this installation target.`);
          return;
        }
        const identity = installIdentity2({ id: manifest.id, platform, scope: options.scope, sourceId: catalogPackage.source.id });
        if (seen.has(identity) || options.existing.some((item) => item.id === manifest.id && item.platform === platform && item.scope === options.scope && item.sourceId === void 0)) {
          return;
        }
        discovered.push({
          id: manifest.id,
          type: manifest.type,
          platform,
          scope: options.scope,
          version: manifest.version,
          sourceRepo: (0, repositoryUrl_1.repositoryIdentity)(catalogPackage.source),
          sourceBranch: catalogPackage.source.branch,
          sourcePath: catalogPackage.sourcePath,
          sourceId: catalogPackage.source.id,
          qualifiedName: manifest.qualifiedName,
          group: manifest.group,
          installedPath: packageRoot,
          installedAt: options.now(),
          hotloaded
        });
        seen.add(identity);
      } catch (error) {
        if (isMissingManifest2(error))
          return;
        options.log(`Auto-discovery skipped ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    function isMissingManifest2(error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        return true;
      return error instanceof Error && /(?:^|\s)ENOENT(?::|\s)|file\s*not\s*found/i.test(error.message);
    }
    function installIdentity2(value) {
      return `${value.scope}:${value.platform}:${value.sourceId ?? ""}:${value.id}`;
    }
  }
});

// packages/marketplace-core/out/services/groupInstall.js
var require_groupInstall = __commonJS({
  "packages/marketplace-core/out/services/groupInstall.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.planGroupInstall = planGroupInstall2;
    exports.autoInstallGroupPlans = autoInstallGroupPlans2;
    exports.collectPackageGroups = collectPackageGroups2;
    exports.normalizeGroupList = normalizeGroupList2;
    var marketplaceModel_1 = require_marketplaceModel();
    function planGroupInstall2(group, scope, catalog, installed, defaultPlatform) {
      const normalizedGroup = group.trim();
      if (!normalizedGroup)
        return [];
      return catalog.flatMap((pkg) => {
        if (pkg.manifest.group !== normalizedGroup)
          return [];
        const matching = installed.filter((item) => (0, marketplaceModel_1.installedIdentity)(item) === (0, marketplaceModel_1.packageIdentity)(pkg));
        const option = (0, marketplaceModel_1.installOptionsForPackage)(pkg, matching, defaultPlatform).find((candidate) => candidate.scope === scope);
        return option ? [{ pkg, platform: option.platform, scope }] : [];
      });
    }
    function autoInstallGroupPlans2(catalog, installed, groups, defaultPlatform) {
      const enabled = new Set(normalizeGroupList2(groups));
      if (enabled.size === 0)
        return [];
      return catalog.flatMap((pkg) => {
        if (!enabled.has(pkg.manifest.group) || !pkg.manifest.delivery.includes("global"))
          return [];
        const identity = (0, marketplaceModel_1.packageIdentity)(pkg);
        if (installed.some((item) => (0, marketplaceModel_1.installedIdentity)(item) === identity || item.sourceId === void 0 && item.id === pkg.manifest.id))
          return [];
        const platform = pkg.manifest.platforms.includes(defaultPlatform) ? defaultPlatform : pkg.manifest.platforms[0];
        return platform ? [{ pkg, platform }] : [];
      });
    }
    function collectPackageGroups2(catalog, installed = []) {
      return normalizeGroupList2([
        ...catalog.map((pkg) => pkg.manifest.group),
        ...installed.map((pkg) => pkg.group ?? "")
      ]);
    }
    function normalizeGroupList2(groups) {
      return [...new Set(groups.map((group) => group.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    }
  }
});

// packages/marketplace-core/out/services/defaultPackages.js
var require_defaultPackages = __commonJS({
  "packages/marketplace-core/out/services/defaultPackages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultPackageInstallPlans = defaultPackageInstallPlans3;
    var packages_1 = require_packages();
    var marketplaceModel_1 = require_marketplaceModel();
    function defaultPackageInstallPlans3(packages, installed, defaultPlatform, config) {
      return packages.filter(isDefaultPackage2).filter((pkg) => config === void 0 || (config.repositories ?? []).some((source) => source.id === pkg.source.id && source.allowDefaultPackages)).filter((pkg) => pkg.manifest.delivery.includes("global")).filter((pkg) => !installed.some((item) => (0, marketplaceModel_1.installedIdentity)(item) === (0, marketplaceModel_1.packageIdentity)(pkg) || item.sourceId === void 0 && item.id === pkg.manifest.id)).map((pkg) => ({
        pkg,
        platform: preferredPlatform2(pkg, defaultPlatform)
      }));
    }
    function isDefaultPackage2(pkg) {
      return pkg.manifest.defaultInstall === true || pkg.manifest.defaultInstall === void 0 && pkg.manifest.tags.some((tag) => tag.trim().toLowerCase() === "default");
    }
    function preferredPlatform2(pkg, defaultPlatform) {
      return orderedPlatforms2(pkg.manifest.platforms, defaultPlatform)[0];
    }
    function orderedPlatforms2(availablePlatforms, defaultPlatform) {
      return [...availablePlatforms].sort((left, right) => {
        if (left === defaultPlatform) {
          return -1;
        }
        if (right === defaultPlatform) {
          return 1;
        }
        return packages_1.platforms.indexOf(left) - packages_1.platforms.indexOf(right);
      });
    }
  }
});

// packages/marketplace-core/out/services/bulkPlanning.js
var require_bulkPlanning = __commonJS({
  "packages/marketplace-core/out/services/bulkPlanning.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.availableBulkInstallScopes = availableBulkInstallScopes;
    exports.planBulkInstall = planBulkInstall2;
    exports.availableBulkUninstallScopes = availableBulkUninstallScopes;
    exports.planBulkUninstall = planBulkUninstall2;
    exports.matchingUninstallTargets = matchingUninstallTargets2;
    var localInstallScopes = ["workspace", "global"];
    var uninstallScopes = ["workspace", "global", "cloud"];
    function availableBulkInstallScopes(candidates) {
      return localInstallScopes.filter((scope) => candidates.some((candidate) => installOptionForScope2(candidate.options, scope) !== void 0));
    }
    function planBulkInstall2(candidates, scope) {
      const eligible = [];
      const skipped = [];
      const seen = /* @__PURE__ */ new Set();
      for (const candidate of candidates) {
        const key = selectionKey2(candidate.selection);
        if (seen.has(key))
          continue;
        seen.add(key);
        const option = installOptionForScope2(candidate.options, scope);
        if (!option) {
          skipped.push(candidate.selection);
          continue;
        }
        eligible.push({ selection: candidate.selection, option });
      }
      return { eligible, skipped };
    }
    function availableBulkUninstallScopes(candidates) {
      return uninstallScopes.filter((scope) => candidates.some((candidate) => matchingUninstallTargets2(candidate.installed, candidate.selection).some((item) => item.scope === scope)));
    }
    function planBulkUninstall2(candidates, scope) {
      const eligible = [];
      const skipped = [];
      const seenSelections = /* @__PURE__ */ new Set();
      const seenInstalled = /* @__PURE__ */ new Set();
      for (const candidate of candidates) {
        const key = selectionKey2(candidate.selection);
        if (seenSelections.has(key))
          continue;
        seenSelections.add(key);
        const target = matchingUninstallTargets2(candidate.installed, candidate.selection).find((item) => item.scope === scope);
        if (!target) {
          skipped.push(candidate.selection);
          continue;
        }
        const installedKey = `${installedIdentity3(target)}:${target.platform}:${target.scope}`;
        if (!seenInstalled.has(installedKey)) {
          seenInstalled.add(installedKey);
          eligible.push(target);
        }
      }
      return { eligible, skipped };
    }
    function matchingUninstallTargets2(installed, selection) {
      return installed.filter((item) => item.id === selection.packageId && (selection.sourceId === void 0 || item.sourceId === selection.sourceId) && (selection.qualifiedName === void 0 || (item.qualifiedName ?? item.id) === selection.qualifiedName) && (selection.platform === void 0 || item.platform === selection.platform));
    }
    function installOptionForScope2(options, scope) {
      return options.find((option) => option.scope === scope && option.action !== "installCloud");
    }
    function selectionKey2(selection) {
      return `${selection.sourceId ?? "legacy"}:${selection.qualifiedName ?? selection.packageId}:${selection.platform ?? ""}`;
    }
    function installedIdentity3(installed) {
      return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
    }
  }
});

// packages/marketplace-core/out/marketplaceService.js
var require_marketplaceService = __commonJS({
  "packages/marketplace-core/out/marketplaceService.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MarketplaceService = void 0;
    var repositoryClient_1 = require_repositoryClient();
    var packageInstaller_1 = require_packageInstaller();
    var marketplaceModel_1 = require_marketplaceModel();
    var autoDiscovery_1 = require_autoDiscovery();
    var groupInstall_1 = require_groupInstall();
    var defaultPackages_1 = require_defaultPackages();
    var versioning_1 = require_versioning();
    var bulkPlanning_1 = require_bulkPlanning();
    var migrationPlanning_1 = require_migrationPlanning();
    var MarketplaceService3 = class {
      dependencies;
      catalog = [];
      constructor(dependencies) {
        this.dependencies = dependencies;
      }
      async refreshCatalog() {
        const client = this.repositoryClient();
        this.catalog = await client.listMarketplacePackages();
        return this.catalog;
      }
      getCatalog() {
        return this.catalog;
      }
      async listInstalled() {
        return (await this.installer()).listInstalled();
      }
      async diagnose() {
        const client = this.repositoryClient();
        await client.checkConnection();
        const packages = await client.listMarketplacePackages();
        return { connected: true, packageCount: packages.length };
      }
      async discover(options) {
        return (0, autoDiscovery_1.discoverInstalledPackages)({ ...options, catalog: this.catalog, existing: await this.listInstalled(), config: this.config() });
      }
      async planGroup(group, scope) {
        return (0, groupInstall_1.planGroupInstall)(group, scope, this.catalog, await this.listInstalled(), this.config().defaultPlatform);
      }
      planBulkInstall(candidates, scope) {
        return (0, bulkPlanning_1.planBulkInstall)(candidates, scope);
      }
      planBulkUninstall(candidates, scope) {
        return (0, bulkPlanning_1.planBulkUninstall)(candidates, scope);
      }
      async syncPlan() {
        const installed = await this.listInstalled();
        const config = this.config();
        const actions = [
          ...(0, defaultPackages_1.defaultPackageInstallPlans)(this.catalog, installed, config.defaultPlatform, config).map((item) => ({ kind: "install-default", ...item, scope: "global" })),
          ...(0, groupInstall_1.autoInstallGroupPlans)(this.catalog, installed, config.autoInstallGroups ?? [], config.defaultPlatform).map((item) => ({ kind: "install-group", ...item, scope: "global" }))
        ];
        if (config.autoUpdateEnabled) {
          for (const current of installed) {
            if (current.autoUpdate === false)
              continue;
            const pkg = this.catalog.find((candidate) => candidate.source.id === current.sourceId && candidate.manifest.qualifiedName === current.qualifiedName);
            if (pkg && (0, versioning_1.isUpdateAvailable)(current.version, pkg.manifest.version)) {
              actions.push({ kind: "update", pkg, installed: current });
            }
          }
        }
        return { actions: deduplicateSyncActions2(actions) };
      }
      async applySync(requestedPlan) {
        const plan = requestedPlan ?? await this.syncPlan();
        const applied = [];
        for (const action of plan.actions) {
          applied.push(action.kind === "update" ? await this.update(action.pkg, action.installed) : await this.install(action.pkg, action.platform, action.scope));
        }
        return applied;
      }
      async getMarketplaceModel() {
        const installed = await this.listInstalled();
        const config = this.config();
        return (0, marketplaceModel_1.toSerializableMarketplaceModel)({
          packages: this.catalog,
          installed,
          configured: true,
          autoUpdateEnabled: config.autoUpdateEnabled ?? false,
          autoInstallGroups: config.autoInstallGroups,
          defaultPlatform: config.defaultPlatform
        });
      }
      async install(pkg, platform, scope) {
        return (await this.installer()).install(pkg, platform, scope);
      }
      async update(pkg, installed) {
        return (await this.installer()).updateInstalled(pkg, installed);
      }
      async planMigrations() {
        return (0, migrationPlanning_1.planPackageMigrations)(this.catalog, await this.listInstalled());
      }
      async migrate(destination, predecessor) {
        const installed = await this.listInstalled();
        if (!(0, migrationPlanning_1.migrationFor)(destination, predecessor, this.catalog, installed))
          throw new Error("The selected package migration is not eligible.");
        return (await this.installer()).migrateInstalled(destination, predecessor);
      }
      async revert(pkg, installed, revision) {
        const snapshot = await this.repositoryClient().fetchPackageAtRevision(pkg, revision);
        return (await this.installer()).revertInstalled(snapshot, installed, revision);
      }
      async uninstall(installed) {
        await (await this.installer()).uninstall(installed);
      }
      async hotload(installed) {
        return (await this.installer()).hotload(installed);
      }
      async offload(installed) {
        return (await this.installer()).offload(installed);
      }
      config() {
        return this.dependencies.configuration.read();
      }
      repositoryClient() {
        return new repositoryClient_1.RepositoryClient(this.config(), this.dependencies.credentials, (message5) => this.dependencies.logger.log(message5));
      }
      async installer() {
        const client = this.repositoryClient();
        return new packageInstaller_1.PackageInstaller(this.dependencies.storage, this.config(), (pkg) => client.fetchPackageFiles(pkg), this.dependencies.mcpScriptRunner, this.dependencies.harnessProfileManager);
      }
    };
    exports.MarketplaceService = MarketplaceService3;
    function deduplicateSyncActions2(actions) {
      const seen = /* @__PURE__ */ new Set();
      return actions.filter((action) => {
        const key = `${action.pkg.source.id}:${action.pkg.manifest.qualifiedName}:${action.kind === "update" ? `${action.installed.platform}:${action.installed.scope}` : `${action.platform}:${action.scope}`}`;
        if (seen.has(key))
          return false;
        seen.add(key);
        return true;
      });
    }
  }
});

// packages/marketplace-core/out/dashboardModel.js
var require_dashboardModel = __commonJS({
  "packages/marketplace-core/out/dashboardModel.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dashboardMaximumPageSize = exports.dashboardDefaultPageSize = void 0;
    exports.buildDashboardModel = buildDashboardModel;
    exports.findDashboardDetail = findDashboardDetail;
    exports.buildDashboardDetail = buildDashboardDetail;
    exports.dashboardFingerprints = dashboardFingerprints;
    exports.rowIdentity = rowIdentity;
    var marketplaceModel_1 = require_marketplaceModel();
    var groupInstall_1 = require_groupInstall();
    exports.dashboardDefaultPageSize = 20;
    exports.dashboardMaximumPageSize = 100;
    function buildDashboardModel(input) {
      const query = normalizeDashboardQuery(input.query);
      const catalog = input.catalog.filter(isCodexPackage);
      const installed = input.installed.filter(isCodexInstallation);
      const serialized = (0, marketplaceModel_1.toSerializableMarketplaceModel)({
        packages: catalog,
        installed,
        configured: input.configured,
        autoUpdateEnabled: input.preferences.autoUpdate,
        autoInstallGroups: input.preferences.autoInstallGroups,
        knownGroups: (0, groupInstall_1.collectPackageGroups)(catalog, installed),
        defaultPlatform: "codex"
      });
      const available = serialized.packages.map((row) => ({ ...sanitizeAvailable(row), kind: "available" })).filter((row) => row.installOptions.length > 0);
      const installedRows = serialized.installed.map((row) => ({ ...sanitizeInstalled(row), kind: "installed" })).sort((left, right) => Number(right.updateAvailable) - Number(left.updateAvailable) || left.name.localeCompare(right.name));
      const allRows = query.tab === "available" ? available : query.tab === "updates" ? installedRows.filter((row) => row.updateAvailable) : installedRows;
      const filtered = allRows.filter((row) => matchesQuery(row, query));
      const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
      const page = Math.min(query.page, totalPages);
      const start = (page - 1) * query.pageSize;
      const fingerprints = dashboardFingerprints(catalog, installed, input.preferences);
      return {
        schemaVersion: 1,
        platform: "codex",
        scopes: ["workspace", "global"],
        tab: query.tab,
        configured: input.configured,
        preferences: normalizePreferences(input.preferences),
        refresh: normalizeRefresh(input.refresh),
        counts: {
          available: available.length,
          installed: installedRows.length,
          updates: installedRows.filter((row) => row.updateAvailable).length
        },
        knownGroups: (0, groupInstall_1.collectPackageGroups)(catalog, installed),
        facets: buildFacets(allRows),
        rows: filtered.slice(start, start + query.pageSize),
        pagination: { page, pageSize: query.pageSize, totalItems: filtered.length, totalPages },
        fingerprints
      };
    }
    function findDashboardDetail(model, identity) {
      const row = model.rows.find((candidate) => rowIdentity(candidate) === identity);
      return row ? { row, fingerprints: model.fingerprints } : void 0;
    }
    function buildDashboardDetail(input, identity, query) {
      const separator = identity.indexOf(":");
      if (separator <= 0 || separator === identity.length - 1)
        return void 0;
      const model = buildDashboardModel({
        ...input,
        catalog: input.catalog.filter((pkg) => (0, marketplaceModel_1.packageIdentity)(pkg) === identity),
        installed: input.installed.filter((item) => (0, marketplaceModel_1.installedIdentity)(item) === identity),
        query: {
          tab: query.kind,
          ...query.kind === "installed" ? { scope: query.scope } : {},
          page: 1,
          pageSize: exports.dashboardMaximumPageSize
        }
      });
      const row = model.rows.find((candidate) => candidate.kind === query.kind && rowIdentity(candidate) === identity && (query.kind === "available" || candidate.kind === "installed" && candidate.scope === query.scope));
      return row ? { row, fingerprints: model.fingerprints } : void 0;
    }
    function dashboardFingerprints(catalog, installed, preferences) {
      const catalogValue = catalog.filter(isCodexPackage).map((pkg) => ({
        identity: (0, marketplaceModel_1.packageIdentity)(pkg),
        version: pkg.manifest.version,
        revision: pkg.sourceRevision ?? "",
        delivery: pkg.manifest.delivery.filter(isDashboardScope).sort(),
        migrations: pkg.manifest.migrations ?? []
      })).sort(compareIdentity);
      const stateValue = installed.filter(isCodexInstallation).map((item) => ({
        identity: (0, marketplaceModel_1.installedIdentity)(item),
        scope: item.scope,
        version: item.version,
        revision: item.sourceRevision ?? "",
        path: item.installedPath,
        hotloaded: item.hotloaded ?? null,
        autoUpdate: item.autoUpdate ?? null,
        revertedAt: item.revertedAt ?? null,
        migrationHistory: item.migrationHistory ?? []
      })).sort(compareIdentity);
      return {
        catalog: stableFingerprint(catalogValue),
        state: stableFingerprint({ installed: stateValue, preferences: normalizePreferences(preferences) })
      };
    }
    function rowIdentity(row) {
      return `${row.sourceId ?? "legacy"}:${row.qualifiedName}`;
    }
    function sanitizeAvailable(row) {
      const installOptions = row.installOptions.filter(isCodexLocalAction);
      const actions = sanitizeActions(row.primaryAction, row.moreActions);
      return { ...row, platforms: ["codex"], installOptions, ...actions };
    }
    function sanitizeInstalled(row) {
      const installOptions = row.installOptions.filter(isCodexLocalAction);
      return { ...row, installOptions, ...sanitizeActions(row.primaryAction, row.moreActions) };
    }
    function sanitizeActions(primary, more) {
      const eligiblePrimary = primary && isCodexLocalAction(primary) ? primary : void 0;
      const eligibleMore = more.filter(isCodexLocalAction);
      return { ...eligiblePrimary ? { primaryAction: eligiblePrimary } : {}, moreActions: eligibleMore };
    }
    function isCodexLocalAction(action) {
      return (action.platform === void 0 || action.platform === "codex") && (action.scope === void 0 || isDashboardScope(action.scope));
    }
    function isCodexPackage(pkg) {
      return pkg.manifest.platforms.includes("codex") && pkg.manifest.delivery.some(isDashboardScope);
    }
    function isCodexInstallation(item) {
      return item.platform === "codex" && isDashboardScope(item.scope);
    }
    function isDashboardScope(scope) {
      return scope === "workspace" || scope === "global";
    }
    function normalizeDashboardQuery(query) {
      const page = Number.isSafeInteger(query?.page) && (query?.page ?? 0) > 0 ? query.page : 1;
      const requestedSize = Number.isSafeInteger(query?.pageSize) && (query?.pageSize ?? 0) > 0 ? query.pageSize : exports.dashboardDefaultPageSize;
      return { ...query, tab: query?.tab ?? "available", page, pageSize: Math.min(requestedSize, exports.dashboardMaximumPageSize) };
    }
    function normalizePreferences(preferences) {
      return { autoUpdate: preferences.autoUpdate, autoInstallGroups: [...new Set(preferences.autoInstallGroups)].sort() };
    }
    function normalizeRefresh(refresh) {
      return { ...refresh, warnings: [...refresh.warnings] };
    }
    function matchesQuery(row, query) {
      if (query.type && row.type !== query.type)
        return false;
      if (query.group && row.group !== query.group)
        return false;
      if (query.sourceId && row.sourceId !== query.sourceId)
        return false;
      if (query.scope && (row.kind !== "installed" || row.scope !== query.scope))
        return false;
      const search = query.search?.trim().toLowerCase();
      if (!search)
        return true;
      return [row.id, row.qualifiedName, row.name, row.description, row.group, row.sourceLabel, row.type, ...row.tags].some((value) => value.toLowerCase().includes(search));
    }
    function buildFacets(rows) {
      return {
        types: countFacet(rows.map((row) => row.type)),
        groups: countFacet(rows.map((row) => row.group)),
        sources: [...new Map(rows.map((row) => [row.sourceId ?? "legacy", row.sourceLabel])).entries()].map(([id, label]) => ({ id, label, count: rows.filter((row) => (row.sourceId ?? "legacy") === id).length })).sort((left, right) => left.label.localeCompare(right.label)),
        scopes: countFacet(rows.flatMap((row) => row.kind === "installed" ? [row.scope] : []))
      };
    }
    function countFacet(values) {
      const counts = /* @__PURE__ */ new Map();
      values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
      return [...counts].map(([value, count]) => ({ value, count })).sort((left, right) => left.value.localeCompare(right.value));
    }
    function stableFingerprint(value) {
      const text = JSON.stringify(value);
      let hash = 0xcbf29ce484222325n;
      for (const byte of Buffer.from(text, "utf8")) {
        hash ^= BigInt(byte);
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
      }
      return hash.toString(16).padStart(16, "0");
    }
    function compareIdentity(left, right) {
      return left.identity.localeCompare(right.identity);
    }
  }
});

// packages/marketplace-core/out/services/configurationValues.js
var require_configurationValues = __commonJS({
  "packages/marketplace-core/out/services/configurationValues.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.normalizeDefaultPlatform = normalizeDefaultPlatform;
    var packages_1 = require_packages();
    function normalizeDefaultPlatform(value) {
      return typeof value === "string" && packages_1.platforms.includes(value) ? value : "codex";
    }
  }
});

// packages/marketplace-core/out/services/githubUrl.js
var require_githubUrl = __commonJS({
  "packages/marketplace-core/out/services/githubUrl.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultGitHubRepositoryUrl = void 0;
    exports.parseGitHubRepo = parseGitHubRepo2;
    var repositoryUrl_1 = require_repositoryUrl();
    exports.defaultGitHubRepositoryUrl = "https://github.com/Idov31/AI-Repository";
    var ownerOrRepoPattern = /^[A-Za-z0-9_.-]+$/;
    function parseGitHubRepo2(value) {
      const parsed = (0, repositoryUrl_1.parseGitHub)(value);
      if (!parsed?.owner || !ownerOrRepoPattern.test(parsed.owner) || !ownerOrRepoPattern.test(parsed.repository))
        return void 0;
      return {
        owner: parsed.owner,
        repository: parsed.repository,
        fullName: `${parsed.owner}/${parsed.repository}`
      };
    }
  }
});

// packages/marketplace-core/out/index.js
var require_out = __commonJS({
  "packages/marketplace-core/out/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_packages(), exports);
    __exportStar(require_ports(), exports);
    __exportStar(require_marketplaceService(), exports);
    __exportStar(require_dashboardModel(), exports);
    __exportStar(require_autoDiscovery(), exports);
    __exportStar(require_bulkPlanning(), exports);
    __exportStar(require_configurationValues(), exports);
    __exportStar(require_defaultPackages(), exports);
    __exportStar(require_githubClient(), exports);
    __exportStar(require_azureDevOpsClient(), exports);
    __exportStar(require_gitLabClient(), exports);
    __exportStar(require_repositoryClient(), exports);
    __exportStar(require_githubUrl(), exports);
    __exportStar(require_repositoryUrl(), exports);
    __exportStar(require_marketplaceYaml(), exports);
    __exportStar(require_manifestSchema(), exports);
    __exportStar(require_manifestDiagnostics(), exports);
    __exportStar(require_groupInstall(), exports);
    __exportStar(require_harnessBundle(), exports);
    __exportStar(require_installedState(), exports);
    __exportStar(require_installPlanning(), exports);
    __exportStar(require_marketplaceModel(), exports);
    __exportStar(require_migrationPlanning(), exports);
    __exportStar(require_mcpConfig(), exports);
    __exportStar(require_mcpScripts(), exports);
    __exportStar(require_packageFiles(), exports);
    __exportStar(require_packageInstaller(), exports);
    __exportStar(require_pathPlanning(), exports);
    __exportStar(require_validation(), exports);
    __exportStar(require_versioning(), exports);
  }
});

// plugins/ai-marketplace-harness/src/index.ts
import { spawn as spawn2 } from "node:child_process";
import { lstat as lstat3, readdir, readFile as readFile2 } from "node:fs/promises";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join2, relative as relative2, resolve as resolve4 } from "node:path";
import { fileURLToPath } from "node:url";

// packages/marketplace-core/src/types/packages.ts
var packageTypes = ["skill", "command", "mcp", "agent", "hook", "rule"];
var platforms = ["codex", "cursor", "github-copilot", "claude", "deepseek-harness"];
var installScopes = ["workspace", "global", "cloud"];

// packages/marketplace-core/src/services/azureDevOpsClient.ts
import { TextDecoder } from "node:util";

// packages/marketplace-core/src/services/pathPlanning.ts
import * as path from "path";
var PathSafetyError = class extends Error {
  constructor(message5) {
    super(message5);
    this.name = "PathSafetyError";
  }
};
var defaultInstallRoots = {
  codex: {
    skill: ".codex/skills",
    command: ".codex/commands",
    mcp: ".codex/mcps",
    agent: ".codex/agents",
    hook: ".codex/hooks",
    rule: ".codex/rules"
  },
  cursor: {
    skill: ".cursor/skills",
    command: ".cursor/commands",
    mcp: ".cursor/mcps",
    agent: ".cursor/agents",
    hook: ".cursor/hooks",
    rule: ".cursor/rules"
  },
  "github-copilot": {
    skill: ".github/skills",
    command: ".github/commands",
    mcp: ".github/mcps",
    agent: ".github/agents",
    hook: ".github/hooks",
    rule: ".github/rules"
  },
  claude: {
    skill: ".claude/skills",
    command: ".claude/commands",
    mcp: ".claude/mcps",
    agent: ".claude/agents",
    hook: ".claude/hooks",
    rule: ".claude/rules"
  },
  "deepseek-harness": {
    skill: ".dsh/skills",
    command: ".ai_marketplace/deepseek-harness/bundles",
    mcp: ".ai_marketplace/deepseek-harness/bundles",
    agent: ".ai_marketplace/deepseek-harness/bundles",
    hook: ".ai_marketplace/deepseek-harness/bundles",
    rule: ".dsh/rules"
  }
};
function installRelativePath(platform, packageType, packageId, overrides) {
  const base = safeJoinRelative(installRootRelativePath(platform, packageType, overrides), packageId);
  return platform === "claude" && isClaudeFlatFileType(packageType) ? `${base}.md` : base;
}
function isClaudeFlatFileType(packageType) {
  return packageType === "command" || packageType === "agent" || packageType === "rule";
}
function installRootRelativePath(platform, packageType, overrides) {
  const overrideRoot = overrides[platform]?.[packageType];
  return safeJoinRelative(overrideRoot && overrideRoot.trim().length > 0 ? overrideRoot : defaultInstallRoots[platform][packageType]);
}
function codexAgentConfigRelativePath(packageId, overrides) {
  return `${safeJoinRelative(installRootRelativePath("codex", "agent", overrides), packageId)}.toml`;
}
function offloadRelativePath(platform, packageType, packageId) {
  return safeJoinRelative(offloadRootRelativePath(platform, packageType), packageId);
}
function offloadRootRelativePath(platform, packageType) {
  return safeJoinRelative(".offload", platform, pluralizePackageType(packageType));
}
function cloudInstallPath(platform, packageType, packageId) {
  return safeJoinRelative("cloud", platform, pluralizePackageType(packageType), packageId);
}
function stateRelativePath() {
  return ".ai_marketplace/installed.json";
}
function mcpPayloadRelativePath(platform, sourceId, packageId) {
  return safeJoinRelative(".ai_marketplace", "mcp-packages", platform, sourceId, packageId);
}
function legacyStateRelativePath() {
  return ".ai-marketplace/installed.json";
}
function safeJoinRelative(...segments) {
  const raw = segments.join("/");
  const slashNormalized = raw.replaceAll("\\", "/");
  if (slashNormalized.startsWith("/") || /^[a-zA-Z]:/.test(slashNormalized)) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  const cleaned = slashNormalized.replace(/\/+$/, "");
  if (cleaned.split("/").some((part) => part === "..")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  const normalized = path.posix.normalize(cleaned);
  if (normalized === "." || normalized.length === 0) {
    throw new PathSafetyError("Path must not be empty.");
  }
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  if (normalized.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new PathSafetyError(`Unsafe relative path '${raw}'.`);
  }
  return normalized;
}
function toPosixRelativePath(value) {
  return safeJoinRelative(value);
}
function repoJoin(...segments) {
  const raw = segments.join("/");
  const slashNormalized = raw.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (/^[a-zA-Z]:/.test(slashNormalized)) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  if (slashNormalized.split("/").some((part) => part === "..")) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  const normalized = path.posix.normalize(slashNormalized);
  if (normalized === "." || normalized.length === 0) {
    return "/";
  }
  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new PathSafetyError(`Unsafe repository path '${raw}'.`);
  }
  return `/${normalized}`;
}
function pluralizePackageType(type) {
  switch (type) {
    case "skill":
      return "skills";
    case "command":
      return "commands";
    case "mcp":
      return "mcps";
    case "agent":
      return "agents";
    case "hook":
      return "hooks";
    case "rule":
      return "rules";
  }
}

// packages/marketplace-core/src/services/marketplaceYaml.ts
var import_yaml = __toESM(require_dist());

// packages/marketplace-core/src/services/manifestSchema.ts
var canonicalManifestFileName = "ai_marketplace.yaml";
var currentManifestReaderSchemaVersion = 1;
function manifestFieldDisposition(lifecycle, schemaVersion, replacementPresent) {
  if (schemaVersion < lifecycle.introducedIn) return "reject-not-introduced";
  if (lifecycle.removedIn !== null && schemaVersion >= lifecycle.removedIn) return "reject-removed";
  if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn && lifecycle.replacement !== null && replacementPresent) {
    return "prefer-replacement";
  }
  return "accept";
}
var activeV1 = { introducedIn: 1, deprecatedIn: null, removedIn: null, replacement: null };
var canonicalManifestFields = Object.freeze(Object.fromEntries([
  "schema_version",
  "minimum_reader_schema_version",
  "package",
  "package.name",
  "package.type",
  "package.version",
  "package.description",
  "package.group",
  "package.entrypoint",
  "targets",
  "targets.platforms",
  "targets.delivery",
  "installation",
  "installation.default",
  "metadata",
  "metadata.tags",
  "metadata.icon",
  "metadata.evaluation_score",
  "history",
  "history.previous_revision",
  "history.migrations",
  "history.migrations[]",
  "history.migrations[].from",
  "history.migrations[].from.source_id",
  "history.migrations[].from.name",
  "history.migrations[].from.repository",
  "history.migrations[].from.branch",
  "history.migrations[].from.path"
].map((path2) => [path2, activeV1])));
function isManifestPath(path2) {
  const name2 = path2.replace(/\\/g, "/").split("/").at(-1);
  return name2 === canonicalManifestFileName;
}
function manifestSourcePath(manifestPath) {
  const normalized = manifestPath.replace(/\\/g, "/");
  if (!isManifestPath(normalized)) throw new Error(`Unsupported AI Marketplace manifest path '${manifestPath}'.`);
  return normalized.slice(0, -canonicalManifestFileName.length).replace(/\/$/, "");
}
function selectManifestCandidates(paths) {
  const folders = /* @__PURE__ */ new Map();
  for (const path2 of paths) {
    if (!isManifestPath(path2)) continue;
    const sourcePath = manifestSourcePath(path2);
    folders.set(sourcePath, path2);
  }
  return [...folders.entries()].map(([sourcePath, path2]) => ({ path: path2, sourcePath }));
}
function selectManifestInFolder(paths, sourcePath) {
  return selectManifestCandidates(paths).find((candidate) => candidate.sourcePath === sourcePath.replace(/\/$/, ""));
}
function isRootManifestFile(relativePath) {
  return relativePath === canonicalManifestFileName;
}

// packages/marketplace-core/src/services/versioning.ts
function compareVersions(left, right) {
  const leftSemver = parseSemanticVersion(left);
  const rightSemver = parseSemanticVersion(right);
  if (leftSemver && rightSemver) return compareSemanticVersions(leftSemver, rightSemver);
  const leftParts = tokenizeVersion(left);
  const rightParts = tokenizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? { kind: "number", value: 0 };
    const rightPart = rightParts[index] ?? { kind: "number", value: 0 };
    const compared = compareVersionPart(leftPart, rightPart);
    if (compared !== 0) {
      return compared;
    }
  }
  return 0;
}
function isSemanticVersion(value) {
  return parseSemanticVersion(value) !== void 0;
}
function parseSemanticVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return void 0;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4]?.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part) ?? [] };
}
function compareSemanticVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  if (left.prerelease.length === 0 || right.prerelease.length === 0) return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length === 0 ? 1 : -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === void 0 || r === void 0) return l === r ? 0 : l === void 0 ? -1 : 1;
    if (l === r) continue;
    if (typeof l === "number" && typeof r === "number") return Math.sign(l - r);
    if (typeof l === "number") return -1;
    if (typeof r === "number") return 1;
    return l.localeCompare(r);
  }
  return 0;
}
function isUpdateAvailable(installedVersion, availableVersion) {
  return compareVersions(installedVersion, availableVersion) < 0;
}
function tokenizeVersion(version) {
  return version.trim().split(/[.+_-]/).filter(Boolean).map((part) => {
    if (/^\d+$/.test(part)) {
      return { kind: "number", value: Number(part) };
    }
    return { kind: "text", value: part.toLowerCase() };
  });
}
function compareVersionPart(left, right) {
  if (left.kind === "number" && right.kind === "number") {
    return Math.sign(left.value - right.value);
  }
  if (left.kind === "number") {
    return 1;
  }
  if (right.kind === "number") {
    return -1;
  }
  return left.value.localeCompare(right.value);
}

// packages/marketplace-core/src/services/validation.ts
var idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
var groupPattern = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/;
var gitRevisionPattern = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
var ValidationError = class extends Error {
  constructor(message5) {
    super(message5);
    this.name = "ValidationError";
  }
};
function isPackageType(value) {
  return packageTypes.includes(value);
}
function isPlatform(value) {
  return platforms.includes(value);
}
function validateMarketplaceManifest(value, source) {
  if (!isRecord(value)) {
    throw new ValidationError(`AI Marketplace manifest at ${source} must be an object.`);
  }
  const schemaVersion = readPositiveInteger(value, "schema_version", source);
  const minimumReaderSchemaVersion = readPositiveInteger(value, "minimum_reader_schema_version", source);
  if (minimumReaderSchemaVersion > schemaVersion) throw new ValidationError(`Manifest at ${source} has minimum_reader_schema_version greater than schema_version.`);
  if (minimumReaderSchemaVersion > currentManifestReaderSchemaVersion) {
    throw new ValidationError(`Manifest at ${source} requires reader schema ${minimumReaderSchemaVersion}, but this client supports ${currentManifestReaderSchemaVersion}.`);
  }
  const diagnostics = canonicalDiagnostics(value, schemaVersion, source);
  const pkg = readRecord(value, "package", source);
  const targets = readRecord(value, "targets", source);
  const installation = optionalRecord(value, "installation", source) ?? {};
  const metadata = optionalRecord(value, "metadata", source) ?? {};
  const history = optionalRecord(value, "history", source) ?? {};
  const canonicalPlatforms = readCanonicalStringArray(targets, "platforms", source);
  const canonicalDelivery = readCanonicalStringArray(targets, "delivery", source);
  const tags = metadata["tags"] === void 0 ? [] : readCanonicalStringArray(metadata, "tags", source, true);
  const defaultInstall = optionalBoolean(installation, "default", source) ?? false;
  const flat = {
    name: pkg["name"],
    type: pkg["type"],
    version: pkg["version"],
    description: pkg["description"],
    group: pkg["group"],
    entrypoint: pkg["entrypoint"],
    platforms: canonicalPlatforms,
    delivery: canonicalDelivery,
    keywords: tags,
    icon: metadata["icon"],
    "evaluation-score": metadata["evaluation_score"],
    previous_version: history["previous_revision"],
    migrations: history["migrations"]
  };
  if (!isSemanticVersion(readString(pkg, "version", source))) throw new ValidationError(`Manifest at ${source} has an invalid SemVer 2.0 package.version.`);
  for (const [path2, values] of [["targets.platforms", canonicalPlatforms], ["targets.delivery", canonicalDelivery], ["metadata.tags", tags]]) assertUniqueStrings(values, path2, source);
  const manifest = { ...validateNormalizedManifest(flat, source), defaultInstall };
  return { manifest, compatibility: { schemaVersion, minimumReaderSchemaVersion }, diagnostics };
}
function validateNormalizedManifest(value, source) {
  const qualifiedName = readString(value, "name", source);
  const id = packageIdFromQualifiedName(qualifiedName, source);
  const group = optionalString(value, "group", source) ?? groupFromQualifiedName(qualifiedName, source);
  const type = readString(value, "type", source);
  const version = readString(value, "version", source);
  const description = readString(value, "description", source);
  const entrypoint = readString(value, "entrypoint", source);
  const manifestPlatforms = readStringArray(value, "platforms", source);
  const manifestDelivery = readStringArray(value, "delivery", source);
  const tags = readStringArray(value, "keywords", source);
  const icon = optionalString(value, "icon", source);
  const previousVersion = optionalString(value, "previous_version", source);
  const migrations = optionalMigrations(value, source, qualifiedName);
  if (!isSafeGroup(group)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe group.`);
  }
  if (!isPackageType(type)) {
    throw new ValidationError(`Manifest at ${source} has unsupported type '${type}'.`);
  }
  if (previousVersion !== void 0 && !gitRevisionPattern.test(previousVersion)) {
    throw new ValidationError(`Manifest at ${source} has an invalid 'previous_version'. Expected a full 40 or 64 character hexadecimal Git revision.`);
  }
  if (entrypoint.length === 0 || entrypoint.includes("\\") || entrypoint.startsWith("/") || entrypoint.includes("..")) {
    throw new ValidationError(`Manifest at ${source} has an unsafe entrypoint.`);
  }
  const parsedPlatforms = manifestPlatforms.map((platform) => {
    if (!isPlatform(platform)) {
      throw new ValidationError(`Manifest at ${source} has unsupported platform '${platform}'.`);
    }
    return platform;
  });
  if (parsedPlatforms.length === 0) {
    throw new ValidationError(`Manifest at ${source} must include at least one platform.`);
  }
  if (type === "hook" && parsedPlatforms.some((platform) => platform !== "codex" && platform !== "github-copilot" && platform !== "claude" && platform !== "deepseek-harness")) {
    throw new ValidationError(`Manifest at ${source} has an unsupported platform for hook packages.`);
  }
  const delivery = parseDelivery(manifestDelivery, type, source);
  if (delivery.includes("cloud") && parsedPlatforms.includes("claude")) {
    throw new ValidationError(`Manifest at ${source} cannot use cloud delivery for the Claude platform.`);
  }
  if (parsedPlatforms.length === 1 && parsedPlatforms[0] === "deepseek-harness") {
    if (delivery.includes("cloud")) throw new ValidationError(`Manifest at ${source} cannot use cloud delivery for DeepSeek Harness.`);
    if (type !== "skill" && type !== "rule" && delivery.includes("workspace")) {
      throw new ValidationError(`Manifest at ${source} supports only global delivery for DeepSeek Harness ${type} packages.`);
    }
  }
  const evaluationScore = type === "skill" || type === "command" ? optionalEvaluationScore(value, source) : void 0;
  return {
    id,
    qualifiedName,
    name: qualifiedName,
    group,
    type,
    version,
    description,
    entrypoint,
    platforms: parsedPlatforms,
    delivery,
    tags,
    ...previousVersion === void 0 ? {} : { previousVersion: previousVersion.toLowerCase() },
    ...icon === void 0 ? {} : { icon },
    ...evaluationScore === void 0 ? {} : { evaluationScore },
    ...migrations === void 0 ? {} : { migrations }
  };
}
function validateMigrationSourceIdentity(manifest, sourceId, source) {
  const self = (manifest.migrations ?? []).find((migration) => (migration.from.sourceId ?? sourceId) === sourceId && (migration.from.name ?? manifest.qualifiedName) === manifest.qualifiedName && migration.from.repository === void 0);
  if (self) throw new ValidationError(`Manifest at ${source} contains a migration that maps the package to itself.`);
}
function optionalMigrations(record, source, destinationName) {
  const value = record["migrations"];
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError(`Manifest at ${source} has invalid 'migrations'. Expected a non-empty array.`);
  const migrations = value.map((item, index) => {
    if (!isRecord(item) || !isRecord(item["from"])) {
      throw new ValidationError(`Manifest at ${source} migration ${index + 1} must contain only a 'from' mapping.`);
    }
    const from = item["from"];
    const allowed = /* @__PURE__ */ new Set(["source_id", "name", "repository", "branch", "path"]);
    const unknown = Object.keys(from).find((key) => !allowed.has(key));
    if (unknown) throw new ValidationError(`Manifest at ${source} migration ${index + 1} contains unknown field '${unknown}'.`);
    const sourceId = optionalString(from, "source_id", source);
    const name2 = optionalString(from, "name", source);
    const repository = optionalString(from, "repository", source);
    const branch = optionalString(from, "branch", source);
    const migrationPath = optionalString(from, "path", source);
    if (sourceId !== void 0 && !idPattern.test(sourceId)) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe source_id.`);
    if (name2 !== void 0) packageIdFromQualifiedName(name2, source);
    const provenanceCount = [repository, branch, migrationPath].filter((field) => field !== void 0).length;
    if (provenanceCount !== 0 && provenanceCount !== 3) throw new ValidationError(`Manifest at ${source} migration ${index + 1} must provide repository, branch, and path together.`);
    if (branch !== void 0 && (branch.includes("..") || branch.includes("\\") || branch.startsWith("/"))) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe branch.`);
    if (repository !== void 0 && !isSafeRepository(repository)) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe repository.`);
    let normalizedPath;
    try {
      normalizedPath = migrationPath === void 0 ? void 0 : repoJoin(migrationPath);
    } catch {
      throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe path.`);
    }
    if (sourceId === void 0 && name2 === void 0 && repository === void 0) throw new ValidationError(`Manifest at ${source} migration ${index + 1} does not identify a predecessor.`);
    if (sourceId === void 0 && name2 === destinationName && repository === void 0) throw new ValidationError(`Manifest at ${source} migration ${index + 1} maps the package to itself.`);
    return { from: {
      ...sourceId === void 0 ? {} : { sourceId },
      ...name2 === void 0 ? {} : { name: name2 },
      ...repository === void 0 ? {} : { repository, branch, path: normalizedPath }
    } };
  });
  const keys = migrations.map(({ from }) => JSON.stringify(from));
  if (new Set(keys).size !== keys.length) throw new ValidationError(`Manifest at ${source} contains duplicate migration entries.`);
  return migrations;
}
function isSafeRepository(repository) {
  return !repository.includes("\\") && !repository.startsWith("/") && repository.split("/").length <= 2 && repository.split("/").every((segment) => idPattern.test(segment) && segment !== "." && segment !== "..");
}
function parseDelivery(values, type, source) {
  const delivery = values.map((value) => {
    if (!installScopes.includes(value)) {
      throw new ValidationError(`Manifest at ${source} has unsupported delivery '${value}'.`);
    }
    return value;
  });
  if (delivery.length === 0) {
    throw new ValidationError(`Manifest at ${source} must include at least one delivery target.`);
  }
  if (type === "mcp" && (delivery.length !== 1 || delivery[0] !== "global")) {
    throw new ValidationError(`Manifest at ${source} must use only global delivery for MCP packages.`);
  }
  if (delivery.includes("cloud") && type !== "agent") {
    throw new ValidationError(`Manifest at ${source} uses cloud delivery, which is currently supported only for agent packages.`);
  }
  return [...new Set(delivery)];
}
function packageIdFromQualifiedName(qualifiedName, source) {
  const segments = qualifiedName.split("/");
  const id = segments.at(-1) ?? "";
  if (!idPattern.test(id)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe package name.`);
  }
  if (qualifiedName.includes("\\") || segments.some((segment) => segment.trim().length === 0 || segment === "." || segment === "..") || segments.length > 1 && !qualifiedName.startsWith("@")) {
    throw new ValidationError(`Manifest at ${source} has an invalid scoped package name.`);
  }
  return id;
}
function groupFromQualifiedName(qualifiedName, source) {
  const slashIndex = qualifiedName.lastIndexOf("/");
  if (slashIndex <= 1 || !qualifiedName.startsWith("@")) {
    throw new ValidationError(`Manifest at ${source} must include 'group' when its package name is unscoped.`);
  }
  const group = qualifiedName.slice(1, slashIndex);
  if (!isSafeGroup(group)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe group derived from its package name.`);
  }
  return group;
}
function isSafeGroup(group) {
  return groupPattern.test(group) && !group.includes("\\") && group.split("/").every((segment) => segment !== "." && segment !== ".." && segment.length > 0);
}
function parseHotloadFlag(entrypointContent) {
  const normalized = entrypointContent.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).slice(0, 80);
  const prologueLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" && prologueLines.length === 0) {
      continue;
    }
    if (trimmed === "---" || trimmed === "+++") {
      if (prologueLines.length === 0) {
        prologueLines.push(trimmed);
        continue;
      }
      break;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.includes(":")) {
      prologueLines.push(trimmed.replace(/^[/#*\s]+/, ""));
      continue;
    }
    break;
  }
  return prologueLines.some((line) => /^hotload\s*:\s*true\s*$/i.test(line));
}
function readString(record, key, source) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Manifest at ${source} must include a non-empty '${key}' string.`);
  }
  return value.trim();
}
function optionalString(record, key, source) {
  const value = record[key];
  if (value === void 0) {
    return void 0;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Manifest at ${source} has invalid '${key}'.`);
  }
  return value.trim();
}
function readStringArray(record, key, source) {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ValidationError(`Manifest at ${source} must include '${key}' as a string array.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}
function optionalEvaluationScore(record, source) {
  const value = record["evaluation-score"];
  if (value === void 0) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
    throw new ValidationError(`Manifest at ${source} has invalid 'evaluation-score'. Expected a finite number from 0 to 10.`);
  }
  return value;
}
function canonicalDiagnostics(value, schemaVersion, source) {
  const diagnostics = [];
  visitKnownFields(value, value, "", schemaVersion, source, diagnostics);
  return diagnostics.slice(0, 50);
}
function visitKnownFields(root, value, parent, schemaVersion, source, diagnostics) {
  for (const [key, child] of Object.entries(value)) {
    const path2 = parent ? `${parent}.${key}` : key;
    const lifecycle = canonicalManifestFields[path2];
    if (!lifecycle) {
      diagnostics.push({ kind: "unknown-field", field: path2 });
      continue;
    }
    const disposition = manifestFieldDisposition(lifecycle, schemaVersion, lifecycle.replacement !== null && hasManifestPath(root, lifecycle.replacement));
    if (disposition === "reject-not-introduced") throw new ValidationError(`Manifest at ${source} uses '${path2}' before schema version ${lifecycle.introducedIn}.`);
    if (disposition === "reject-removed") throw new ValidationError(`Manifest at ${source} uses removed field '${path2}'.`);
    if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn) diagnostics.push({ kind: "deprecated-field", field: path2, ...lifecycle.replacement ? { replacement: lifecycle.replacement } : {} });
    if (disposition === "prefer-replacement") continue;
    if (isRecord(child)) visitKnownFields(root, child, path2, schemaVersion, source, diagnostics);
    else if (Array.isArray(child) && path2 === "history.migrations") {
      for (const item of child) if (isRecord(item)) visitKnownFields(root, item, `${path2}[]`, schemaVersion, source, diagnostics);
    }
  }
}
function hasManifestPath(root, path2) {
  let current = root;
  for (const segment of path2.replaceAll("[]", "").split(".")) {
    if (!isRecord(current) || !(segment in current)) return false;
    current = current[segment];
  }
  return true;
}
function readRecord(record, key, source) {
  const value = record[key];
  if (!isRecord(value)) throw new ValidationError(`Manifest at ${source} must include '${key}' as a mapping.`);
  return value;
}
function optionalRecord(record, key, source) {
  const value = record[key];
  if (value === void 0) return void 0;
  if (!isRecord(value)) throw new ValidationError(`Manifest at ${source} has invalid '${key}'. Expected a mapping.`);
  return value;
}
function readPositiveInteger(record, key, source) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new ValidationError(`Manifest at ${source} must include '${key}' as a positive integer.`);
  return value;
}
function optionalBoolean(record, key, source) {
  const value = record[key];
  if (value === void 0) return void 0;
  if (typeof value !== "boolean") throw new ValidationError(`Manifest at ${source} has invalid '${key}'. Expected a boolean.`);
  return value;
}
function readCanonicalStringArray(record, key, source, allowEmpty = false) {
  const value = record[key];
  if (!Array.isArray(value) || !allowEmpty && value.length === 0 || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new ValidationError(`Manifest at ${source} must include '${key}' as ${allowEmpty ? "a" : "a non-empty"} string array without blank entries.`);
  }
  return value.map((item) => item.trim());
}
function assertUniqueStrings(values, path2, source) {
  const normalized = values.filter((value) => typeof value === "string").map((value) => value.trim());
  if (new Set(normalized).size !== normalized.length) throw new ValidationError(`Manifest at ${source} contains duplicate '${path2}' entries.`);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/marketplace-core/src/services/marketplaceYaml.ts
var maxManifestBytes = 128 * 1024;
function parseMarketplaceYaml(text, source) {
  if (Buffer.byteLength(text, "utf8") > maxManifestBytes) throw new ValidationError(`AI Marketplace manifest at ${source} exceeds the 128 KiB size limit.`);
  const document = (0, import_yaml.parseDocument)(text, { strict: true, uniqueKeys: true, prettyErrors: false });
  if (document.errors.length > 0) throw new ValidationError(`AI Marketplace manifest at ${source} is invalid YAML: ${document.errors[0].message}`);
  if (!(0, import_yaml.isMap)(document.contents)) throw new ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
  let value;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new ValidationError(`AI Marketplace manifest at ${source} contains unsafe YAML aliases: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord2(value)) throw new ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
  return value;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/marketplace-core/src/services/manifestDiagnostics.ts
var ManifestDiagnosticCollector = class {
  unknownFields = /* @__PURE__ */ new Set();
  deprecatedFields = /* @__PURE__ */ new Map();
  record(diagnostics) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.kind === "unknown-field") this.unknownFields.add(diagnostic.field);
      else this.deprecatedFields.set(diagnostic.field, diagnostic.replacement);
    }
  }
  summary(sourceLabel) {
    const parts = [];
    if (this.unknownFields.size) parts.push(`unknown forward-compatible field(s): ${bounded(this.unknownFields)}`);
    if (this.deprecatedFields.size) parts.push(`deprecated field(s): ${bounded(this.deprecatedFields.keys())}`);
    return parts.length ? `Source '${sourceLabel}' manifest compatibility summary: ${parts.join("; ")}.` : void 0;
  }
};
function bounded(values) {
  const all = [...values].sort();
  return `${all.slice(0, 20).join(", ")}${all.length > 20 ? `, and ${all.length - 20} more` : ""}`;
}

// packages/marketplace-core/src/services/mcpScripts.ts
var mcpInstallScript = "install.py";
var mcpUninstallScript = "uninstall.py";
var mcpScriptTimeoutMs = 10 * 60 * 1e3;
function assertMcpPackageScripts(pkg, files) {
  if (pkg.manifest.type !== "mcp") return;
  const paths = new Set(files.map((file) => file.relativePath));
  assertMcpScriptPaths(pkg.manifestPath, paths);
}
function assertMcpScriptPaths(source, paths) {
  for (const script of [mcpInstallScript, mcpUninstallScript]) {
    if (!paths.has(script)) {
      throw new ValidationError(`MCP package at ${source} must contain root-level '${script}'.`);
    }
  }
}

// packages/marketplace-core/src/services/repositoryUrl.ts
function repositoryIdentity(source) {
  switch (source.provider) {
    case "github":
      return `${source.owner}/${source.repository}`;
    case "azure-devops":
      return `${source.organization}/${source.project}/${source.repository}`;
    case "gitlab":
      return `${source.namespace}/${source.repository}`;
  }
}
function packageSourceFromConfig(source) {
  const common = { id: source.id, label: source.label, repository: source.repository, branch: source.branch };
  switch (source.provider) {
    case "github":
      return { ...common, provider: "github", host: "github.com", owner: source.owner };
    case "azure-devops":
      return { ...common, provider: "azure-devops", host: "dev.azure.com", organization: source.organization, project: source.project };
    case "gitlab":
      return { ...common, provider: "gitlab", host: source.host, namespace: source.namespace };
  }
}
function sourceMatchesConfig(source, configured) {
  return source.provider === configured.provider && source.id === configured.id && source.branch === configured.branch && repositoryIdentity(source) === repositoryIdentity(configured) && source.host === configured.host;
}

// packages/marketplace-core/src/services/repositoryHttp.ts
var retryableStatuses = /* @__PURE__ */ new Set([408, 429, 500, 502, 503, 504]);
var retryDelaysMs = [250, 750, 1500];
async function requestWithCredentials(options) {
  const shared = await options.credentials.sharedCredentials(options.source.provider);
  let response = await attemptCredentials(options, shared.length > 0 ? shared : [void 0]);
  if (!isAuthenticationFailureResponse(response, options.source.provider)) return response;
  const sourceCredentials2 = await options.credentials.sourceCredentials(options.source);
  const prior = new Set(shared.map(credentialKey));
  const unique = sourceCredentials2.filter((credential2) => !prior.has(credentialKey(credential2)));
  if (unique.length === 0) return response;
  options.log(`Retrying ${providerLabel(options.source.provider)} request with a repository-specific credential for source '${options.source.id}'.`);
  response = await attemptCredentials(options, unique);
  return response;
}
async function attemptCredentials(options, credentials) {
  let response = await fetchWithRetry(options, credentials[0]);
  for (const credential2 of credentials.slice(1)) {
    if (!isAuthenticationFailureResponse(response, options.source.provider)) break;
    options.log(`Retrying ${providerLabel(options.source.provider)} request with an alternate credential for source '${options.source.id}'.`);
    response = await fetchWithRetry(options, credential2);
  }
  return response;
}
async function fetchWithRetry(options, credential2) {
  let lastError;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetch(options.url, { headers: { ...options.headers, ...credentialHeaders(credential2, options.accept) } });
      if (!retryableStatuses.has(response.status) || attempt === retryDelaysMs.length) return response;
      options.log(`${providerLabel(options.source.provider)} returned ${response.status} ${response.statusText}; retrying ${describeRequest(options.url)}.`);
    } catch (error) {
      lastError = error;
      if (attempt === retryDelaysMs.length) throw error;
      options.log(`${providerLabel(options.source.provider)} request failed transiently; retrying ${describeRequest(options.url)}.`);
    }
    await delay(retryDelaysMs[attempt]);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
function credentialHeaders(credential2, accept = "application/json") {
  const headers = { Accept: accept };
  if (!credential2) return headers;
  switch (credential2.kind) {
    case "bearer":
      headers.Authorization = `Bearer ${credential2.token}`;
      break;
    case "basic-pat":
      headers.Authorization = `Basic ${Buffer.from(`:${credential2.token}`, "utf8").toString("base64")}`;
      break;
    case "private-token":
      headers["PRIVATE-TOKEN"] = credential2.token;
      break;
  }
  return headers;
}
function isAuthenticationFailureResponse(response, provider) {
  if (response.status === 401 || response.status === 403) return true;
  if (provider !== "azure-devops") return false;
  return response.status === 203 || Boolean(response.headers.get("content-type")?.toLowerCase().includes("text/html"));
}
function repositorySources(config) {
  return (config.repositories ?? [{
    id: "default",
    label: "Default repository",
    provider: "github",
    host: "github.com",
    owner: config.repository.split("/")[0] ?? "",
    repository: config.repository.split("/")[1] ?? config.repository,
    branch: config.branch,
    enabled: true,
    allowDefaultPackages: true,
    packageFolders: config.packageFolders
  }]).filter((source) => source.enabled);
}
function configuredSource(config, source) {
  const candidate = repositorySources(config).find((item) => item.id === source.id);
  if (!candidate) throw new Error(`Package source '${source.id}' is no longer configured.`);
  if (!sourceMatchesConfig(source, candidate)) throw new Error(`Package source '${source.id}' no longer matches the loaded catalog.`);
  return candidate;
}
function packageSource(source) {
  return packageSourceFromConfig(source);
}
function isFullGitRevision(value) {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}
async function safeReadErrorBody(response) {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text);
      const candidate = typeof json.message === "string" ? json.message : typeof json.error === "string" ? json.error : text;
      return summarizeErrorBody(candidate);
    } catch {
      return summarizeErrorBody(text);
    }
  } catch {
    return "";
  }
}
function describeRequest(rawUrl) {
  const url = new URL(rawUrl);
  return `host=${url.host}, route=${url.pathname}`;
}
function credentialKey(credential2) {
  return `${credential2.kind}:${credential2.token}`;
}
function providerLabel(provider) {
  return provider === "github" ? "GitHub" : provider === "azure-devops" ? "Azure DevOps" : "GitLab";
}
function summarizeErrorBody(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 600);
}
async function delay(milliseconds) {
  await new Promise((resolve5) => setTimeout(resolve5, milliseconds));
}

// packages/marketplace-core/src/services/azureDevOpsClient.ts
var AzureDevOpsClient = class {
  constructor(config, credentials, log) {
    this.config = config;
    this.credentials = credentials;
    this.log = log;
  }
  config;
  credentials;
  log;
  decoder = new TextDecoder();
  loggedCredentialFallbacks = /* @__PURE__ */ new Set();
  async checkConnection() {
    for (const source of this.sources()) await this.resolveSourceRevision(source);
  }
  async listBranches() {
    const source = this.sources()[0];
    if (!source) return [];
    const json = await this.requestJson(source, this.buildUrl(source, "/refs", { filter: "heads/", "api-version": "7.1" }));
    return (json.value ?? []).map((ref) => ref.name?.replace(/^refs\/heads\//, "")).filter((name2) => Boolean(name2)).sort((left, right) => left.localeCompare(right));
  }
  async listMarketplacePackages(onSourceComplete) {
    const results = await Promise.all(this.sources().map(async (source) => {
      const packages = [];
      try {
        await this.listSourcePackages(source, packages);
      } catch (error) {
        this.log(`Unable to refresh source '${source.label}': ${message(error)}`);
        return packages;
      }
      packages.sort(comparePackages);
      this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
      await onSourceComplete?.({ source: packageSource(source), packages });
      return packages;
    }));
    return results.flat().sort(comparePackages);
  }
  async fetchPackageFiles(pkg) {
    const source = this.sourceForPackage(pkg.source);
    const items = await this.listItems(source, pkg.sourcePath, { revision: pkg.sourceRevision });
    const files = [];
    for (const item of items) {
      if (!isFile(item) || !item.path) continue;
      const relativePath = item.path.slice(pkg.sourcePath.length).replace(/^\/+/, "");
      files.push({ relativePath: toPosixRelativePath(relativePath), content: await this.getBytes(source, item.path, pkg.sourceRevision) });
    }
    return files;
  }
  async fetchPackageAtRevision(pkg, revision) {
    if (!isFullGitRevision(revision) || revision.length !== 40) throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    await this.validateCommit(source, commit);
    const items = await this.listItems(source, pkg.sourcePath, { revision: commit });
    const selection = selectManifestInFolder(items.flatMap((item) => isFile(item) && item.path ? [item.path] : []), pkg.sourcePath);
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestText = await this.getText(source, selection.path, commit);
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(manifestText, selection.path), selection.path).manifest;
    validateMigrationSourceIdentity(manifest, source.id, selection.path);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== pkg.sourcePath || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(selection.path, packageRelativePaths(items, sourcePath));
    const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), commit);
    return { manifest, sourcePath, manifestPath: selection.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: commit };
  }
  async listSourcePackages(source, packages) {
    const revision = await this.resolveSourceRevision(source);
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = repoJoin(folder);
      const items = await this.listItems(source, root, { allowMissingFolder: true, revision });
      const selections = selectManifestCandidates(items.flatMap((item) => isFile(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isFile(candidate));
        if (!item?.path) continue;
        try {
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(await this.getText(source, item.path, revision), item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) {
            this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
            continue;
          }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativePaths(items, sourcePath));
          const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), revision);
          packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: revision });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) {
          this.log(`Skipping invalid package at ${item.path}: ${message(error)}`);
        }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }
  async resolveSourceRevision(source) {
    const json = await this.requestJson(source, this.buildUrl(source, "/refs", { filter: `heads/${source.branch}`, "api-version": "7.1" }));
    const revision = json.value?.find((ref) => ref.name === `refs/heads/${source.branch}`)?.objectId;
    if (!revision || !/^[0-9a-f]{40}$/i.test(revision)) throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
    return revision.toLowerCase();
  }
  async validateCommit(source, revision) {
    const commit = await this.requestJson(source, this.buildUrl(source, `/commits/${encodeURIComponent(revision)}`, { "api-version": "7.1" }));
    if (commit.commitId?.toLowerCase() !== revision) throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
  }
  async listItems(source, scopePath, options = {}) {
    const revision = options.revision ?? source.branch;
    const url = this.buildUrl(source, "/items", {
      scopePath,
      recursionLevel: "Full",
      includeContentMetadata: "true",
      "versionDescriptor.version": revision,
      "versionDescriptor.versionType": options.revision ? "commit" : "branch",
      "api-version": "7.1"
    });
    try {
      return (await this.requestJson(source, url)).value ?? [];
    } catch (error) {
      if (options.allowMissingFolder && isMissingPathError(error)) {
        this.log(`Skipping missing package folder ${scopePath}.`);
        return [];
      }
      throw error;
    }
  }
  async getText(source, path2, revision) {
    return this.decoder.decode(await this.getBytes(source, path2, revision));
  }
  async getBytes(source, path2, revision) {
    const url = this.buildUrl(source, "/items", {
      path: path2,
      download: "true",
      "versionDescriptor.version": revision ?? source.branch,
      "versionDescriptor.versionType": revision ? "commit" : "branch",
      "api-version": "7.1"
    });
    const response = await requestWithCredentials({ source, url, accept: "*/*", credentials: this.credentials, log: (line) => this.logRequest(source, line) });
    if (isAuthenticationFailureResponse(response, source.provider)) throw authenticationError(response, url);
    if (!response.ok) throw new AzureDevOpsRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    return new Uint8Array(await response.arrayBuffer());
  }
  async requestJson(source, url) {
    const response = await requestWithCredentials({ source, url, credentials: this.credentials, log: (line) => this.logRequest(source, line) });
    if (isAuthenticationFailureResponse(response, source.provider)) throw authenticationError(response, url);
    if (!response.ok) throw new AzureDevOpsRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    try {
      return await response.json();
    } catch {
      throw new AzureDevOpsRequestError(response.status, response.statusText, "Azure DevOps returned a non-JSON response.", describeRequest(url));
    }
  }
  buildUrl(source, route, params) {
    const url = new URL(`https://dev.azure.com/${encodeURIComponent(source.organization)}/${encodeURIComponent(source.project)}/_apis/git/repositories/${encodeURIComponent(source.repository)}${route}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
  sources() {
    return repositorySources(this.config).filter((source) => source.provider === "azure-devops");
  }
  sourceForPackage(source) {
    if (source.provider !== "azure-devops") throw new Error(`Package source '${source.id}' is not an Azure DevOps source.`);
    return configuredSource(this.config, source);
  }
  logRequest(source, line) {
    if (line.startsWith("Retrying Azure DevOps request with a repository-specific credential")) {
      if (this.loggedCredentialFallbacks.has(source.id)) return;
      this.loggedCredentialFallbacks.add(source.id);
    }
    this.log(line);
  }
};
var AzureDevOpsRequestError = class extends Error {
  constructor(status, statusText, body, request) {
    super(`Azure DevOps request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`);
    this.status = status;
    this.body = body;
    this.name = "AzureDevOpsRequestError";
  }
  status;
  body;
};
function isFile(item) {
  return item.gitObjectType === "blob" || item.isFolder === false;
}
function packageRelativePaths(items, sourcePath) {
  const prefix = `${sourcePath}/`;
  return new Set(items.flatMap((item) => isFile(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
}
function isMissingPathError(error) {
  return error instanceof AzureDevOpsRequestError && (error.status === 400 || error.status === 404) && /tf401174|could not be found|not found/i.test(error.body);
}
function authenticationError(response, url) {
  return new AzureDevOpsRequestError(response.status, response.statusText, "Authentication was rejected or redirected to the Azure DevOps sign-in page. Verify the selected OAuth/PAT credential type and repository access.", describeRequest(url));
}
function comparePackages(left, right) {
  return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`);
}
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// packages/marketplace-core/src/services/githubClient.ts
import { TextDecoder as TextDecoder2 } from "util";
var GitHubClient = class {
  constructor(config, credentialsOrToken, log, sourceToken) {
    this.config = config;
    this.log = log;
    this.credentials = isCredentialProvider(credentialsOrToken) ? credentialsOrToken : legacyCredentialProvider(credentialsOrToken, sourceToken);
  }
  config;
  log;
  decoder = new TextDecoder2();
  treeCache = /* @__PURE__ */ new Map();
  credentials;
  async checkConnection() {
    for (const source of this.sources()) {
      await this.getTree(source);
    }
  }
  async listBranches() {
    const source = this.sources()[0];
    if (!source) {
      return [];
    }
    const branches = await this.requestJson(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/branches`, { per_page: "100" })
    );
    return branches.map((branch) => branch.name).filter((name2) => typeof name2 === "string" && name2.length > 0).sort((left, right) => left.localeCompare(right));
  }
  async listMarketplacePackages(onSourceComplete) {
    const results = await Promise.all(this.sources().map(async (source) => {
      const packages = [];
      try {
        await this.listSourcePackages(source, packages);
      } catch (error) {
        this.log(`Unable to refresh source '${source.label}': ${error instanceof Error ? error.message : String(error)}`);
        return packages;
      }
      packages.sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
      this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
      await onSourceComplete?.({ source: packageSource(source), packages });
      return packages;
    }));
    return results.flat().sort(
      (left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`)
    );
  }
  async fetchPackageFiles(pkg) {
    const source = this.sourceForPackage(pkg.source);
    const tree = (await this.getTree(source, pkg.sourceRevision)).items;
    const sourcePrefix = stripLeadingSlash(repoJoin(pkg.sourcePath));
    const files = [];
    for (const item of tree) {
      if (!isBlob(item) || !item.path || !item.sha || !isWithinFolder(item.path, sourcePrefix)) {
        continue;
      }
      const relativePath = item.path.slice(sourcePrefix.length).replace(/^\/+/, "");
      files.push({
        relativePath: toPosixRelativePath(relativePath),
        content: await this.getBlobBytes(source, item.sha)
      });
    }
    return files;
  }
  /** Reads and validates the exact package snapshot selected by a manifest rollback revision. */
  async fetchPackageAtRevision(pkg, revision) {
    if (!isFullGitRevision(revision)) {
      throw new Error("Rollback revision must be a full 40 or 64 character hexadecimal Git revision.");
    }
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    const treeResult = await this.getTree(source, await this.getCommitTreeSha(source, commit));
    this.treeCache.set(`${source.id}:${commit}`, treeResult);
    const selection = selectManifestInFolder(treeResult.items.flatMap((item) => isBlob(item) && item.path ? [item.path] : []), stripLeadingSlash(pkg.sourcePath));
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestPath = selection.path;
    const manifestItem = treeResult.items.find((item) => item.path === manifestPath && isBlob(item));
    if (!manifestItem?.sha) {
      throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    }
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, manifestItem.sha)), manifestPath), manifestPath).manifest;
    validateMigrationSourceIdentity(manifest, source.id, manifestPath);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== pkg.sourcePath || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(manifestPath, packageRelativeBlobPaths(treeResult.items, sourcePath));
    const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), void 0, treeResult.items);
    return {
      manifest,
      sourcePath,
      manifestPath,
      hotload: parseHotloadFlag(entrypoint),
      source: packageSource(source),
      sourceRevision: commit
    };
  }
  async listSourcePackages(source, packages) {
    const treeResult = await this.getTree(source);
    const tree = treeResult.items;
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = stripLeadingSlash(repoJoin(folder));
      const items = tree.filter((item) => isWithinFolder(item.path, root));
      const selections = selectManifestCandidates(items.flatMap((item) => isBlob(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isBlob(candidate));
        if (!item?.path) continue;
        try {
          const manifestText = await this.getText(source, item.path);
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(manifestText, item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) {
            this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
            continue;
          }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativeBlobPaths(tree, sourcePath));
          const entrypointContent = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint));
          packages.push({
            manifest,
            sourcePath,
            manifestPath: item.path,
            hotload: parseHotloadFlag(entrypointContent),
            source: packageSource(source),
            ...treeResult.revision === void 0 ? {} : { sourceRevision: treeResult.revision }
          });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) {
          this.log(`Skipping invalid package at ${item.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }
  async getTree(source, revision = source.branch) {
    const cacheKey = `${source.id}:${revision}`;
    const cached = this.treeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    this.log(`Listing GitHub tree: source=${source.id}, repo=${source.owner}/${source.repository}, branch=${source.branch}`);
    const tree = await this.requestJson(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/trees/${encodeURIComponent(revision)}`, {
        recursive: "1"
      })
    );
    if (tree.truncated) {
      throw new Error(`GitHub repository tree is truncated for source '${source.id}'; its catalog is too large to load safely.`);
    }
    if (!isFullGitRevision(tree.sha ?? "")) {
      throw new Error(`GitHub tree for source '${source.id}' did not return an immutable revision SHA.`);
    }
    const result = { items: tree.tree ?? [], revision: tree.sha.toLowerCase() };
    this.treeCache.set(cacheKey, result);
    return result;
  }
  async getCommitTreeSha(source, revision) {
    const commit = await this.requestJson(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/commits/${encodeURIComponent(revision)}`, {})
    );
    if (typeof commit.sha !== "string" || commit.sha.toLowerCase() !== revision || !isFullGitRevision(commit.tree?.sha ?? "")) {
      throw new Error(`Rollback revision '${revision}' is not an exact Git commit with a valid tree.`);
    }
    return commit.tree.sha.toLowerCase();
  }
  async getText(source, path2, revision, providedTree) {
    const tree = providedTree ?? (await this.getTree(source, revision)).items;
    const normalized = stripLeadingSlash(repoJoin(path2));
    const item = tree.find((candidate) => candidate.path === normalized && isBlob(candidate));
    if (!item?.sha) {
      throw new GitHubRequestError(404, "Not Found", "", `source=${source.id}, path=${path2}, branch=${source.branch}`);
    }
    return this.decoder.decode(await this.getBlobBytes(source, item.sha));
  }
  async getBlobBytes(source, sha) {
    const blob = await this.requestJson(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/blobs/${encodeURIComponent(sha)}`, {})
    );
    if (blob.encoding !== "base64" || typeof blob.content !== "string") {
      throw new Error(`GitHub blob ${sha} did not return base64 content.`);
    }
    return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
  }
  async requestJson(source, url) {
    const response = await this.request(source, url);
    if (!response.ok) {
      throw new GitHubRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest2(url));
    }
    return await response.json();
  }
  async request(source, url) {
    return requestWithCredentials({
      source,
      url,
      accept: "application/vnd.github+json",
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
      credentials: this.credentials,
      log: this.log
    });
  }
  apiUrl(_source, route, params) {
    const url = new URL(`https://api.github.com${route}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
  sources() {
    return repositorySources(this.config).filter((source) => source.provider === "github");
  }
  sourceForPackage(source) {
    if (source.provider !== "github") throw new Error(`Package source '${source.id}' is not a GitHub source.`);
    return configuredSource(this.config, source);
  }
};
var GitHubRequestError = class extends Error {
  constructor(status, statusText, body, requestDescription) {
    super(`GitHub request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${requestDescription})`);
    this.status = status;
    this.body = body;
    this.name = "GitHubRequestError";
  }
  status;
  body;
};
function isBlob(item) {
  return item.type === "blob";
}
function packageRelativeBlobPaths(items, sourcePath) {
  const prefix = `${stripLeadingSlash(sourcePath)}/`;
  return new Set(items.flatMap((item) => isBlob(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
}
function isWithinFolder(pathValue, folder) {
  return typeof pathValue === "string" && (pathValue === folder || pathValue.startsWith(`${folder}/`));
}
function stripLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}
function describeRequest2(rawUrl) {
  const url = new URL(rawUrl);
  return `route=${url.pathname}`;
}
function isCredentialProvider(value) {
  return typeof value === "object" && value !== null && "sharedCredentials" in value;
}
function legacyCredentialProvider(token, sourceToken) {
  return {
    sharedCredentials: async (provider) => provider === "github" && token ? [{ kind: "bearer", token }] : [],
    sourceCredentials: async (source) => {
      const value = sourceToken ? await sourceToken(source) : void 0;
      return source.provider === "github" && value ? [{ kind: "bearer", token: value }] : [];
    }
  };
}

// packages/marketplace-core/src/services/gitLabClient.ts
import { TextDecoder as TextDecoder3 } from "node:util";
var GitLabClient = class {
  constructor(config, credentials, log) {
    this.config = config;
    this.credentials = credentials;
    this.log = log;
  }
  config;
  credentials;
  log;
  decoder = new TextDecoder3();
  treeCache = /* @__PURE__ */ new Map();
  async checkConnection() {
    for (const source of this.sources()) await this.resolveSourceRevision(source);
  }
  async listBranches() {
    const source = this.sources()[0];
    if (!source) return [];
    const values = await this.requestPaged(source, this.apiUrl(source, "/repository/branches", { per_page: "100" }));
    return values.map((branch) => branch.name).filter((name2) => Boolean(name2)).sort((a, b) => a.localeCompare(b));
  }
  async listMarketplacePackages(onSourceComplete) {
    const results = await Promise.all(this.sources().map(async (source) => {
      const packages = [];
      try {
        await this.listSourcePackages(source, packages);
      } catch (error) {
        this.log(`Unable to refresh source '${source.label}': ${message2(error)}`);
        return packages;
      }
      packages.sort(comparePackages2);
      this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
      await onSourceComplete?.({ source: packageSource(source), packages });
      return packages;
    }));
    return results.flat().sort(comparePackages2);
  }
  async fetchPackageFiles(pkg) {
    const source = this.sourceForPackage(pkg.source);
    const revision = pkg.sourceRevision ?? source.branch;
    const tree = await this.getTree(source, revision);
    const prefix = stripSlash(pkg.sourcePath);
    const files = [];
    for (const item of tree) {
      if (!isBlob2(item) || !item.id || !item.path || !isWithin(item.path, prefix)) continue;
      files.push({ relativePath: toPosixRelativePath(item.path.slice(prefix.length).replace(/^\/+/, "")), content: await this.getBlobBytes(source, item.id) });
    }
    return files;
  }
  async fetchPackageAtRevision(pkg, revision) {
    if (!isFullGitRevision(revision) || revision.length !== 40) throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    await this.validateCommit(source, commit);
    const tree = await this.getTree(source, commit);
    const selection = selectManifestInFolder(tree.flatMap((item) => isBlob2(item) && item.path ? [item.path] : []), stripSlash(pkg.sourcePath));
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestPath = selection.path;
    const manifestItem = tree.find((item) => isBlob2(item) && item.path === manifestPath);
    if (!manifestItem?.id) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, manifestItem.id)), manifestPath), manifestPath).manifest;
    validateMigrationSourceIdentity(manifest, source.id, manifestPath);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== stripSlash(pkg.sourcePath) || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(manifestPath, packageRelativePaths2(tree, sourcePath));
    const entrypoint = await this.getTextFromTree(source, tree, repoJoin(sourcePath, manifest.entrypoint));
    return { manifest, sourcePath, manifestPath, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: commit };
  }
  async listSourcePackages(source, packages) {
    const revision = await this.resolveSourceRevision(source);
    const tree = await this.getTree(source, revision);
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = stripSlash(repoJoin(folder));
      const items = tree.filter((item) => isWithin(item.path, root));
      const selections = selectManifestCandidates(items.flatMap((item) => isBlob2(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isBlob2(candidate));
        if (!item?.path || !item.id) continue;
        try {
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, item.id)), item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) {
            this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
            continue;
          }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativePaths2(tree, sourcePath));
          const entrypoint = await this.getTextFromTree(source, tree, repoJoin(sourcePath, manifest.entrypoint));
          packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: revision });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) {
          this.log(`Skipping invalid package at ${item.path}: ${message2(error)}`);
        }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }
  async resolveSourceRevision(source) {
    const commit = await this.requestJson(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(source.branch)}`, { stats: "false" }));
    if (!commit.id || !/^[0-9a-f]{40}$/i.test(commit.id)) throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
    return commit.id.toLowerCase();
  }
  async validateCommit(source, revision) {
    const commit = await this.requestJson(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(revision)}`, { stats: "false" }));
    if (commit.id?.toLowerCase() !== revision) throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
  }
  async getTree(source, revision) {
    const key = `${source.id}:${revision}`;
    const cached = this.treeCache.get(key);
    if (cached) return cached;
    const url = this.apiUrl(source, "/repository/tree", { ref: revision, recursive: "true", per_page: "100", pagination: "keyset" });
    let tree;
    try {
      tree = await this.requestPaged(source, url);
    } catch (error) {
      if (error instanceof GitLabRequestError && error.status === 404) tree = [];
      else throw error;
    }
    this.treeCache.set(key, tree);
    return tree;
  }
  async getTextFromTree(source, tree, path2) {
    const normalized = stripSlash(path2);
    const item = tree.find((candidate) => isBlob2(candidate) && candidate.path === normalized);
    if (!item?.id) throw new GitLabRequestError(404, "Not Found", "", `source=${source.id}, path=${normalized}`);
    return this.decoder.decode(await this.getBlobBytes(source, item.id));
  }
  async getBlobBytes(source, sha) {
    const blob = await this.requestJson(source, this.apiUrl(source, `/repository/blobs/${encodeURIComponent(sha)}`, {}));
    if (blob.encoding !== "base64" || typeof blob.content !== "string" || blob.sha && blob.sha.toLowerCase() !== sha.toLowerCase()) throw new Error(`GitLab blob ${sha} did not return valid base64 content.`);
    return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
  }
  async requestPaged(source, firstUrl) {
    const values = [];
    let next = firstUrl;
    for (let page = 0; next && page < 1e3; page += 1) {
      const response = await requestWithCredentials({ source, url: next, credentials: this.credentials, log: this.log });
      if (!response.ok) throw new GitLabRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(next));
      const pageValues = await response.json();
      if (!Array.isArray(pageValues)) throw new Error(`GitLab returned a malformed paginated response (${describeRequest(next)}).`);
      values.push(...pageValues);
      next = validatedNextLink(response.headers.get("link"), source);
    }
    if (next) throw new Error(`GitLab pagination exceeded the safe page limit for source '${source.id}'.`);
    return values;
  }
  async requestJson(source, url) {
    const response = await requestWithCredentials({ source, url, credentials: this.credentials, log: this.log });
    if (!response.ok) throw new GitLabRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    return await response.json();
  }
  apiUrl(source, route, params) {
    const project = encodeURIComponent(`${source.namespace}/${source.repository}`);
    const url = new URL(`https://${source.host}/api/v4/projects/${project}${route}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
  sources() {
    return repositorySources(this.config).filter((source) => source.provider === "gitlab");
  }
  sourceForPackage(source) {
    if (source.provider !== "gitlab") throw new Error(`Package source '${source.id}' is not a GitLab source.`);
    return configuredSource(this.config, source);
  }
};
var GitLabRequestError = class extends Error {
  constructor(status, statusText, body, request) {
    super(`GitLab request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`);
    this.status = status;
    this.body = body;
    this.name = "GitLabRequestError";
  }
  status;
  body;
};
function validatedNextLink(header, source) {
  if (!header) return void 0;
  const entry = header.split(",").map((part) => part.trim()).find((part) => /;\s*rel="?next"?$/i.test(part));
  const raw = entry?.match(/^<([^>]+)>/)?.[1];
  if (!raw) return void 0;
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.host.toLowerCase() !== source.host.toLowerCase() || !url.pathname.startsWith("/api/v4/projects/")) throw new Error(`GitLab returned an unsafe pagination URL for source '${source.id}'.`);
  return url.toString();
}
function isBlob2(item) {
  return item.type === "blob";
}
function isWithin(path2, folder) {
  return typeof path2 === "string" && (path2 === folder || path2.startsWith(`${folder}/`));
}
function stripSlash(value) {
  return value.replace(/^\/+/, "");
}
function packageRelativePaths2(items, sourcePath) {
  const prefix = `${stripSlash(sourcePath)}/`;
  return new Set(items.flatMap((item) => isBlob2(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
}
function message2(error) {
  return error instanceof Error ? error.message : String(error);
}
function comparePackages2(left, right) {
  return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`);
}

// packages/marketplace-core/src/services/repositoryClient.ts
var RepositoryClient = class {
  github;
  azureDevOps;
  gitlab;
  constructor(config, credentials, log) {
    this.github = new GitHubClient(config, credentials, log);
    this.azureDevOps = new AzureDevOpsClient(config, credentials, log);
    this.gitlab = new GitLabClient(config, credentials, log);
    this.config = config;
  }
  config;
  async checkConnection() {
    await this.github.checkConnection();
    await this.azureDevOps.checkConnection();
    await this.gitlab.checkConnection();
  }
  async listBranches() {
    const provider = repositorySources(this.config)[0]?.provider;
    return provider === "azure-devops" ? this.azureDevOps.listBranches() : provider === "gitlab" ? this.gitlab.listBranches() : this.github.listBranches();
  }
  async listMarketplacePackages(onProgress) {
    const completedPackages = [];
    const onSourceComplete = async (snapshot) => {
      completedPackages.push(...snapshot.packages);
      await onProgress?.({ ...snapshot, catalog: sortPackages(completedPackages) });
    };
    const results = await Promise.all([
      this.github.listMarketplacePackages(onSourceComplete),
      this.azureDevOps.listMarketplacePackages(onSourceComplete),
      this.gitlab.listMarketplacePackages(onSourceComplete)
    ]);
    return sortPackages(results.flat());
  }
  fetchPackageFiles(pkg) {
    return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageFiles(pkg) : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageFiles(pkg) : this.github.fetchPackageFiles(pkg);
  }
  fetchPackageAtRevision(pkg, revision) {
    return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageAtRevision(pkg, revision) : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageAtRevision(pkg, revision) : this.github.fetchPackageAtRevision(pkg, revision);
  }
};
function sortPackages(packages) {
  return [...packages].sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
}

// packages/marketplace-core/src/services/packageInstaller.ts
import { createHash as createHash2, randomUUID } from "node:crypto";

// packages/marketplace-core/src/services/installPlanning.ts
function uninstallTargetPaths(installed, config) {
  return uniquePaths([
    installed.installedPath,
    installRelativePath(installed.platform, installed.type, installed.id, config.platformPathOverrides),
    ...installed.managedConfig?.kind === "codex-agent" ? [installed.managedConfig.configPath] : [],
    offloadRelativePath(installed.platform, installed.type, installed.id)
  ]);
}
function uniquePaths(paths) {
  return [...new Set(paths)];
}

// packages/marketplace-core/src/services/installedState.ts
var InstalledStateStore = class {
  constructor(storage, scope) {
    this.storage = storage;
    this.scope = scope;
  }
  storage;
  scope;
  async read() {
    for (const relativePath of [stateRelativePath(), legacyStateRelativePath()]) {
      const bytes = await this.storage.readFile(this.scope, relativePath);
      if (bytes !== void 0) {
        const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
        return {
          schemaVersion: 2,
          packages: Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage) : []
        };
      }
    }
    return { schemaVersion: 2, packages: [] };
  }
  async upsert(pkg) {
    const state = await this.read();
    const packages = state.packages.filter((item) => !sameInstallIdentity(item, pkg.id, pkg.platform, pkg.scope, pkg.sourceId));
    packages.push(pkg);
    await this.write({ ...state, packages: packages.sort(compareInstalledPackages) });
  }
  async remove(id, platform, scope, sourceId) {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstallIdentity(item, id, platform, scope, sourceId));
    if (!existing) {
      return void 0;
    }
    await this.write({ ...state, packages: state.packages.filter((item) => !sameInstallIdentity(item, id, platform, scope, sourceId)) });
    return existing;
  }
  /** Removes one exact persisted installation without broad legacy identity matching. */
  async removeInstalled(pkg) {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstalledRecord(item, pkg));
    if (!existing) return void 0;
    await this.write({ ...state, packages: state.packages.filter((item) => !sameInstalledRecord(item, pkg)) });
    return existing;
  }
  /** Atomically swaps one installation identity for another in a single state write. */
  async replace(previous, next) {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstalledRecord(item, previous));
    if (!existing) throw new Error(`Installed predecessor '${previous.qualifiedName ?? previous.id}' was not found.`);
    const collision = state.packages.find((item) => sameInstallIdentity(item, next.id, next.platform, next.scope, next.sourceId) && !sameInstalledRecord(item, previous));
    if (collision) throw new Error(`Destination package '${next.qualifiedName ?? next.id}' is already installed.`);
    const packages = state.packages.filter((item) => !sameInstalledRecord(item, previous));
    packages.push(next);
    await this.write({ ...state, packages: packages.sort(compareInstalledPackages) });
  }
  async discardLegacyAutomationPreferences() {
    let changed = false;
    for (const relativePath of [stateRelativePath(), legacyStateRelativePath()]) {
      const bytes = await this.storage.readFile(this.scope, relativePath);
      if (bytes === void 0) continue;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
      } catch {
        continue;
      }
      if (!("autoUpdateEnabled" in parsed) && !("autoUpdateChangedAt" in parsed) && !("autoInstallGroups" in parsed) && !("autoInstallGroupsChangedAt" in parsed)) continue;
      const packages = Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage) : [];
      await this.storage.writeFileAtomic(this.scope, relativePath, Buffer.from(`${JSON.stringify({ schemaVersion: 2, packages }, null, 2)}
`, "utf8"));
      changed = true;
    }
    return changed;
  }
  async write(state) {
    await this.storage.writeFileAtomic(this.scope, stateRelativePath(), Buffer.from(`${JSON.stringify({ ...state, schemaVersion: 2 }, null, 2)}
`, "utf8"));
  }
};
function compareInstalledPackages(left, right) {
  return `${left.scope}:${left.platform}:${left.type}:${left.sourceId ?? ""}:${left.qualifiedName ?? left.id}`.localeCompare(`${right.scope}:${right.platform}:${right.type}:${right.sourceId ?? ""}:${right.qualifiedName ?? right.id}`);
}
function sameInstallIdentity(pkg, id, platform, scope, sourceId) {
  if (pkg.id !== id || pkg.platform !== platform || pkg.scope !== scope) {
    return false;
  }
  return sourceId === void 0 || pkg.sourceId === sourceId;
}
function sameInstalledRecord(left, right) {
  return left.id === right.id && left.platform === right.platform && left.scope === right.scope && left.sourceId === right.sourceId && left.qualifiedName === right.qualifiedName && left.sourceRepo === right.sourceRepo && left.sourceBranch === right.sourceBranch && left.sourcePath === right.sourcePath;
}
function isInstalledPackage(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value;
  const scope = record.scope === void 0 ? "workspace" : record.scope;
  if (!installScopes.includes(scope)) {
    return false;
  }
  if (record.scope === void 0) {
    record.scope = "workspace";
  }
  return typeof record.id === "string" && typeof record.type === "string" && typeof record.platform === "string" && platforms.includes(record.platform) && typeof record.scope === "string" && typeof record.version === "string" && typeof record.sourceRepo === "string" && typeof record.sourceBranch === "string" && typeof record.sourcePath === "string" && typeof record.installedPath === "string" && typeof record.installedAt === "string" && (record.sourceId === void 0 || typeof record.sourceId === "string") && (record.qualifiedName === void 0 || typeof record.qualifiedName === "string") && (record.group === void 0 || typeof record.group === "string") && (record.managedConfig === void 0 || isManagedConfigContribution(record.managedConfig)) && (record.managedPayloadPath === void 0 || typeof record.managedPayloadPath === "string") && (record.harnessBundle === void 0 || isHarnessBundle(record.harnessBundle)) && (record.harnessProfile === void 0 || typeof record.harnessProfile === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(record.harnessProfile)) && (record.hotloaded === void 0 || typeof record.hotloaded === "boolean") && (record.hotloadRequestedAt === void 0 || typeof record.hotloadRequestedAt === "string") && (record.offloadRequestedAt === void 0 || typeof record.offloadRequestedAt === "string") && (record.autoUpdate === void 0 || typeof record.autoUpdate === "boolean") && (record.autoUpdateChangedAt === void 0 || typeof record.autoUpdateChangedAt === "string") && (record.sourceRevision === void 0 || typeof record.sourceRevision === "string") && (record.revertedAt === void 0 || typeof record.revertedAt === "string") && (record.revertedFromVersion === void 0 || typeof record.revertedFromVersion === "string") && (record.migrationHistory === void 0 || Array.isArray(record.migrationHistory) && record.migrationHistory.every(isMigrationHistoryEntry));
}
function isHarnessBundle(value) {
  return isPlainRecord(value) && typeof value.profile === "string" && typeof value.name === "string" && typeof value.contentSha256 === "string" && /^[0-9a-f]{64}$/.test(value.contentSha256) && Array.isArray(value.files) && value.files.every((file) => isPlainRecord(file) && typeof file.path === "string" && typeof file.sha256 === "string" && /^[0-9a-f]{64}$/.test(file.sha256));
}
function isMigrationHistoryEntry(value) {
  if (!isPlainRecord(value) || typeof value.migratedAt !== "string") return false;
  return isMigrationSnapshot(value.from) && isMigrationSnapshot(value.to);
}
function isMigrationSnapshot(value) {
  if (!isPlainRecord(value)) return false;
  return typeof value.id === "string" && typeof value.qualifiedName === "string" && (value.sourceId === void 0 || typeof value.sourceId === "string") && typeof value.version === "string" && typeof value.repository === "string" && typeof value.branch === "string" && typeof value.path === "string";
}
function isManagedConfigContribution(value) {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (value.kind === "mcp") {
    return typeof value.serverName === "string" && isPlainRecord(value.serverConfig);
  }
  if (value.kind === "hook") {
    return isPlainRecord(value.hooks) && Object.values(value.hooks).every(Array.isArray);
  }
  if (value.kind === "codex-agent") {
    return typeof value.configPath === "string" && typeof value.contentSha256 === "string" && /^[0-9a-f]{64}$/.test(value.contentSha256);
  }
  return false;
}
function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/marketplace-core/src/services/packageFiles.ts
function filterPackageFilesForPlatform(files, platform) {
  if (platform === "codex") {
    return files;
  }
  return files.filter((file) => !isOpenAIYaml(file.relativePath));
}
function isOpenAIYaml(relativePath) {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1]?.toLowerCase() === "openai.yaml";
}

// packages/marketplace-core/src/services/migrationPlanning.ts
function planPackageMigrations(catalog, installed) {
  const raw = [];
  const ineligible = [];
  for (const destination of catalog) {
    for (const migration of destination.manifest.migrations ?? []) {
      for (const predecessor of installed.filter((item) => matchesMigration(destination, migration, item))) {
        const reason = incompatibilityReason(destination, predecessor, installed);
        if (reason) ineligible.push({ destination, predecessor, reason });
        else raw.push({ destination, predecessor });
      }
    }
  }
  const eligible = [];
  for (const candidate of deduplicate(raw)) {
    const predecessorClaims = raw.filter((item) => installKey(item.predecessor) === installKey(candidate.predecessor));
    const destinationClaims = raw.filter((item) => targetKey(item) === targetKey(candidate));
    const reason = new Set(predecessorClaims.map((item) => destinationIdentity(item.destination))).size > 1 ? "Multiple destination packages claim this predecessor installation." : new Set(destinationClaims.map((item) => installKey(item.predecessor))).size > 1 ? "Multiple predecessor installations target the same destination platform and scope." : void 0;
    if (reason) ineligible.push({ ...candidate, reason });
    else eligible.push(candidate);
  }
  return { eligible, ineligible: deduplicateIneligible(ineligible) };
}
function matchesMigration(destination, migration, installed) {
  const sourceId = migration.from.sourceId ?? destination.source.id;
  const qualifiedName = migration.from.name ?? destination.manifest.qualifiedName;
  const id = qualifiedName.split("/").at(-1);
  if (installed.sourceId !== void 0) return installed.sourceId === sourceId && (installed.qualifiedName ?? installed.id) === qualifiedName;
  return migration.from.repository !== void 0 && installed.id === id && installed.sourceRepo === migration.from.repository && installed.sourceBranch === migration.from.branch && normalizeRepoPath(installed.sourcePath) === normalizeRepoPath(migration.from.path);
}
function migrationFor(destination, predecessor, catalog, installed) {
  return planPackageMigrations(catalog, installed).eligible.find((item) => destinationIdentity(item.destination) === destinationIdentity(destination) && installKey(item.predecessor) === installKey(predecessor));
}
function incompatibilityReason(destination, predecessor, installed) {
  if (destination.manifest.type !== predecessor.type) return "Destination package type does not match the predecessor.";
  if (!destination.manifest.platforms.includes(predecessor.platform)) return "Destination package does not support the installed platform.";
  if (!destination.manifest.delivery.includes(predecessor.scope)) return "Destination package does not support the installed scope.";
  if (compareVersions(destination.manifest.version, predecessor.version) < 0) return "Destination version is older than the installed predecessor.";
  const collision = installed.some((item) => item.platform === predecessor.platform && item.scope === predecessor.scope && item.sourceId === destination.source.id && item.qualifiedName === destination.manifest.qualifiedName);
  return collision ? "Destination package is already installed for this platform and scope." : void 0;
}
function deduplicate(candidates) {
  const seen = /* @__PURE__ */ new Set();
  return candidates.filter((item) => {
    const key = `${destinationIdentity(item.destination)}:${installKey(item.predecessor)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function deduplicateIneligible(candidates) {
  const seen = /* @__PURE__ */ new Set();
  return candidates.filter((item) => {
    const key = `${destinationIdentity(item.destination)}:${installKey(item.predecessor)}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function destinationIdentity(pkg) {
  return `${pkg.source.id}:${pkg.manifest.qualifiedName}`;
}
function installKey(item) {
  return `${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}:${item.platform}:${item.scope}`;
}
function targetKey(item) {
  return `${destinationIdentity(item.destination)}:${item.predecessor.platform}:${item.predecessor.scope}`;
}
function normalizeRepoPath(value) {
  return `/${value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")}`;
}

// packages/marketplace-core/src/services/mcpConfig.ts
function mcpConfigRelativePath(platform) {
  switch (platform) {
    case "codex":
      return ".codex/config.toml";
    case "cursor":
      return ".cursor/mcp.json";
    case "github-copilot":
      return ".copilot/mcp-config.json";
    case "claude":
      return ".claude.json";
    case "deepseek-harness":
      throw new Error("DeepSeek Harness MCP servers are installed through profile bundles.");
  }
}
function readMcpHostConfig(pkg, platform, files) {
  const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
  if (!entrypoint) {
    throw new ValidationError(`MCP package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
  }
  return validateMcpEntrypoint(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.id, platform, pkg.manifest.entrypoint);
}
function validateMcpEntrypoint(content, packageId, platform, source) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ValidationError(`MCP entrypoint at ${source} must be valid JSON.`);
  }
  if (!isRecord3(parsed)) {
    throw new ValidationError(`MCP entrypoint at ${source} must be a JSON object.`);
  }
  const platformConfig = isRecord3(parsed[platform]) ? parsed[platform] : parsed;
  const servers = platform === "codex" ? platformConfig["mcp_servers"] ?? platformConfig["mcpServers"] : platformConfig["mcpServers"];
  if (!isRecord3(servers)) {
    if (looksLikeServerConfig(platformConfig)) {
      return { serverName: packageId, serverConfig: normalizeServerConfig(platform, platformConfig) };
    }
    throw new ValidationError(`MCP entrypoint at ${source} must include a supported MCP servers object or a direct MCP server config.`);
  }
  const serverNames = Object.keys(servers);
  if (serverNames.length !== 1) {
    throw new ValidationError(`MCP entrypoint at ${source} must define exactly one MCP server.`);
  }
  const serverConfig = servers[serverNames[0]];
  if (!isRecord3(serverConfig)) {
    throw new ValidationError(`MCP entrypoint at ${source} must define its MCP server as a JSON object.`);
  }
  return { serverName: packageId, serverConfig: normalizeServerConfig(platform, serverConfig) };
}
function upsertJsonMcpServer(existingContent, serverName, serverConfig, expectedExisting) {
  const config = parseExistingJsonObject(existingContent, "MCP configuration");
  const existingServers = isRecord3(config["mcpServers"]) ? config["mcpServers"] : {};
  const existing = existingServers[serverName];
  if (existing !== void 0 && (!expectedExisting || !sameJsonValue(existing, expectedExisting))) {
    throw new ValidationError(`MCP server '${serverName}' already exists and is not managed by AI Marketplace.`);
  }
  return `${JSON.stringify({
    ...config,
    mcpServers: {
      ...existingServers,
      [serverName]: serverConfig
    }
  }, null, 2)}
`;
}
function removeJsonMcpServer(existingContent, serverName, expectedServerConfig) {
  const config = parseExistingJsonObject(existingContent, "MCP configuration");
  if (!isRecord3(config["mcpServers"]) || !(serverName in config["mcpServers"])) {
    return existingContent;
  }
  if (expectedServerConfig && !sameJsonValue(config["mcpServers"][serverName], expectedServerConfig)) {
    throw new ValidationError(`MCP server '${serverName}' was changed outside AI Marketplace and will not be removed.`);
  }
  const remainingServers = { ...config["mcpServers"] };
  delete remainingServers[serverName];
  return `${JSON.stringify({ ...config, mcpServers: remainingServers }, null, 2)}
`;
}
function readClaudeHookConfig(content, source) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ValidationError(`Claude hook entrypoint at ${source} must be valid JSON.`);
  }
  if (!isRecord3(parsed) || !isRecord3(parsed["hooks"])) {
    throw new ValidationError(`Claude hook entrypoint at ${source} must contain a 'hooks' object.`);
  }
  const hooks = {};
  for (const [event, entries] of Object.entries(parsed["hooks"])) {
    if (!Array.isArray(entries)) {
      throw new ValidationError(`Claude hook entrypoint at ${source} has a non-array '${event}' hook list.`);
    }
    hooks[event] = entries;
  }
  return hooks;
}
function upsertClaudeHookConfig(existingContent, contribution) {
  const config = parseExistingJsonObject(existingContent, ".claude/settings.json");
  const existingHooks = isRecord3(config["hooks"]) ? config["hooks"] : {};
  const hooks = { ...existingHooks };
  for (const [event, entries] of Object.entries(contribution)) {
    const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
    hooks[event] = [...existing, ...entries.filter((entry) => !existing.some((candidate) => sameJsonValue(candidate, entry)))];
  }
  return `${JSON.stringify({ ...config, hooks }, null, 2)}
`;
}
function removeClaudeHookConfig(existingContent, contribution) {
  const config = parseExistingJsonObject(existingContent, ".claude/settings.json");
  if (!isRecord3(config["hooks"])) {
    return existingContent;
  }
  const hooks = { ...config["hooks"] };
  let changed = false;
  for (const [event, entries] of Object.entries(contribution)) {
    const existing = hooks[event];
    if (!Array.isArray(existing)) {
      continue;
    }
    const remaining = existing.filter((candidate) => !entries.some((entry) => sameJsonValue(candidate, entry)));
    if (remaining.length !== existing.length) {
      changed = true;
      if (remaining.length === 0) delete hooks[event];
      else hooks[event] = remaining;
    }
  }
  return changed ? `${JSON.stringify({ ...config, hooks }, null, 2)}
` : existingContent;
}
function upsertCodexMcpServer(existingContent, serverName, serverConfig, expectedExisting) {
  const base = removeCodexMcpServerUnchecked(existingContent, serverName) ?? "";
  if (existingContent !== void 0 && base !== existingContent && (!expectedExisting || normalizeToml(existingContent) !== normalizeToml(appendCodexServer(base, serverName, expectedExisting)))) {
    throw new ValidationError(`MCP server '${serverName}' already exists or changed outside AI Marketplace.`);
  }
  return appendCodexServer(base, serverName, serverConfig);
}
function appendCodexServer(base, serverName, serverConfig) {
  const separator = base.trim().length > 0 && !base.endsWith("\n\n") ? "\n" : "";
  return `${base}${separator}${codexServerToml(serverName, serverConfig)}`;
}
function normalizeToml(value) {
  return value.replace(/\r\n/g, "\n").trim();
}
function removeCodexMcpServer(existingContent, serverName, expectedExisting) {
  const base = removeCodexMcpServerUnchecked(existingContent, serverName);
  if (existingContent !== void 0 && base !== existingContent && expectedExisting && normalizeToml(existingContent) !== normalizeToml(appendCodexServer(base ?? "", serverName, expectedExisting))) {
    throw new ValidationError(`MCP server '${serverName}' changed outside AI Marketplace and will not be removed.`);
  }
  return base;
}
function removeCodexMcpServerUnchecked(existingContent, serverName) {
  if (existingContent === void 0) {
    return void 0;
  }
  const lines = existingContent.split(/\r?\n/);
  const kept = [];
  let removing = false;
  for (const line of lines) {
    const header = parseTomlTableHeader(line);
    if (header) {
      removing = isManagedCodexMcpHeader(header, serverName);
    }
    if (!removing) {
      kept.push(line);
    }
  }
  const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  return result.trim().length === 0 ? "" : `${result.replace(/\n*$/, "")}
`;
}
function parseExistingJsonObject(content, source) {
  if (!content || content.trim().length === 0) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ValidationError(`${source} must contain valid JSON.`);
  }
  if (!isRecord3(parsed)) {
    throw new ValidationError(`${source} must contain a JSON object.`);
  }
  return parsed;
}
function codexServerToml(serverName, serverConfig) {
  const lines = [];
  appendTomlTable(lines, ["mcp_servers", serverName], serverConfig);
  return `${lines.join("\n")}
`;
}
function appendTomlTable(lines, path2, record) {
  lines.push(`[${path2.map(quoteTomlKey).join(".")}]`);
  const nested = [];
  for (const [key, value] of Object.entries(record)) {
    if (isRecord3(value)) {
      nested.push([key, value]);
      continue;
    }
    lines.push(`${quoteTomlKey(key)} = ${formatTomlValue(value)}`);
  }
  for (const [key, value] of nested) {
    lines.push("");
    appendTomlTable(lines, [...path2, key], value);
  }
}
function formatTomlValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatTomlValue).join(", ")}]`;
  }
  throw new ValidationError("Codex MCP server config contains an unsupported TOML value.");
}
function quoteTomlKey(value) {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}
function parseTomlTableHeader(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]") || trimmed.startsWith("[[")) {
    return void 0;
  }
  return splitTomlDottedKey(trimmed.slice(1, -1));
}
function splitTomlDottedKey(value) {
  const parts = [];
  let current = "";
  let quoted = false;
  let escaping = false;
  for (const char of value) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (quoted && char === "\\") {
      escaping = true;
      current += char;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (!quoted && char === ".") {
      parts.push(parseTomlKeyPart(current.trim()));
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(parseTomlKeyPart(current.trim()));
  return parts;
}
function parseTomlKeyPart(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  return value;
}
function isManagedCodexMcpHeader(header, serverName) {
  return header.length >= 2 && header[0] === "mcp_servers" && header[1] === serverName;
}
function normalizeServerConfig(platform, config) {
  if (platform !== "codex") {
    return config;
  }
  const normalized = { ...config };
  if (normalized["type"] === "stdio") {
    delete normalized["type"];
  }
  return normalized;
}
function looksLikeServerConfig(value) {
  return typeof value["command"] === "string" || typeof value["url"] === "string";
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sameJsonValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord3(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

// packages/marketplace-core/src/services/harnessBundle.ts
var import_yaml2 = __toESM(require_dist());
import { createHash } from "node:crypto";
function validateHarnessBundle(pkg, files) {
  if (pkg.manifest.entrypoint !== "package.json") {
    throw new ValidationError(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' must use package.json as its entrypoint.`);
  }
  const entrypoint = files.find((file) => file.relativePath === "package.json");
  if (!entrypoint) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing package.json.`);
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(entrypoint.content).toString("utf8"));
  } catch {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid package.json.`);
  }
  if (!isRecord4(parsed) || typeof parsed.name !== "string" || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(parsed.name) || parsed.version !== pkg.manifest.version || !isRecord4(parsed.dsh) || !isRecord4(parsed.dsh.bundle)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a matching npm name, version, and dsh.bundle declaration.`);
  }
  const patch = parsed.dsh.bundle.patch;
  if (typeof patch !== "string") throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires dsh.bundle.patch.`);
  const patchPath = safeJoinRelative(patch.replace(/^\.\//, ""));
  if (!/^cordis\.patch\.ya?ml$/.test(patchPath)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must use a root cordis.patch.yml file.`);
  }
  const patchFile = files.find((file) => file.relativePath === patchPath);
  if (!patchFile) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing '${patchPath}'.`);
  const document = (0, import_yaml2.parseDocument)(Buffer.from(patchFile.content).toString("utf8"), { uniqueKeys: true });
  const patchValue = document.toJS();
  if (document.errors.length > 0 || !Array.isArray(patchValue) || patchValue.length === 0) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an invalid or empty Cordis patch.`);
  }
  const rows = patchValue.flatMap((operation) => isRecord4(operation) && Array.isArray(operation.insert) ? operation.insert : []);
  const expectedName = parsed.name;
  const hasContribution = rows.some((row) => isRecord4(row) && typeof row.id === "string" && row.id.length > 0 && typeof row.name === "string" && (row.name === expectedName || row.name.startsWith(`${expectedName}/`) || pkg.manifest.type === "mcp" && row.name === "@deepseek-ai/dsh-mcp-client"));
  if (!hasContribution) {
    throw new ValidationError(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' must insert a plugin contribution from its bundle.`);
  }
  const scripts = parsed.scripts;
  if (isRecord4(scripts) && ["preinstall", "install", "postinstall", "prepare"].some((key) => key in scripts)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must be prebuilt and contain no install lifecycle scripts.`);
  }
  const paths = /* @__PURE__ */ new Set();
  for (const file of files) {
    const path2 = safeJoinRelative(file.relativePath);
    if (paths.has(path2)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' contains duplicate file '${path2}'.`);
    paths.add(path2);
  }
  const entry = typeof parsed.main === "string" ? parsed.main : void 0;
  if (entry) {
    const mainPath = safeJoinRelative(entry.replace(/^\.\//, ""));
    if (!paths.has(mainPath)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing main module '${mainPath}'.`);
  } else if (pkg.manifest.type !== "mcp") {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a prebuilt main module.`);
  }
  const exportsValue = parsed.exports;
  if (exportsValue !== void 0 && !isRecord4(exportsValue) && typeof exportsValue !== "string") {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid exports.`);
  }
  const checkReference = (reference) => {
    if (typeof reference === "string") {
      if (!reference.startsWith("./")) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an external entrypoint reference.`);
      const target = safeJoinRelative(reference.slice(2));
      if (!paths.has(target)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing referenced file '${target}'.`);
    } else if (isRecord4(reference)) {
      for (const nested of Object.values(reference)) checkReference(nested);
    } else {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid entrypoint exports.`);
    }
  };
  if (exportsValue !== void 0) checkReference(exportsValue);
  if (isRecord4(parsed.dsh.client)) {
    if (!isRecord4(exportsValue) || exportsValue["./client"] === void 0) {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' declares dsh.client without a client export.`);
    }
  }
  for (const row of rows) {
    if (!isRecord4(row) || typeof row.name !== "string" || !row.name.startsWith(`${expectedName}/`)) continue;
    const subpath = `.${row.name.slice(expectedName.length)}`;
    if (!isRecord4(exportsValue) || exportsValue[subpath] === void 0) {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has no export for patch plugin '${row.name}'.`);
    }
  }
  const digest = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    digest.update(file.relativePath).update("\0").update(file.content).update("\0");
  }
  return { name: parsed.name, patchPath, contentSha256: digest.digest("hex") };
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/marketplace-core/src/services/packageInstaller.ts
var PackageInstaller = class {
  constructor(storage, config, fetchFiles, mcpScriptRunner, harnessProfileManager) {
    this.storage = storage;
    this.config = config;
    this.fetchFiles = fetchFiles;
    this.mcpScriptRunner = mcpScriptRunner;
    this.harnessProfileManager = harnessProfileManager;
  }
  storage;
  config;
  fetchFiles;
  mcpScriptRunner;
  harnessProfileManager;
  async listInstalled() {
    await this.recoverMigration("workspace");
    await this.recoverMigration("global");
    const workspace = await this.stateStore("workspace").read();
    const global = await this.stateStore("global").read();
    return [...workspace.packages, ...global.packages];
  }
  async install(pkg, platform, scope) {
    if (platform === "deepseek-harness") {
      this.assertHarnessDelivery(pkg, scope);
      if (pkg.manifest.type !== "skill" && pkg.manifest.type !== "rule") return this.installHarnessBundle(pkg);
      const files = await this.fetchFiles(pkg);
      this.assertHarnessDocument(pkg, files);
      if (pkg.manifest.type === "rule") {
        if (!this.harnessProfileManager) throw new Error("This host cannot activate DeepSeek Harness rules.");
        await this.harnessProfileManager.ensureBridge(this.config.deepseekHarnessProfile ?? "web");
      }
    }
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, platform, "install");
    }
    if (pkg.manifest.type === "hook" && platform === "claude") {
      return this.installClaudeHook(pkg, scope);
    }
    const installPath = scope === "cloud" ? cloudInstallPath(platform, pkg.manifest.type, pkg.manifest.id) : installRelativePath(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
    let managedConfig;
    if (scope !== "cloud") {
      await this.assertNoInstallCollision(pkg, platform, scope, installPath);
      const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), platform);
      managedConfig = codexAgentContribution(pkg, platform, files, this.config);
      await this.assertCodexAgentConfigAvailable(pkg, scope, installPath, managedConfig);
      await this.replacePackage(scope, installPath, files, pkg, platform);
    }
    const installed = {
      id: pkg.manifest.id,
      type: pkg.manifest.type,
      platform,
      scope,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      ...managedConfig === void 0 ? {} : { managedConfig },
      ...platform === "deepseek-harness" && pkg.manifest.type === "rule" ? { harnessProfile: this.config.deepseekHarnessProfile ?? "web" } : {},
      installedPath: installPath,
      installedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.stateStore(scope).upsert(installed);
    return installed;
  }
  async update(pkg, platform, scope) {
    return this.install(pkg, platform, scope);
  }
  async updateInstalled(pkg, installed) {
    if (installed.harnessBundle) {
      this.assertHarnessBundleSource(pkg, installed);
      return this.installHarnessBundle(pkg, installed);
    }
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, installed.platform, "update", installed.installedAt, installed, true, (updated2) => ({
        ...updated2,
        autoUpdate: void 0,
        autoUpdateChangedAt: void 0,
        revertedAt: void 0,
        revertedFromVersion: void 0
      }));
    }
    const updated = await this.mutateInstalled(pkg, installed);
    const current = {
      ...updated,
      autoUpdate: void 0,
      autoUpdateChangedAt: void 0,
      revertedAt: void 0,
      revertedFromVersion: void 0
    };
    await this.stateStore(installed.scope).upsert(current);
    return current;
  }
  async revertInstalled(pkg, installed, expectedRevision) {
    if (pkg.sourceRevision === void 0 || pkg.sourceRevision !== expectedRevision) {
      throw new Error("Rollback snapshot revision does not match the current manifest previous_version.");
    }
    if (installed.harnessBundle) {
      this.assertHarnessBundleSource(pkg, installed);
      return this.installHarnessBundle(pkg, installed, true);
    }
    this.assertCompatibleRollback(pkg, installed);
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, installed.platform, "revert", installed.installedAt, installed, true, (updated2) => ({
        ...updated2,
        autoUpdate: false,
        autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(),
        revertedAt: (/* @__PURE__ */ new Date()).toISOString(),
        revertedFromVersion: installed.version
      }));
    }
    const updated = await this.mutateInstalled(pkg, installed);
    const reverted = {
      ...updated,
      autoUpdate: false,
      autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(),
      revertedAt: (/* @__PURE__ */ new Date()).toISOString(),
      revertedFromVersion: installed.version
    };
    await this.stateStore(installed.scope).upsert(reverted);
    return reverted;
  }
  /** Replaces an explicitly declared predecessor while preserving its target and user metadata. */
  async migrateInstalled(pkg, predecessor) {
    if (!(pkg.manifest.migrations ?? []).some((migration) => matchesMigration(pkg, migration, predecessor))) {
      throw new Error("Destination package does not declare the selected predecessor.");
    }
    if (pkg.manifest.type !== predecessor.type || !pkg.manifest.platforms.includes(predecessor.platform) || !pkg.manifest.delivery.includes(predecessor.scope) || compareVersions(pkg.manifest.version, predecessor.version) < 0) {
      throw new Error("Destination package is not compatible with the selected predecessor installation.");
    }
    if (predecessor.harnessBundle) return this.migrateHarnessBundle(pkg, predecessor);
    if (predecessor.platform === "codex" && predecessor.type === "agent") {
      throw new Error("Codex agent identity migrations are not yet supported; uninstall the predecessor before installing the destination.");
    }
    if (!isCanonicalInstalledPath(predecessor, this.config)) throw new Error("Installed predecessor uses an unexpected managed path.");
    const files = await this.fetchFiles(pkg);
    assertMcpPackageScripts(pkg, files);
    const offloaded = predecessor.installedPath.startsWith(".offload/");
    const targetPath = predecessor.type === "mcp" ? predecessor.installedPath : predecessor.scope === "cloud" ? cloudInstallPath(predecessor.platform, predecessor.type, pkg.manifest.id) : offloaded ? offloadRelativePath(predecessor.platform, predecessor.type, pkg.manifest.id) : installRelativePath(predecessor.platform, predecessor.type, pkg.manifest.id, this.config.platformPathOverrides);
    await this.assertMigrationDestinationAvailable(pkg, predecessor, targetPath);
    const operationId = randomUUID();
    const journalPath = migrationJournalPath();
    const backupRoot = `.ai_marketplace/migrations/${operationId}`;
    const payloadBackup = predecessor.scope === "cloud" || predecessor.type === "mcp" ? void 0 : `${backupRoot}/payload`;
    const configPath2 = migrationConfigPath(predecessor);
    const configBackup = configPath2 ? `${backupRoot}/config` : void 0;
    const existingConfig = configPath2 ? await this.readOptionalText(predecessor.scope, configPath2) : void 0;
    const nextConfig = !configPath2 ? void 0 : predecessor.type === "mcp" ? this.migratedMcpConfig(pkg, predecessor, files, existingConfig) : this.migratedClaudeHookConfig(pkg, predecessor, files, existingConfig);
    if (predecessor.type === "mcp") {
      const destinationPayload = mcpPayloadRelativePath(predecessor.platform, pkg.source.id, pkg.manifest.id);
      if (await this.storage.exists("global", destinationPayload) && predecessor.managedPayloadPath !== destinationPayload) {
        throw new Error(`Managed MCP payload path '${destinationPayload}' already exists without matching installed ownership.`);
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const next = this.migratedRecord(pkg, predecessor, targetPath, now, files);
    const journal = { operationId, previous: migrationJournalPrevious(predecessor), next: migrationJournalNext(next), targetPath, payloadBackup, configPath: configPath2, configBackup };
    await this.writeText(predecessor.scope, journalPath, `${JSON.stringify(journal, null, 2)}
`);
    let preparedMcpPayload;
    let stateCommitted = false;
    try {
      if (predecessor.type === "mcp") {
        if (predecessor.managedPayloadPath) {
          await this.runMcpScript(predecessor.managedPayloadPath, mcpUninstallScript, "migrate", predecessor.platform);
        }
        preparedMcpPayload = await this.prepareMcpPayload(pkg, predecessor.platform, files, "migrate", predecessor.managedPayloadPath);
      }
      if (configPath2) {
        if (await this.storage.exists(predecessor.scope, configPath2)) await this.storage.move(predecessor.scope, configPath2, configBackup);
      }
      if (payloadBackup && await this.storage.exists(predecessor.scope, predecessor.installedPath)) {
        await this.storage.move(predecessor.scope, predecessor.installedPath, payloadBackup);
      }
      if (nextConfig !== void 0 && configPath2) await this.writeText(predecessor.scope, configPath2, nextConfig);
      if (predecessor.scope !== "cloud" && predecessor.type !== "mcp") {
        await this.replacePackage(predecessor.scope, targetPath, filterPackageFilesForPlatform(files, predecessor.platform), pkg, predecessor.platform);
      }
      await this.stateStore(predecessor.scope).replace(predecessor, next);
      stateCommitted = true;
      if (predecessor.type === "mcp" && preparedMcpPayload) {
        if (predecessor.managedPayloadPath && predecessor.managedPayloadPath !== preparedMcpPayload.path) {
          await this.storage.remove("global", predecessor.managedPayloadPath).catch(() => void 0);
        }
        await this.commitMcpPayload(preparedMcpPayload);
      }
      await this.storage.remove(predecessor.scope, backupRoot).catch(() => void 0);
      await this.storage.remove(predecessor.scope, journalPath).catch(() => void 0);
      return next;
    } catch (error) {
      if (preparedMcpPayload && !stateCommitted) await this.rollbackMcpPayload(preparedMcpPayload).catch(() => void 0);
      await this.rollbackMigration(journal).catch(() => void 0);
      throw error;
    }
  }
  async mutateInstalled(pkg, installed) {
    let updated;
    if (pkg.manifest.type === "hook" && installed.platform === "claude") {
      updated = isOffloaded(installed) ? await this.updateOffloadedClaudeHook(pkg, installed) : await this.installClaudeHook(pkg, installed.scope, installed.installedAt, installed, false);
    } else {
      if (installed.scope !== "cloud") {
        const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), installed.platform);
        if (installed.platform === "deepseek-harness" && (installed.type === "skill" || installed.type === "rule")) {
          this.assertHarnessDocument(pkg, files);
          if (installed.type === "rule") await this.harnessProfileManager?.ensureBridge(installed.harnessProfile ?? "web");
        }
        const managedConfig = codexAgentContribution(pkg, installed.platform, files, this.config);
        await this.assertCodexAgentConfigAvailable(pkg, installed.scope, installed.installedPath, managedConfig, installed);
        await this.replacePackage(installed.scope, installed.installedPath, files, pkg, installed.platform);
        updated = {
          ...installed,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...sourceMetadata(pkg),
          ...managedConfig === void 0 ? {} : { managedConfig }
        };
        return updated;
      }
      updated = {
        ...installed,
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg)
      };
    }
    return updated;
  }
  async uninstall(installed) {
    if (installed.harnessBundle) {
      await this.uninstallHarnessBundle(installed);
      return;
    }
    if (installed.type === "mcp") {
      await this.uninstallMcp(installed);
      return;
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.uninstallClaudeHook(installed);
      return;
    }
    if (installed.scope !== "cloud") {
      await this.assertManagedCodexAgentConfigUnmodified(installed);
      for (const path2 of uninstallTargetPaths(installed, this.config)) {
        await this.deleteRelativeDirectory(installed.scope, path2);
      }
    }
    await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
  }
  async offload(installed) {
    if (installed.harnessBundle) return this.offloadHarnessBundle(installed);
    if (installed.scope === "cloud") {
      throw new Error("Cloud packages cannot be offloaded.");
    }
    if (installed.type === "mcp") {
      throw new Error("MCP packages cannot be offloaded.");
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.removeClaudeHookContribution(installed);
    }
    await this.assertManagedCodexAgentConfigUnmodified(installed);
    const offloadPath = offloadRelativePath(installed.platform, installed.type, installed.id);
    await this.moveDirectory(installed.scope, installed.installedPath, offloadPath);
    if (installed.managedConfig?.kind === "codex-agent") {
      await this.deleteRelativeDirectory(installed.scope, installed.managedConfig.configPath);
    }
    const moved = {
      ...installed,
      installedPath: offloadPath,
      hotloaded: false,
      offloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.stateStore(installed.scope).upsert(moved);
    return moved;
  }
  async hotload(installed) {
    if (installed.harnessBundle) return this.hotloadHarnessBundle(installed);
    if (installed.scope === "cloud") {
      throw new Error("Cloud packages cannot be hotloaded.");
    }
    if (installed.type === "mcp") {
      throw new Error("MCP packages cannot be hotloaded.");
    }
    if (installed.platform === "deepseek-harness" && installed.type === "rule") {
      if (!this.harnessProfileManager) throw new Error("This host cannot activate DeepSeek Harness rules.");
      await this.harnessProfileManager.ensureBridge(installed.harnessProfile ?? "web");
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.restoreClaudeHookContribution(installed);
    }
    await this.assertManagedCodexAgentConfigUnmodified(installed);
    const activePath = installRelativePath(installed.platform, installed.type, installed.id, this.config.platformPathOverrides);
    if (installed.managedConfig?.kind === "codex-agent" && await this.storage.exists(installed.scope, installed.managedConfig.configPath)) {
      throw new Error(`Codex agent config '${installed.managedConfig.configPath}' already exists while the package is offloaded.`);
    }
    await this.moveDirectory(installed.scope, installed.installedPath, activePath);
    if (installed.managedConfig?.kind === "codex-agent") {
      await this.materializeCodexAgentConfig(installed.scope, activePath, installed.id, installed.managedConfig);
    }
    const moved = {
      ...installed,
      installedPath: activePath,
      hotloaded: true,
      hotloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.stateStore(installed.scope).upsert(moved);
    return moved;
  }
  assertHarnessDelivery(pkg, scope) {
    if (!pkg.manifest.platforms.includes("deepseek-harness") || !pkg.manifest.delivery.includes(scope) || scope === "cloud") {
      throw new Error(`DeepSeek Harness package '${pkg.manifest.id}' does not support ${scope} delivery.`);
    }
    if (scope === "workspace" && pkg.manifest.type !== "skill" && pkg.manifest.type !== "rule") {
      throw new Error(`DeepSeek Harness ${pkg.manifest.type} packages require global profile delivery.`);
    }
  }
  assertHarnessDocument(pkg, files) {
    const entry = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entry || !pkg.manifest.entrypoint.toLowerCase().endsWith(".md")) {
      throw new Error(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' requires a Markdown entrypoint.`);
    }
    if (pkg.manifest.type === "skill" && pkg.manifest.entrypoint !== "SKILL.md") {
      throw new Error(`DeepSeek Harness skill '${pkg.manifest.id}' must use SKILL.md as its entrypoint.`);
    }
    if (pkg.manifest.type === "rule" && pkg.manifest.entrypoint !== "RULE.md") {
      throw new Error(`DeepSeek Harness rule '${pkg.manifest.id}' must use RULE.md as its entrypoint.`);
    }
  }
  assertHarnessBundleSource(pkg, installed) {
    if (installed.platform !== "deepseek-harness" || installed.scope !== "global" || pkg.source.id !== installed.sourceId || pkg.manifest.qualifiedName !== installed.qualifiedName || pkg.manifest.id !== installed.id || pkg.manifest.type !== installed.type || sourceRepository(pkg) !== installed.sourceRepo || pkg.source.branch !== installed.sourceBranch || pkg.sourcePath !== installed.sourcePath || !isCanonicalInstalledPath(installed, this.config)) {
      throw new Error("DeepSeek Harness bundle source or installed path does not match Marketplace ownership.");
    }
  }
  async migrateHarnessBundle(pkg, predecessor) {
    this.assertHarnessDelivery(pkg, "global");
    if (!this.harnessProfileManager || !predecessor.harnessBundle || !isCanonicalInstalledPath(predecessor, this.config)) {
      throw new Error("DeepSeek Harness bundle migration requires a valid owned profile installation.");
    }
    await this.assertHarnessBundleUnmodified(predecessor);
    const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), "deepseek-harness").filter((file) => !isRootManifestFile(file.relativePath));
    const bundle = validateHarnessBundle(pkg, files);
    const offloaded = isOffloaded(predecessor);
    const targetPath = offloaded ? offloadRelativePath("deepseek-harness", pkg.manifest.type, pkg.manifest.id) : installRelativePath("deepseek-harness", pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
    await this.assertMigrationDestinationAvailable(pkg, predecessor, targetPath);
    const profile = predecessor.harnessBundle.profile;
    const backupPath = `${predecessor.installedPath}.backup-${randomUUID()}`;
    await this.storage.move("global", predecessor.installedPath, backupPath);
    let removed = false;
    let added = false;
    try {
      if (!offloaded) {
        await this.harnessProfileManager.remove(profile, predecessor.harnessBundle.name, predecessor.installedPath);
        removed = true;
      }
      await this.replaceDirectory("global", targetPath, files);
      if (!offloaded) {
        await this.harnessProfileManager.add(profile, bundle.name, targetPath);
        added = true;
      }
      const migrated = {
        ...predecessor,
        id: pkg.manifest.id,
        type: pkg.manifest.type,
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg),
        installedPath: targetPath,
        harnessBundle: {
          profile,
          name: bundle.name,
          contentSha256: bundle.contentSha256,
          files: files.map((file) => ({ path: file.relativePath, sha256: sha256(file.content) }))
        },
        migrationHistory: [...predecessor.migrationHistory ?? [], {
          migratedAt: (/* @__PURE__ */ new Date()).toISOString(),
          from: migrationSnapshot(predecessor),
          to: migrationSnapshotForPackage(pkg)
        }]
      };
      await this.stateStore("global").replace(predecessor, migrated);
      await this.storage.remove("global", backupPath).catch(() => void 0);
      return migrated;
    } catch (error) {
      if (added) await this.harnessProfileManager.remove(profile, bundle.name, targetPath).catch(() => void 0);
      await this.storage.remove("global", targetPath).catch(() => void 0);
      await this.storage.move("global", backupPath, predecessor.installedPath).catch(() => void 0);
      if (removed) await this.harnessProfileManager.add(profile, predecessor.harnessBundle.name, predecessor.installedPath).catch(() => void 0);
      throw error;
    }
  }
  async installHarnessBundle(pkg, previous, revert = false) {
    this.assertHarnessDelivery(pkg, "global");
    const manager = this.harnessProfileManager;
    if (!manager) throw new Error("This host cannot manage DeepSeek Harness profiles.");
    if (previous) await this.assertHarnessBundleUnmodified(previous);
    const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), "deepseek-harness").filter((file) => !isRootManifestFile(file.relativePath));
    const bundle = validateHarnessBundle(pkg, files);
    const profile = previous?.harnessBundle?.profile ?? this.config.deepseekHarnessProfile ?? "web";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(profile)) throw new Error("Invalid DeepSeek Harness profile name.");
    const activePath = installRelativePath("deepseek-harness", pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
    const targetPath = previous?.installedPath.startsWith(".offload/") ? offloadRelativePath("deepseek-harness", pkg.manifest.type, pkg.manifest.id) : activePath;
    await this.assertNoInstallCollision(pkg, "deepseek-harness", "global", targetPath);
    const allInstalled = await this.listInstalled();
    if (allInstalled.some((item) => !(previous && item.id === previous.id && item.sourceId === previous.sourceId && item.platform === previous.platform && item.scope === previous.scope) && item.harnessBundle?.profile === profile && item.harnessBundle.name === bundle.name)) {
      throw new Error(`DeepSeek Harness bundle '${bundle.name}' is already owned by another Marketplace package.`);
    }
    if (!previous && await this.storage.exists("global", targetPath)) {
      throw new Error(`DeepSeek Harness bundle path '${targetPath}' exists without Marketplace ownership.`);
    }
    const backupPath = `${targetPath}.backup-${randomUUID()}`;
    const hadPrevious = previous !== void 0 && await this.storage.exists("global", targetPath);
    if (hadPrevious) await this.storage.move("global", targetPath, backupPath);
    let added = false;
    try {
      await this.replaceDirectory("global", targetPath, files);
      if (!targetPath.startsWith(".offload/")) {
        if (previous?.harnessBundle && previous.harnessBundle.name !== bundle.name) {
          await manager.remove(profile, previous.harnessBundle.name, targetPath);
        }
        await manager.add(profile, bundle.name, targetPath);
        added = true;
      }
      const installed = {
        id: pkg.manifest.id,
        type: pkg.manifest.type,
        platform: "deepseek-harness",
        scope: "global",
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg),
        installedPath: targetPath,
        installedAt: previous?.installedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
        harnessBundle: {
          profile,
          name: bundle.name,
          contentSha256: bundle.contentSha256,
          files: files.map((file) => ({ path: file.relativePath, sha256: sha256(file.content) }))
        },
        ...previous?.hotloaded === void 0 ? {} : { hotloaded: previous.hotloaded },
        ...revert ? { autoUpdate: false, autoUpdateChangedAt: (/* @__PURE__ */ new Date()).toISOString(), revertedAt: (/* @__PURE__ */ new Date()).toISOString(), revertedFromVersion: previous.version } : {}
      };
      await this.stateStore("global").upsert(installed);
      if (hadPrevious) await this.storage.remove("global", backupPath).catch(() => void 0);
      return installed;
    } catch (error) {
      if (added) await manager.remove(profile, bundle.name, targetPath).catch(() => void 0);
      await this.storage.remove("global", targetPath).catch(() => void 0);
      if (hadPrevious) {
        await this.storage.move("global", backupPath, targetPath).catch(() => void 0);
        if (previous?.harnessBundle && !previous.installedPath.startsWith(".offload/")) {
          await manager.add(profile, previous.harnessBundle.name, targetPath).catch(() => void 0);
        }
      }
      throw error;
    }
  }
  async assertHarnessBundleUnmodified(installed) {
    const bundle = installed.harnessBundle;
    if (!bundle || installed.platform !== "deepseek-harness" || installed.scope !== "global") {
      throw new Error("Invalid DeepSeek Harness bundle ownership metadata.");
    }
    if (!this.storage.listFiles) throw new Error("This host cannot verify DeepSeek Harness bundle ownership.");
    const actualPaths = (await this.storage.listFiles("global", installed.installedPath)).map((path2) => safeJoinRelative(path2)).sort();
    const ownedPaths = bundle.files.map((file) => safeJoinRelative(file.path)).sort();
    if (actualPaths.length !== ownedPaths.length || actualPaths.some((path2, index) => path2 !== ownedPaths[index])) {
      throw new Error(`DeepSeek Harness bundle '${bundle.name}' contains unowned or missing files.`);
    }
    for (const file of bundle.files) {
      const relativePath = safeJoinRelative(installed.installedPath, file.path);
      const content = await this.storage.readFile("global", relativePath);
      if (!content || sha256(content) !== file.sha256) {
        throw new Error(`DeepSeek Harness bundle '${bundle.name}' was modified after installation.`);
      }
    }
  }
  async uninstallHarnessBundle(installed) {
    await this.assertHarnessBundleUnmodified(installed);
    const bundle = installed.harnessBundle;
    const manager = this.harnessProfileManager;
    if (!installed.installedPath.startsWith(".offload/")) {
      if (!manager) throw new Error("This host cannot manage DeepSeek Harness profiles.");
      await manager.remove(bundle.profile, bundle.name, installed.installedPath);
    }
    try {
      await this.stateStore("global").remove(installed.id, installed.platform, installed.scope, installed.sourceId);
      await this.storage.remove("global", installed.installedPath);
    } catch (error) {
      await this.stateStore("global").upsert(installed).catch(() => void 0);
      if (!installed.installedPath.startsWith(".offload/") && manager) {
        await manager.add(bundle.profile, bundle.name, installed.installedPath).catch(() => void 0);
      }
      throw error;
    }
  }
  async offloadHarnessBundle(installed) {
    await this.assertHarnessBundleUnmodified(installed);
    if (!this.harnessProfileManager) throw new Error("This host cannot manage DeepSeek Harness profiles.");
    const bundle = installed.harnessBundle;
    const offloadPath = offloadRelativePath("deepseek-harness", installed.type, installed.id);
    if (await this.storage.exists("global", offloadPath)) throw new Error(`Offload path '${offloadPath}' already exists.`);
    await this.harnessProfileManager.remove(bundle.profile, bundle.name, installed.installedPath);
    try {
      await this.moveDirectory("global", installed.installedPath, offloadPath);
      const moved = { ...installed, installedPath: offloadPath, hotloaded: false, offloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await this.stateStore("global").upsert(moved);
      return moved;
    } catch (error) {
      if (await this.storage.exists("global", offloadPath)) {
        await this.moveDirectory("global", offloadPath, installed.installedPath).catch(() => void 0);
      }
      await this.harnessProfileManager.add(bundle.profile, bundle.name, installed.installedPath).catch(() => void 0);
      throw error;
    }
  }
  async hotloadHarnessBundle(installed) {
    await this.assertHarnessBundleUnmodified(installed);
    if (!this.harnessProfileManager) throw new Error("This host cannot manage DeepSeek Harness profiles.");
    const bundle = installed.harnessBundle;
    const activePath = installRelativePath("deepseek-harness", installed.type, installed.id, this.config.platformPathOverrides);
    if (await this.storage.exists("global", activePath)) throw new Error(`Active path '${activePath}' already exists.`);
    await this.moveDirectory("global", installed.installedPath, activePath);
    let added = false;
    try {
      await this.harnessProfileManager.add(bundle.profile, bundle.name, activePath);
      added = true;
      const moved = { ...installed, installedPath: activePath, hotloaded: true, hotloadRequestedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await this.stateStore("global").upsert(moved);
      return moved;
    } catch (error) {
      if (added) await this.harnessProfileManager.remove(bundle.profile, bundle.name, activePath).catch(() => void 0);
      await this.moveDirectory("global", activePath, installed.installedPath).catch(() => void 0);
      throw error;
    }
  }
  stateStore(scope) {
    return new InstalledStateStore(this.storage, scope);
  }
  async installMcp(pkg, platform, action, installedAt = (/* @__PURE__ */ new Date()).toISOString(), previous, persistState = true, transform = (installed) => installed) {
    await this.assertNoMcpCollision(pkg, platform, previous);
    const files = await this.fetchFiles(pkg);
    assertMcpPackageScripts(pkg, files);
    const hostConfig = readMcpHostConfig(pkg, platform, files);
    const installedPath = mcpConfigRelativePath(platform);
    const existingContent = await this.readOptionalText("global", installedPath);
    const nextContent = platform === "codex" ? upsertCodexMcpServer(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig(previous)?.serverConfig) : upsertJsonMcpServer(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig(previous)?.serverConfig);
    const preparedPayload = await this.prepareMcpPayload(pkg, platform, files, action, previous?.managedPayloadPath);
    let configWritten = false;
    try {
      await this.writeText("global", installedPath, nextContent);
      configWritten = true;
      const installed = transform({
        id: pkg.manifest.id,
        type: "mcp",
        platform,
        scope: "global",
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg),
        managedConfig: { kind: "mcp", serverName: hostConfig.serverName, serverConfig: hostConfig.serverConfig },
        managedPayloadPath: preparedPayload.path,
        installedPath,
        installedAt
      });
      if (persistState) await this.stateStore("global").upsert(installed);
      await this.removeLegacyMcpInstallations(pkg.manifest.id, platform, installedPath).catch(() => void 0);
      await this.commitMcpPayload(preparedPayload);
      return installed;
    } catch (error) {
      await this.rollbackMcpPayload(preparedPayload).catch(() => void 0);
      if (configWritten) {
        if (existingContent === void 0) await this.storage.remove("global", installedPath).catch(() => void 0);
        else await this.writeText("global", installedPath, existingContent).catch(() => void 0);
      }
      throw error;
    }
  }
  async uninstallMcp(installed) {
    const configPath2 = mcpConfigRelativePath(installed.platform);
    if (installed.scope !== "global" || installed.installedPath !== configPath2) {
      for (const path2 of uninstallTargetPaths(installed, this.config)) {
        await this.deleteRelativeDirectory(installed.scope, path2);
      }
      await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
      return;
    }
    if (installed.managedPayloadPath) {
      if (!installed.sourceId || installed.managedPayloadPath !== mcpPayloadRelativePath(installed.platform, installed.sourceId, installed.id)) {
        throw new Error(`MCP package '${installed.id}' has an unexpected managed payload path and will not execute it.`);
      }
      await this.runMcpScript(installed.managedPayloadPath, mcpUninstallScript, "uninstall", installed.platform);
    }
    const existingContent = await this.readOptionalText("global", configPath2);
    const nextContent = installed.platform === "codex" ? removeCodexMcpServer(existingContent, installed.id) : removeJsonMcpServer(existingContent, installed.id, managedMcpConfig(installed)?.serverConfig);
    if (nextContent !== void 0 && nextContent !== existingContent) {
      await this.writeText("global", configPath2, nextContent);
    }
    await this.stateStore("global").remove(installed.id, installed.platform, "global", installed.sourceId);
    if (installed.managedPayloadPath) await this.storage.remove("global", installed.managedPayloadPath);
  }
  async prepareMcpPayload(pkg, platform, files, action, existingOwnerPath) {
    const path2 = mcpPayloadRelativePath(platform, pkg.source.id, pkg.manifest.id);
    const backupPath = `${path2}.backup-${randomUUID()}`;
    const hadPrevious = await this.storage.exists("global", path2);
    if (hadPrevious && existingOwnerPath !== path2) {
      throw new Error(`Managed MCP payload path '${path2}' already exists without matching installed ownership.`);
    }
    if (hadPrevious) await this.storage.move("global", path2, backupPath);
    try {
      await this.replaceDirectory("global", path2, files);
      await this.runMcpScript(path2, mcpInstallScript, action, platform);
      return { path: path2, ...hadPrevious ? { backupPath } : {} };
    } catch (error) {
      await this.storage.remove("global", path2).catch(() => void 0);
      if (hadPrevious && await this.storage.exists("global", backupPath)) {
        await this.storage.move("global", backupPath, path2).catch(() => void 0);
      }
      throw error;
    }
  }
  async commitMcpPayload(prepared) {
    if (prepared.backupPath) await this.storage.remove("global", prepared.backupPath).catch(() => void 0);
  }
  async rollbackMcpPayload(prepared) {
    await this.storage.remove("global", prepared.path);
    if (prepared.backupPath && await this.storage.exists("global", prepared.backupPath)) {
      await this.storage.move("global", prepared.backupPath, prepared.path);
    }
  }
  async runMcpScript(packagePath, script, action, platform) {
    if (!this.mcpScriptRunner) throw new Error("This host cannot execute MCP package lifecycle scripts.");
    await this.mcpScriptRunner.run({ scope: "global", packagePath, script, action, platform, timeoutMs: mcpScriptTimeoutMs });
  }
  async removeLegacyMcpInstallations(id, platform, configPath2) {
    for (const scope of ["workspace", "global"]) {
      const stateStore = this.stateStore(scope);
      const legacy = (await stateStore.read()).packages.filter(
        (item) => item.id === id && item.type === "mcp" && item.platform === platform && item.installedPath !== configPath2
      );
      for (const installed of legacy) {
        for (const path2 of uninstallTargetPaths(installed, this.config)) {
          await this.deleteRelativeDirectory(scope, path2);
        }
        await stateStore.removeInstalled(installed);
      }
    }
  }
  async installClaudeHook(pkg, scope, installedAt = (/* @__PURE__ */ new Date()).toISOString(), previous, persistState = true) {
    const files = await this.fetchFiles(pkg);
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    const contribution = readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
    const installPath = installRelativePath("claude", "hook", pkg.manifest.id, this.config.platformPathOverrides);
    await this.assertNoInstallCollision(pkg, "claude", scope, installPath);
    await this.replacePackage(scope, installPath, files, pkg, "claude");
    const settingsPath = ".claude/settings.json";
    const settings = await this.readOptionalText(scope, settingsPath);
    if (previous?.managedConfig?.kind === "hook") {
      const withoutPrevious = removeClaudeHookConfig(settings, previous.managedConfig.hooks);
      await this.writeText(scope, settingsPath, upsertClaudeHookConfig(withoutPrevious, contribution));
    } else {
      await this.writeText(scope, settingsPath, upsertClaudeHookConfig(settings, contribution));
    }
    const installed = {
      id: pkg.manifest.id,
      type: "hook",
      platform: "claude",
      scope,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      managedConfig: { kind: "hook", hooks: contribution },
      installedPath: installPath,
      installedAt
    };
    if (persistState) {
      await this.stateStore(scope).upsert(installed);
    }
    return installed;
  }
  async updateOffloadedClaudeHook(pkg, installed) {
    const files = await this.fetchFiles(pkg);
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    const contribution = readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
    await this.replacePackage(installed.scope, installed.installedPath, files, pkg, "claude");
    return {
      ...installed,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      managedConfig: { kind: "hook", hooks: contribution }
    };
  }
  async uninstallClaudeHook(installed) {
    await this.removeClaudeHookContribution(installed);
    for (const target of uninstallTargetPaths(installed, this.config)) {
      await this.deleteRelativeDirectory(installed.scope, target);
    }
    await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
  }
  async removeClaudeHookContribution(installed) {
    if (installed.managedConfig?.kind !== "hook") {
      throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and will not be removed.`);
    }
    const settingsPath = ".claude/settings.json";
    const existing = await this.readOptionalText(installed.scope, settingsPath);
    const next = removeClaudeHookConfig(existing, installed.managedConfig.hooks);
    if (next !== void 0 && next !== existing) {
      await this.writeText(installed.scope, settingsPath, next);
    }
  }
  async restoreClaudeHookContribution(installed) {
    if (installed.managedConfig?.kind !== "hook") {
      throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and cannot be hotloaded.`);
    }
    const settingsPath = ".claude/settings.json";
    const existing = await this.readOptionalText(installed.scope, settingsPath);
    await this.writeText(installed.scope, settingsPath, upsertClaudeHookConfig(existing, installed.managedConfig.hooks));
  }
  async replacePackage(scope, installPath, files, pkg, platform) {
    const payloadFiles = files.filter((file) => !isRootManifestFile(file.relativePath));
    const codexAgent = codexAgentContribution(pkg, platform, files, this.config);
    if (codexAgent) {
      const entrypoint2 = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint);
      await this.replaceDirectory(scope, installPath, payloadFiles);
      const activePath = installRelativePath(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
      if (installPath === activePath) await this.storage.writeFileAtomic(scope, codexAgent.configPath, entrypoint2.content);
      return;
    }
    if (platform !== "claude" || !isClaudeFlatFilePackage(pkg)) {
      await this.replaceDirectory(scope, installPath, payloadFiles);
      return;
    }
    const entrypoint = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    if (payloadFiles.some((file) => file !== entrypoint)) {
      throw new Error(`Claude ${pkg.manifest.type} package '${pkg.manifest.id}' must contain only its Markdown entrypoint.`);
    }
    await this.deleteRelativeDirectory(scope, installPath);
    await this.storage.writeFile(scope, installPath, entrypoint.content);
  }
  async assertCodexAgentConfigAvailable(pkg, scope, installPath, contribution, knownOwner) {
    if (contribution?.kind !== "codex-agent" || !await this.storage.exists(scope, contribution.configPath)) return;
    const owner = knownOwner ?? (await this.listInstalled()).find(
      (item) => item.type === "agent" && item.platform === "codex" && item.scope === scope && item.installedPath === installPath && item.sourceId === pkg.source.id && (item.qualifiedName ?? item.id) === pkg.manifest.qualifiedName
    );
    if (owner?.managedConfig?.kind !== "codex-agent") {
      throw new Error(`Codex agent config '${contribution.configPath}' already exists without matching installed ownership.`);
    }
    await this.assertManagedCodexAgentConfigUnmodified(owner);
  }
  async assertManagedCodexAgentConfigUnmodified(installed) {
    const managed = installed.managedConfig;
    if (managed?.kind !== "codex-agent") return;
    const expectedPath = codexAgentConfigRelativePath(installed.id, this.config.platformPathOverrides);
    if (installed.platform !== "codex" || installed.type !== "agent" || managed.configPath !== expectedPath || !/^[0-9a-f]{64}$/.test(managed.contentSha256)) {
      throw new Error(`Codex agent '${installed.id}' has invalid managed config ownership metadata.`);
    }
    const content = await this.storage.readFile(installed.scope, managed.configPath);
    if (content === void 0) return;
    if (sha256(content) !== managed.contentSha256) {
      throw new Error(`Codex agent config '${managed.configPath}' was modified after installation; refusing to overwrite or remove it.`);
    }
  }
  async materializeCodexAgentConfig(scope, activePath, packageId, managed) {
    const content = await this.storage.readFile(scope, safeJoinRelative(activePath, `${packageId}.toml`));
    if (content === void 0 || sha256(content) !== managed.contentSha256) {
      throw new Error(`Codex agent '${packageId}' managed payload does not match its recorded TOML config.`);
    }
    await this.storage.writeFileAtomic(scope, managed.configPath, content);
  }
  async assertNoInstallCollision(pkg, platform, scope, installPath) {
    const collision = (await this.listInstalled()).find(
      (item) => item.platform === platform && item.scope === scope && item.installedPath === installPath && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName)
    );
    if (collision) {
      throw new Error(`Install path '${installPath}' is already managed by '${collision.qualifiedName ?? collision.id}' from another source.`);
    }
  }
  async assertMigrationDestinationAvailable(pkg, predecessor, destination) {
    const state = await this.stateStore(predecessor.scope).read();
    const collision = state.packages.find((item) => item.platform === predecessor.platform && item.scope === predecessor.scope && item.sourceId === pkg.source.id && item.qualifiedName === pkg.manifest.qualifiedName);
    if (collision) throw new Error(`Destination package '${pkg.manifest.qualifiedName}' is already installed.`);
    const pathOwner = state.packages.find((item) => item.platform === predecessor.platform && item.installedPath === destination && !(item.id === predecessor.id && item.sourceId === predecessor.sourceId && item.qualifiedName === predecessor.qualifiedName && item.sourceRepo === predecessor.sourceRepo && item.sourceBranch === predecessor.sourceBranch && item.sourcePath === predecessor.sourcePath));
    if (pathOwner) throw new Error(`Managed destination '${destination}' is already owned by '${pathOwner.sourceId ?? "legacy"}:${pathOwner.qualifiedName ?? pathOwner.id}'.`);
    if (destination !== predecessor.installedPath && !pathOwner && await this.storage.exists(predecessor.scope, destination)) {
      throw new Error(`Managed destination '${destination}' already exists without marketplace ownership.`);
    }
  }
  migratedRecord(pkg, predecessor, installedPath, migratedAt, files) {
    const { revertedAt: _revertedAt, revertedFromVersion: _revertedFromVersion, managedConfig: _managedConfig, managedPayloadPath: _managedPayloadPath, sourceRevision: _sourceRevision, ...preserved } = predecessor;
    const managedConfig = pkg.manifest.type === "mcp" ? (() => {
      const config = readMcpHostConfig(pkg, predecessor.platform, files);
      return { kind: "mcp", serverName: config.serverName, serverConfig: config.serverConfig };
    })() : pkg.manifest.type === "hook" && predecessor.platform === "claude" ? (() => {
      const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
      if (!entrypoint) throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
      return { kind: "hook", hooks: readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint) };
    })() : void 0;
    return {
      ...preserved,
      id: pkg.manifest.id,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...pkg.sourceRevision ? { sourceRevision: pkg.sourceRevision } : {},
      ...sourceMetadata(pkg),
      installedPath,
      ...pkg.manifest.type === "mcp" ? { managedPayloadPath: mcpPayloadRelativePath(predecessor.platform, pkg.source.id, pkg.manifest.id) } : {},
      ...managedConfig === void 0 ? {} : { managedConfig },
      migrationHistory: [...predecessor.migrationHistory ?? [], { migratedAt, from: migrationSnapshot(predecessor), to: migrationSnapshotForPackage(pkg) }]
    };
  }
  migratedMcpConfig(pkg, predecessor, files, existing) {
    const previous = managedMcpConfig(predecessor);
    if (!previous) throw new Error(`MCP package '${predecessor.id}' has no tracked configuration contribution and cannot be migrated safely.`);
    const next = readMcpHostConfig(pkg, predecessor.platform, files);
    const removed = predecessor.platform === "codex" ? removeCodexMcpServer(existing, previous.serverName, previous.serverConfig) : removeJsonMcpServer(existing, previous.serverName, previous.serverConfig);
    return predecessor.platform === "codex" ? upsertCodexMcpServer(removed, next.serverName, next.serverConfig) : upsertJsonMcpServer(removed, next.serverName, next.serverConfig);
  }
  migratedClaudeHookConfig(pkg, predecessor, files, existing) {
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    const previous = predecessor.managedConfig?.kind === "hook" ? predecessor.managedConfig : void 0;
    if (!previous) throw new Error(`Claude hook '${predecessor.id}' has no tracked settings contribution and cannot be migrated safely.`);
    const removed = removeClaudeHookConfig(existing, previous.hooks);
    return upsertClaudeHookConfig(removed, readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint));
  }
  async rollbackMigration(journal) {
    const scope = journal.previous.scope;
    const state = await this.stateStore(scope).read();
    const committed = state.packages.some((item) => item.id === journal.next.id && item.platform === journal.next.platform && item.scope === journal.next.scope && item.sourceId === journal.next.sourceId);
    if (committed) {
      await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
      await this.storage.remove(scope, migrationJournalPath());
      return;
    }
    if (journal.targetPath !== journal.previous.installedPath) await this.storage.remove(scope, journal.targetPath);
    if (journal.payloadBackup && await this.storage.exists(scope, journal.payloadBackup)) {
      await this.storage.remove(scope, journal.previous.installedPath);
      await this.storage.move(scope, journal.payloadBackup, journal.previous.installedPath);
    }
    if (journal.configPath && journal.configBackup && await this.storage.exists(scope, journal.configBackup)) {
      await this.storage.remove(scope, journal.configPath);
      await this.storage.move(scope, journal.configBackup, journal.configPath);
    }
    await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
    await this.storage.remove(scope, migrationJournalPath());
  }
  async recoverMigration(scope) {
    const content = await this.readOptionalText(scope, migrationJournalPath());
    if (!content) return;
    const parsed = this.validateMigrationJournal(JSON.parse(content), scope);
    await this.rollbackMigration(parsed);
  }
  validateMigrationJournal(value, scope) {
    if (!isRecord5(value) || typeof value.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.operationId) || !isRecord5(value.previous) || !isRecord5(value.next) || typeof value.targetPath !== "string") {
      throw new Error("Migration recovery journal is malformed.");
    }
    const previous = value.previous;
    const next = value.next;
    if (!isMigrationJournalPrevious(previous) || !isMigrationJournalNext(next) || previous.scope !== scope || next.scope !== scope || previous.platform !== next.platform) {
      throw new Error("Migration recovery journal has incompatible identities or scope.");
    }
    if (!isCanonicalInstalledPath(previous, this.config)) throw new Error("Migration recovery journal contains an unexpected predecessor path.");
    const expectedTarget = previous.type === "mcp" ? previous.installedPath : previous.scope === "cloud" ? cloudInstallPath(previous.platform, previous.type, next.id) : previous.installedPath.startsWith(".offload/") ? offloadRelativePath(previous.platform, previous.type, next.id) : installRelativePath(previous.platform, previous.type, next.id, this.config.platformPathOverrides);
    const backupRoot = `.ai_marketplace/migrations/${value.operationId}`;
    const expectedPayloadBackup = previous.scope === "cloud" || previous.type === "mcp" ? void 0 : `${backupRoot}/payload`;
    const expectedConfigPath = migrationConfigPath(previous);
    const expectedConfigBackup = expectedConfigPath ? `${backupRoot}/config` : void 0;
    if (value.targetPath !== expectedTarget || value.payloadBackup !== expectedPayloadBackup || value.configPath !== expectedConfigPath || value.configBackup !== expectedConfigBackup) {
      throw new Error("Migration recovery journal contains unexpected managed paths.");
    }
    return value;
  }
  assertCompatibleRollback(pkg, installed) {
    if (sourceRepository(pkg) !== installed.sourceRepo || pkg.source.branch !== installed.sourceBranch || installed.sourceId !== void 0 && pkg.source.id !== installed.sourceId || pkg.sourcePath !== installed.sourcePath || pkg.manifest.id !== installed.id || pkg.manifest.qualifiedName !== (installed.qualifiedName ?? installed.id) || pkg.manifest.type !== installed.type || !pkg.manifest.platforms.includes(installed.platform) || !pkg.manifest.delivery.includes(installed.scope) || !isCanonicalInstalledPath(installed, this.config)) {
      throw new Error("Rollback snapshot is not compatible with the installed package source, identity, platform, or scope.");
    }
  }
  async assertNoMcpCollision(pkg, platform, previous) {
    const collision = (await this.listInstalled()).find(
      (item) => item.type === "mcp" && item.platform === platform && item.id === pkg.manifest.id && (item.sourceId !== void 0 || item.installedPath === mcpConfigRelativePath(platform)) && !sameInstalledRecord2(item, previous) && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName)
    );
    if (collision) {
      throw new Error(`MCP server '${pkg.manifest.id}' is already managed by another package source.`);
    }
  }
  async replaceDirectory(scope, relativeDirectory, files) {
    await this.storage.replaceDirectory(scope, relativeDirectory, files.map((file) => ({
      relativePath: safeJoinRelative(file.relativePath),
      content: file.content
    })));
  }
  async moveDirectory(scope, fromRelativePath, toRelativePath) {
    await this.storage.move(scope, fromRelativePath, toRelativePath);
  }
  async deleteRelativeDirectory(scope, relativeDirectory) {
    await this.storage.remove(scope, relativeDirectory);
  }
  async readOptionalText(scope, relativePath) {
    const bytes = await this.storage.readFile(scope, relativePath);
    return bytes === void 0 ? void 0 : Buffer.from(bytes).toString("utf8");
  }
  async writeText(scope, relativePath, content) {
    await this.storage.writeFileAtomic(scope, relativePath, Buffer.from(content, "utf8"));
  }
};
function sameInstalledRecord2(left, right) {
  return right !== void 0 && left.id === right.id && left.platform === right.platform && left.scope === right.scope && left.installedAt === right.installedAt && left.installedPath === right.installedPath;
}
function isClaudeFlatFilePackage(pkg) {
  return pkg.manifest.type === "command" || pkg.manifest.type === "agent" || pkg.manifest.type === "rule";
}
function codexAgentContribution(pkg, platform, files, config) {
  if (platform !== "codex" || pkg.manifest.type !== "agent") return void 0;
  const expectedEntrypoint = `${pkg.manifest.id}.toml`;
  if (pkg.manifest.entrypoint !== expectedEntrypoint) {
    throw new Error(`Codex agent '${pkg.manifest.id}' entrypoint must be '${expectedEntrypoint}'.`);
  }
  const entrypoint = files.find((file) => file.relativePath === expectedEntrypoint);
  if (!entrypoint) throw new Error(`Codex agent '${pkg.manifest.id}' is missing entrypoint '${expectedEntrypoint}'.`);
  return {
    kind: "codex-agent",
    configPath: codexAgentConfigRelativePath(pkg.manifest.id, config.platformPathOverrides),
    contentSha256: sha256(entrypoint.content)
  };
}
function sha256(content) {
  return createHash2("sha256").update(content).digest("hex");
}
function isOffloaded(installed) {
  return installed.installedPath === offloadRelativePath(installed.platform, installed.type, installed.id);
}
function isCanonicalInstalledPath(installed, config) {
  if (installed.harnessBundle) {
    return installed.platform === "deepseek-harness" && installed.scope === "global" && (installed.installedPath === installRelativePath(installed.platform, installed.type, installed.id, config.platformPathOverrides) || isOffloaded(installed));
  }
  if (installed.type === "mcp") {
    return installed.scope === "global" && installed.installedPath === mcpConfigRelativePath(installed.platform) && (installed.managedPayloadPath === void 0 || installed.sourceId !== void 0 && installed.managedPayloadPath === mcpPayloadRelativePath(installed.platform, installed.sourceId, installed.id));
  }
  if (installed.scope === "cloud") {
    return installed.installedPath === cloudInstallPath(installed.platform, installed.type, installed.id);
  }
  if (installed.scope !== "workspace" && installed.scope !== "global") {
    return false;
  }
  return installed.installedPath === installRelativePath(installed.platform, installed.type, installed.id, config.platformPathOverrides) || isOffloaded(installed);
}
function managedMcpConfig(installed) {
  return installed?.managedConfig?.kind === "mcp" ? installed.managedConfig : void 0;
}
function sourceRepository(pkg) {
  return repositoryIdentity(pkg.source);
}
function sourceMetadata(pkg) {
  return {
    sourceId: pkg.source.id,
    qualifiedName: pkg.manifest.qualifiedName,
    group: pkg.manifest.group,
    sourceRevision: pkg.sourceRevision
  };
}
function migrationJournalPrevious(installed) {
  return { id: installed.id, ...installed.qualifiedName === void 0 ? {} : { qualifiedName: installed.qualifiedName }, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, sourceRepo: installed.sourceRepo, sourceBranch: installed.sourceBranch, sourcePath: installed.sourcePath, type: installed.type, platform: installed.platform, scope: installed.scope, installedPath: installed.installedPath };
}
function migrationJournalNext(installed) {
  return { id: installed.id, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, platform: installed.platform, scope: installed.scope };
}
function isMigrationJournalPrevious(value) {
  return typeof value.id === "string" && typeof value.sourceRepo === "string" && typeof value.sourceBranch === "string" && typeof value.sourcePath === "string" && typeof value.type === "string" && typeof value.platform === "string" && typeof value.scope === "string" && typeof value.installedPath === "string" && (value.qualifiedName === void 0 || typeof value.qualifiedName === "string") && (value.sourceId === void 0 || typeof value.sourceId === "string");
}
function isMigrationJournalNext(value) {
  return typeof value.id === "string" && typeof value.platform === "string" && typeof value.scope === "string" && (value.sourceId === void 0 || typeof value.sourceId === "string");
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function migrationJournalPath() {
  return ".ai_marketplace/migration-journal.json";
}
function migrationConfigPath(installed) {
  if (installed.type === "mcp") return mcpConfigRelativePath(installed.platform);
  return installed.type === "hook" && installed.platform === "claude" ? ".claude/settings.json" : void 0;
}
function migrationSnapshot(installed) {
  return { id: installed.id, qualifiedName: installed.qualifiedName ?? installed.id, ...installed.sourceId === void 0 ? {} : { sourceId: installed.sourceId }, version: installed.version, repository: installed.sourceRepo, branch: installed.sourceBranch, path: installed.sourcePath };
}
function migrationSnapshotForPackage(pkg) {
  return { id: pkg.manifest.id, qualifiedName: pkg.manifest.qualifiedName, sourceId: pkg.source.id, version: pkg.manifest.version, repository: sourceRepository(pkg), branch: pkg.source.branch, path: pkg.sourcePath };
}

// packages/marketplace-core/src/services/marketplaceModel.ts
function packageIdentity(pkg) {
  return `${pkg.source.id}:${pkg.manifest.qualifiedName}`;
}
function installedIdentity(installed) {
  return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
}
function toSerializableMarketplaceModel(model) {
  const packagesByIdentity = new Map(model.packages.map((pkg) => [packageIdentity(pkg), pkg]));
  const migrations = planPackageMigrations(model.packages, model.installed).eligible;
  const installed = model.installed.map((item) => {
    const pkg = packagesByIdentity.get(installedIdentity(item));
    const latestVersion = pkg?.manifest.version;
    const installOptions = pkg ? installOptionsForPackage(pkg, model.installed.filter((candidate) => installedIdentity(candidate) === packageIdentity(pkg)), model.defaultPlatform) : [];
    const updateAvailable = latestVersion ? isUpdateAvailable(item.version, latestVersion) || isRollbackPinned(item) : false;
    const migration = migrations.find((candidate) => sameInstallation(candidate.predecessor, item));
    const card = installedCardActions(item, pkg, installOptions, updateAvailable, migration);
    return {
      ...item,
      sourceLabel: pkg?.source.label ?? item.sourceRepo,
      repositoryKey: repositoryFilterKey(item),
      group: pkg?.manifest.group ?? item.group ?? "unknown",
      qualifiedName: pkg?.manifest.qualifiedName ?? item.qualifiedName ?? item.id,
      latestVersion,
      updateAvailable,
      name: pkg?.manifest.name ?? item.id,
      description: pkg?.manifest.description ?? item.installedPath,
      tags: pkg?.manifest.tags ?? [item.type, item.platform],
      evaluationScore: pkg?.manifest.evaluationScore,
      installOptions,
      ...card,
      ...migration === void 0 ? {} : { migration: serializeMigration(migration) }
    };
  });
  const packages = model.packages.map((pkg) => {
    const matchingInstalled = model.installed.filter((item) => installedIdentity(item) === packageIdentity(pkg));
    const packageMigrations = migrations.filter((candidate) => packageIdentity(candidate.destination) === packageIdentity(pkg));
    const migration = packageMigrations[0];
    const installOptions = installOptionsForPackage(pkg, matchingInstalled, model.defaultPlatform);
    const primaryAction = migration ? { action: "migrate", label: "Migrate", tone: "primary", platform: migration.predecessor.platform, scope: migration.predecessor.scope } : installOptions[0] ? cardAction(installOptions[0], "primary") : void 0;
    return {
      id: pkg.manifest.id,
      qualifiedName: pkg.manifest.qualifiedName,
      sourceId: pkg.source.id,
      sourceLabel: pkg.source.label,
      repositoryKey: repositoryFilterKey({ sourceId: pkg.source.id, sourceLabel: pkg.source.label, sourceRepo: pkg.source.repository }),
      group: pkg.manifest.group,
      name: pkg.manifest.name,
      type: pkg.manifest.type,
      version: pkg.manifest.version,
      description: pkg.manifest.description,
      platforms: pkg.manifest.platforms,
      tags: pkg.manifest.tags,
      evaluationScore: pkg.manifest.evaluationScore,
      hotload: pkg.hotload,
      updateAvailable: matchingInstalled.some((item) => isUpdateAvailable(item.version, pkg.manifest.version) || isRollbackPinned(item)),
      installOptions,
      status: { kind: "available", label: "Available" },
      ...primaryAction === void 0 ? {} : { primaryAction },
      moreActions: (migration ? installOptions : installOptions.slice(1)).map((option) => cardAction(option, "secondary")),
      ...migration === void 0 ? {} : { migration: packageMigrations.length === 1 ? serializeMigration(migration) : { destinationSourceId: pkg.source.id, destinationQualifiedName: pkg.manifest.qualifiedName } }
    };
  }).filter((pkg) => pkg.installOptions.length > 0).sort((left, right) => Number(right.updateAvailable) - Number(left.updateAvailable) || left.name.localeCompare(right.name));
  return {
    configured: model.configured,
    autoUpdateEnabled: model.autoUpdateEnabled,
    defaultPlatform: model.defaultPlatform,
    autoInstallGroups: model.autoInstallGroups ?? [],
    knownGroups: model.knownGroups ?? [],
    extensionVersion: model.extensionVersion ?? "0.0.0",
    packages,
    installed
  };
}
function isRollbackPinned(installed) {
  return installed.autoUpdate === false && installed.revertedAt !== void 0;
}
function cardAction(option, tone) {
  return { ...option, tone };
}
function installedCardActions(installed, pkg, installOptions, updateAvailable, migration) {
  const pinned = isRollbackPinned(installed);
  const isMcp = installed.type === "mcp" && !installed.harnessBundle;
  const isCloud = installed.scope === "cloud";
  const offloaded = !isCloud && !isMcp && installed.installedPath.startsWith(".offload/");
  const status = migration ? { kind: "migration", label: "Migration available" } : pinned ? { kind: "reverted", label: "Reverted, pinned" } : isMcp ? { kind: "mcp", label: "Installed and configured" } : isCloud ? { kind: "cloud", label: "Cloud" } : offloaded ? { kind: "offloaded", label: "Offloaded" } : updateAvailable ? { kind: "outdated", label: "Update available" } : { kind: "installed", label: "Installed" };
  const more = installOptions.map((option) => cardAction(option, "secondary"));
  if (migration && updateAvailable) more.unshift({ action: "migrate", label: "Migrate", tone: "secondary", platform: installed.platform, scope: installed.scope });
  if (pkg?.manifest.previousVersion && !pinned) more.push(!updateAvailable ? { action: "revert", label: "Revert to previous version", tone: "secondary", platform: installed.platform, scope: installed.scope } : { action: "revert", label: "Revert to previous version (update first)", tone: "secondary", platform: installed.platform, scope: installed.scope, disabled: true });
  if (updateAvailable && !isCloud && !isMcp) more.push({ action: offloaded ? "hotload" : "offload", label: offloaded ? "Hotload" : "Offload", tone: "secondary", platform: installed.platform, scope: installed.scope });
  more.push({ action: "uninstall", label: "Uninstall", tone: "danger", platform: installed.platform, scope: installed.scope });
  const primaryAction = migration && !updateAvailable ? { action: "migrate", label: "Migrate", tone: "primary", platform: installed.platform, scope: installed.scope } : updateAvailable ? { action: "update", label: pinned ? "Update to latest" : "Update", tone: "primary", platform: installed.platform, scope: installed.scope } : !isCloud && !isMcp ? { action: offloaded ? "hotload" : "offload", label: offloaded ? "Hotload" : "Offload", tone: "primary", platform: installed.platform, scope: installed.scope } : void 0;
  return { status, ...primaryAction === void 0 ? {} : { primaryAction }, moreActions: more };
}
function serializeMigration(candidate) {
  return {
    destinationSourceId: candidate.destination.source.id,
    destinationQualifiedName: candidate.destination.manifest.qualifiedName,
    predecessorId: candidate.predecessor.id,
    ...candidate.predecessor.sourceId === void 0 ? {} : { predecessorSourceId: candidate.predecessor.sourceId },
    ...candidate.predecessor.qualifiedName === void 0 ? {} : { predecessorQualifiedName: candidate.predecessor.qualifiedName },
    platform: candidate.predecessor.platform,
    scope: candidate.predecessor.scope
  };
}
function sameInstallation(left, right) {
  return left.id === right.id && left.sourceId === right.sourceId && left.platform === right.platform && left.scope === right.scope;
}
function installOptionsForPackage(pkg, installed, defaultPlatform) {
  if (pkg.manifest.type === "mcp") {
    return installOptionsForMcpPackage(pkg, installed, defaultPlatform);
  }
  const options = [];
  const orderedPlatforms2 = orderPlatforms(pkg.manifest.platforms, defaultPlatform);
  const delivery = pkg.manifest.delivery;
  const workspacePlatform = delivery.includes("workspace") ? orderedPlatforms2.find((platform) => supportsPlatformScope(pkg, platform, "workspace") && !isInstalled(installed, platform, "workspace")) : void 0;
  if (workspacePlatform) {
    options.push(installed.some((item) => item.scope === "workspace") ? {
      action: "installDifferentPlatform",
      scope: "workspace",
      platform: workspacePlatform,
      label: "Install in workspace for different platform"
    } : {
      action: "install",
      scope: "workspace",
      platform: workspacePlatform,
      label: workspacePlatform === defaultPlatform ? "Install" : `Install for ${platformLabel(workspacePlatform)}`
    });
  }
  const globalPlatform = delivery.includes("global") ? orderedPlatforms2.find((platform) => supportsPlatformScope(pkg, platform, "global") && !isInstalled(installed, platform, "global")) : void 0;
  if (globalPlatform) {
    options.push(installed.some((item) => item.scope === "global") ? {
      action: "installDifferentPlatform",
      scope: "global",
      platform: globalPlatform,
      label: "Install in user directory for different platform"
    } : {
      action: "installGlobal",
      scope: "global",
      platform: globalPlatform,
      label: "Install in user directory"
    });
  }
  const cloudPlatform = delivery.includes("cloud") ? orderedPlatforms2.find((platform) => supportsPlatformScope(pkg, platform, "cloud") && !isInstalled(installed, platform, "cloud")) : void 0;
  if (cloudPlatform) {
    options.push({
      action: "installCloud",
      scope: "cloud",
      platform: cloudPlatform,
      label: `Install to ${platformLabel(cloudPlatform)} cloud`
    });
  }
  return dedupeOptions(options);
}
function supportsPlatformScope(pkg, platform, scope) {
  if (!pkg.manifest.platforms.includes(platform) || !pkg.manifest.delivery.includes(scope)) return false;
  if (platform !== "deepseek-harness") return true;
  return scope === "global" || scope === "workspace" && (pkg.manifest.type === "skill" || pkg.manifest.type === "rule");
}
function repositoryFilterKey(item) {
  return item.sourceId ? `source:${item.sourceId}` : `legacy:${item.sourceRepo ?? item.sourceLabel ?? "unknown"}`;
}
function installOptionsForMcpPackage(pkg, installed, defaultPlatform) {
  const platform = mcpInstallPlatformCandidates(pkg, installed, defaultPlatform)[0];
  return platform ? [{ action: "installGlobal", scope: "global", platform, label: `Configure for ${platformLabel(platform)} in user directory` }] : [];
}
function mcpInstallPlatformCandidates(pkg, installed, defaultPlatform) {
  return orderPlatforms(pkg.manifest.platforms, defaultPlatform).filter((platform) => !isInstalled(installed, platform, "global"));
}
function isInstalled(installed, platform, scope) {
  return installed.some((item) => item.platform === platform && item.scope === scope);
}
function orderPlatforms(available, defaultPlatform) {
  return [...available].sort((left, right) => {
    if (left === defaultPlatform) return -1;
    if (right === defaultPlatform) return 1;
    return platforms.indexOf(left) - platforms.indexOf(right);
  });
}
function dedupeOptions(options) {
  const seen = /* @__PURE__ */ new Set();
  return options.filter((option) => {
    const key = `${option.action}:${option.scope}:${option.platform}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function platformLabel(platform) {
  switch (platform) {
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "github-copilot":
      return "GitHub Copilot";
    case "claude":
      return "Claude";
    case "deepseek-harness":
      return "DeepSeek Harness";
  }
}

// packages/marketplace-core/src/services/autoDiscovery.ts
async function discoverInstalledPackages(options) {
  if (options.scope === "cloud") {
    return [];
  }
  const discovered = [];
  const seen = new Set(options.existing.map(installIdentity));
  const diagnostics = new ManifestDiagnosticCollector();
  for (const platform of platforms) {
    for (const packageType of packageTypes) {
      if (packageType === "mcp") {
        continue;
      }
      await discoverRoot(options, discovered, seen, diagnostics, platform, packageType, installRootRelativePath(platform, packageType, options.config.platformPathOverrides), true);
      await discoverRoot(options, discovered, seen, diagnostics, platform, packageType, offloadRootRelativePath(platform, packageType), false);
    }
  }
  const summary = diagnostics.summary("local auto-discovery");
  if (summary) options.log(summary);
  return discovered;
}
async function discoverRoot(options, discovered, seen, diagnostics, platform, packageType, rootRelativePath, hotloaded) {
  let entries;
  try {
    entries = await options.fileSystem.readDirectory(rootRelativePath) ?? [];
  } catch (error) {
    options.log(`Auto-discovery skipped ${rootRelativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymbolicLink) {
      continue;
    }
    const packageRoot = safeJoinRelative(rootRelativePath, entry.name);
    await discoverPackage(options, discovered, seen, diagnostics, platform, packageType, packageRoot, entry.name, hotloaded);
  }
}
async function discoverPackage(options, discovered, seen, diagnostics, platform, packageType, packageRoot, directoryName, hotloaded) {
  const manifestPath = safeJoinRelative(packageRoot, canonicalManifestFileName);
  try {
    const text = await options.fileSystem.readText(manifestPath);
    const validated = validateMarketplaceManifest(parseMarketplaceYaml(text, manifestPath), manifestPath);
    diagnostics.record(validated.diagnostics);
    const manifest = validated.manifest;
    if (manifest.id !== directoryName) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest id does not match containing folder.`);
      return;
    }
    if (manifest.type !== packageType) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest type does not match containing folder.`);
      return;
    }
    if (!manifest.platforms.includes(platform)) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${platform}.`);
      return;
    }
    if (!manifest.delivery.includes(options.scope)) {
      options.log(`Auto-discovery skipped ${manifestPath}: manifest does not support ${options.scope} delivery.`);
      return;
    }
    const catalogMatches = options.catalog.filter((pkg) => pkg.manifest.qualifiedName === manifest.qualifiedName);
    if (catalogMatches.length !== 1) {
      options.log(`Auto-discovery skipped ${manifestPath}: package must resolve to exactly one source-qualified catalog entry.`);
      return;
    }
    const catalogPackage = catalogMatches[0];
    if (catalogPackage.manifest.type !== manifest.type || !catalogPackage.manifest.platforms.includes(platform) || !catalogPackage.manifest.delivery.includes(options.scope)) {
      options.log(`Auto-discovery skipped ${manifestPath}: catalog package does not support this installation target.`);
      return;
    }
    const identity = installIdentity({ id: manifest.id, platform, scope: options.scope, sourceId: catalogPackage.source.id });
    if (seen.has(identity) || options.existing.some(
      (item) => item.id === manifest.id && item.platform === platform && item.scope === options.scope && item.sourceId === void 0
    )) {
      return;
    }
    discovered.push({
      id: manifest.id,
      type: manifest.type,
      platform,
      scope: options.scope,
      version: manifest.version,
      sourceRepo: repositoryIdentity(catalogPackage.source),
      sourceBranch: catalogPackage.source.branch,
      sourcePath: catalogPackage.sourcePath,
      sourceId: catalogPackage.source.id,
      qualifiedName: manifest.qualifiedName,
      group: manifest.group,
      installedPath: packageRoot,
      installedAt: options.now(),
      hotloaded
    });
    seen.add(identity);
  } catch (error) {
    if (isMissingManifest(error)) return;
    options.log(`Auto-discovery skipped ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function isMissingManifest(error) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return true;
  return error instanceof Error && /(?:^|\s)ENOENT(?::|\s)|file\s*not\s*found/i.test(error.message);
}
function installIdentity(value) {
  return `${value.scope}:${value.platform}:${value.sourceId ?? ""}:${value.id}`;
}

// packages/marketplace-core/src/services/groupInstall.ts
function planGroupInstall(group, scope, catalog, installed, defaultPlatform) {
  const normalizedGroup = group.trim();
  if (!normalizedGroup) return [];
  return catalog.flatMap((pkg) => {
    if (pkg.manifest.group !== normalizedGroup) return [];
    const matching = installed.filter((item) => installedIdentity(item) === packageIdentity(pkg));
    const option = installOptionsForPackage(pkg, matching, defaultPlatform).find((candidate) => candidate.scope === scope);
    return option ? [{ pkg, platform: option.platform, scope }] : [];
  });
}
function autoInstallGroupPlans(catalog, installed, groups, defaultPlatform) {
  const enabled = new Set(normalizeGroupList(groups));
  if (enabled.size === 0) return [];
  return catalog.flatMap((pkg) => {
    if (!enabled.has(pkg.manifest.group) || !pkg.manifest.delivery.includes("global")) return [];
    const identity = packageIdentity(pkg);
    if (installed.some((item) => installedIdentity(item) === identity || item.sourceId === void 0 && item.id === pkg.manifest.id)) return [];
    const platform = pkg.manifest.platforms.includes(defaultPlatform) ? defaultPlatform : pkg.manifest.platforms[0];
    return platform ? [{ pkg, platform }] : [];
  });
}
function normalizeGroupList(groups) {
  return [...new Set(groups.map((group) => group.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

// packages/marketplace-core/src/services/defaultPackages.ts
function defaultPackageInstallPlans(packages, installed, defaultPlatform, config) {
  return packages.filter(isDefaultPackage).filter((pkg) => config === void 0 || (config.repositories ?? []).some(
    (source) => source.id === pkg.source.id && source.allowDefaultPackages
  )).filter((pkg) => pkg.manifest.delivery.includes("global")).filter((pkg) => !installed.some(
    (item) => installedIdentity(item) === packageIdentity(pkg) || item.sourceId === void 0 && item.id === pkg.manifest.id
  )).map((pkg) => ({
    pkg,
    platform: preferredPlatform(pkg, defaultPlatform)
  }));
}
function isDefaultPackage(pkg) {
  return pkg.manifest.defaultInstall === true || pkg.manifest.defaultInstall === void 0 && pkg.manifest.tags.some((tag) => tag.trim().toLowerCase() === "default");
}
function preferredPlatform(pkg, defaultPlatform) {
  return orderedPlatforms(pkg.manifest.platforms, defaultPlatform)[0];
}
function orderedPlatforms(availablePlatforms, defaultPlatform) {
  return [...availablePlatforms].sort((left, right) => {
    if (left === defaultPlatform) {
      return -1;
    }
    if (right === defaultPlatform) {
      return 1;
    }
    return platforms.indexOf(left) - platforms.indexOf(right);
  });
}

// packages/marketplace-core/src/services/bulkPlanning.ts
function planBulkInstall(candidates, scope) {
  const eligible = [];
  const skipped = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const key = selectionKey(candidate.selection);
    if (seen.has(key)) continue;
    seen.add(key);
    const option = installOptionForScope(candidate.options, scope);
    if (!option) {
      skipped.push(candidate.selection);
      continue;
    }
    eligible.push({ selection: candidate.selection, option });
  }
  return { eligible, skipped };
}
function planBulkUninstall(candidates, scope) {
  const eligible = [];
  const skipped = [];
  const seenSelections = /* @__PURE__ */ new Set();
  const seenInstalled = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const key = selectionKey(candidate.selection);
    if (seenSelections.has(key)) continue;
    seenSelections.add(key);
    const target = matchingUninstallTargets(candidate.installed, candidate.selection).find((item) => item.scope === scope);
    if (!target) {
      skipped.push(candidate.selection);
      continue;
    }
    const installedKey = `${installedIdentity2(target)}:${target.platform}:${target.scope}`;
    if (!seenInstalled.has(installedKey)) {
      seenInstalled.add(installedKey);
      eligible.push(target);
    }
  }
  return { eligible, skipped };
}
function matchingUninstallTargets(installed, selection) {
  return installed.filter((item) => item.id === selection.packageId && (selection.sourceId === void 0 || item.sourceId === selection.sourceId) && (selection.qualifiedName === void 0 || (item.qualifiedName ?? item.id) === selection.qualifiedName) && (selection.platform === void 0 || item.platform === selection.platform));
}
function installOptionForScope(options, scope) {
  return options.find((option) => option.scope === scope && option.action !== "installCloud");
}
function selectionKey(selection) {
  return `${selection.sourceId ?? "legacy"}:${selection.qualifiedName ?? selection.packageId}:${selection.platform ?? ""}`;
}
function installedIdentity2(installed) {
  return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
}

// packages/marketplace-core/src/marketplaceService.ts
var MarketplaceService = class {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }
  dependencies;
  catalog = [];
  async refreshCatalog() {
    const client = this.repositoryClient();
    this.catalog = await client.listMarketplacePackages();
    return this.catalog;
  }
  getCatalog() {
    return this.catalog;
  }
  async listInstalled() {
    return (await this.installer()).listInstalled();
  }
  async diagnose() {
    const client = this.repositoryClient();
    await client.checkConnection();
    const packages = await client.listMarketplacePackages();
    return { connected: true, packageCount: packages.length };
  }
  async discover(options) {
    return discoverInstalledPackages({ ...options, catalog: this.catalog, existing: await this.listInstalled(), config: this.config() });
  }
  async planGroup(group, scope) {
    return planGroupInstall(group, scope, this.catalog, await this.listInstalled(), this.config().defaultPlatform);
  }
  planBulkInstall(candidates, scope) {
    return planBulkInstall(candidates, scope);
  }
  planBulkUninstall(candidates, scope) {
    return planBulkUninstall(candidates, scope);
  }
  async syncPlan() {
    const installed = await this.listInstalled();
    const config = this.config();
    const actions = [
      ...defaultPackageInstallPlans(this.catalog, installed, config.defaultPlatform, config).map((item) => ({ kind: "install-default", ...item, scope: "global" })),
      ...autoInstallGroupPlans(this.catalog, installed, config.autoInstallGroups ?? [], config.defaultPlatform).map((item) => ({ kind: "install-group", ...item, scope: "global" }))
    ];
    if (config.autoUpdateEnabled) {
      for (const current of installed) {
        if (current.autoUpdate === false) continue;
        const pkg = this.catalog.find((candidate) => candidate.source.id === current.sourceId && candidate.manifest.qualifiedName === current.qualifiedName);
        if (pkg && isUpdateAvailable(current.version, pkg.manifest.version)) {
          actions.push({ kind: "update", pkg, installed: current });
        }
      }
    }
    return { actions: deduplicateSyncActions(actions) };
  }
  async applySync(requestedPlan) {
    const plan = requestedPlan ?? await this.syncPlan();
    const applied = [];
    for (const action of plan.actions) {
      applied.push(action.kind === "update" ? await this.update(action.pkg, action.installed) : await this.install(action.pkg, action.platform, action.scope));
    }
    return applied;
  }
  async getMarketplaceModel() {
    const installed = await this.listInstalled();
    const config = this.config();
    return toSerializableMarketplaceModel({
      packages: this.catalog,
      installed,
      configured: true,
      autoUpdateEnabled: config.autoUpdateEnabled ?? false,
      autoInstallGroups: config.autoInstallGroups,
      defaultPlatform: config.defaultPlatform
    });
  }
  async install(pkg, platform, scope) {
    return (await this.installer()).install(pkg, platform, scope);
  }
  async update(pkg, installed) {
    return (await this.installer()).updateInstalled(pkg, installed);
  }
  async planMigrations() {
    return planPackageMigrations(this.catalog, await this.listInstalled());
  }
  async migrate(destination, predecessor) {
    const installed = await this.listInstalled();
    if (!migrationFor(destination, predecessor, this.catalog, installed)) throw new Error("The selected package migration is not eligible.");
    return (await this.installer()).migrateInstalled(destination, predecessor);
  }
  async revert(pkg, installed, revision) {
    const snapshot = await this.repositoryClient().fetchPackageAtRevision(pkg, revision);
    return (await this.installer()).revertInstalled(snapshot, installed, revision);
  }
  async uninstall(installed) {
    await (await this.installer()).uninstall(installed);
  }
  async hotload(installed) {
    return (await this.installer()).hotload(installed);
  }
  async offload(installed) {
    return (await this.installer()).offload(installed);
  }
  config() {
    return this.dependencies.configuration.read();
  }
  repositoryClient() {
    return new RepositoryClient(
      this.config(),
      this.dependencies.credentials,
      (message5) => this.dependencies.logger.log(message5)
    );
  }
  async installer() {
    const client = this.repositoryClient();
    return new PackageInstaller(this.dependencies.storage, this.config(), (pkg) => client.fetchPackageFiles(pkg), this.dependencies.mcpScriptRunner, this.dependencies.harnessProfileManager);
  }
};
function deduplicateSyncActions(actions) {
  const seen = /* @__PURE__ */ new Set();
  return actions.filter((action) => {
    const key = `${action.pkg.source.id}:${action.pkg.manifest.qualifiedName}:${action.kind === "update" ? `${action.installed.platform}:${action.installed.scope}` : `${action.platform}:${action.scope}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// packages/marketplace-node-cli/src/cli.ts
var import_core3 = __toESM(require_out(), 1);
import { homedir } from "node:os";
import { createHash as createHash3 } from "node:crypto";
import { isAbsolute as isAbsolute2, resolve as resolve3 } from "node:path";

// packages/marketplace-node-cli/src/config.ts
var import_core = __toESM(require_out(), 1);
import { resolve } from "node:path";
var defaultPackageFolders = {
  skill: "Skills/",
  command: "Commands/",
  mcp: "Mcps/",
  agent: "Agents/",
  hook: "Hooks/",
  rule: "Rules/"
};
function hostConfigRelativePath(policy2) {
  return `.ai_marketplace/${policy2.configFileName}`;
}
async function readHostConfig(storage, policy2) {
  const bytes = await storage.readFile("global", hostConfigRelativePath(policy2));
  if (bytes === void 0) return { schemaVersion: 1 };
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to parse ${policy2.displayName} marketplace configuration: ${message3(error)}`);
  }
  rejectCredentialFields(parsed, policy2);
  return normalizeFile(parsed, policy2);
}
function toMarketplaceConfig(raw, policy2) {
  const packageFolders = normalizedFolders(raw.packageFolders);
  const sources = raw.repositories?.map((source) => normalizeSource(source, packageFolders));
  assertCredentialIdCollisions(sources ?? []);
  const legacy = (0, import_core.parseGitHubRepo)(import_core.defaultGitHubRepositoryUrl);
  return {
    repository: legacy.fullName,
    branch: "main",
    packageFolders,
    ...sources && sources.length > 0 ? { repositories: sources } : {},
    platformPathOverrides: { [policy2.platform]: normalizedOverrides(raw.platformPathOverrides) },
    defaultPlatform: policy2.platform,
    autoUpdateEnabled: raw.autoUpdate === true,
    autoInstallGroups: raw.autoInstallGroups ?? []
  };
}
function normalizeSource(source, defaults) {
  if (!source || typeof source.id !== "string" || !/^[A-Za-z0-9._-]+$/.test(source.id)) throw new Error("Repository id must contain only letters, digits, dot, underscore, or hyphen.");
  const parsed = typeof source.url === "string" ? (0, import_core.parseRepositoryUrl)(source.url, source.provider) : void 0;
  if (!parsed) throw new Error(`Repository '${source.id}' must use a URL matching its supported repository provider.`);
  const branch = source.branch ?? "main";
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..")) throw new Error(`Repository '${source.id}' has an invalid branch.`);
  return (0, import_core.toRepositoryConfig)(parsed, {
    id: source.id,
    label: source.label?.trim() || source.id,
    branch,
    enabled: source.enabled !== false,
    allowDefaultPackages: source.allowDefaultPackages === true,
    packageFolders: normalizedFolders(source.packageFolders, defaults)
  });
}
function normalizedFolders(raw, defaults = defaultPackageFolders) {
  return Object.fromEntries(import_core.packageTypes.map((type) => {
    const value = raw?.[type] ?? defaults[type];
    if (typeof value !== "string" || value.trim() === "" || value.startsWith("/") || value.split(/[\\/]/).includes("..")) throw new Error(`Unsafe package folder for '${type}'.`);
    return [type, value];
  }));
}
function normalizedOverrides(raw) {
  if (!raw) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => import_core.packageTypes.includes(key) && typeof value === "string"));
}
function normalizeFile(value, policy2) {
  if (!isRecord6(value) || value.schemaVersion !== 1) throw new Error(`${policy2.displayName} marketplace configuration must use schemaVersion 1.`);
  assertAllowedKeys(value, ["schemaVersion", "repositories", "packageFolders", "platformPathOverrides", "autoInstallGroups", "autoUpdate"], "config");
  const repositories = value.repositories === void 0 ? void 0 : normalizeRepositories(value.repositories);
  const packageFolders = value.packageFolders === void 0 ? void 0 : normalizeStringMap(value.packageFolders, "packageFolders");
  const platformPathOverrides = value.platformPathOverrides === void 0 ? void 0 : normalizeStringMap(value.platformPathOverrides, "platformPathOverrides");
  if (value.autoInstallGroups !== void 0 && (!Array.isArray(value.autoInstallGroups) || !value.autoInstallGroups.every((item) => typeof item === "string"))) throw new Error("autoInstallGroups must be an array of strings.");
  if (value.autoUpdate !== void 0 && typeof value.autoUpdate !== "boolean") throw new Error("autoUpdate must be boolean.");
  return {
    schemaVersion: 1,
    ...repositories === void 0 ? {} : { repositories },
    ...packageFolders === void 0 ? {} : { packageFolders },
    ...platformPathOverrides === void 0 ? {} : { platformPathOverrides },
    ...value.autoInstallGroups === void 0 ? {} : { autoInstallGroups: value.autoInstallGroups },
    ...value.autoUpdate === void 0 ? {} : { autoUpdate: value.autoUpdate }
  };
}
function normalizeRepositories(value) {
  if (!Array.isArray(value)) throw new Error("repositories must be an array.");
  return value.map((item) => {
    if (!isRecord6(item)) throw new Error("Each repository must be an object.");
    assertAllowedKeys(item, ["id", "url", "provider", "label", "branch", "enabled", "allowDefaultPackages", "packageFolders"], "repository");
    if (typeof item.id !== "string" || typeof item.url !== "string") throw new Error("Each repository requires string id and url fields.");
    if (item.provider !== void 0 && (typeof item.provider !== "string" || !import_core.repositoryProviders.includes(item.provider))) throw new Error("Repository provider is unsupported.");
    if (item.label !== void 0 && typeof item.label !== "string") throw new Error("Repository label must be a string.");
    if (item.branch !== void 0 && typeof item.branch !== "string") throw new Error("Repository branch must be a string.");
    if (item.enabled !== void 0 && typeof item.enabled !== "boolean") throw new Error("Repository enabled must be boolean.");
    if (item.allowDefaultPackages !== void 0 && typeof item.allowDefaultPackages !== "boolean") throw new Error("Repository allowDefaultPackages must be boolean.");
    const folders = item.packageFolders === void 0 ? void 0 : normalizeStringMap(item.packageFolders, "repository packageFolders");
    return { id: item.id, url: item.url, ...item.provider === void 0 ? {} : { provider: item.provider }, ...item.label === void 0 ? {} : { label: item.label }, ...item.branch === void 0 ? {} : { branch: item.branch }, ...item.enabled === void 0 ? {} : { enabled: item.enabled }, ...item.allowDefaultPackages === void 0 ? {} : { allowDefaultPackages: item.allowDefaultPackages }, ...folders === void 0 ? {} : { packageFolders: folders } };
  });
}
function assertCredentialIdCollisions(sources) {
  const seen = /* @__PURE__ */ new Map();
  for (const source of sources) {
    const normalized = (0, import_core.normalizedSourceCredentialId)(source.id);
    const previous = seen.get(normalized);
    if (previous) throw new Error(`Repository ids '${previous}' and '${source.id}' collide in credential environment variable names.`);
    seen.set(normalized, source.id);
  }
}
function normalizeStringMap(value, label) {
  if (!isRecord6(value)) throw new Error(`${label} must be an object.`);
  assertAllowedKeys(value, [...import_core.packageTypes], label);
  const output = {};
  for (const type of import_core.packageTypes) {
    const entry = value[type];
    if (entry !== void 0) {
      if (typeof entry !== "string") throw new Error(`${label}.${type} must be a string.`);
      output[type] = entry;
    }
  }
  return output;
}
function assertAllowedKeys(value, allowed, label) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${label} contains unknown field '${unexpected}'.`);
}
function rejectCredentialFields(value, policy2, path2 = "config") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCredentialFields(item, policy2, `${path2}[${index}]`));
    return;
  }
  if (!isRecord6(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:token|secret|password|credential|authorization|api[-_]?key)/i.test(key)) throw new Error(`${policy2.displayName} marketplace configuration must not contain credential field '${path2}.${key}'.`);
    rejectCredentialFields(nested, policy2, `${path2}.${key}`);
  }
}
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function message3(error) {
  return error instanceof Error ? error.message : String(error);
}

// packages/marketplace-node-cli/src/nodeStorage.ts
import { constants } from "node:fs";
import { randomUUID as randomUUID2 } from "node:crypto";
import { access, lstat, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve as resolve2, sep } from "node:path";
var SecurityError = class extends Error {
};
var NodeMarketplaceStorage = class {
  constructor(workspaceRoot, globalRoot) {
    this.workspaceRoot = workspaceRoot;
    this.globalRoot = globalRoot;
  }
  workspaceRoot;
  globalRoot;
  atomicWriteQueues = /* @__PURE__ */ new Map();
  async validateRoots() {
    await this.validateRoot(this.workspaceRoot, "workspace");
    await this.validateRoot(this.globalRoot, "global");
  }
  async readFile(scope, relativePath) {
    const target = await this.safeTarget(scope, relativePath, true);
    try {
      return await readFile(target);
    } catch (error) {
      if (isCode(error, "ENOENT")) return void 0;
      throw error;
    }
  }
  async exists(scope, relativePath) {
    return exists(await this.safeTarget(scope, relativePath, true));
  }
  async writeFile(scope, relativePath, content) {
    const target = await this.safeTarget(scope, relativePath, true);
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    await writeFile(target, content, { mode: 384 });
  }
  async writeFileAtomic(scope, relativePath, content) {
    const target = await this.safeTarget(scope, relativePath, true);
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    const previous = this.atomicWriteQueues.get(target) ?? Promise.resolve();
    const write = previous.catch(() => void 0).then(async () => {
      const temporary = `${target}.tmp-${process.pid}-${randomUUID2()}`;
      try {
        await writeFile(temporary, content, { mode: 384, flag: "wx" });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true }).catch(() => void 0);
      }
    });
    this.atomicWriteQueues.set(target, write);
    try {
      await write;
    } finally {
      if (this.atomicWriteQueues.get(target) === write) this.atomicWriteQueues.delete(target);
    }
  }
  async replaceDirectory(scope, relativePath, files) {
    const target = await this.safeTarget(scope, relativePath, true);
    const operationId = `${process.pid}-${randomUUID2()}`;
    const temporary = `${target}.tmp-${operationId}`;
    const backup = `${target}.backup-${operationId}`;
    await mkdir(dirname(target), { recursive: true });
    await this.safeTarget(scope, relativePath, true);
    await mkdir(temporary, { recursive: false });
    try {
      for (const file of files) {
        const fileTarget = safeChild(temporary, file.relativePath);
        await assertNoSymlinkPath(temporary, fileTarget);
        await mkdir(dirname(fileTarget), { recursive: true });
        await writeFile(fileTarget, file.content, { mode: 384 });
      }
      let movedOld = false;
      if (await exists(target)) {
        await rename(target, backup);
        movedOld = true;
      }
      try {
        await rename(temporary, target);
      } catch (error) {
        if (movedOld) await rename(backup, target).catch(() => void 0);
        throw error;
      }
      if (movedOld) await rm(backup, { recursive: true, force: true });
    } finally {
      await rm(temporary, { recursive: true, force: true }).catch(() => void 0);
      await rm(backup, { recursive: true, force: true }).catch(() => void 0);
    }
  }
  async move(scope, fromRelativePath, toRelativePath) {
    const from = await this.safeTarget(scope, fromRelativePath, false);
    const to = await this.safeTarget(scope, toRelativePath, true);
    if (await exists(to)) throw new SecurityError(`Move destination already exists: ${toRelativePath}`);
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }
  async remove(scope, relativePath) {
    const target = await this.safeTarget(scope, relativePath, true);
    await rm(target, { recursive: true, force: true });
  }
  root(scope) {
    return scope === "workspace" ? this.workspaceRoot : this.globalRoot;
  }
  async assertSafe(scope, relativePath, allowMissing = true) {
    return this.safeTarget(scope, relativePath, allowMissing);
  }
  async safeTarget(scope, relativePath, allowMissing) {
    if (scope === "cloud") throw new SecurityError("Cloud scope is not supported by the marketplace CLI.");
    const root = this.root(scope);
    const target = safeChild(root, relativePath);
    await assertNoSymlinkPath(root, target, allowMissing);
    return target;
  }
  async validateRoot(root, label) {
    if (!isAbsolute(root)) throw new SecurityError(`${label} root must be absolute.`);
    const info = await lstat(root).catch(() => void 0);
    if (!info?.isDirectory()) throw new SecurityError(`${label} root must be an existing directory.`);
    if (info.isSymbolicLink()) throw new SecurityError(`${label} root must not be a symbolic link.`);
    await access(root, constants.R_OK | constants.W_OK);
  }
};
function safeChild(root, input) {
  if (!input || isAbsolute(input) || input.includes("\0")) throw new SecurityError(`Unsafe relative path: ${input}`);
  const target = resolve2(root, input);
  const within = relative(resolve2(root), target);
  if (!within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) throw new SecurityError(`Path escapes configured root: ${input}`);
  return target;
}
async function assertNoSymlinkPath(root, target, allowMissing = true) {
  const rel = relative(root, target);
  let current = resolve2(root);
  for (const segment of rel.split(sep)) {
    current = resolve2(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new SecurityError(`Symbolic links are not allowed in managed paths: ${current}`);
    } catch (error) {
      if (isCode(error, "ENOENT") && allowMissing) return;
      throw error;
    }
  }
}
async function exists(path2) {
  return stat(path2).then(() => true, (error) => isCode(error, "ENOENT") ? false : Promise.reject(error));
}
function isCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

// packages/marketplace-node-cli/src/mcpScriptRunner.ts
import { spawn } from "node:child_process";
import { lstat as lstat2 } from "node:fs/promises";
import { join } from "node:path";

// packages/marketplace-node-cli/src/credentials.ts
var import_core2 = __toESM(require_out(), 1);
function createEnvironmentCredentialProvider(env) {
  return {
    sharedCredentials: async (provider) => sharedCredentials(env, provider),
    sourceCredentials: async (source) => sourceCredentials(env, source)
  };
}
function sharedCredentials(env, provider) {
  switch (provider) {
    case "github":
      return compact([
        credential("bearer", env.GH_TOKEN, "GH_TOKEN"),
        credential("bearer", env.GITHUB_TOKEN, "GITHUB_TOKEN")
      ]);
    case "azure-devops":
      return compact([
        credential("bearer", env.AZURE_DEVOPS_ACCESS_TOKEN, "AZURE_DEVOPS_ACCESS_TOKEN"),
        credential("basic-pat", env.AZURE_DEVOPS_EXT_PAT, "AZURE_DEVOPS_EXT_PAT")
      ]);
    case "gitlab":
      return compact([
        credential("bearer", env.GITLAB_OAUTH_TOKEN, "GITLAB_OAUTH_TOKEN"),
        credential("private-token", env.GITLAB_TOKEN, "GITLAB_TOKEN")
      ]);
  }
}
function sourceCredentials(env, source) {
  const suffix = (0, import_core2.normalizedSourceCredentialId)(source.id);
  switch (source.provider) {
    case "github":
      return compact([credential("bearer", env[`AI_MARKETPLACE_GITHUB_TOKEN_${suffix}`], `AI_MARKETPLACE_GITHUB_TOKEN_${suffix}`)]);
    case "azure-devops":
      return compact([
        credential("bearer", env[`AI_MARKETPLACE_AZURE_DEVOPS_ACCESS_TOKEN_${suffix}`], `AI_MARKETPLACE_AZURE_DEVOPS_ACCESS_TOKEN_${suffix}`),
        credential("basic-pat", env[`AI_MARKETPLACE_AZURE_DEVOPS_PAT_${suffix}`], `AI_MARKETPLACE_AZURE_DEVOPS_PAT_${suffix}`)
      ]);
    case "gitlab":
      return compact([
        credential("bearer", env[`AI_MARKETPLACE_GITLAB_OAUTH_TOKEN_${suffix}`], `AI_MARKETPLACE_GITLAB_OAUTH_TOKEN_${suffix}`),
        credential("private-token", env[`AI_MARKETPLACE_GITLAB_TOKEN_${suffix}`], `AI_MARKETPLACE_GITLAB_TOKEN_${suffix}`)
      ]);
  }
}
function credential(kind, token, source) {
  return token ? { kind, token, source } : void 0;
}
function compact(values) {
  const seen = /* @__PURE__ */ new Set();
  return values.filter((item) => Boolean(item)).filter((item) => {
    const key = `${item.kind}:${item.token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// packages/marketplace-node-cli/src/mcpScriptRunner.ts
var maximumOutputLength = 64 * 1024;

// plugins/ai-marketplace-harness/src/index.ts
var name = "ai-marketplace-harness";
var inject = [];
var profileName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
var bundleName = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
var policy = {
  platform: "deepseek-harness",
  displayName: "DeepSeek Harness",
  configFileName: "deepseek-harness.json",
  mcpConfigRelativePath: "",
  supportedScopes: ["workspace", "global"]
};
var userHome = homedir2();
var dshHome = process.env.DSH_HOME || join2(userHome, ".dsh");
var pluginRoot = resolve4(dirname2(fileURLToPath(import.meta.url)), "..");
var testedHarnessVersion = "0.1.5-rc.3";
function apply(ctx) {
  ctx.inject(["systemPrompt"], (ready) => ready.effect(() => ready.systemPrompt.section({
    name: "ai-marketplace:rules",
    order: 75,
    interpolate: false,
    text: ({ agent }) => collectRules(agent?.session?.header?.cwd)
  }), "AI Marketplace rule instructions"));
  ctx.inject(["webServer", "connection", "sessions"], (ready) => ready.effect(() => ready.webServer.register({
    kind: "exact",
    path: "/ai-marketplace/api",
    handler: (req, res) => handleRequest(ready, req, res)
  }), "AI Marketplace API"));
}
async function handleRequest(ctx, req, res) {
  const rejection = ctx.connection.requestRejection(req);
  if (rejection !== void 0) {
    respond(res, rejection, { error: "Unauthorized" });
    return;
  }
  if (req.method !== "POST") {
    respond(res, 405, { error: "Method not allowed" });
    return;
  }
  try {
    const body = await readBody(req);
    if (typeof body.profile !== "string" || !profileName.test(body.profile)) throw new Error("Invalid Harness profile.");
    const profile = body.profile;
    const session = typeof body.sessionId === "string" ? ctx.sessions.get(body.sessionId) : void 0;
    const workspace = session?.header.cwd || process.cwd();
    const storage = new HarnessStorage(workspace);
    await storage.validateRoots();
    const raw = await readHostConfig(storage, policy);
    const config = { ...toMarketplaceConfig(raw, policy), deepseekHarnessProfile: profile };
    const service = new MarketplaceService({
      storage,
      configuration: { read: () => config },
      credentials: createEnvironmentCredentialProvider(process.env),
      logger: { log: () => void 0 },
      harnessProfileManager: new ProfileManager()
    });
    const action = body.action;
    if (action === "model" || action === "refresh") {
      let catalog = [];
      let warning;
      if (action === "refresh") {
        try {
          catalog = await service.refreshCatalog();
        } catch (error) {
          warning = message4(error);
        }
      }
      const installed2 = (await service.listInstalled()).filter((item) => item.platform === "deepseek-harness");
      const model = toSerializableMarketplaceModel({
        packages: catalog.filter((pkg2) => pkg2.manifest.platforms.includes("deepseek-harness")),
        installed: installed2,
        configured: Boolean(config.repositories?.length),
        autoUpdateEnabled: config.autoUpdateEnabled ?? false,
        defaultPlatform: "deepseek-harness",
        autoInstallGroups: config.autoInstallGroups
      });
      respond(res, 200, { model, profile, profiles: await profiles(), warning });
      return;
    }
    if (!isAction(action) || typeof body.packageId !== "string" || typeof body.sourceId !== "string" || typeof body.qualifiedName !== "string" || !["workspace", "global"].includes(String(body.scope))) {
      respond(res, 400, { error: "Invalid package action" });
      return;
    }
    const scope = body.scope;
    if (scope === "workspace" && !session?.header.cwd) throw new Error("Select a live Harness session with a workspace before using workspace delivery.");
    const installed = (await service.listInstalled()).filter((item) => item.platform === "deepseek-harness");
    const current = installed.find((item) => item.id === body.packageId && item.sourceId === body.sourceId && item.qualifiedName === body.qualifiedName && item.scope === scope && (!item.harnessBundle || item.harnessBundle.profile === profile) && (!item.harnessProfile || item.harnessProfile === profile));
    let pkg;
    if (["install", "update", "revert", "migrate"].includes(action)) {
      const catalog = await service.refreshCatalog();
      pkg = catalog.find((item) => item.manifest.id === body.packageId && item.source.id === body.sourceId && item.manifest.qualifiedName === body.qualifiedName && item.manifest.platforms.includes("deepseek-harness"));
      if (!pkg) throw new Error("Package is absent from the selected catalog source.");
    }
    if (action === "install") await service.install(pkg, "deepseek-harness", scope);
    else if (action === "update") await service.update(pkg, required(current));
    else if (action === "migrate") {
      const predecessor = installed.find((item) => item.id === body.predecessorId && item.sourceId === body.predecessorSourceId && item.qualifiedName === body.predecessorQualifiedName && item.scope === scope && (!item.harnessBundle || item.harnessBundle.profile === profile) && (!item.harnessProfile || item.harnessProfile === profile));
      await service.migrate(pkg, required(predecessor));
    } else if (action === "revert") {
      if (!pkg.manifest.previousVersion) throw new Error("Package has no previous version.");
      await service.revert(pkg, required(current), pkg.manifest.previousVersion);
    } else if (action === "uninstall") await service.uninstall(required(current));
    else if (action === "hotload") await service.hotload(required(current));
    else await service.offload(required(current));
    respond(res, 200, { ok: true });
  } catch (error) {
    respond(res, 400, { error: message4(error) });
  }
}
function required(item) {
  if (!item) throw new Error("No matching package is installed in this profile and scope.");
  return item;
}
function isAction(value) {
  return typeof value === "string" && ["install", "update", "migrate", "revert", "uninstall", "hotload", "offload"].includes(value);
}
async function readBody(req) {
  const chunks = [];
  let length = 0;
  await new Promise((resolveRead, rejectRead) => {
    req.on("data", (chunk) => {
      if (!chunk) return;
      length += chunk.length;
      if (length > 16384) rejectRead(new Error("Request is too large."));
      else chunks.push(chunk);
    });
    req.on("end", () => resolveRead());
    req.on("error", () => rejectRead(new Error("Request failed.")));
  });
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request body.");
  return value;
}
function respond(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}
async function profiles() {
  try {
    return (await readdir(join2(dshHome, "profiles"), { withFileTypes: true })).filter((item) => item.isDirectory() && profileName.test(item.name)).map((item) => item.name).sort();
  } catch {
    return ["web"];
  }
}
var HarnessStorage = class {
  ordinary;
  harness;
  constructor(workspace) {
    this.ordinary = new NodeMarketplaceStorage(workspace, userHome);
    this.harness = new NodeMarketplaceStorage(workspace, dshHome);
  }
  async validateRoots() {
    await this.ordinary.validateRoots();
    await this.harness.validateRoots();
  }
  selected(scope, path2) {
    if (scope === "global" && path2.startsWith(".dsh/")) return { storage: this.harness, path: path2.slice(5) };
    return { storage: this.ordinary, path: path2 };
  }
  readFile(scope, path2) {
    const at = this.selected(scope, path2);
    return at.storage.readFile(scope, at.path);
  }
  exists(scope, path2) {
    const at = this.selected(scope, path2);
    return at.storage.exists(scope, at.path);
  }
  writeFile(scope, path2, content) {
    const at = this.selected(scope, path2);
    return at.storage.writeFile(scope, at.path, content);
  }
  writeFileAtomic(scope, path2, content) {
    const at = this.selected(scope, path2);
    return at.storage.writeFileAtomic(scope, at.path, content);
  }
  replaceDirectory(scope, path2, files) {
    const at = this.selected(scope, path2);
    return at.storage.replaceDirectory(scope, at.path, files);
  }
  async move(scope, from, to) {
    const source = this.selected(scope, from);
    const target = this.selected(scope, to);
    if (source.storage !== target.storage) {
      if (scope !== "global" || await target.storage.exists(scope, target.path)) throw new Error("Harness move destination already exists.");
      const sourcePath = await source.storage.assertSafe("global", source.path, false);
      const files = [];
      const walk = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path2 = join2(directory, entry.name);
          const stat2 = await lstat3(path2);
          if (stat2.isSymbolicLink()) throw new Error("Harness payload contains a symlink.");
          if (stat2.isDirectory()) await walk(path2);
          else if (stat2.isFile()) files.push({ relativePath: relative2(sourcePath, path2).replaceAll("\\", "/"), content: await readFile2(path2) });
          else throw new Error("Harness payload contains an unsupported filesystem entry.");
        }
      };
      await walk(sourcePath);
      await target.storage.replaceDirectory(scope, target.path, files);
      await source.storage.remove(scope, source.path);
      return;
    }
    await source.storage.move(scope, source.path, target.path);
  }
  remove(scope, path2) {
    const at = this.selected(scope, path2);
    return at.storage.remove(scope, at.path);
  }
  async listFiles(scope, path2) {
    if (scope === "cloud") throw new Error("Cloud delivery is unsupported for Harness.");
    const at = this.selected(scope, path2);
    const root = await at.storage.assertSafe(scope, at.path, false);
    const files = [];
    const walk = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const child = join2(directory, entry.name);
        const stat2 = await lstat3(child);
        if (stat2.isSymbolicLink()) throw new Error("Harness payload contains a symlink.");
        if (stat2.isDirectory()) await walk(child);
        else if (stat2.isFile()) files.push(relative2(root, child).replaceAll("\\", "/"));
        else throw new Error("Harness payload contains an unsupported filesystem entry.");
      }
    };
    await walk(root);
    return files.sort();
  }
};
var ProfileManager = class {
  async ensureBridge(profile) {
    const dependency = await this.dependency(profile, name);
    if (dependency === void 0) await this.add(profile, name, "");
  }
  async add(profile, bundle, payload) {
    const path2 = payload ? resolve4(userHome, payload) : pluginRoot;
    await this.assertDependency(profile, bundle, path2, true);
    await this.run(["plugin", "--profile", profile, "add", `file:${path2.replaceAll("\\", "/")}`]);
  }
  async remove(profile, bundle, payload) {
    await this.assertDependency(profile, bundle, resolve4(userHome, payload), false);
    await this.run(["plugin", "--profile", profile, "remove", bundle]);
  }
  async dependency(profile, bundle) {
    if (!profileName.test(profile) || !bundleName.test(bundle)) throw new Error("Invalid Harness profile or bundle name.");
    try {
      const value = JSON.parse(await readFile2(join2(dshHome, "profiles", profile, "package.json"), "utf8"));
      if (!value || typeof value !== "object") return void 0;
      const deps = value.dependencies;
      return deps && typeof deps === "object" ? deps[bundle] : void 0;
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  }
  async assertDependency(profile, bundle, path2, allowMissing) {
    const dependency = await this.dependency(profile, bundle);
    if (dependency === void 0 && allowMissing) return;
    if (typeof dependency !== "string" || !/^(?:file|link):/.test(dependency) || resolve4(dshHome, "profiles", profile, dependency.slice(dependency.indexOf(":") + 1)) !== path2) {
      throw new Error(`Harness bundle '${bundle}' has another owner in profile '${profile}'.`);
    }
  }
  async run(args) {
    const cliScript = process.argv[1]?.replaceAll("\\", "/").includes("/@deepseek-ai/dsh/lib/bin.js") ? process.argv[1] : void 0;
    const version = await this.execute(cliScript, ["--version"]);
    if (version.trim() !== testedHarnessVersion) throw new Error(`DeepSeek Harness ${testedHarnessVersion} is required.`);
    await this.execute(cliScript, args);
  }
  async execute(cliScript, args) {
    return new Promise((resolveRun, rejectRun) => {
      const windows = process.platform === "win32";
      const script = "$dshArgs = @(ConvertFrom-Json $env:AI_MARKETPLACE_DSH_ARGUMENTS); & dsh @dshArgs; exit $LASTEXITCODE";
      const child = spawn2(cliScript ? process.execPath : windows ? "powershell.exe" : "dsh", cliScript ? [cliScript, ...args] : windows ? ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")] : args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"], env: windows && !cliScript ? { ...process.env, AI_MARKETPLACE_DSH_ARGUMENTS: JSON.stringify(args) } : process.env });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output = `${output}${chunk.toString("utf8")}`.slice(-1024);
      });
      child.once("error", rejectRun);
      child.once("close", (code) => code === 0 ? resolveRun(output) : rejectRun(new Error(`dsh plugin exited with code ${code}.`)));
    });
  }
};
function collectRules(cwd) {
  const profileIndex = process.argv.indexOf("--profile");
  const profile = profileIndex >= 0 && profileName.test(process.argv[profileIndex + 1] ?? "") ? process.argv[profileIndex + 1] : "web";
  const roots = [{ path: join2(dshHome, "rules"), scope: "global", state: join2(userHome, ".ai_marketplace", "installed.json") }];
  if (cwd) roots.push({ path: join2(resolve4(cwd), ".dsh", "rules"), scope: "workspace", state: join2(resolve4(cwd), ".ai_marketplace", "installed.json") });
  const sections = [];
  for (const root of roots) {
    if (!isDirectory(root.path)) continue;
    const managed = managedRuleIds(root.state, root.scope, profile);
    for (const id of readdirSync(root.path).sort()) {
      if (!profileName.test(id)) continue;
      if (!managed.has(id)) continue;
      const path2 = join2(root.path, id, "RULE.md");
      if (!isFile2(path2)) continue;
      sections.push(`## ${id}
${readFileSync(path2, "utf8")}`);
    }
  }
  return sections.length ? `# AI Marketplace rules

${sections.join("\n\n")}`.slice(0, 65536) : "";
}
function managedRuleIds(statePath, scope, profile) {
  if (!isFile2(statePath)) return /* @__PURE__ */ new Set();
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (!state || typeof state !== "object" || !Array.isArray(state.packages)) return /* @__PURE__ */ new Set();
    return new Set(state.packages.filter((item) => Boolean(item) && typeof item === "object" && typeof item.id === "string" && item.platform === "deepseek-harness" && item.type === "rule" && item.scope === scope && item.harnessProfile === profile && item.installedPath === `.dsh/rules/${item.id}`).map((item) => item.id));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function isDirectory(path2) {
  try {
    return lstatSync(path2).isDirectory();
  } catch {
    return false;
  }
}
function isFile2(path2) {
  try {
    return lstatSync(path2).isFile();
  } catch {
    return false;
  }
}
function message4(error) {
  return error instanceof Error ? error.message : String(error);
}
export {
  apply,
  inject,
  name
};
