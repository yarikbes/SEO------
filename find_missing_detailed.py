# -*- coding: utf-8 -*-
"""
Находит КОНКРЕТНЫЕ слаги, которые есть в Excel, но отсутствуют в slugs.json
"""

import pandas as pd
import json

# Читаем Excel
df = pd.read_excel('URL на разных языках.xlsx')

# Читаем slugs.json
with open('slugs.json', 'r', encoding='utf-8') as f:
    slugs_data = json.load(f)

# Собираем ВСЕ слаги из JSON в один список
json_slugs_list = []
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name == '⭐ - основной вариант':
        continue
    for slug in group_data['slugs'].keys():
        if slug.startswith('/'):
            json_slugs_list.append(slug)

json_slugs_set = set(json_slugs_list)

# Языковые колонки
language_columns = [
    'English (UK)', 'Swedish (SV)', 'Dutch (NL)', 'German (DE)', 
    'French (FR)', 'Spanish (ES)', 'Italian (IT)', 'Polish (PL)', 
    'Finnish (FI)', 'Danish (DA)', 'Norwegian (NO)', 'Portuguese (PT)', 
    'Czech (CS)', 'Romanian (RO)', 'Greek (GR)', 'Estonian (EE)', 
    'Hungarian (HU)'
]

# Собираем ВСЕ слаги из Excel с указанием строки
excel_slugs_detailed = []
for idx, row in df.iterrows():
    for col in language_columns:
        if pd.notna(row[col]):
            value = str(row[col]).strip()
            if value and value.startswith('/'):
                excel_slugs_detailed.append({
                    'row': idx + 2,  # +2 потому что в Excel нумерация с 1 и есть заголовок
                    'column': col,
                    'slug': value
                })

# Находим отсутствующие
missing = []
for item in excel_slugs_detailed:
    if item['slug'] not in json_slugs_set:
        missing.append(item)

print("="*80)
print(f"НАЙДЕНО {len(missing)} ОТСУТСТВУЮЩИХ СЛАГОВ В slugs.json")
print("="*80)

# Группируем по строкам
missing_by_row = {}
for item in missing:
    row_num = item['row']
    if row_num not in missing_by_row:
        missing_by_row[row_num] = []
    missing_by_row[row_num].append(item)

# Выводим результат
for row_num in sorted(missing_by_row.keys()):
    items = missing_by_row[row_num]
    print(f"\nСтрока {row_num} ({len(items)} слагов):")
    for item in items:
        print(f"  {item['slug']} ({item['column']})")

# Сохраняем в файл
with open('missing_slugs_list.txt', 'w', encoding='utf-8') as f:
    f.write("ОТСУТСТВУЮЩИЕ СЛАГИ В slugs.json\n")
    f.write("="*80 + "\n\n")
    for row_num in sorted(missing_by_row.keys()):
        items = missing_by_row[row_num]
        f.write(f"\nСтрока {row_num} ({len(items)} слагов):\n")
        for item in items:
            f.write(f"  {item['slug']} ({item['column']})\n")

print(f"\n\nПолный список сохранён в: missing_slugs_list.txt")
