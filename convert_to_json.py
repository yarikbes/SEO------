"""Инструмент конвертации CSV в slugs.json.

Использование:
    python convert_to_json.py [input_csv] [output_json]

По умолчанию читает файл "URL на разных языках - Вариант Б (развёрнутый).csv"
в корне проекта и перезаписывает slugs.json.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

import pandas as pd

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "URL на разных языках - Вариант Б (развёрнутый).csv"
DEFAULT_OUTPUT = ROOT / "slugs.json"

PAGE_GROUPS = {
    "main": {"description": "Главная страница", "aliases": ["", "/"]},
    "privacy": {"description": "Политика конфиденциальности", "aliases": ["privacy", "privacy-policy", "privacy-notice"]},
    "terms": {"description": "Условия использования", "aliases": ["terms", "terms-condition"]},
    "responsible": {"description": "Ответственная игра", "aliases": ["responsible", "responsible-gaming"]},
    "cookies": {"description": "Политика cookies", "aliases": ["cookies-policy", "cookies"]},
    "kyc": {"description": "Политика KYC"},
    "faq": {"description": "Часто задаваемые вопросы"},
    "contacts": {"description": "Контакты"},
    "support": {"description": "Поддержка"},
    "login": {"description": "Вход в систему"},
    "bonus": {"description": "Бонусы"},
    "promoCode": {"description": "Промокод / Бонус код", "aliases": ["promo-code", "bonus-code"]},
    "noDepositBonus": {"description": "Бонус без депозита"},
    "review": {"description": "Обзор казино"},
    "withdrawal": {"description": "Вывод средств"},
    "freeSpins": {"description": "Бесплатные вращения"},
    "app": {"description": "Мобильное приложение"},
    "games": {"description": "Игры"},
    "lottery": {"description": "Лотерея"},
    "vipProgram": {"description": "VIP программа"},
    "verification": {"description": "Верификация"},
    "cashback": {"description": "Кэшбэк"},
    "sport": {"description": "Спорт"},
    "betting": {"description": "Ставки на спорт", "aliases": ["betting", "sports-betting"]},
    "slots": {"description": "Слоты", "aliases": ["slots", "online-slots"]},
    "rules": {"description": "Правила", "aliases": ["regler"]},
}

TYPE_TO_GROUP = {
    "": "main",
    "/": "main",
    "main": "main",
    "en-gb": "main",
    "privacy": "privacy",
    "privacy-policy": "privacy",
    "privacy-notice": "privacy",
    "terms": "terms",
    "terms-condition": "terms",
    "responsible": "responsible",
    "responsible-gaming": "responsible",
    "cookies": "cookies",
    "cookies-policy": "cookies",
    "kyc": "kyc",
    "faq": "faq",
    "contacts": "contacts",
    "support": "support",
    "login": "login",
    "bonus": "bonus",
    "promo-code": "promoCode",
    "bonus-code": "promoCode",
    "no-deposit-bonus": "noDepositBonus",
    "review": "review",
    "withdrawal": "withdrawal",
    "free-spins": "freeSpins",
    "app": "app",
    "games": "games",
    "lottery": "lottery",
    "vip-program": "vipProgram",
    "verification": "verification",
    "cashback": "cashback",
    "sport": "sport",
    "betting": "betting",
    "sports-betting": "betting",
    "slots": "slots",
    "online-slots": "slots",
    "rules": "rules",
}


@dataclass
class PageBlock:
    slug: str
    rows: List[pd.Series]


def load_blocks(df: pd.DataFrame) -> Iterable[PageBlock]:
    current_slug: str | None = None
    buffer: List[pd.Series] = []

    for _, row in df.iterrows():
        first = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        if first.startswith('/'):
            if current_slug and buffer:
                yield PageBlock(current_slug, buffer)
                buffer = []
            current_slug = first
        if current_slug:
            buffer.append(row)

    if current_slug and buffer:
        yield PageBlock(current_slug, buffer)


def clean_slug(raw: str) -> str:
    slug = raw.strip()
    if not slug:
        return '/'
    if not slug.startswith('/'):
        slug = '/' + slug
    return '/' + slug.strip('/').lower()


def resolve_group(slug: str) -> str:
    key = slug.lstrip('/')
    return TYPE_TO_GROUP.get(slug) or TYPE_TO_GROUP.get(key) or key


def block_entries(block: PageBlock, headers: List[str]) -> Dict[str, str]:
    entries: Dict[str, str] = {}
    for row in block.rows:
        for idx, value in enumerate(row):
            if idx >= len(headers):
                continue
            if pd.isna(value) or not str(value).strip():
                continue
            entries[clean_slug(str(value))] = headers[idx]
    return entries


def build_groups(blocks: Iterable[PageBlock], headers: List[str]) -> Dict[str, Dict[str, Dict[str, str]]]:
    groups: Dict[str, Dict[str, Dict[str, str]]] = {}
    for block in blocks:
        group_key = resolve_group(block.slug)
        entries = block_entries(block, headers)
        bucket = groups.setdefault(group_key, {"slugs": {}})
        bucket["slugs"].update(entries)
    return groups


def merge_with_metadata(groups: Dict[str, Dict[str, Dict[str, str]]]) -> Dict[str, Dict[str, object]]:
    merged: Dict[str, Dict[str, object]] = {}
    for key, info in groups.items():
        meta = PAGE_GROUPS.get(key, {"description": key})
        merged[key] = {
            "description": meta["description"],
            "slugs": dict(sorted(info["slugs"].items())),
        }
        if aliases := meta.get("aliases"):
            merged[key]["aliases"] = aliases
    return dict(sorted(merged.items()))


def convert(input_path: Path, output_path: Path) -> None:
    df = pd.read_csv(input_path, header=None)
    headers = [str(col).strip() for col in df.iloc[1]]
    payload = df.iloc[2:].reset_index(drop=True)
    blocks = list(load_blocks(payload))
    raw_groups = build_groups(blocks, headers)
    final_groups = merge_with_metadata(raw_groups)

    data = {
        "version": "2.7",
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "pageGroups": final_groups,
    }
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ JSON сохранён: {output_path}")
    print(f"🧩 Групп: {len(final_groups)}")
    print(f"🔢 Слагов: {sum(len(group['slugs']) for group in final_groups.values())}")


def main(args: List[str]) -> int:
    input_path = Path(args[0]).expanduser() if args else DEFAULT_INPUT
    output_path = Path(args[1]).expanduser() if len(args) > 1 else DEFAULT_OUTPUT
    if not input_path.exists():
        print(f"❌ Файл не найден: {input_path}", file=sys.stderr)
        return 1
    convert(input_path, output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
