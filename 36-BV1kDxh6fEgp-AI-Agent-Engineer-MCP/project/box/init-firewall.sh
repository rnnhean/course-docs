#!/usr/bin/env bash
# P11 边界盒子——网络白名单：默认全禁，只放行运行 Agent 必需的三类
#
# 课程描述（按顺序，顺序本身就是设计）：
#   1. 先阻断所有出站流量
#   2. 再放行 npm registry / GitHub / Anthropic API
#   "It blocks all network traffic, then allows npm, github and Anthropic" —— p011
#
# 为什么要做成白名单而不是黑名单：注入攻击的第一个动作是「把数据送出去」，
# 没有外送通道，注入就少了一半威力（课程 P43「致命三要素」）。
set -euo pipefail

ALLOWED_DOMAINS=(
  "registry.npmjs.org"
  "api.github.com"
  "github.com"
  "codeload.github.com"
  "objects.githubusercontent.com"
  "api.anthropic.com"
  "statsig.anthropic.com"
  "sentry.io"
)

echo "[firewall] 清空规则，默认拒绝出站"
iptables -F OUTPUT 2>/dev/null || true
iptables -P OUTPUT DROP 2>/dev/null || true

# 本地回环与已建立连接
iptables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true

# DNS（否则域名解析不了，白名单形同虚设）
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || true
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT 2>/dev/null || true

for d in "${ALLOWED_DOMAINS[@]}"; do
  ips=$(getent ahostsv4 "$d" 2>/dev/null | awk '{print $1}' | sort -u || true)
  for ip in $ips; do
    iptables -A OUTPUT -d "$ip" -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    iptables -A OUTPUT -d "$ip" -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
  done
  echo "[firewall] 放行 $d (${ips//$'\n'/ })"
done

echo "[firewall] 完成。验证："
echo "  curl -sS --max-time 5 https://example.com          # 应失败"
echo "  curl -sS --max-time 5 https://registry.npmjs.org/-/ping  # 应成功"
