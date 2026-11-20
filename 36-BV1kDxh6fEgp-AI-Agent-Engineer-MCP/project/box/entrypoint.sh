#!/usr/bin/env bash
# P11 边界盒子——启动时先装防火墙，再降到 node 用户运行
#
# 课程描述：
#   "init-firewall.sh runs when the box starts. It blocks all network traffic,
#    then allows npm, github and Anthropic" —— p011
set -euo pipefail

/usr/local/bin/init-firewall.sh

exec gosu node "$@"
