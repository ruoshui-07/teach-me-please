# 蹲一个师姐 🐰

> 这周谁在做实验，我能不能去旁边看看。

给实验室做的小页面：师兄师姐点一下「哪个半天 + 做什么实验」，我就能看到什么时候可以去蹭一次，不用一个个私信问「你最近忙吗」。

## 三个页面

| 页面 | 谁用 | 填什么 |
|---|---|---|
| 🌸 **我来带**（默认打开） | 师兄师姐 | 昵称 · 哪几个半天有空 · 做什么实验 · 补充一句 |
| 🐣 **我想跟** | 我 | 哪几个半天有空 · 想学什么 · 补充说明 |
| 🔒 **看看** | 我（口令） | 输口令后才显示这周所有人填的内容 |

师兄师姐打开链接**直接落在自己的表单上**，填完就关，不用切页面。

## 隐私

**每个人只能看到「自己填的那一条」，看不到别人；你能看到全部（要口令）。**

- `people` / `slots` 两张表**没有**无条件读权限。RLS 只放行 `token` 与请求头 `x-peek-token` 相同的那一行
- 那个 token 是浏览器生成的随机 UUID，只存在当事人自己的浏览器里；拿不到它就一行也读不出来
- 刷新页面时，页面会带着 token 把自己的记录从服务器拉回来 —— 本地缓存没了也能恢复
- 想看汇总，只能在「我想跟」页面输口令，走 `peek_board()` 这个带校验的数据库函数
- 口令哈希存在 `peek_secret` 表，这张表连 grant 都没给匿名用户

也就是说：**打开网页源码，只能拿到一个公开的 anon key，查表会被 RLS 挡死。**

唯一的前提：**别把带 `token` 的链接或截图发出去**（正常使用不会发生，token 只活在 localStorage 里）。

---

## 一、上线（三步，约 10 分钟）

### 第 1 步 · 建表

Supabase 控制台 → 左侧 **SQL Editor** → New query → 把 [`supabase/schema.sql`](supabase/schema.sql) 全文粘进去 → **Run**。

脚本是幂等的，重复跑不会出事，也不会覆盖你改过的实验库和口令。

### 第 2 步 · 填密钥

Supabase 控制台 → **Settings → API**，抄两个值填进 `config.js`：

| 抄哪个 | 填到 |
|---|---|
| `Project URL`（`https://xxxx.supabase.co`） | `SUPABASE_URL` |
| `anon` / `public` 那一长串 | `SUPABASE_ANON_KEY` |

> **一定用 anon key，不要用 service_role key。**

### 第 3 步 · 放上 GitHub Pages

**不用装 git（推荐第一次用这个）：**

1. GitHub 新建仓库 `peek-lab`（Public，**不要**勾 Add README）
2. 点 **uploading an existing file** → 把这个文件夹里的所有文件拖进去 → Commit
3. 点开 `config.js` → **铅笔**图标 → 填两个值 → Commit changes
4. **Settings → Pages** → `Deploy from a branch` → `main` / `/ (root)` → Save

一两分钟后：`https://ruoshui-07.github.io/peek-lab/`

**命令行：** 双击 `publish.bat`（需要 Git），会先检查配置再推送到 `ruoshui-07/peek-lab`。

---

## 二、口令（重要）

默认口令是 **`peek2026`**。第一次输进去能看到汇总之后，**建议立刻改掉**：

Supabase → SQL Editor → 单独跑这一句（把 `newpassword` 换成你要的）：

```sql
update public.peek_secret set pass_hash = md5('newpassword') where id = 1;
```

改完在页面上点「🔒 锁上」再重新输一次。浏览器会记住口令，下次自动解锁。

> 口令忘了也不怕：重跑上面那句 SQL 就能重置。数据库里只存 md5 哈希，不存明文。

---

## 三、实验库怎么改

站点上那些能点的实验标签，全部来自 **`exp_categories`** 表。改表 = 改页面，**不用动代码**。

Supabase → **Table Editor** → `exp_categories`：

| 字段 | 含义 | 说明 |
|---|---|---|
| `id` | 短 id | 建了别改，`people.exp_ids` 靠它关联 |
| `name` | 显示名 | 「Western blot」 |
| `emoji` | 图标 | 一个 emoji |
| `tier` | 梯队 | 1 零门槛 / 2 跟上手 / 3 先听懂 |
| `level` | 难度 | 1~3，显示成几颗星 |
| `hours` / `why` / `watch` | 悬停信息 | 大概多久、为什么值得跟、可以盯哪几步 |
| `sort` | 排序 | 小的在前，建议 10、20、30 留空档 |
| `active` | 是否显示 | `false` 就从前端消失，历史数据还在 |

**加一个新实验**：Insert row → 填 `id`/`name`/`emoji`/`tier`/`level`/`sort` → 刷新页面就出现了。

**想砍到 5 个**：把不要的 `active` 改成 `false`。第一版别放太多 —— 实验室十几个人，类别一多墙就稀疏。

> 前端读不到这张表时会自动退回 `data.js` 里内置的同一份 13 类，所以先传页面、后建表也不会白屏。

---

## 四、数据结构

| 表 | 一行代表 | 匿名权限 |
|---|---|---|
| `exp_categories` | 一个实验大类 | 只读 |
| `people` | 一个人 × 一周 | 增 / 改 / 删，**只能读回自己那条** |
| `slots` | 一个人的一个半天 | 增 / 删，**只能读回自己那条** |
| `peek_secret` | 口令哈希（只有一行） | **完全无权限** |

两条读路径：

| 谁 | 怎么读 | 能看到 |
|---|---|---|
| 所有人 | `GET people?token=eq.<自己的>` + 请求头 `x-peek-token` | 自己那一行 |
| 只有你 | `peek_board(p_pass, p_week)`（`security definer`，口令错返回 `null`） | 本周全部 |

前端 **不引 Supabase SDK**，直接调 PostgREST（`app.js` 里的 `api()` / `apiBoard()` / `loadMine()`）。好处是零外部依赖，不会因为 CDN 慢或挂掉而白屏 —— 在微信里点开时很关键。

---

## 五、本地预览

直接双击 `index.html`。没填密钥时是演示模式，界面交互一样，数据存在本机；口令随便输一个就能看到汇总（内容是假的）。

---

## 六、想改哪

| 想改 | 改哪 |
|---|---|
| 实验大类 | **Supabase 的 `exp_categories` 表** |
| 内置兜底实验表 | `data.js` 的 `categories` |
| 时段（默认上午/下午/晚上） | `data.js` 的 `periods` |
| 颜色、圆角、阴影 | `style.css` 顶部的 `:root` |
| 邀请文案 | `app.js` 的 `inviteText()` |
| 自称（师妹/学妹…） | `config.js` 的 `SELF` |
| 页脚署名 | `config.js` 的 `AUTHOR` |

---

## 七、已知取舍

- **匿名可写**：拿到链接的人都能写。因为读不到别人的数据，能作恶的空间很小。
- **token 决定你是谁**：换浏览器 = 换身份（会多出一条记录）。同一个浏览器里重填是覆盖自己那条，不会重复。浏览器数据全清了，旧记录会留在库里、你的页面上再来一条新的 —— 到时候在 Table Editor 里把旧的删掉就行。
- **每周自动翻篇**：`week` 用 ISO 周号（`2026-W46`），页面只查当周，旧数据留着不删。想清就取消 `schema.sql` 末尾两行的注释，配 Supabase Cron 每周跑。
- **没有账号系统**：口令是一次性校验，不是登录态。对「点两下就完事」的页面来说，登录会把所有人劝退。
- **不做「申请—审批」**：一旦有「待确认」状态，就从「顺路带我一个」变成走流程了。

---

## 八、开发与自测

```bash
node dev/check.js          # 静态自检：id / class / 默认端 / schema 权限
node dev/smoke.js          # 演示模式全流程
node dev/smoke-remote.js   # 假 PostgREST：验证「只能读自己」+ 口令校验
```

`smoke-remote.js` 里有三条关键断言：

1. 带草稿被清空的 token 打开页面，能从服务器读回自己上次填的内容
2. **不带 token 查表返回 0 行**
3. 带着 A 的 token 只能读到 A 那一行，读不到 B

---

## 九、几条使用建议

1. **先别急着全组推广。** 找 2–3 个最熟的师姐试填，掐表看能不能 15 秒内填完。填不完就再砍字段。
2. **第一周你要自己先发。** 群里没人动的时候，谁也不愿意当第一个。
3. **链接配一句话发**，别只丢 URL。解锁后页面里有「📋 复制邀请的话」。
4. 这个页面解决的是「不知道对方什么时候在做实验」，不解决「开口」。看到对得上的，**当天**就把消息发出去 —— 隔一天，勇气就没了。

---

MIT · [ruoshui-07](https://github.com/ruoshui-07)
