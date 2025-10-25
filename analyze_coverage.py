# -*- coding: utf-8 -*-
import pandas as pd
import json
from collections import defaultdict

# Читаем Excel
df = pd.read_excel('URL на разных языках.xlsx')

# Читаем текущий slugs.json
with open('slugs.json', 'r', encoding='utf-8') as f:
    slugs_data = json.load(f)

print("=" * 80)
print("АНАЛИЗ ПОКРЫТИЯ БАЗЫ СЛАГОВ")
print("=" * 80)

# Языки в Excel (пропускаем служебные колонки)
excel_languages = [col for col in df.columns if col not in ['Страница', 'Тип страницы', 'Unnamed: 0']]
print(f"\nЯзыков в Excel: {len(excel_languages)}")
print(f"Языки: {', '.join(excel_languages)}\n")

# Подсчитаем покрытие по языкам для каждой группы
coverage = {}
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name == '⭐ - основной вариант':
        continue
    
    slugs = group_data['slugs']
    lang_coverage = defaultdict(int)
    
    for slug, lang in slugs.items():
        # Извлекаем код языка
        if 'en' in lang.lower():
            lang_code = 'EN'
        elif '(SV)' in lang:
            lang_code = 'SV'
        elif '(NL)' in lang:
            lang_code = 'NL'
        elif '(DE)' in lang:
            lang_code = 'DE'
        elif '(FR)' in lang:
            lang_code = 'FR'
        elif '(ES)' in lang:
            lang_code = 'ES'
        elif '(IT)' in lang:
            lang_code = 'IT'
        elif '(PL)' in lang:
            lang_code = 'PL'
        elif '(FI)' in lang:
            lang_code = 'FI'
        elif '(DA)' in lang:
            lang_code = 'DA'
        elif '(NO)' in lang:
            lang_code = 'NO'
        elif '(PT)' in lang:
            lang_code = 'PT'
        elif '(CS)' in lang:
            lang_code = 'CS'
        elif '(RO)' in lang:
            lang_code = 'RO'
        elif '(GR)' in lang:
            lang_code = 'GR'
        elif '(EE)' in lang:
            lang_code = 'EE'
        elif '(HU)' in lang:
            lang_code = 'HU'
        else:
            lang_code = 'OTHER'
        
        lang_coverage[lang_code] += 1
    
    coverage[group_name] = dict(lang_coverage)

# Ключевые языки
key_languages = ['EN', 'SV', 'NL', 'DE', 'FR', 'ES', 'IT', 'PL', 'FI', 'DA', 'NO', 'PT', 'CS', 'RO', 'GR', 'EE', 'HU']

# Найдём группы с неполным покрытием
print("\n" + "=" * 80)
print("ГРУППЫ С НЕПОЛНЫМ ПОКРЫТИЕМ ЯЗЫКОВ")
print("=" * 80)

gaps = []
for group_name, lang_cov in sorted(coverage.items()):
    missing = [lang for lang in key_languages if lang not in lang_cov]
    if missing and len(missing) < 17:  # Пропускаем совсем пустые
        print(f"\n{group_name}:")
        print(f"  Есть: {len(lang_cov)} языков ({', '.join(sorted(lang_cov.keys()))})")
        print(f"  НЕТ:  {', '.join(missing)}")
        gaps.append((group_name, missing))

# Анализ дефисов
print("\n\n" + "=" * 80)
print("АНАЛИЗ ВАРИАНТОВ С ДЕФИСАМИ/БЕЗ ДЕФИСОВ")
print("=" * 80)

dash_variants = defaultdict(list)
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name == '⭐ - основной вариант':
        continue
    
    for slug in group_data['slugs'].keys():
        if '-' in slug:
            # Проверяем, есть ли вариант без дефиса
            no_dash = slug.replace('-', '')
            for g2_name, g2_data in slugs_data['pageGroups'].items():
                if g2_name == group_name:
                    continue
                if no_dash in g2_data['slugs']:
                    dash_variants[slug].append(f"без дефиса: {no_dash} в группе {g2_name}")

if dash_variants:
    print("\nНайдены пары с дефисами:")
    for dash_slug, variants in sorted(dash_variants.items()):
        print(f"  {dash_slug} -> {', '.join(variants)}")
else:
    print("\nВсе варианты с дефисами уже в базе.")

# Подсчёт общей статистики
print("\n\n" + "=" * 80)
print("ОБЩАЯ СТАТИСТИКА")
print("=" * 80)

total_slugs = 0
total_groups = 0
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name != '⭐ - основной вариант':
        total_groups += 1
        total_slugs += len(group_data['slugs'])

print(f"\nВсего групп: {total_groups}")
print(f"Всего слагов: {total_slugs}")
print(f"Среднее слагов на группу: {total_slugs / total_groups:.1f}")

# Группы с наименьшим покрытием
print("\n\nГруппы с наименьшим покрытием (TOP-5):")
sorted_coverage = sorted(coverage.items(), key=lambda x: len(x[1]))
for i, (group_name, lang_cov) in enumerate(sorted_coverage[:5], 1):
    print(f"{i}. {group_name}: {len(lang_cov)} языков")
