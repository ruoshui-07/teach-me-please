/* ============================================================
 *  「蹲一个师姐」 配置 —— 整个项目你只需要改这个文件
 *  GitHub: ruoshui-07
 *
 *  ┌─────────────────────────────────────────────┐
 *  │  在下面两行引号里粘上你 Supabase 项目的值      │
 *  │  没填 → 自动进「演示模式」，数据只存本机       │
 *  └─────────────────────────────────────────────┘
 *
 *  去哪抄（Supabase 控制台）：
 *    Settings → API
 *      · Project URL              → SUPABASE_URL
 *      · anon / public 那一长串   → SUPABASE_ANON_KEY
 *
 *  注意：
 *    · 填 anon key，不要填 service_role key（那个会让人拿到全部权限）
 *    · anon key 本来就是公开的，放进 GitHub 没问题，安全性靠 schema.sql 里的 RLS 兜着
 *    · URL 后面多粘了斜杠或 /rest/v1 也不要紧，代码会自动去掉
 * ============================================================ */

window.PEEK_CONFIG = {

  SUPABASE_URL: "",          // 例：https://abcdefghijklmn.supabase.co

  SUPABASE_ANON_KEY: "",     // 例：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIs...

  // 页脚署名（会显示在页面底部）
  AUTHOR: "ruoshui-07",

  // 邀请文案里的自称
  SELF: "师妹"
};
