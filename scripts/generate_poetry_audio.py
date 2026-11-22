#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为移动端内置诗词批量生成全文朗读音频（edge-tts，需 scripts/.venv-speech 环境）。

用法: scripts/.venv-speech/bin/python scripts/generate_poetry_audio.py [--voice V] [--rate R] [--limit N]

数据源: mobile/src/subPackages/pages-memory/text-memory/data/poetry-*.json
输出: public/poetry-audio/<md5(f"{voice}|{rate}|{norm(speakText)}")>.mp3
speakText = [title, author, content] 去空后以「。」连接；norm = trim + 连续空白折叠为单空格，
与移动端 src/utils/poetry-audio.ts 严格一致（中文不做小写折叠）。
改音色/语速后哈希变化，需重新生成全量并同步修改前端常量。
幂等: 已存在且非空的文件直接跳过，可安全重跑补失败条目。
"""
import argparse
import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "mobile/src/subPackages/pages-memory/text-memory/data"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())


def speak_text(title: str, author: str, content: str) -> str:
    return "。".join(p.strip() for p in (title, author, content) if p and p.strip())


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--voice", default="zh-CN-XiaoxiaoNeural")
    ap.add_argument("--rate", default="-10%")
    ap.add_argument("--limit", type=int, default=0, help="只生成前 N 条（样例试跑用）")
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()

    import edge_tts  # 延迟导入，--help 不依赖包

    items: list[str] = []
    for f in sorted(DATA_DIR.glob("poetry-*.json")):
        data = json.load(open(f, encoding="utf-8"))
        for poem in data.get("poems", []):
            text = speak_text(poem.get("title", ""), poem.get("author", ""), poem.get("content", ""))
            if text:
                items.append(text)
    # 去重（不同诗集可能收同一篇）
    items = list(dict.fromkeys(items))[: args.limit or None]

    outdir = ROOT / "public/poetry-audio"
    outdir.mkdir(parents=True, exist_ok=True)

    def target(text: str) -> Path:
        h = hashlib.md5(f"{args.voice}|{args.rate}|{norm(text)}".encode("utf-8")).hexdigest()
        return outdir / f"{h}.mp3"

    todo = [t for t in items if not (target(t).exists() and target(t).stat().st_size > 0)]
    skipped = len(items) - len(todo)
    print(f"总数 {len(items)}，跳过已存在 {skipped}，待生成 {len(todo)}")

    sem = asyncio.Semaphore(args.concurrency)
    failures = []

    async def gen(text: str) -> None:
        err: Exception | None = None
        async with sem:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(text, args.voice, rate=args.rate).save(str(target(text)))
                    if target(text).stat().st_size > 0:
                        return
                except Exception as e:  # noqa: BLE001 - 单条失败不中断整体
                    err = e
                    await asyncio.sleep(2**attempt)
        failures.append(text)
        print(f"[失败] {text[:30]}: {err}", file=sys.stderr)

    await asyncio.gather(*(gen(t) for t in todo))
    ok = len(todo) - len(failures)
    print(f"完成: 成功 {ok}，跳过 {skipped}，失败 {len(failures)}")
    if failures:
        print("失败清单:", [t[:30] for t in failures])
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
