#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 48 个音素生成预合成发音音频（edge-tts，需 scripts/.venv-speech 环境）。

音素清单从 mobile/src/utils/phoneme-data.ts 正则提取（ipa + articulation 代理串），
输出到 public/phoneme-audio/<ipa>.mp3（原始 IPA 字符命名，jsDelivr 解码 URL 后按原名查找），
经 jsDelivr 分发：
  https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/phoneme-audio/<urlencode(ipa)>.mp3
前端按同一规则拼 URL（mobile/src/utils/phoneme-audio.ts），改文件名规则需两边同步。
幂等：已存在且非空的文件直接跳过，可安全重跑。
"""
import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHONEME_DATA = ROOT / "mobile/src/utils/phoneme-data.ts"
OUTDIR = ROOT / "public/phoneme-audio"
VOICE = "en-US-AvaNeural"
RATE = "-15%"  # 慢速，便于初学者听清单音


def parse_phonemes() -> list[tuple[str, str]]:
    """从 phoneme-data.ts 提取 (ipa, articulation) 对（每个音素对象单行）"""
    text = PHONEME_DATA.read_text(encoding="utf-8")
    pairs = re.findall(r"\{ipa: '([^']+)'[^\n]*?articulation: '([^']+)'", text)
    return pairs


async def main() -> None:
    import edge_tts  # 延迟导入

    pairs = parse_phonemes()
    if len(pairs) != 48:
        print(f"警告：提取到 {len(pairs)} 个音素（预期 48）", file=sys.stderr)

    OUTDIR.mkdir(parents=True, exist_ok=True)
    todo = []
    for ipa, articulation in pairs:
        # 文件名直接用原始 IPA 字符：jsDelivr 会解码 URL 后按原始文件名查找
        target = OUTDIR / f"{ipa}.mp3"
        if target.exists() and target.stat().st_size > 0:
            continue
        todo.append((ipa, articulation, target))

    print(f"总数 {len(pairs)}，待生成 {len(todo)}")

    sem = asyncio.Semaphore(6)

    async def gen(ipa: str, articulation: str, target: Path) -> None:
        async with sem:
            for attempt in range(3):
                try:
                    communicate = edge_tts.Communicate(articulation, VOICE, rate=RATE)
                    await communicate.save(str(target))
                    print(f"✓ /{ipa}/ <- '{articulation}'")
                    return
                except Exception as e:  # noqa: BLE001
                    print(f"重试 {attempt + 1}/3 /{ipa}/: {e}", file=sys.stderr)
                    await asyncio.sleep(1 + attempt)
            print(f"✗ 失败 /{ipa}/", file=sys.stderr)

    await asyncio.gather(*(gen(*item) for item in todo))
    print("完成")


if __name__ == "__main__":
    asyncio.run(main())
