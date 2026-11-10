/* 演示模式（没配 Supabase）全流程自测
 * 跑：node dev/smoke.js
 */
const { install } = require("./stub");

const { reg, tabs, panels } = install({ config: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" } });

require("../app.js");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
process.on("uncaughtException", (e) => errors.push(e));

(async () => {
  await wait(120);

  console.log("默认展开的面板      :", panels.filter((p) => p.classList.contains("active"))
    .map((p) => p.id).join(",") || "(无)");
  console.log("周号标签            :", reg["#weekLabel"].textContent);

  const chipsT = reg["#chipsTeach"].children.filter((c) => c.dataset && c.dataset.id);
  const chipsL = reg["#chipsLearn"].children.filter((c) => c.dataset && c.dataset.id);
  console.log("师兄师姐端 chips    :", chipsT.length, "个");
  console.log("我的端 chips        :", chipsL.length, "个");

  const rowsT = reg["#gridTeach"].children;
  console.log("师兄师姐端时间行数  :", rowsT.length, "| 每行格子:", rowsT[0].children.length);

  // 师兄师姐端：昵称 + 周一上午 + WB + 补充
  reg["#nickTeach"].value = "小满";
  reg["#nickTeach"].fire("input");
  rowsT[0].children[1].fire("click");
  chipsT.find((c) => c.dataset.id === "wb").fire("click");
  reg["#noteTeach"].value = "周二上午跑胶，来了正好看";
  reg["#noteTeach"].fire("input");
  await wait(700);

  const cache = JSON.parse(global.localStorage.getItem("peek:cache:v2") || "{}");
  console.log("缓存 teach          :", JSON.stringify(cache.teach));
  console.log("缓存 nick           :", cache.nick);

  // 我的端
  tabs[1].fire("click");
  reg["#gridLearn"].children[0].children[1].fire("click");   // 周一上午
  reg["#chipsLearn"].children.find((c) => c.dataset && c.dataset.id === "wb").fire("click");
  reg["#noteLearn"].value = "这周课多，只有周一上午";
  reg["#noteLearn"].fire("input");
  await wait(700);

  const cache2 = JSON.parse(global.localStorage.getItem("peek:cache:v2") || "{}");
  console.log("缓存 learn          :", JSON.stringify(cache2.learn));

  // 口令解锁（演示模式下任意口令都放行）
  console.log("解锁前 wallPanel 隐藏:", reg["#wallPanel"].hidden);
  reg["#passInput"].value = "demo";
  reg["#unlockBtn"].fire("click");
  await wait(120);
  console.log("解锁后 wallPanel 隐藏:", reg["#wallPanel"].hidden);
  console.log("解锁后 lockPanel 隐藏:", reg["#lockPanel"].hidden);

  // 上锁
  reg["#lockBtn"].fire("click");
  await wait(80);
  console.log("上锁后 wallPanel 隐藏:", reg["#wallPanel"].hidden);

  console.log("异常数               :", errors.length);
  errors.forEach((e) => console.log("  !", e.message));
})();
