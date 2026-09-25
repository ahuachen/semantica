#!/usr/bin/env bash
#
# Semantica 本地开发 / 演示脚本
#
#   ./start-dev.sh              安装依赖 + 生成演示图谱 + 启动前后端 (dev 模式)
#   ./start-dev.sh setup        只装依赖 (Python venv + 前端 node_modules)
#   ./start-dev.sh demo         只生成演示图谱数据
#   ./start-dev.sh dev          启动后端 :8000 + Vite 前端 :5173 (热更新)
#   ./start-dev.sh build        编译前端到 semantica/static
#   ./start-dev.sh serve        编译前端后，用单个后端端口 :8000 同时提供 UI 和 API
#   ./start-dev.sh status       查看运行状态
#   ./start-dev.sh logs         跟踪日志
#   ./start-dev.sh stop         停止后台进程
#   ./start-dev.sh clean        清理 venv / node_modules / 运行产物
#
# 环境变量：
#   API_PORT=8000  WEB_PORT=5173  PYTHON_VERSION=3.12  GRAPH=demo_out/demo_graph.json
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
PYTHON_VERSION="${PYTHON_VERSION:-3.12}"   # pyproject 要求 >=3.10,<3.14
NODE_MIN_MAJOR=18

VENV="$ROOT/.venv"
PY="$VENV/bin/python"
RUN_DIR="$ROOT/demo_out"                   # 已在 .gitignore 中
GRAPH="${GRAPH:-$RUN_DIR/demo_graph.json}"
API_LOG="$RUN_DIR/api.log"
WEB_LOG="$RUN_DIR/web.log"
API_PID="$RUN_DIR/api.pid"
WEB_PID="$RUN_DIR/web.pid"

info()  { printf '\033[36m▸\033[0m %s\n' "$*"; }
ok()    { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m!\033[0m %s\n' "$*"; }
die()   { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- toolchain

need_uv() {
  command -v uv >/dev/null 2>&1 || die "未找到 uv，请先安装：curl -LsSf https://astral.sh/uv/install.sh | sh"
}

# 只在当前进程内切 Node 版本，不动全局默认
ensure_node() {
  local major
  if command -v node >/dev/null 2>&1; then
    major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
    [ "$major" -ge "$NODE_MIN_MAJOR" ] && return 0
    warn "当前 node $(node -v) 低于要求的 v${NODE_MIN_MAJOR}，尝试用 nvm 切换"
  fi
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || nvm install 22
    ok "已在当前进程切到 node $(node -v)"
  else
    die "需要 Node.js >= ${NODE_MIN_MAJOR}，且未找到 nvm"
  fi
}

# ------------------------------------------------------------------- setup

setup_python() {
  need_uv
  if [ ! -x "$PY" ]; then
    info "创建 Python ${PYTHON_VERSION} 虚拟环境 (.venv)"
    uv venv --python "$PYTHON_VERSION" "$VENV"
  fi
  info "安装 semantica[explorer] (editable)"
  uv pip install --python "$PY" -e ".[explorer]"
  ok "Python 环境就绪：$("$PY" -V)"
}

setup_frontend() {
  ensure_node
  if [ -d "$ROOT/explorer/node_modules" ]; then
    ok "前端依赖已存在，跳过（重装请先 ./start-dev.sh clean）"
    return 0
  fi
  info "安装前端依赖 (npm ci)"
  ( cd "$ROOT/explorer" && npm ci )
  ok "前端依赖就绪"
}

cmd_setup() {
  setup_python
  setup_frontend
}

# -------------------------------------------------------------------- demo

cmd_demo() {
  [ -x "$PY" ] || setup_python
  mkdir -p "$RUN_DIR"
  info "生成演示图谱 → $GRAPH"
  "$PY" demo/build_demo_graph.py "$GRAPH"
}

# ------------------------------------------------------------------ runtime

port_busy() { lsof -ti tcp:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

wait_for_http() {
  local url="$1" name="$2" tries=60
  while [ "$tries" -gt 0 ]; do
    # --noproxy 是必须的：本机若设了 HTTP_PROXY/ALL_PROXY，curl 会把回环地址
    # 也送去代理，探测就可能因为代理而"成功"，掩盖服务其实没起来的事实。
    curl -fsS --noproxy '*' -o /dev/null "$url" 2>/dev/null && { ok "$name 已就绪 → $url"; return 0; }
    sleep 1
    tries=$((tries - 1))
  done
  die "$name 启动超时，查看日志：./start-dev.sh logs"
}

start_api() {
  [ -f "$GRAPH" ] || cmd_demo
  port_busy "$API_PORT" && die "端口 $API_PORT 已被占用，先 ./start-dev.sh stop 或换 API_PORT"

  info "启动后端 API :$API_PORT"
  # SEMANTICA_ALLOW_ANONYMOUS 仅用于本地开发：不设它受保护路由会 503
  # ALLOWED_ORIGINS 默认只有 :5173，端口一改 /ws 握手就会 403，这里按实际端口下发
  SEMANTICA_ALLOW_ANONYMOUS=true \
  ALLOWED_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT,http://localhost:$API_PORT,http://127.0.0.1:$API_PORT" \
    nohup "$PY" -m semantica.explorer \
      --graph "$GRAPH" --port "$API_PORT" --host 127.0.0.1 --no-browser \
      >"$API_LOG" 2>&1 &
  echo "$! $API_PORT" >"$API_PID"
  wait_for_http "http://127.0.0.1:$API_PORT/api/health" "后端"
}

start_web() {
  ensure_node
  port_busy "$WEB_PORT" && die "端口 $WEB_PORT 已被占用，先 ./start-dev.sh stop 或换 WEB_PORT"

  info "启动前端 Vite :$WEB_PORT"
  # `&` 必须只作用于 nohup 那一条命令：否则后台的是一个子 shell，
  # 它继承脚本的 stdout 且不会退出，调用方的管道会一直挂住。
  (
    cd "$ROOT/explorer"
    export VITE_EXPLORER_API_TARGET="http://127.0.0.1:$API_PORT"
    nohup npm run dev -- --port "$WEB_PORT" --strictPort >"$WEB_LOG" 2>&1 &
    echo "$! $WEB_PORT" >"$WEB_PID"
  )
  # 探测用 localhost 而不是 127.0.0.1：vite 默认只绑 IPv6 的 [::1]，
  # 写死 IPv4 回环会连不上。localhost 两种协议栈都能解析到。
  wait_for_http "http://localhost:$WEB_PORT/" "前端"
}

cmd_dev() {
  [ -x "$PY" ] || setup_python
  [ -d "$ROOT/explorer/node_modules" ] || setup_frontend
  mkdir -p "$RUN_DIR"
  start_api
  start_web
  echo
  ok "开发环境已启动"
  echo "   UI   → http://localhost:$WEB_PORT"
  echo "   API  → http://127.0.0.1:$API_PORT/api/health"
  echo "   图谱 → $GRAPH"
  echo "   日志 → ./start-dev.sh logs      停止 → ./start-dev.sh stop"
}

# -------------------------------------------------------------- build/serve

cmd_build() {
  ensure_node
  [ -d "$ROOT/explorer/node_modules" ] || setup_frontend
  info "编译前端 (tsc -b && vite build) → semantica/static"
  ( cd "$ROOT/explorer" && npm run build )
  ok "构建完成：$ROOT/semantica/static"
}

cmd_serve() {
  [ -x "$PY" ] || setup_python
  [ -d "$ROOT/semantica/static" ] || cmd_build
  mkdir -p "$RUN_DIR"
  start_api
  echo
  ok "单端口模式已启动（UI + API 同端口）"
  echo "   打开 → http://127.0.0.1:$API_PORT"
}

# ------------------------------------------------------------------- 运维

# 自底向上杀掉进程树：npm run dev 会派生 vite，只杀父进程会留下孤儿占着端口
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

stop_pidfile() {
  local file="$1" name="$2" pid
  [ -f "$file" ] || return 0
  read -r pid _ <"$file"
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    kill_tree "$pid"
    info "已停止 $name (pid $pid)"
  fi
  rm -f "$file"
}

cmd_stop() {
  stop_pidfile "$WEB_PID" "前端"
  stop_pidfile "$API_PID" "后端"
  ok "已停止"
}

cmd_status() {
  local file name pid port
  for entry in "$API_PID:后端" "$WEB_PID:前端"; do
    IFS=: read -r file name <<<"$entry"
    pid=""; port=""
    [ -f "$file" ] && read -r pid port <"$file"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      ok "$name 运行中 (pid $pid, 端口 $port)"
    else
      warn "$name 未运行"
    fi
  done
}

cmd_logs() {
  mkdir -p "$RUN_DIR"
  touch "$API_LOG" "$WEB_LOG"
  tail -n 40 -f "$API_LOG" "$WEB_LOG"
}

cmd_clean() {
  cmd_stop || true
  info "清理 .venv / explorer/node_modules / semantica/static / demo_out"
  rm -rf "$VENV" "$ROOT/explorer/node_modules" "$ROOT/semantica/static" "$RUN_DIR"
  ok "已清理"
}

# ------------------------------------------------------------------ dispatch

case "${1:-dev}" in
  setup)  cmd_setup ;;
  demo)   cmd_demo ;;
  dev)    cmd_dev ;;
  build)  cmd_build ;;
  serve)  cmd_serve ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  stop)   cmd_stop ;;
  clean)  cmd_clean ;;
  -h|--help|help)
    sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
  *) die "未知命令：$1（可用：setup demo dev build serve status logs stop clean）" ;;
esac
