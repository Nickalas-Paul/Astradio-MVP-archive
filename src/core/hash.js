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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = sha256Hex;
exports.stableStringify = stableStringify;
async function sha256Hex(input) {
    var _a;
    if (typeof window !== 'undefined' && ((_a = window.crypto) === null || _a === void 0 ? void 0 : _a.subtle)) {
        const data = new TextEncoder().encode(input);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    else {
        // Node path (SSR)
        const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
        return createHash('sha256').update(input).digest('hex');
    }
}
function stableStringify(value) {
    const seen = new WeakSet();
    const stringify = (val) => {
        if (val && typeof val === 'object') {
            if (seen.has(val))
                return null;
            seen.add(val);
            if (Array.isArray(val))
                return val.map(stringify);
            return Object.keys(val).sort().reduce((acc, k) => {
                acc[k] = stringify(val[k]);
                return acc;
            }, {});
        }
        return val;
    };
    return JSON.stringify(stringify(value));
}
