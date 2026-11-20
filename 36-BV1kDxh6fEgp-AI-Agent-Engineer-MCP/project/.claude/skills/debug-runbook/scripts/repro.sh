#!/usr/bin/env bash
# P14：每次结果必须一致的机械步骤 → 写成脚本，不写进 skill.md 让模型每次自己拼
set -euo pipefail
cd "$(dirname "$0")/../.."
npm test --silent -- "$@"
