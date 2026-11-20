# P11 边界盒子——镜像：Node、Git、Claude Code，其余一律不装
#
# 课程对职责的描述：
#   "Dockerfile builds the image, node, git, and cloud code" —— p011
#   "it opens a shell inside the container, separate from the rest of my computer. I list my SSH keys. No such folder." —— p011 [02:52]
#
# 关键：镜像里没有宿主机 home，所以 ~/.ssh 不存在不是配置出来的，是「根本没挂进来」。
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git curl ca-certificates iptables iproute2 dnsutils gosu ripgrep \
 && rm -rf /var/lib/apt/lists/*

# Claude Code（harness 本体）
RUN npm install -g @anthropic-ai/claude-code

COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh

WORKDIR /workspace

# 默认以 node 用户运行；entrypoint 先以 root 装防火墙，再降权
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
