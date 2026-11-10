/* ============================================================
   蹲一个师姐 · 逻辑
   GitHub: ruoshui-07
   ------------------------------------------------------------
   默认端「我来带」：师兄师姐填「哪几个半天 + 做什么实验 + 补充」，
                    写进 Supabase，但他们读不到任何别人的数据。
   我的端「我想跟」：我填「哪几个半天 + 想学什么 + 补充说明」。
   查看            ：输口令 → 调 peek_board() 拿到本周汇总（只有我解得开）。

   前端不引 SDK，直接调 PostgREST。
   ============================================================ */
(function () {
  "use strict";

  const D = window.PEEK_DATA;
  const C = window.PEEK_CONFIG || {};

  /* 容错：URL 后面多粘了斜杠、/rest/v1、或首尾空格都能用 */
  const BASE_URL = String(C.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
  const API_KEY = String(C.SUPABASE_ANON_KEY || "").trim();

  const REMOTE = !!(BASE_URL && API_KEY);
  const AUTHOR = C.AUTHOR || "ruoshui-07";
  const SELF = C.SELF || "师妹";

  /* ---------------- 小工具 ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const uuid = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });

  const pad = (n) => String(n).padStart(2, "0");

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dn = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dn);
    const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const wn = Math.ceil(((t - ys) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + "-W" + pad(wn);
  }

  function weekRange(d) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dn = t.getDay() || 7;
    const mon = new Date(t);
    mon.setDate(t.getDate() - dn + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [mon, sun];
  }

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2100);
  }

  /* ---------------- 本机缓存 ----------------
     数据表对匿名用户是「只写不读」，
     所以自己填过什么必须存在本地，否则刷新就空了。 */
  const CACHE = "peek:cache:v2";

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (v && typeof v === "object") return v;
    } catch (e) { /* ignore */ }
    return {};
  }

  function writeCache(patch) {
    try {
      localStorage.setItem(CACHE, JSON.stringify({ ...readCache(), ...patch }));
    } catch (e) { /* ignore */ }
  }

  function tokenFor(side) {
    const c = readCache();
    const key = "token:" + side;
    if (c[key]) return c[key];
    const t = uuid();
    writeCache({ [key]: t });
    return t;
  }

  /* ---------------- 网络 ---------------- */
  async function api(path, opts = {}) {
    const res = await fetch(BASE_URL + "/rest/v1/" + path, {
      ...opts,
      headers: {
        apikey: API_KEY,
        Authorization: "Bearer " + API_KEY,
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(res.status + " " + body.slice(0, 160));
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /* 读：走带口令的存储过程，口令不对返回 null */
  async function apiBoard(pass, week) {
    const res = await fetch(BASE_URL + "/rest/v1/rpc/peek_board", {
      method: "POST",
      headers: {
        apikey: API_KEY,
        Authorization: "Bearer " + API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_pass: pass, p_week: week })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(res.status + " " + body.slice(0, 160));
    }
    const text = await res.text();
    if (!text) return null;
    const v = JSON.parse(text);
    return v || null;   // 口令错时是 null
  }

  const Store = {
    /* 读回「我自己」填的那一条：请求头带上 x-peek-token，RLS 只放行 token 相同的行 */
    async loadMine(token, week) {
      if (!REMOTE) return null;
      const h = { "x-peek-token": token };
      const q = "token=eq." + encodeURIComponent(token) +
                "&week=eq." + encodeURIComponent(week) + "&select=*";
      const [rows, sl] = await Promise.all([
        api("people?" + q, { headers: h }),
        api("slots?" + q, { headers: h })
      ]);
      const p = rows && rows[0];
      if (!p) return null;
      return {
        nickname: p.nickname || "",
        exp_ids: Array.isArray(p.exp_ids) ? p.exp_ids : [],
        note: p.note || "",
        slots: (sl || []).map((r) => r.day + "|" + r.period)
      };
    },

    async loadCategories() {
      if (!REMOTE) return D.categories.slice();
      try {
        const rows = await api("exp_categories?active=eq.true&select=*&order=sort.asc,id.asc");
        if (!rows || !rows.length) return D.categories.slice();
        return rows.map((r) => ({
          id: String(r.id),
          name: String(r.name || r.id),
          emoji: r.emoji || "🧪",
          tier: Number(r.tier) || 1,
          level: Number(r.level) || 1,
          hours: r.hours || "",
          why: r.why || "",
          watch: Array.isArray(r.watch) ? r.watch : []
        }));
      } catch (e) {
        console.warn("[peek] exp_categories 读取失败，改用内置科目表", e);
        return D.categories.slice();
      }
    },

    /* 写也必须带 x-peek-token：
       people 是 upsert(ON CONFLICT DO UPDATE)，Postgres 要「看见」已有的那一行
       才能走 UPDATE 分支；slots 的 DELETE 同理 —— 看不见就删不掉，会留下旧行。 */
    async savePerson(p) {
      if (!REMOTE) return;
      await api("people?on_conflict=token", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
          "x-peek-token": p.token
        },
        body: JSON.stringify({ ...p, updated_at: new Date().toISOString() })
      });
    },

    async saveSlots(token, week, list) {
      if (!REMOTE) return;
      const h = { "x-peek-token": token };
      await api(
        "slots?token=eq." + encodeURIComponent(token) +
        "&week=eq." + encodeURIComponent(week),
        { method: "DELETE", headers: h }
      );
      if (!list.length) return;
      await api("slots", {
        method: "POST",
        headers: { Prefer: "return=minimal", ...h },
        body: JSON.stringify(list.map((s) => ({
          token, week, day: s.day, period: s.period
        })))
      });
    }
  };

  /* ---------------- 状态 ---------------- */
  function emptySide(token) {
    return { token, slots: new Set(), exps: new Set(), note: "" };
  }

  const cache = readCache();

  const state = {
    tab: "teach",                       // 默认就是师兄师姐端
    week: isoWeek(new Date()),
    learn: emptySide(tokenFor("learn")),
    teach: emptySide(tokenFor("teach")),
    nick: cache.nick || "",
    pass: cache.pass || "",
    board: null,                        // 解锁后的汇总
    categories: [],
    unlocked: false
  };

  // 从缓存恢复自己填过的
  ["learn", "teach"].forEach((k) => {
    const s = state[k];
    const saved = cache[k];
    if (!saved) return;
    s.slots = new Set(saved.slots || []);
    s.exps = new Set(saved.exps || []);
    s.note = saved.note || "";
  });
  state.learn.nick = SELF;
  state.teach.nick = state.nick;

  const sideOf = (key) => state[key];

  /* ---------------- 渲染：时间网格 ---------------- */
  function renderGrid(el, set, onToggle) {
    el.innerHTML = "";
    D.days.forEach((day, di) => {
      const row = document.createElement("div");
      row.className = "row" + (di >= 5 ? " weekend" : "");
      const label = document.createElement("span");
      label.className = "dow";
      label.textContent = day.slice(1);
      row.appendChild(label);

      D.periods.forEach((p) => {
        const key = di + "|" + p;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + (set.has(key) ? " on" : "") + (di >= 5 ? " weekend-bg" : "");
        b.textContent = p;
        b.dataset.key = key;
        b.addEventListener("click", () => {
          if (set.has(key)) set.delete(key);
          else set.add(key);
          b.classList.toggle("on", set.has(key));
          onToggle();
        });
        row.appendChild(b);
      });
      el.appendChild(row);
    });
  }

  /* ---------------- 渲染：实验 chips ---------------- */
  function cats() {
    return state.categories && state.categories.length ? state.categories : D.categories;
  }
  const TIER_CN = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五" };

  function renderChips(el, set, onToggle) {
    el.innerHTML = "";
    const list = cats();
    const tiers = [...new Set(list.map((c) => Number(c.tier) || 1))].sort((a, b) => a - b);

    tiers.forEach((tier) => {
      const meta = D.tiers.find((x) => x.id === tier);
      const head = document.createElement("div");
      head.className = "chips-tier";
      head.textContent = "第" + (TIER_CN[tier] || tier) + "梯队 · " + (meta ? meta.name : "其他");
      el.appendChild(head);

      list.filter((c) => (Number(c.tier) || 1) === tier).forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (set.has(c.id) ? " on" : "");
        b.dataset.id = c.id;
        const lv = Math.max(1, Math.min(3, Number(c.level) || 1));
        const watch = Array.isArray(c.watch) ? c.watch : [];
        b.innerHTML =
          "<span>" + esc(c.emoji || "🧪") + "</span>" +
          "<span>" + esc(c.name) + "</span>" +
          '<span class="lv">' + "★".repeat(lv) + "</span>";
        b.title = [c.why, c.hours ? "大约 " + c.hours : "",
                   watch.length ? "可以看：" + watch.join("、") : ""]
          .filter(Boolean).join("\n");
        b.addEventListener("click", () => {
          if (set.has(c.id)) set.delete(c.id);
          else set.add(c.id);
          b.classList.toggle("on", set.has(c.id));
          onToggle();
        });
        el.appendChild(b);
      });
    });
  }

  /* ---------------- 渲染：汇总墙 ---------------- */
  function catById(id) {
    return cats().find((c) => c.id === id);
  }

  function groupSlots(slots, token) {
    return slots
      .filter((s) => s.token === token)
      .sort((a, b) => a.day - b.day || D.periods.indexOf(a.period) - D.periods.indexOf(b.period));
  }

  function slotLabel(s) {
    return D.days[s.day] + " " + s.period;
  }

  function score(person, personSlots) {
    const mine = state.learn.slots;
    const exps = state.learn.exps;
    const timeHit = personSlots.some((s) => mine.has(s.day + "|" + s.period));
    const expHit = (person.exp_ids || []).some((id) => exps.has(id));
    if (timeHit && expHit) return 2;
    if (timeHit) return 1;
    if (expHit) return 1.2;
    return 0;
  }

  function cardHTML(p, slots, hot) {
    const times = slots.length
      ? slots.map((s) => '<span class="t' + (s.day >= 5 ? " wk" : "") + '">' +
          esc(slotLabel(s)) + "</span>").join("")
      : '<span class="t">没说具体时间</span>';

    const exps = (p.exp_ids || []).length
      ? p.exp_ids.map((id) => {
          const c = catById(id);
          return c ? '<span class="e">' + esc(c.emoji || "") + " " + esc(c.name) + "</span>" : "";
        }).join("")
      : '<span class="e">还没选实验</span>';

    return (
      '<div class="pcard' + (hot ? " hot" : "") + '">' +
        '<div class="pc-top"><span>🌸</span>' +
        '<span class="pc-name">' + esc(p.nickname || "匿名") + "</span></div>" +
        '<div class="pc-times">' + times + "</div>" +
        '<div class="pc-exps">' + exps + "</div>" +
        (p.note ? '<p class="pc-note">' + esc(p.note) + "</p>" : "") +
      "</div>"
    );
  }

  function renderWall() {
    const box = $("#wall");
    const hint = $("#matchHint");
    if (!box) return;

    if (!state.unlocked || !state.board) {
      box.innerHTML = "";
      if (hint) hint.textContent = "";
      return;
    }

    const people = (state.board.people || []).filter((p) => p.role === "senior");

    if (!people.length) {
      box.innerHTML =
        '<div class="empty"><span class="big">🫧</span>' +
        "这周还没人填～<br>把链接发到实验室群里试试</div>";
      if (hint) hint.textContent = "";
      return;
    }

    const scored = people.map((p) => {
      const s = groupSlots(state.board.slots || [], p.token);
      return { p, slots: s, sc: score(p, s) };
    });

    const hits = scored.filter((x) => x.sc >= 2).length;
    if (hint) {
      if (hits) {
        hint.textContent = "✧ 有 " + hits + " 个时间对得上，冲！";
        hint.classList.add("match");
      } else if (state.learn.slots.size) {
        hint.textContent = "这周还凑不上，去「我想跟」再点亮几个半天试试";
        hint.classList.remove("match");
      } else {
        hint.textContent = "先去「我想跟」点亮你有空的半天，我帮你对时间";
        hint.classList.remove("match");
      }
    }

    scored.sort((a, b) =>
      b.sc - a.sc || (a.p.nickname || "").localeCompare(b.p.nickname || ""));

    box.innerHTML = scored.map((x) => cardHTML(x.p, x.slots, x.sc >= 2)).join("");
  }

  /* ---------------- 解锁 / 上锁 ---------------- */
  function setLocked(locked) {
    state.unlocked = !locked;
    $("#lockPanel").hidden = !locked;
    $("#wallPanel").hidden = locked;
    if (locked) {
      state.board = null;
      $("#passInput").value = "";
    }
    renderWall();
  }

  async function tryUnlock() {
    const pass = ($("#passInput").value || "").trim();
    const msg = $("#lockMsg");

    if (!pass) {
      msg.textContent = "先输一下口令";
      return;
    }
    if (!REMOTE) {
      // 演示模式没有后端，随便输一个就放行
      setLocked(false);
      msg.textContent = "";
      return;
    }

    $("#unlockBtn").disabled = true;
    msg.textContent = "看看…";
    try {
      const board = await apiBoard(pass, state.week);
      if (!board) {
        msg.textContent = "口令不对，再想想";
        return;
      }
      state.pass = pass;
      state.board = board;
      writeCache({ pass });
      setLocked(false);
      msg.textContent = "";
    } catch (e) {
      console.error(e);
      msg.textContent = explainError(e);
    } finally {
      $("#unlockBtn").disabled = false;
    }
  }

  /* 第一次连不上时，说清楚是哪一步错了 */
  function explainError(e) {
    const msg = String((e && e.message) || "");
    if (/^401|^403|JWT|apikey/i.test(msg)) return "密钥不对，检查 config.js 里的 anon key";
    if (/^404|does not exist|relation/i.test(msg)) return "找不到表或函数，先在 Supabase 跑一次 schema.sql";
    if (/^5\d\d/.test(msg)) return "Supabase 项目可能在休眠，等一会儿再试";
    return "连不上数据库，稍后再试";
  }

  /* ---------------- 保存 ---------------- */
  const pending = new Set();
  let saveTimer = null;

  function queueSave(key) {
    pending.add(key);
    writeCache({
      [key]: {
        slots: [...state[key].slots],
        exps: [...state[key].exps],
        note: state[key].note || ""
      }
    });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 450);
  }

  async function flushSave() {
    const keys = [...pending];
    pending.clear();
    for (const k of keys) {
      try {
        await saveSide(k);
      } catch (e) {
        console.error(e);
        toast(explainError(e));
        return;
      }
    }
    toast("记下啦 ✓");
  }

  async function saveSide(key) {
    const s = state[key];
    const isTeach = key === "teach";
    const nick = (isTeach ? s.nick : SELF) || "";
    if (isTeach && !nick.trim()) return;   // 师兄师姐端先填昵称

    const list = [...s.slots].map((k) => {
      const a = k.split("|");
      return { day: +a[0], period: a[1] };
    });

    writeCache({ nick: isTeach ? nick : state.nick });

    await Store.savePerson({
      token: s.token,
      nickname: nick.trim() || (isTeach ? "匿名" : SELF),
      role: isTeach ? "senior" : "me",
      week: state.week,
      exp_ids: [...s.exps],
      note: s.note || ""
    });
    await Store.saveSlots(s.token, state.week, list);
  }

  /* ---------------- 复制 ---------------- */
  async function copy(text, okMsg) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast(okMsg || "复制好啦 📋");
    } catch (e) {
      toast("复制失败，长按手动选一下");
    }
  }

  function inviteText() {
    const url = location.href.split("#")[0].split("?")[0];
    return (
      "师兄师姐打扰啦～我做了一个小页面，" +
      "这周谁在做实验可以顺手点一下（选个半天 + 一个实验，30 秒就好），" +
      "我有空就过去在旁边看看，绝不占你们时间 🙇‍♀️\n" +
      url
    );
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $$(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        state.tab = t.dataset.tab;
        $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
        $$(".panel").forEach((p) =>
          p.classList.toggle("active", p.id === "panel-" + state.tab));
      });
    });

    const nt = $("#nickTeach");
    nt.value = state.teach.nick;
    nt.addEventListener("input", () => {
      state.teach.nick = nt.value;
      state.nick = nt.value;
      queueSave("teach");
    });

    const nl = $("#noteLearn");
    nl.value = state.learn.note;
    nl.addEventListener("input", () => {
      state.learn.note = nl.value;
      queueSave("learn");
    });

    const ntl = $("#noteTeach");
    ntl.value = state.teach.note;
    ntl.addEventListener("input", () => {
      state.teach.note = ntl.value;
      queueSave("teach");
    });

    renderGrid($("#gridTeach"), state.teach.slots, () => queueSave("teach"));
    renderGrid($("#gridLearn"), state.learn.slots, () => queueSave("learn"));
    renderChips($("#chipsTeach"), state.teach.exps, () => queueSave("teach"));
    renderChips($("#chipsLearn"), state.learn.exps, () => queueSave("learn"));

    $("#unlockBtn").addEventListener("click", tryUnlock);
    $("#passInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
    $("#lockBtn").addEventListener("click", () => setLocked(true));
    $("#copyInvite").addEventListener("click", () =>
      copy(inviteText(), "复制好啦，去群里粘贴吧 📋"));
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    const [mon, sun] = weekRange(new Date());
    $("#weekLabel").textContent =
      "第 " + state.week.split("W")[1] + " 周 · " +
      (mon.getMonth() + 1) + "/" + mon.getDate() + "–" +
      (sun.getMonth() + 1) + "/" + sun.getDate();

    $("#demoBanner").hidden = REMOTE;

    bind();

    Store.loadCategories().then((list) => {
      state.categories = list;
      renderChips($("#chipsTeach"), state.teach.exps, () => queueSave("teach"));
      renderChips($("#chipsLearn"), state.learn.exps, () => queueSave("learn"));
      renderWall();
    });

    // 口令存在本地 → 自动解锁一次
    if (state.pass && REMOTE) {
      apiBoard(state.pass, state.week)
        .then((board) => {
          if (board) {
            state.board = board;
            setLocked(false);
          } else {
            state.pass = "";
            writeCache({ pass: "" });
          }
        })
        .catch((e) => console.warn("[peek] 自动解锁失败", e));
    }

    // 把「我自己填过什么」从服务器读回来（RLS 只放行自己那一行）
    if (REMOTE) {
      ["teach", "learn"].forEach((k) => {
        Store.loadMine(state[k].token, state.week)
          .then((mine) => {
            if (!mine) return;
            applyMine(k, mine);
          })
          .catch((e) => console.warn("[peek] 读回自己的记录失败", e));
      });
    }
  }

  /* 用服务器上的记录覆盖本地状态，然后重画 */
  function applyMine(key, mine) {
    const s = state[key];
    // 本地刚改过就别覆盖（用户正在输入）
    if (pending.has(key) || s.slots.size || s.exps.size || s.note) return;

    s.slots = new Set(mine.slots);
    s.exps = new Set(mine.exp_ids);
    s.note = mine.note || "";

    if (key === "teach" && mine.nickname && !state.nick) {
      state.nick = mine.nickname;
      s.nick = mine.nickname;
      $("#nickTeach").value = mine.nickname;
    }
    if (key === "learn") {
      $("#noteLearn").value = s.note;
    } else {
      $("#noteTeach").value = s.note;
    }

    renderGrid($(key === "teach" ? "#gridTeach" : "#gridLearn"), s.slots,
      () => queueSave(key));
    renderChips($(key === "teach" ? "#chipsTeach" : "#chipsLearn"), s.exps,
      () => queueSave(key));

    writeCache({
      [key]: { slots: [...s.slots], exps: [...s.exps], note: s.note }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
