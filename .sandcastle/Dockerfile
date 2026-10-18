# 玉机子网站沙箱：Ruby + Jekyll 静态站工具链 + gh + OpenCode v2
#
# 项目需求来源：仓库根 AGENTS.md（验证命令）+ _config.yml（Jekyll 站点、Pages legacy build）
# 本站点没有编译器、没有测试框架，门禁 = `jekyll build` + 站内链接检查（.sandcastle/check_site.py）。
# 音频/文档大文件（玉机子/ 经典读诵/ 体真山人语录/）由 .dockerignore 排除在 build context 之外，
# 沙箱里通过 worktree bind mount 依然可见（只用于核对，agent 不应改）。
FROM ruby:3.2-bookworm

ARG HTTPS_PROXY=""
ARG HTTP_PROXY=""
ARG NO_PROXY=""

# 系统依赖 + GitHub CLI + python3（check_site.py 用）
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  curl \
  jq \
  ca-certificates \
  python3 \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Jekyll 预装并冻结进镜像：容器内不联网装 gem，首次 build 不用等 gem 解析。
# 4.3.4 近似 GitHub Pages 的托管版本（Pages 用 3.9.3）；本站点只用核心 Liquid + Markdown，
# 两者行为一致。版本差异不作为验收依据 —— 门禁只取「能构建 + 无 Liquid/YAML 错误」。
RUN gem install jekyll -v 4.3.4 --no-document \
  && gem install webrick --no-document \
  && jekyll --version

# Build-args for UID/GID alignment: `sandcastle docker build-image` 默认取宿主 UID/GID，
# 使镜像内新建文件与 bind-mount 的文件同主，运行时零 chown。
# ruby 镜像自带 uid 1000 的 ruby 用户 → 走 ③a（groupadd/useradd），不是 node 的 groupmod。
ARG AGENT_UID=1000
ARG AGENT_GID=1000

RUN groupadd -o -g $AGENT_GID agent 2>/dev/null; \
  useradd -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l -s /bin/bash agent

# OpenCode CLI v2 —— 走官方安装脚本（自带二进制，无需 Node）；
# 装后实体拷贝进 /usr/local/bin（root 家目录 700，软链对 agent 用户是悬空的）。
RUN curl -fsSL https://opencode.ai/v2/install | bash \
  && install -m 755 /root/.opencode/bin/opencode /usr/local/bin/opencode \
  && opencode --version

# 显式声明 opencode-go provider：容器内 Bun fetch 不走代理，models.dev 拉不到
# （只剩内置模型 → provider.no-route）。key 经 {env:OPENCODE_GO_API_KEY} 注入。
# --chown 必须：COPY 自动建的父目录若归 root，opencode 写 service.json.tmp 会 EACCES。
COPY --chown=${AGENT_UID}:${AGENT_GID} .sandcastle/opencode.json /home/agent/.config/opencode/opencode.json

USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at ${SANDBOX_REPO_DIR}
# and overrides the working directory to ${SANDBOX_REPO_DIR} at container start.
ENTRYPOINT ["sleep", "infinity"]
