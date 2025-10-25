# -*- coding: utf-8 -*-
"""
Анализ возможных вариантов написания слагов:
1. Дефисы vs пробелы vs слитно
2. Единственное vs множественное число
3. Региональные диалекты
"""

import json
from collections import defaultdict

with open('slugs.json', 'r', encoding='utf-8') as f:
    slugs_data = json.load(f)

print("="*80)
print("АНАЛИЗ ВАРИАНТОВ НАПИСАНИЯ СЛАГОВ")
print("="*80)

# 1. Анализ дефисов
print("\n" + "="*80)
print("1. СЛАГИ С ДЕФИСАМИ (возможны варианты без дефиса или слитно)")
print("="*80)

dashed_slugs = defaultdict(list)
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name == '⭐ - основной вариант':
        continue
    for slug, lang in group_data['slugs'].items():
        if '-' in slug:
            # Извлекаем язык
            lang_code = 'OTHER'
            if 'English' in lang or 'en' in lang.lower():
                lang_code = 'EN'
            elif '(ES)' in lang:
                lang_code = 'ES'
            elif '(DE)' in lang:
                lang_code = 'DE'
            elif '(FR)' in lang:
                lang_code = 'FR'
            elif '(IT)' in lang:
                lang_code = 'IT'
            elif '(NL)' in lang:
                lang_code = 'NL'
            elif '(SV)' in lang:
                lang_code = 'SV'
            elif '(FI)' in lang:
                lang_code = 'FI'
            elif '(PL)' in lang:
                lang_code = 'PL'
            elif '(NO)' in lang:
                lang_code = 'NO'
            elif '(DA)' in lang:
                lang_code = 'DA'
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
            
            # Проверяем, сколько дефисов
            dash_count = slug.count('-')
            if dash_count == 1:
                base = slug.replace('-', '')
                dashed_slugs[base].append((slug, lang_code, group_name))

# Группируем по базе
variant_groups = {}
for base, variants in dashed_slugs.items():
    if len(variants) > 1:
        variant_groups[base] = variants

if variant_groups:
    print("\nНайдены группы с возможными вариантами:")
    for base, variants in sorted(variant_groups.items())[:10]:
        print(f"\n  База '{base}':")
        for slug, lang, group in variants:
            print(f"    {slug} ({lang}) в группе {group}")
else:
    print("\nНет явных дублей с дефисами")

# 2. Анализ единственного/множественного числа
print("\n\n" + "="*80)
print("2. ЕДИНСТВЕННОЕ vs МНОЖЕСТВЕННОЕ ЧИСЛО")
print("="*80)

# Известные пары
number_variants = {
    'bonus': {
        'singular': ['/bonus', '/bono'],
        'plural': ['/bonos', '/bonusy', '/bonussen', '/bonusar', '/bonukset', '/bonusser', '/bonuser', '/bonusuri', '/boonused', '/bonuszok']
    },
    'withdrawal': {
        'singular': ['/retiro', '/nosto', '/kotiutus', '/wyplata'],
        'plural': ['/retiros', '/wyplaty']
    },
    'review': {
        'singular': ['/resena'],
        'plural': ['/resenas', '/opiniones']
    },
    'slot': {
        'singular': ['/slot'],
        'plural': ['/slots', '/sloty', '/slotok']
    }
}

print("\nИЗВЕСТНЫЕ ПАРЫ (ед. vs мн. число):")
for concept, variants in number_variants.items():
    print(f"\n{concept.upper()}:")
    print(f"  Единственное: {', '.join(variants['singular'])}")
    print(f"  Множественное: {', '.join(variants['plural'])}")

# Проверяем, какие есть в базе
print("\n\nЧТО ЕСТЬ В БАЗЕ:")
all_slugs = set()
for group_name, group_data in slugs_data['pageGroups'].items():
    if group_name != '⭐ - основной вариант':
        for slug in group_data['slugs'].keys():
            all_slugs.add(slug)

for concept, variants in number_variants.items():
    print(f"\n{concept}:")
    for num_type in ['singular', 'plural']:
        present = [s for s in variants[num_type] if s in all_slugs]
        missing = [s for s in variants[num_type] if s not in all_slugs]
        if present:
            print(f"  {num_type} ЕСТЬ: {', '.join(present)}")
        if missing:
            print(f"  {num_type} НЕТ: {', '.join(missing)}")

# 3. Региональные диалекты
print("\n\n" + "="*80)
print("3. РЕГИОНАЛЬНЫЕ ДИАЛЕКТЫ (ES, PT, etc)")
print("="*80)

dialects = {
    'Spanish (ES)': {
        'slots': {
            'ES-EU': '/tragaperras',  # Испания
            'ES-LA': '/tragamonedas'  # Латинская Америка
        },
        'withdrawal': {
            'singular': '/retiro',
            'plural': '/retiros'
        },
        'review': {
            'singular': '/resena',
            'plural': '/resenas',
            'alternative': '/opiniones'
        },
        'bonus': {
            'singular': '/bono',
            'plural': '/bonos'
        }
    },
    'Finnish (FI)': {
        'withdrawal': {
            'variant1': '/nosto',
            'variant2': '/kotiutus'
        },
        'bonus-code': {
            'variant1': '/bonuskoodi',
            'variant2': '/bonus-koodi'
        }
    }
}

print("\nИСПАНСКИЙ:")
for concept, variants in dialects['Spanish (ES)'].items():
    print(f"\n  {concept}:")
    for var_name, slug in variants.items():
        status = "✓ ЕСТЬ" if slug in all_slugs else "✗ НЕТ"
        print(f"    {var_name}: {slug} {status}")

print("\n\nФИНСКИЙ:")
for concept, variants in dialects['Finnish (FI)'].items():
    print(f"\n  {concept}:")
    for var_name, slug in variants.items():
        status = "✓ ЕСТЬ" if slug in all_slugs else "✗ НЕТ"
        print(f"    {var_name}: {slug} {status}")

# 4. Рекомендации по добавлению
print("\n\n" + "="*80)
print("4. РЕКОМЕНДАЦИИ ПО ДОБАВЛЕНИЮ")
print("="*80)

recommendations = []

# Проверяем /bono
if '/bono' not in all_slugs:
    recommendations.append({
        'slug': '/bono',
        'lang': 'Spanish (ES)',
        'group': 'bonus',
        'reason': 'Единственное число от /bonos, используется на кнопках'
    })

if '/retiro' not in all_slugs:
    recommendations.append({
        'slug': '/retiro', 
        'lang': 'Spanish (ES)',
        'group': 'withdrawal',
        'reason': 'Единственное число от /retiros'
    })

if '/resena' not in all_slugs:
    recommendations.append({
        'slug': '/resena',
        'lang': 'Spanish (ES)', 
        'group': 'review',
        'reason': 'Единственное число, вариант без тильды'
    })

if recommendations:
    print("\nРЕКОМЕНДУЕТСЯ ДОБАВИТЬ:")
    for i, rec in enumerate(recommendations, 1):
        print(f"\n{i}. {rec['slug']} ({rec['lang']})")
        print(f"   Группа: {rec['group']}")
        print(f"   Причина: {rec['reason']}")
else:
    print("\nВсе рекомендованные варианты уже в базе!")

print("\n" + "="*80)
print("ИТОГО:")
print("="*80)
print(f"Всего уникальных слагов в базе: {len(all_slugs)}")
print(f"Рекомендаций к добавлению: {len(recommendations)}")
