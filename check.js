/* 静态自检：HTML 里的 id、JS 用到的 class、CSS 是否都齐全 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const data = fs.readFileSync(path.join(root, "data.js"), "utf8");
const cfg = fs.readFileSync(path.join(root, "config.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");

let bad = 0;
const ok = (label, cond, extra) => {
  if (!cond) bad++;
  console.log((cond ? "  OK  " : "  X   ") + label + (extra ? "  " + extra : ""));
};

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const needed = ["weekLabel", "demoBanner", "nickTeach", "noteTeach", "noteLearn",
  "gridTeach", "gridLearn", "chipsTeach", "chipsLearn", "passInput",
  "unlockBtn", "lockPanel", "wallPanel", "lockMsg", "lockBtn",
  "matchHint", "wall", "copyInvite", "toast"];
const missing = needed.filter((i) => !htmlIds.has(i));
ok("app.js 引用的 id 全部存在", missing.length === 0, missing.join(","));

const cssCls = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const jsCls = [...new Set([...js.matchAll(/class="([a-zA-Z0-9 _-]+)"/g)]
  .flatMap((m) => m[1].split(/\s+/)))].filter(Boolean);
const missJs = jsCls.filter((c) => !cssCls.has(c));
ok("app.js 用到的 class 都有样式", missJs.length === 0, missJs.join(","));

const htmlCls = [...new Set([...html.matchAll(/class="([^"]+)"/g)]
  .flatMap((m) => m[1].split(/\s+/)))].filter(Boolean);
const missHtml = htmlCls.filter((c) => !cssCls.has(c));
ok("index.html 用到的 class 都有样式", missHtml.length === 0, missHtml.join(","));

// 默认端必须是师兄师姐端
const firstTab = (html.match(/class="tab active" data-tab="([^"]+)"/) || [])[1];
ok("默认 tab 是师兄师姐端(teach)", firstTab === "teach", firstTab || "未找到");
const activePanel = (html.match(/class="panel active" id="panel-([^"]+)"/) || [])[1];
ok("默认展开的面板是 teach", activePanel === "teach", activePanel || "未找到");

const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
const panels = [...html.matchAll(/id="panel-([^"]+)"/g)].map((m) => m[1]);
ok("tab 与 panel 一一对应", tabs.length === panels.length &&
  tabs.every((t) => panels.includes(t)), tabs.join(",") + " / " + panels.join(","));

// 师兄师姐端不该再出现预览 / 复制按钮
ok("已删掉「你在墙上的样子」预览", !html.includes("myPreview") && !html.includes("preview-label"));
ok("师兄师姐端没有复制邀请按钮",
  html.indexOf("copyInvite") > html.indexOf('id="panel-learn"') ||
  html.indexOf("copyInvite") === -1);

// 我的端只保留 时间 / 实验 / 补充
ok("我的端没有昵称输入框", !html.includes("nickLearn"));
ok("我的端有补充说明", html.includes('id="noteLearn"'));
ok("我的端有时间网格", html.includes('id="gridLearn"'));

const ids = [...data.matchAll(/id: "([a-z]+)", name/g)].map((m) => m[1]);
ok("data.js 内置科目数 = 13", ids.length === 13, ids.length + " 个");

ids.forEach((id) => {
  if (!new RegExp("\\('" + id + "'").test(sql)) {
    console.log("  X   schema.sql 缺少种子数据：" + id);
    bad++;
  }
});
ok("schema.sql 种子覆盖全部 13 个 id", true);

// 权限模型
ok("有 peek_self_token 函数读请求头",
  /x-peek-token/.test(sql) && /function public\.peek_self_token/.test(sql));
ok("people 只能读自己那一行",
  /create policy "peek people self read"[\s\S]{0,160}peek_self_token\(\)/.test(sql));
ok("slots 只能读自己那一行",
  /create policy "peek slots self read"[\s\S]{0,160}peek_self_token\(\)/.test(sql));
ok("people/slots 没有无条件 select 策略",
  !/create policy "peek (people|slots)[^"]*" on public\.(people|slots) for select using \(true\)/.test(sql));
ok("给了 people/slots 的 select 授权",
  /grant select on public\.people, public\.slots to anon/.test(sql));
ok("有口令校验函数 peek_board", /function public\.peek_board/.test(sql));
ok("peek_secret 开启了 RLS", /peek_secret\s+enable row level security/.test(sql));
ok("peek_secret 没有给 anon 任何 grant", !/grant [^;]*on public\.peek_secret/.test(sql));
ok("已移除 wishes 表", !/create table if not exists public\.wishes/.test(sql));

const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)]
  .map((m) => m[1]).filter((r) => !/^https?:/.test(r));
const missRef = refs.filter((r) => !fs.existsSync(path.join(root, r)));
ok("index.html 的本地引用都存在", missRef.length === 0, missRef.join(",") || refs.join(", "));

console.log("");
const cfgEmpty = /SUPABASE_URL:\s*""/.test(cfg);
console.log(cfgEmpty
  ? "  !   config.js 的密钥还是空的（演示模式）—— 上线前记得填"
  : "  OK  config.js 已填写密钥");
console.log("");
console.log(bad === 0 ? "全部通过 ✓" : bad + " 项未通过");
process.exitCode = bad === 0 ? 0 : 1;
