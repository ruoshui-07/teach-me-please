/* 最小 DOM 桩 + 全局注入，供 smoke 测试共用 */
function mkEl(tag) {
  const e = {
    tagName: tag || "div", id: "", _html: "", _text: "", value: "", hidden: false,
    title: "", dataset: {}, style: {}, children: [], _listeners: {}, type: "",
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) {
        if (f === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c);
        else f ? this._s.add(c) : this._s.delete(c);
      },
      contains(c) { return this._s.has(c); }
    },
    get className() { return [...this.classList._s].join(" "); },
    set className(v) {
      this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean));
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild() { },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    fire(t, ev) { (this._listeners[t] || []).forEach((f) => f(ev || { target: this })); },
    focus() { }, select() { },
    closest() { return null; },
    querySelector() { return mkEl(); },
    querySelectorAll() { return []; }
  };
  return e;
}

const IDS = ["weekLabel", "demoBanner", "nickTeach", "noteTeach", "noteLearn",
  "gridTeach", "gridLearn", "chipsTeach", "chipsLearn", "passInput",
  "unlockBtn", "lockPanel", "wallPanel", "lockMsg", "lockBtn",
  "matchHint", "wall", "copyInvite", "toast"];

function install(opts) {
  const o = opts || {};
  const reg = {};
  IDS.forEach((id) => { reg["#" + id] = mkEl(); reg["#" + id].id = id; });
  // 对应 index.html 上的 hidden 属性
  reg["#wallPanel"].hidden = true;

  const tabs = [mkEl("button"), mkEl("button")];
  tabs[0].dataset.tab = "teach"; tabs[1].dataset.tab = "learn";
  tabs[0].classList.add("active");
  const panels = [mkEl("section"), mkEl("section")];
  panels[0].id = "panel-teach"; panels[0].classList.add("active");
  panels[1].id = "panel-learn";

  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };

  global.document = {
    readyState: "complete",
    body: mkEl("body"),
    querySelector: (s) => reg[s] || mkEl(),
    querySelectorAll: (s) => (s === ".tab" ? tabs : s === ".panel" ? panels : []),
    createElement: (t) => mkEl(t),
    addEventListener: () => { }
  };

  global.navigator = { clipboard: null };
  global.location = { href: "http://127.0.0.1:8899/" };
  global.fetch = o.fetch || (() => Promise.reject(new Error("no network in test")));

  global.window = {
    PEEK_DATA: {},
    PEEK_CONFIG: o.config || { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", AUTHOR: "ruoshui-07", SELF: "师妹" },
    isSecureContext: false,
    addEventListener: () => { }
  };

  require("../data.js");

  return { reg, tabs, panels, localStorageMap: mem };
}

module.exports = { install, mkEl };
