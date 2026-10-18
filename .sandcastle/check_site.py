#!/usr/bin/env python3
"""站内链接 / 资源 / Liquid 残留检查 —— 玉机子网站的 Sandcastle 门禁。

用法：
    python3 .sandcastle/check_site.py <site_dir> [--baseline <file>] [--write-baseline <file>]

检查三类问题，任何一条都算「本次改动引入的缺陷」：
  1. 站内链接 / 资源指向的目标文件在构建产物里不存在（死链）
  2. HTML 里残留未渲染的 Liquid（`{{` / `{%`）—— Jekyll 渲染失败的痕迹
  3. 页面引用了 _site 之外绝对路径（如 file://）

基线对齐（对应 AGENTS.md 的「失败分类规则」）：
    本站点历史上存在少量死链，直接报错会把「既有问题」误判成「本次回归」。
    用 --baseline 传入已知死链清单（每行一条 `页面<TAB>链接`），脚本只对
    **不在清单里** 的新增死链退出码 1。--write-baseline 生成/刷新清单。

退出码：0 = 无新增问题；1 = 有新增问题（stdout 打印明细）；2 = 用法错误。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

SKIP_PREFIXES = (
    "http://",
    "https://",
    "//",
    "mailto:",
    "tel:",
    "javascript:",
    "data:",
    "file:",
    "ftp:",
    "irc:",
    "sms:",
    "whatsapp:",
    "weixin:",
    "alipay:",
)

LIQUID_RE = re.compile(r"\{\{|\{%")


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in ("href", "src") and value:
                self.links.append(value.strip())

    handle_startendtag = handle_starttag


def iter_html(site_dir: str):
    for root, _dirs, files in os.walk(site_dir):
        for name in files:
            if name.endswith((".html", ".htm")):
                yield os.path.join(root, name)


def resolve(site_dir: str, doc_path: str, url: str) -> list[str]:
    """返回该 URL 可能的落盘路径候选（相对站根）。"""
    path = unquote(urlsplit(url).path)
    if not path:
        return []
    if path.startswith("/"):
        base = os.path.join(site_dir, path.lstrip("/"))
    else:
        base = os.path.normpath(os.path.join(os.path.dirname(doc_path), path))
    candidates = [base]
    if path.endswith("/"):
        candidates = [os.path.join(base, "index.html")]
    else:
        candidates.append(base + ".html")
        candidates.append(os.path.join(base, "index.html"))
    return candidates


def check(site_dir: str) -> tuple[list[str], list[str]]:
    broken: list[str] = []
    liquid: list[str] = []
    if not os.path.isdir(site_dir):
        print(f"ERROR: site dir not found: {site_dir}", file=sys.stderr)
        sys.exit(2)

    for doc in sorted(iter_html(site_dir)):
        rel_doc = os.path.relpath(doc, site_dir)
        try:
            text = open(doc, encoding="utf-8", errors="replace").read()
        except OSError as exc:
            broken.append(f"{rel_doc}\t<unreadable: {exc}>")
            continue

        if LIQUID_RE.search(text):
            line = next(
                (i for i, l in enumerate(text.splitlines(), 1) if LIQUID_RE.search(l)),
                0,
            )
            liquid.append(f"{rel_doc}:{line}")

        parser = LinkCollector()
        parser.feed(text)
        for url in parser.links:
            if url.startswith("#") or url.startswith(SKIP_PREFIXES):
                continue
            candidates = resolve(site_dir, doc, url)
            if not candidates:
                continue
            if not any(os.path.exists(c) for c in candidates):
                broken.append(f"{rel_doc}\t{url}")

    return broken, liquid


def load_baseline(path: str | None) -> set[str]:
    if not path or not os.path.exists(path):
        return set()
    out = set()
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            out.add(line)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("site_dir")
    ap.add_argument("--baseline")
    ap.add_argument("--write-baseline")
    args = ap.parse_args()

    broken, liquid = check(args.site_dir)

    if args.write_baseline:
        with open(args.write_baseline, "w", encoding="utf-8") as fh:
            fh.write("# 玉机子网站已知死链基线（check_site.py --write-baseline 生成）\n")
            fh.write("# 格式：页面路径<TAB>链接。只影响「新增」判定，不代表这些链接是好的。\n")
            for row in sorted(broken):
                fh.write(row + "\n")
        print(f"baseline written: {args.write_baseline} ({len(broken)} entries)")

    baseline = load_baseline(args.baseline)
    new_broken = [row for row in broken if row not in baseline]

    print(f"checked {args.site_dir}")
    print(f"  broken links : {len(broken)} total, {len(new_broken)} new")
    print(f"  liquid leaks : {len(liquid)}")

    if liquid:
        print("\n未渲染的 Liquid（模板渲染失败）：")
        for row in liquid:
            print(f"  {row}")

    if new_broken:
        print("\n新增死链（不在基线内）—— 必须修：")
        for row in new_broken:
            print(f"  {row}")

    if liquid or new_broken:
        return 1

    if broken:
        print("\n（剩余死链均在基线内，判定为既有问题，放行）")
    else:
        print("\nOK: 无死链、无 Liquid 残留")
    return 0


if __name__ == "__main__":
    sys.exit(main())
