#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为词库批量生成预合成口语连读音频（edge-tts，需 scripts/.venv-speech 环境）。

用法: scripts/.venv-speech/bin/python scripts/generate_speech_audio.py <bankId> [--voice V] [--rate R] [--limit N]

输出: public/speech-audio/<bankId>/<md5(f"{voice}|{rate}|{norm(word)}")>.mp3
norm = trim + 小写 + 连续空白折叠为单空格，与前端 src/utils/speech-audio.ts 严格一致；
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


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("bank", help="词库 id（对应 public/wordbanks/<bank>.json）")
    ap.add_argument("--voice", default="en-US-AvaNeural")
    ap.add_argument("--rate", default="+5%")
    ap.add_argument("--limit", type=int, default=0, help="只生成前 N 条（样例试跑用）")
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()

    import edge_tts  # 延迟导入，--help 不依赖包

    words = json.load(open(ROOT / "public/wordbanks" / f"{args.bank}.json", encoding="utf-8"))
    items = [w["word"] for w in words][: args.limit or None]
    outdir = ROOT / "public/speech-audio" / args.bank
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
        print(f"[失败] {text}: {err}", file=sys.stderr)

    await asyncio.gather(*(gen(t) for t in todo))
    ok = len(todo) - len(failures)
    print(f"完成: 成功 {ok}，跳过 {skipped}，失败 {len(failures)}")
    if failures:
        print("失败清单:", failures)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
