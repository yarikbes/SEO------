# -*- coding: utf-8 -*-
"""
Находит слаги, которые есть в Excel, но отсутствуют в slugs.json
"""

import pandas as pd
import json

# Читаем Excel
print("Читаем Excel таблицу...")
df = pd.read_excel('URL на разных языках.xlsx')

# Читаем slugs.json
print("Читаем slugs.json...")
with open('slugs.json', 'r', encoding='utf-8') as f:
    slugs_data = json.load(f)

# Собираем все слаги из JSON (кроме main - там локали, а не слаги)
json_slugs = set()
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name == '⭐ - основной вариант':
        continue
    for slug in group_data['slugs'].keys():
        # Пропускаем локали из main
        if not slug.startswith('/'):
            continue
        json_slugs.add(slug)

print(f"\nСлагов в slugs.json: {len(json_slugs)}")

# Собираем все слаги из Excel
excel_slugs = set()
language_columns = [col for col in df.columns if col not in ['Страница', 'Тип страницы', 'Unnamed: 0']]

for col in language_columns:
    for value in df[col].dropna():
        value = str(value).strip()
        if value and value.startswith('/'):
            excel_slugs.add(value)

print(f"Слагов в Excel: {len(excel_slugs)}")

# Находим разницу
missing_in_json = excel_slugs - json_slugs
extra_in_json = json_slugs - excel_slugs

print("\n" + "="*80)
print(f"ОТСУТСТВУЮТ В slugs.json (есть в Excel): {len(missing_in_json)}")
print("="*80)

if missing_in_json:
    # Группируем по типу страницы
    missing_by_page = {}
    for slug in sorted(missing_in_json):
        # Ищем в какой строке Excel этот слаг
        found = False
        for idx, row in df.iterrows():
            for col in language_columns:
                if pd.notna(row[col]) and str(row[col]).strip() == slug:
                    page_type = row['Тип страницы']
                    if page_type not in missing_by_page:
                        missing_by_page[page_type] = []
                    missing_by_page[page_type].append((slug, col))
                    found = True
                    break
            if found:
                break
    
    for page_type, slugs in sorted(missing_by_page.items()):
        print(f"\n{page_type}:")
        for slug, lang in slugs:
            print(f"  {slug} ({lang})")

print("\n" + "="*80)
print(f"ЛИШНИЕ В slugs.json (нет в Excel): {len(extra_in_json)}")
print("="*80)

if extra_in_json:
    for slug in sorted(extra_in_json)[:20]:  # Показываем первые 20
        print(f"  {slug}")
    if len(extra_in_json) > 20:
        print(f"  ... и ещё {len(extra_in_json) - 20} слагов")

print("\n" + "="*80)
print("ИТОГО:")
print("="*80)
print(f"В Excel: {len(excel_slugs)} слагов")
print(f"В JSON:  {len(json_slugs)} слагов")
print(f"Нужно добавить в JSON: {len(missing_in_json)}")
print(f"Лишних в JSON: {len(extra_in_json)}")
