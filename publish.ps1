# 一键发布到 GitHub Pages
# 用法：双击同目录的 publish.bat，或在 PowerShell 里跑：powershell -ExecutionPolicy Bypass -File .\一键发布.ps1

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$USER   = 'ruoshui-07'
$REPO   = 'peek-lab'

function Write-Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "   OK  $t" -ForegroundColor Green }
function Write-Warn($t) { Write-Host "   !   $t" -ForegroundColor Yellow }
function Write-Bad($t)  { Write-Host "   X   $t" -ForegroundColor Red }

Write-Host ""
Write-Host "  蹲一个师姐  ·  发布到 https://$USER.github.io/$REPO/" -ForegroundColor Magenta

# ---------- 1. 检查 config.js ----------
Write-Step "检查 config.js"
$cfg = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.js') -Raw -Encoding UTF8

$url = [regex]::Match($cfg, 'SUPABASE_URL:\s*"([^"]*)"').Groups[1].Value
$key = [regex]::Match($cfg, 'SUPABASE_ANON_KEY:\s*"([^"]*)"').Groups[1].Value

if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($key)) {
  Write-Bad "config.js 里还是空的"
  Write-Host ""
  Write-Host "   打开 config.js，填上 Supabase 的 Project URL 和 anon key 再运行。" -ForegroundColor Yellow
  Write-Host "   （Supabase 控制台 → Settings → API）" -ForegroundColor Gray
  Write-Host ""
  Read-Host "按回车退出"
  exit 1
}
if ($url -notmatch '^https://[a-z0-9-]+\.supabase\.co') {
  Write-Warn "SUPABASE_URL 看起来不像 https://xxx.supabase.co，继续但请留意"
} else {
  Write-Ok "SUPABASE_URL = $url"
}
if ($key -match '^eyJ' ) {
  Write-Ok "SUPABASE_ANON_KEY 已填写（$($key.Length) 字符）"
} else {
  Write-Warn "anon key 通常以 eyJ 开头，确认一下有没有粘错"
}

# ---------- 2. 检查 git ----------
Write-Step "检查 git"
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Bad "没找到 git"
  Write-Host ""
  Write-Host "   装一个：https://git-scm.com/download/win" -ForegroundColor Yellow
  Write-Host "   或者走网页版：在 GitHub 新建仓库 → Upload files → 拖进去" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "按回车退出"
  exit 1
}
Write-Ok "git $((git --version) -replace 'git version ','')"

# ---------- 3. 初始化 ----------
Write-Step "初始化仓库"
if (Test-Path (Join-Path $PSScriptRoot '.git')) {
  Write-Ok "已有 .git，跳过 init"
} else {
  git init -q
  git branch -M main
  Write-Ok "git init 完成"
}

$remotes = git remote
if ($remotes -match '^origin$') {
  $cur = git remote get-url origin
  Write-Ok "origin 已存在：$cur"
} else {
  git remote add origin "https://github.com/$USER/$REPO.git"
  Write-Ok "origin → https://github.com/$USER/$REPO.git"
}

# ---------- 4. 提交并推送 ----------
Write-Step "提交并推送"
git add -A
$dirty = git status --porcelain
if ([string]::IsNullOrWhiteSpace($dirty)) {
  Write-Ok "没有改动，跳过 commit"
} else {
  $msg = "update " + (Get-Date -Format 'yyyy-MM-dd HH:mm')
  git commit -q -m $msg
  Write-Ok "commit：$msg"
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Bad "推送失败（多半是没登录 GitHub）"
  Write-Host ""
  Write-Host "   试试先跑一次：git push -u origin main" -ForegroundColor Yellow
  Write-Host "   按提示在浏览器里授权，或用 Personal Access Token 当密码。" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "按回车退出"
  exit 1
}

Write-Host ""
Write-Host "  推送成功。" -ForegroundColor Green
Write-Host ""
Write-Host "  最后一步（只需做一次）：" -ForegroundColor Cyan
Write-Host "    打开 https://github.com/$USER/$REPO/settings/pages" -ForegroundColor White
Write-Host "    Source 选 'Deploy from a branch'，分支 main，目录 / (root)，Save" -ForegroundColor White
Write-Host ""
Write-Host "    一两分钟后： https://$USER.github.io/$REPO/" -ForegroundColor Magenta
Write-Host ""
Read-Host "按回车关闭"
