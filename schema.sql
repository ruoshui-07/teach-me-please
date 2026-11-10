-- ============================================================
--  蹲一个师姐 · Supabase 建表脚本
--
--  用法：Supabase 控制台 → SQL Editor → New query
--        → 全选粘贴下面全部内容 → Run
--
--  权限模型（重要）：
--    来访者（师兄师姐）只能「写」，以及读回「自己填的那一条」
--    读别人的数据 —— 只有拿着口令的你，通过 peek_board() 函数
--
--  跑完会有 4 张表：
--    exp_categories  实验库（前端「点击选择」的那些分类，只读）
--    people          每个人每周一行
--    slots           每个人的时间片
--    peek_secret     口令哈希（匿名完全读不到）
-- ============================================================

-- 旧版本遗留的「我也想去」表，已经不用了
drop table if exists public.wishes cascade;

-- ------------------------------------------------------------
-- 1. 实验库：站点上那些可以点的「实验大类」
--    想改就在 Table Editor 里直接改，前端刷新就变，不用动代码
--    active = false 的不显示
-- ------------------------------------------------------------
create table if not exists public.exp_categories (
  id    text primary key,                            -- 短 id，会被 people.exp_ids 引用
  name  text not null,                               -- 显示名
  emoji text not null default '🧪',
  tier  int  not null default 1,                     -- 梯队 1/2/3
  level int  not null default 1 check (level between 1 and 3),  -- 难度星 1~3
  hours text not null default '',                    -- 大概耗时（悬停显示）
  why   text not null default '',                    -- 一句话理由（悬停显示）
  watch text[] not null default '{}',                -- 可以旁观的关键环节
  sort  int  not null default 0,                     -- 排序，小的在前
  active boolean not null default true
);

create index if not exists exp_categories_sort_idx on public.exp_categories (sort);

-- ------------------------------------------------------------
-- 2. 人：每个（浏览器 / 角色 / 周）一行
-- ------------------------------------------------------------
create table if not exists public.people (
  token      text primary key,
  nickname   text   not null default '',
  role       text   not null default 'me' check (role in ('senior','me')),
  week       text   not null,
  exp_ids    text[] not null default '{}',   -- 引用 exp_categories.id
  note       text   not null default '',
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. 时间片：每人每周多行（周几 × 上午/下午/晚上）
-- ------------------------------------------------------------
create table if not exists public.slots (
  id     uuid primary key default gen_random_uuid(),
  token  text not null,
  week   text not null,
  day    int  not null check (day between 0 and 6),   -- 0=周一 … 6=周日
  period text not null check (period in ('上午','下午','晚上')),
  unique (token, week, day, period)
);

create index if not exists people_week_idx on public.people (week);
create index if not exists slots_week_idx  on public.slots  (week);

-- ------------------------------------------------------------
-- 4. 口令：只有存哈希，而且匿名读不到这张表
-- ------------------------------------------------------------
create table if not exists public.peek_secret (
  id        int primary key default 1 check (id = 1),
  pass_hash text not null
);

-- ============================================================
-- 权限
-- ============================================================
alter table public.exp_categories enable row level security;
alter table public.people         enable row level security;
alter table public.slots          enable row level security;
alter table public.peek_secret    enable row level security;

grant select on public.exp_categories to anon, authenticated;
grant select, insert, update, delete on public.people, public.slots to anon, authenticated;
-- peek_secret 故意不给任何 grant、不建任何 policy → 匿名彻底看不到

-- 实验库：只读
drop policy if exists "peek exp read" on public.exp_categories;
create policy "peek exp read" on public.exp_categories for select using (true);

-- ------------------------------------------------------------
-- 自己读自己
--   前端每次请求带一个请求头  x-peek-token: <自己的 token>
--   RLS 只放行 token 完全相同的那一行 —— 别人的行依然一行都读不到
--   token 是浏览器生成的随机 UUID，只存在当事人自己的浏览器里
-- ------------------------------------------------------------
create or replace function public.peek_self_token()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-peek-token',
    ''
  );
$$;

grant execute on function public.peek_self_token() to anon, authenticated;

grant select on public.people, public.slots to anon, authenticated;

-- people / slots：可以写；只能读回自己那一条
drop policy if exists "peek people read"      on public.people;
drop policy if exists "peek people self read" on public.people;
drop policy if exists "peek people write"     on public.people;
drop policy if exists "peek people upd"       on public.people;
drop policy if exists "peek people del"       on public.people;

create policy "peek people self read" on public.people for select
  using (token <> '' and token = public.peek_self_token());
create policy "peek people write" on public.people for insert with check (true);
create policy "peek people upd"   on public.people for update using (true) with check (true);
create policy "peek people del"   on public.people for delete using (true);

drop policy if exists "peek slots read"      on public.slots;
drop policy if exists "peek slots self read" on public.slots;
drop policy if exists "peek slots write"     on public.slots;
drop policy if exists "peek slots del"       on public.slots;

create policy "peek slots self read" on public.slots for select
  using (token <> '' and token = public.peek_self_token());
create policy "peek slots write" on public.slots for insert with check (true);
create policy "peek slots del"   on public.slots for delete using (true);

-- ============================================================
-- 读数据的唯一入口：口令对了才返回本周数据
--   security definer 让它绕过 RLS；口令错返回 null
-- ============================================================
create or replace function public.peek_board(p_pass text, p_week text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
begin
  select pass_hash into h from public.peek_secret where id = 1;

  -- 还没设过口令，或者口令不对
  if h is null or h <> md5(coalesce(p_pass, '')) then
    return null;
  end if;

  return json_build_object(
    'people', coalesce((
      select json_agg(row_to_json(t)) from (
        select token, nickname, role, week, exp_ids, note
        from public.people where week = p_week
      ) t
    ), '[]'::json),
    'slots', coalesce((
      select json_agg(row_to_json(t)) from (
        select token, week, day, period
        from public.slots where week = p_week
      ) t
    ), '[]'::json)
  );
end;
$$;

revoke all on function public.peek_board(text, text) from public;
grant execute on function public.peek_board(text, text) to anon, authenticated;

-- ============================================================
-- 设置口令（默认 peek2026，建议改掉）
-- ============================================================
insert into public.peek_secret (id, pass_hash)
values (1, md5('peek2026'))
on conflict (id) do nothing;

-- 改口令：把 newpassword 换成你要的，然后单独跑这一行
-- update public.peek_secret set pass_hash = md5('newpassword') where id = 1;

-- ============================================================
-- 实验库的初始数据（13 个大类）
--   重复跑安全：已存在的 id 会跳过
--   想调整顺序改 sort，想隐藏某个改 active = false
-- ============================================================
insert into public.exp_categories (id, name, emoji, tier, level, hours, why, watch, sort) values
('culture', '细胞培养',          '🧫', 1, 1, '0.5–1 h',    '所有细胞的起点，跟一次就能自己开瓶',
  array['无菌操作手势','消化到什么程度该终止','传代密度怎么估'], 10),

('treat',   '细胞处理与表型',    '🧪', 1, 1, '1–2 h',      '缺糖、缺氧、加药、CCK-8，最容易插进别人已有的实验里',
  array['铺板密度与时间点','缺糖/缺氧怎么设对照','CCK-8 加药到读板的节奏'], 20),

('func',    '细胞功能实验',      '🏃', 1, 1, '1–3 h（含等待）', 'Transwell、划痕、克隆形成、管形成，手法简单但要等',
  array['小室怎么放不产生气泡','划痕的力度一致性','固定染色的时间点'], 30),

('wb',      'Western blot',     '🧬', 2, 2, '2 天（分两段）', '实验室最高频技能，会了就能接活；也是最值得跟的一个',
  array['裂解与 BCA 定量','制胶和上样量','转膜有没有转透','条带怎么判读'], 40),

('if',      '免疫荧光与成像',    '🔬', 2, 2, '1 天（分两段）', '和你的课题最贴，直接决定 IL-17F 到底在不在核里',
  array['爬片/种板','固定透化的分寸','抗体浓度与背景','共聚焦怎么调参数'], 50),

('qpcr',    '核酸提取与 qPCR',   '🌡️', 2, 2, '半天',         '提 RNA、逆转录、上机，全流程都是手上的活',
  array['RNase 防护','逆转录体系','加样重复性','熔解曲线怎么看'], 60),

('clone',   '分子克隆',          '🔧', 2, 2, '2–3 天（分段）', '后面要做 NLS 突变体，迟早得自己会',
  array['引物设计','酶切/同源重组','转化与涂板','挑单克隆送测序'], 70),

('flow',    '流式细胞术',        '📊', 2, 2, '半天',         '周期、凋亡、分选，一个下午能看完一整轮',
  array['单细胞悬液怎么制备','补偿设置','圈门逻辑'], 80),

('ihc',     '组织切片与免疫组化', '🩸', 3, 3, '2–3 天',      '周期长、步骤多，建议先旁观并记流程',
  array['固定包埋','抗原修复','显色与封片','结果判读标准'], 90),

('virus',   '慢病毒与稳转构建',  '🦠', 3, 3, '1–2 周',      '周期长、规范多，先听懂原理，操作从观摩开始',
  array['包装体系与转染','滴度怎么定','感染与筛选','单克隆化'], 100),

('animal',  '动物实验',          '🐭', 3, 3, '半天 / 单次',  '涉及伦理与资质，通常需要老师授权，先跟着看',
  array['裸鼠皮下接种','瘤径测量','取材与固定','伦理与记录'], 110),

('omics',   '组学样品制备',      '🧾', 3, 3, '1 天（分两段）', 'RNA-seq 送样、ChIP/CUT&RUN 建库、Co-IP 样品，贵而且要求高',
  array['样品量与质控','建库前处理','送样单怎么填'], 120),

('bioinfo', '生信分析与作图',    '💻', 3, 2, '半天',         '不用进实验室也能学，适合在别人做实验时并行推进',
  array['DESeq2 差异分析','MACS2 / HOMER','R 或 Python 作图'], 130)

on conflict (id) do nothing;

-- ============================================================
-- 可选：旧数据每周自动清理（想保留历史就别跑这段）
-- ============================================================
-- delete from public.slots  where week < to_char(now() - interval '56 days', 'IYYY-"W"IW');
-- delete from public.people where week < to_char(now() - interval '56 days', 'IYYY-"W"IW');
