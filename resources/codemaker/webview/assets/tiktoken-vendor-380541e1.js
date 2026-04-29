let I, q, F, J, H, P, G, K, Q, ke, ye, he;
let __tla = (async () => {
  const O = "/assets/tiktoken_bg-dedd9a7b.wasm", D = async (e = {}, n) => {
    let r;
    if (n.startsWith("data:")) {
      const _ = n.replace(/^data:.*?base64,/, "");
      let o;
      if (typeof Buffer == "function" && typeof Buffer.from == "function")
        o = Buffer.from(_, "base64");
      else if (typeof atob == "function") {
        const i = atob(_);
        o = new Uint8Array(i.length);
        for (let a = 0; a < i.length; a++)
          o[a] = i.charCodeAt(a);
      } else
        throw new Error("Cannot decode base64-encoded data URL");
      r = await WebAssembly.instantiate(o, e);
    } else {
      const _ = await fetch(n), o = _.headers.get("Content-Type") || "";
      if ("instantiateStreaming" in WebAssembly && o.startsWith("application/wasm"))
        r = await WebAssembly.instantiateStreaming(_, e);
      else {
        const i = await _.arrayBuffer();
        r = await WebAssembly.instantiate(i, e);
      }
    }
    return r.instance.exports;
  };
  let t;
  F = function(e) {
    t = e;
  };
  const L = typeof TextDecoder > "u" ? (0, module.require)("util").TextDecoder : TextDecoder;
  let z = new L("utf-8", {
    ignoreBOM: true,
    fatal: true
  });
  z.decode();
  let m = null;
  function y() {
    return (m === null || m.byteLength === 0) && (m = new Uint8Array(t.memory.buffer)), m;
  }
  function h(e, n) {
    return e = e >>> 0, z.decode(y().subarray(e, e + n));
  }
  const b = new Array(128).fill(void 0);
  b.push(void 0, null, true, false);
  let k = b.length;
  function l(e) {
    k === b.length && b.push(b.length + 1);
    const n = k;
    return k = b[n], b[n] = e, n;
  }
  function U(e, n) {
    try {
      return e.apply(this, n);
    } catch (r) {
      t.__wbindgen_export_0(l(r));
    }
  }
  function A(e) {
    return b[e];
  }
  function C(e) {
    e < 132 || (b[e] = k, k = e);
  }
  function w(e) {
    const n = A(e);
    return C(e), n;
  }
  let u = 0;
  const R = typeof TextEncoder > "u" ? (0, module.require)("util").TextEncoder : TextEncoder;
  let x = new R("utf-8");
  const B = typeof x.encodeInto == "function" ? function(e, n) {
    return x.encodeInto(e, n);
  } : function(e, n) {
    const r = x.encode(e);
    return n.set(r), {
      read: e.length,
      written: r.length
    };
  };
  function f(e, n, r) {
    if (r === void 0) {
      const d = x.encode(e), c = n(d.length, 1) >>> 0;
      return y().subarray(c, c + d.length).set(d), u = d.length, c;
    }
    let _ = e.length, o = n(_, 1) >>> 0;
    const i = y();
    let a = 0;
    for (; a < _; a++) {
      const d = e.charCodeAt(a);
      if (d > 127)
        break;
      i[o + a] = d;
    }
    if (a !== _) {
      a !== 0 && (e = e.slice(a)), o = r(o, _, _ = a + e.length * 3, 1) >>> 0;
      const d = y().subarray(o + a, o + _), c = B(e, d);
      a += c.written, o = r(o, _, a, 1) >>> 0;
    }
    return u = a, o;
  }
  function N(e) {
    return e == null;
  }
  let p = null;
  function s() {
    return (p === null || p.buffer.detached === true || p.buffer.detached === void 0 && p.buffer !== t.memory.buffer) && (p = new DataView(t.memory.buffer)), p;
  }
  let v = null;
  function j() {
    return (v === null || v.byteLength === 0) && (v = new Uint32Array(t.memory.buffer)), v;
  }
  function M(e, n) {
    return e = e >>> 0, j().subarray(e / 4, e / 4 + n);
  }
  function V(e, n) {
    const r = n(e.length * 1, 1) >>> 0;
    return y().set(e, r / 1), u = e.length, r;
  }
  function $(e, n) {
    const r = n(e.length * 4, 4) >>> 0;
    return j().set(e, r / 4), u = e.length, r;
  }
  function T(e, n) {
    return e = e >>> 0, y().subarray(e / 1, e / 1 + n);
  }
  ye = function(e, n) {
    if (t == null)
      throw new Error("tiktoken: WASM binary has not been propery initialized.");
    try {
      const i = t.__wbindgen_add_to_stack_pointer(-16), a = f(e, t.__wbindgen_export_1, t.__wbindgen_export_2), d = u;
      t.get_encoding(i, a, d, l(n));
      var r = s().getInt32(i + 4 * 0, true), _ = s().getInt32(i + 4 * 1, true), o = s().getInt32(i + 4 * 2, true);
      if (o)
        throw w(_);
      return I.__wrap(r);
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  };
  ke = function(e, n) {
    if (t == null)
      throw new Error("tiktoken: WASM binary has not been propery initialized.");
    try {
      const i = t.__wbindgen_add_to_stack_pointer(-16), a = f(e, t.__wbindgen_export_1, t.__wbindgen_export_2), d = u;
      t.encoding_for_model(i, a, d, l(n));
      var r = s().getInt32(i + 4 * 0, true), _ = s().getInt32(i + 4 * 1, true), o = s().getInt32(i + 4 * 2, true);
      if (o)
        throw w(_);
      return I.__wrap(r);
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  };
  he = function(e) {
    if (t == null)
      throw new Error("tiktoken: WASM binary has not been propery initialized.");
    let n, r;
    try {
      const g = t.__wbindgen_add_to_stack_pointer(-16), W = f(e, t.__wbindgen_export_1, t.__wbindgen_export_2), E = u;
      t.get_encoding_name_for_model(g, W, E);
      var _ = s().getInt32(g + 4 * 0, true), o = s().getInt32(g + 4 * 1, true), i = s().getInt32(g + 4 * 2, true), a = s().getInt32(g + 4 * 3, true), d = _, c = o;
      if (a)
        throw d = 0, c = 0, w(i);
      return n = d, r = c, h(d, c);
    } finally {
      t.__wbindgen_add_to_stack_pointer(16), t.__wbindgen_export_3(n, r, 1);
    }
  };
  const S = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((e) => t.__wbg_tiktoken_free(e >>> 0, 1));
  I = class {
    static __wrap(n) {
      n = n >>> 0;
      const r = Object.create(I.prototype);
      return r.__wbg_ptr = n, S.register(r, r.__wbg_ptr, r), r;
    }
    __destroy_into_raw() {
      const n = this.__wbg_ptr;
      return this.__wbg_ptr = 0, S.unregister(this), n;
    }
    free() {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      const n = this.__destroy_into_raw();
      t.__wbg_tiktoken_free(n, 0);
    }
    constructor(n, r, _) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      const o = f(n, t.__wbindgen_export_1, t.__wbindgen_export_2), i = u, a = f(_, t.__wbindgen_export_1, t.__wbindgen_export_2), d = u, c = t.tiktoken_new(o, i, l(r), a, d);
      return this.__wbg_ptr = c >>> 0, S.register(this, this.__wbg_ptr, this), this;
    }
    get name() {
      try {
        const _ = t.__wbindgen_add_to_stack_pointer(-16);
        t.tiktoken_name(_, this.__wbg_ptr);
        var n = s().getInt32(_ + 4 * 0, true), r = s().getInt32(_ + 4 * 1, true);
        let o;
        return n !== 0 && (o = h(n, r).slice(), t.__wbindgen_export_3(n, r * 1, 1)), o;
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    encode(n, r, _) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      try {
        const g = t.__wbindgen_add_to_stack_pointer(-16), W = f(n, t.__wbindgen_export_1, t.__wbindgen_export_2), E = u;
        t.tiktoken_encode(g, this.__wbg_ptr, W, E, l(r), l(_));
        var o = s().getInt32(g + 4 * 0, true), i = s().getInt32(g + 4 * 1, true), a = s().getInt32(g + 4 * 2, true), d = s().getInt32(g + 4 * 3, true);
        if (d)
          throw w(a);
        var c = M(o, i).slice();
        return t.__wbindgen_export_3(o, i * 4, 4), c;
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    encode_ordinary(n) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      try {
        const i = t.__wbindgen_add_to_stack_pointer(-16), a = f(n, t.__wbindgen_export_1, t.__wbindgen_export_2), d = u;
        t.tiktoken_encode_ordinary(i, this.__wbg_ptr, a, d);
        var r = s().getInt32(i + 4 * 0, true), _ = s().getInt32(i + 4 * 1, true), o = M(r, _).slice();
        return t.__wbindgen_export_3(r, _ * 4, 4), o;
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    encode_with_unstable(n, r, _) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      try {
        const d = t.__wbindgen_add_to_stack_pointer(-16), c = f(n, t.__wbindgen_export_1, t.__wbindgen_export_2), g = u;
        t.tiktoken_encode_with_unstable(d, this.__wbg_ptr, c, g, l(r), l(_));
        var o = s().getInt32(d + 4 * 0, true), i = s().getInt32(d + 4 * 1, true), a = s().getInt32(d + 4 * 2, true);
        if (a)
          throw w(i);
        return w(o);
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    encode_single_token(n) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      const r = V(n, t.__wbindgen_export_1), _ = u;
      return t.tiktoken_encode_single_token(this.__wbg_ptr, r, _) >>> 0;
    }
    decode(n) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      try {
        const i = t.__wbindgen_add_to_stack_pointer(-16), a = $(n, t.__wbindgen_export_1), d = u;
        t.tiktoken_decode(i, this.__wbg_ptr, a, d);
        var r = s().getInt32(i + 4 * 0, true), _ = s().getInt32(i + 4 * 1, true), o = T(r, _).slice();
        return t.__wbindgen_export_3(r, _ * 1, 1), o;
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    decode_single_token_bytes(n) {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      try {
        const i = t.__wbindgen_add_to_stack_pointer(-16);
        t.tiktoken_decode_single_token_bytes(i, this.__wbg_ptr, n);
        var r = s().getInt32(i + 4 * 0, true), _ = s().getInt32(i + 4 * 1, true), o = T(r, _).slice();
        return t.__wbindgen_export_3(r, _ * 1, 1), o;
      } finally {
        t.__wbindgen_add_to_stack_pointer(16);
      }
    }
    token_byte_values() {
      if (t == null)
        throw new Error("tiktoken: WASM binary has not been propery initialized.");
      const n = t.tiktoken_token_byte_values(this.__wbg_ptr);
      return w(n);
    }
  };
  q = function() {
    return U(function(e, n) {
      const r = JSON.parse(h(e, n));
      return l(r);
    }, arguments);
  };
  J = function() {
    return U(function(e) {
      const n = JSON.stringify(A(e));
      return l(n);
    }, arguments);
  };
  H = function(e, n) {
    const r = new Error(h(e, n));
    return l(r);
  };
  P = function(e) {
    return A(e) === void 0;
  };
  G = function(e) {
    w(e);
  };
  K = function(e, n) {
    if (t == null)
      throw new Error("tiktoken: WASM binary has not been propery initialized.");
    const r = A(n), _ = typeof r == "string" ? r : void 0;
    var o = N(_) ? 0 : f(_, t.__wbindgen_export_1, t.__wbindgen_export_2), i = u;
    s().setInt32(e + 4 * 1, i, true), s().setInt32(e + 4 * 0, o, true);
  };
  Q = function(e, n) {
    throw new Error(h(e, n));
  };
  URL = globalThis.URL;
  const X = await D({
    "./tiktoken_bg.js": {
      __wbindgen_object_drop_ref: G,
      __wbindgen_is_undefined: P,
      __wbg_stringify_f7ed6987935b4a24: J,
      __wbindgen_string_get: K,
      __wbindgen_error_new: H,
      __wbg_parse_def2e24ef1252aff: q,
      __wbindgen_throw: Q
    }
  }, O), { memory: Y, __wbg_tiktoken_free: Z, tiktoken_new: ee, tiktoken_name: te, tiktoken_encode: ne, tiktoken_encode_ordinary: re, tiktoken_encode_with_unstable: _e, tiktoken_encode_single_token: oe, tiktoken_decode: ie, tiktoken_decode_single_token_bytes: ae, tiktoken_token_byte_values: de, get_encoding: se, encoding_for_model: ce, get_encoding_name_for_model: ue, __wbindgen_export_0: ge, __wbindgen_export_1: le, __wbindgen_export_2: be, __wbindgen_add_to_stack_pointer: fe, __wbindgen_export_3: we } = X, pe = Object.freeze(Object.defineProperty({
    __proto__: null,
    __wbg_tiktoken_free: Z,
    __wbindgen_add_to_stack_pointer: fe,
    __wbindgen_export_0: ge,
    __wbindgen_export_1: le,
    __wbindgen_export_2: be,
    __wbindgen_export_3: we,
    encoding_for_model: ce,
    get_encoding: se,
    get_encoding_name_for_model: ue,
    memory: Y,
    tiktoken_decode: ie,
    tiktoken_decode_single_token_bytes: ae,
    tiktoken_encode: ne,
    tiktoken_encode_ordinary: re,
    tiktoken_encode_single_token: oe,
    tiktoken_encode_with_unstable: _e,
    tiktoken_name: te,
    tiktoken_new: ee,
    tiktoken_token_byte_values: de
  }, Symbol.toStringTag, {
    value: "Module"
  }));
  F(pe);
})();
export {
  I as Tiktoken,
  __tla,
  q as __wbg_parse_def2e24ef1252aff,
  F as __wbg_set_wasm,
  J as __wbg_stringify_f7ed6987935b4a24,
  H as __wbindgen_error_new,
  P as __wbindgen_is_undefined,
  G as __wbindgen_object_drop_ref,
  K as __wbindgen_string_get,
  Q as __wbindgen_throw,
  ke as encoding_for_model,
  ye as get_encoding,
  he as get_encoding_name_for_model
};
