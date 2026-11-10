/* 用假 PostgREST 验证「连真 Supabase 时」的行为
 *   重点：来访者只能写、读不到；只有带对的口令才能拿到汇总
 * 跑：node dev/smoke-remote.js
 */
const { install } = require("./stub");

const PASS = "peek2026";

const DB = {
  exp_categories: [
    { id: "culture", name: "细胞培养", emoji: "🧫", tier: 1, level: 1, hours: "1 h", why: "x", watch: ["a"], sort: 10, active: true },
    { id: "wb", name: "Western blot", emoji: "🧬", tier: 2, level: 2, hours: "2 d", why: "y", watch: ["b"], sort: 40, active: true },
    { id: "hidden", name: "不该出现", emoji: "🚫", tier: 2, level: 2, hours: "", why: "", watch: [], sort: 99, active: false }
  ],
  people: [],
  slots: []
};

const calls = [];

function parseQuery(qs) {
  const out = {};
  String(qs || "").split("&").filter(Boolean).forEach((kv) => {
    const i = kv.indexOf("=");
    out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });
  return out;
}
function eqMatch(row, f) {
  return Object.entries(f).every(([k, v]) => {
    if (["select", "order", "on_conflict"].includes(k)) return true;
    if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
    if (v === "true") return row[k] === true;
    if (v === "false") return row[k] === false;
    return true;
  });
}
const jsonRes = (obj, status) => ({
  ok: (status || 200) < 300, status: status || 200,
  text: async () => (obj === undefined ? "" : JSON.stringify(obj))
});

const mockFetch = async (url, opts) => {
  const method = (opts && opts.method) || "GET";
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean); // rest / v1 / <table|rpc> / [fn]
  const head = parts[2];
  const filters = parseQuery(u.search.slice(1));
  const headers = (opts && opts.headers) || {};
  const body = opts && opts.body ? JSON.parse(opts.body) : null;

  calls.push({ method, head, fn: parts[3], hasKey: !!headers.apikey,
               token: headers["x-peek-token"] || "" });

  if (!headers.apikey || !headers.Authorization) {
    return { ok: false, status: 401, text: async () => "no apikey" };
  }

  /* ---- RPC：口令校验 ---- */
  if (head === "rpc" && parts[3] === "peek_board") {
    if (body.p_pass !== PASS) return jsonRes(null);   // 口令错 → null
    return jsonRes({
      people: DB.people.filter((p) => p.week === body.p_week),
      slots: DB.slots.filter((s) => s.week === body.p_week)
    });
  }

  /* ---- 表 ---- */
  if (method === "GET") {
    let rows = DB[head] || [];
    if (head === "exp_categories") {
      rows = rows.filter((r) => r.active);
      rows = rows.filter((r) => eqMatch(r, filters));
    } else {
      // 模拟 RLS：只能读到 token 与请求头相同的那一行
      const mineTok = headers["x-peek-token"] || "";
      const matched = rows.filter((r) => eqMatch(r, filters));
      const blocked = matched.filter((r) => !(mineTok && r.token === mineTok)).length;
      calls[calls.length - 1].blocked = blocked;   // 被 RLS 挡下的「别人的行」
      rows = matched.filter((r) => mineTok && r.token === mineTok);
    }
    return jsonRes(rows.map((r) => ({ ...r })));
  }

  if (method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    rows.forEach((r) => {
      if (head === "people") {
        const i = DB.people.findIndex((x) => x.token === r.token);
        if (i >= 0) DB.people[i] = { ...DB.people[i], ...r };
        else DB.people.push({ ...r });
      } else if (head === "slots") {
        if (!DB.slots.some((x) => x.token === r.token && x.week === r.week &&
            x.day === r.day && x.period === r.period)) {
          DB.slots.push({ ...r });
        }
      }
    });
    return jsonRes(null, 201);
  }

  if (method === "DELETE") {
    DB[head] = DB[head].filter((r) => !eqMatch(r, filters));
    return jsonRes(null, 200);
  }

  return jsonRes(null, 200);
};

/* 预置：上一周（同一周）师姐就用这个 token 填过，
   这一次浏览器里只剩 token、草稿被清空 —— 用来验证「读回自己」 */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + "-W" + String(Math.ceil(((t - ys) / 86400000 + 1) / 7)).padStart(2, "0");
}
const WEEK = isoWeek(new Date());
const OLD_TEACH = "old-teach-token";
const OLD_LEARN = "old-learn-token";
const OTHER = "someone-else-token";

DB.people.push(
  { token: OLD_TEACH, nickname: "小满", role: "senior", week: WEEK,
    exp_ids: ["culture"], note: "上次填的备注" },
  { token: OLD_LEARN, nickname: "师妹", role: "me", week: WEEK,
    exp_ids: [], note: "" },
  { token: OTHER, nickname: "不该被我看到的人", role: "senior", week: WEEK,
    exp_ids: ["wb"], note: "秘密" }
);
DB.slots.push(
  { token: OLD_TEACH, week: WEEK, day: 2, period: "上午" },
  { token: OLD_TEACH, week: WEEK, day: 3, period: "下午" },
  { token: OTHER, week: WEEK, day: 0, period: "上午" }
);

const { reg, tabs, localStorageMap } = install({
  fetch: mockFetch,
  config: {
    SUPABASE_URL: "https://demo-project.supabase.co/rest/v1/",  // 故意多粘了 /rest/v1/
    SUPABASE_ANON_KEY: "fake-anon-key"
  }
});

// 只有 token，没有草稿 —— 模拟「换了台设备 / 被清了缓存但 token 还在」
localStorageMap.set("peek:cache:v2", JSON.stringify({
  "token:teach": OLD_TEACH,
  "token:learn": OLD_LEARN
}));

require("../app.js");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
process.on("uncaughtException", (e) => errors.push(e));

(async () => {
  await wait(200);

  console.log("演示横幅已隐藏        :", reg["#demoBanner"].hidden);
  const chipsT = reg["#chipsTeach"].children.filter((c) => c.dataset && c.dataset.id);
  console.log("chips 来自远端        :", chipsT.map((c) => c.dataset.id).join(","));

  /* ---- 读回自己：草稿被清了，靠 token 从服务器拉回来 ---- */
  const lit = reg["#gridTeach"].children
    .flatMap((r) => r.children)
    .filter((c) => c.classList && c.classList.contains("on"));
  console.log("读回自己的时间片      :", lit.map((c) => c.dataset.key).join(" ") || "(无)");
  console.log("读回自己的补充        :", reg["#noteTeach"].value || "(空)");
  console.log("读回自己的昵称        :", reg["#nickTeach"].value || "(空)");
  console.log("读回自己的实验        :",
    chipsT.filter((c) => c.classList.contains("on")).map((c) => c.dataset.id).join(",") || "(无)");

  /* ---- 别人那一行读不到 ---- */
  const t0 = JSON.stringify(reg["#wall"].innerHTML);
  console.log("别人的名字没漏出来    :", !t0.includes("不该被我看到的人"));

  /* ---- 师兄师姐写 ---- */
  reg["#nickTeach"].value = "小满";
  reg["#nickTeach"].fire("input");
  reg["#gridTeach"].children[0].children[1].fire("click");           // 周一上午
  chipsT.find((c) => c.dataset.id === "wb").fire("click");
  await wait(700);

  const senior = DB.people.find((p) => p.token === OLD_TEACH);
  console.log("写回自己那一条        :", !!senior,
    JSON.stringify(senior && { nick: senior.nickname, role: senior.role, exps: senior.exp_ids }));
  console.log("没有多出重复的 person ：", DB.people.filter((p) => p.token === OLD_TEACH).length === 1);
  console.log("自己的 slots 已重写   :",
    DB.slots.filter((s) => s.token === OLD_TEACH).map((s) => s.day + "/" + s.period).join(" "));

  /* ---- 我的端 ---- */
  tabs[1].fire("click");
  reg["#gridLearn"].children[0].children[1].fire("click");
  reg["#chipsLearn"].children.find((c) => c.dataset && c.dataset.id === "wb").fire("click");
  await wait(700);
  const me = DB.people.find((p) => p.role === "me");
  console.log("我的端 role=me        :", !!me, me ? me.nickname : "");

  /* ---- 隐私：直接拿假接口试「不给我 token 能不能读到别人」 ---- */
  const appReads = calls.filter((c) =>
    c.method === "GET" && (c.head === "people" || c.head === "slots"));
  console.log("app 读表请求全部带 token:", appReads.length > 0 && appReads.every((c) => !!c.token));

  const H = { apikey: "k", Authorization: "Bearer k" };
  const base = "https://demo-project.supabase.co/rest/v1/";

  const r1 = await mockFetch(base + "people?select=*", { headers: { ...H } });
  const n1 = JSON.parse(await r1.text()).length;

  const r2 = await mockFetch(base + "people?select=*",
    { headers: { ...H, "x-peek-token": OTHER } });
  const n2 = JSON.parse(await r2.text());

  console.log("不带 token 查表返回    :", n1, "行（应为 0）");
  console.log("带别人的 token 查表    :", n2.length, "行 →",
    n2.map((x) => x.nickname).join(",") || "(读不到)");
  console.log("持有他人 token 只能读他自己:", n2.every((x) => x.token === OTHER));

  /* ---- 口令：错 ---- */
  console.log("解锁前 wallPanel 隐藏 :", reg["#wallPanel"].hidden);
  reg["#passInput"].value = "wrong-pass";
  reg["#unlockBtn"].fire("click");
  await wait(250);
  console.log("错口令仍锁着          :", reg["#wallPanel"].hidden === true);
  console.log("错口令提示            :", reg["#lockMsg"].textContent);

  /* ---- 口令：对 ---- */
  reg["#passInput"].value = PASS;
  reg["#unlockBtn"].fire("click");
  await wait(300);
  console.log("对口令后解锁          :", reg["#wallPanel"].hidden === false);

  const wall = reg["#wall"].innerHTML;
  console.log("墙上有师姐            :", wall.includes("小满"));
  console.log("墙上有实验名          :", wall.includes("Western blot"));
  console.log("时间对得上 → 高亮     :", wall.includes('class="pcard hot"'));
  console.log("匹配提示              :", reg["#matchHint"].textContent);
  console.log("我的端(role=me)不投墙 :", !wall.includes("师妹"));

  /* ---- 上锁 ---- */
  reg["#lockBtn"].fire("click");
  await wait(80);
  console.log("上锁后 wallPanel 隐藏 :", reg["#wallPanel"].hidden);

  console.log("");
  console.log("请求一览：");
  const seen = {};
  calls.forEach((c) => {
    const k = c.method + " " + c.head + (c.fn ? "/" + c.fn : "");
    seen[k] = (seen[k] || 0) + 1;
  });
  Object.entries(seen).forEach(([k, v]) => console.log("   " + k.padEnd(26) + " x" + v));
  console.log("全部请求带 apikey     :", calls.every((c) => c.hasKey));
  console.log("异常数                :", errors.length);
  errors.forEach((e) => console.log("  !", e.message));
})();
