import json

# Читаем текущий slugs.json
with open('slugs.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("🔍 Проверка слагов на наличие вариантов с дефисами и без\n")
print("=" * 80)

# Проверяем каждую группу
for group_name, group_data in data['pageGroups'].items():
    slugs = group_data['slugs']
    
    # Ищем пары: слово с дефисом и без
    slugs_list = list(slugs.keys())
    
    for slug in slugs_list:
        # Если в слаге есть дефис
        if '-' in slug:
            # Проверяем, есть ли вариант без дефиса
            slug_no_dash = slug.replace('-', '')
            if slug_no_dash in slugs:
                print(f"⚠️  Группа: {group_name}")
                print(f"   С дефисом:  {slug} → {slugs[slug]}")
                print(f"   Без дефиса: {slug_no_dash} → {slugs[slug_no_dash]}")
                print()
        # Если в слаге нет дефиса, но содержит составное слово
        else:
            # Пробуем найти варианты с дефисом между словами
            # Например: bonuskoodi -> bonus-koodi
            if len(slug) > 8:  # Только длинные слова
                # Простая эвристика: ищем повторяющиеся согласные
                for i in range(3, len(slug)-3):
                    slug_with_dash = slug[:i] + '-' + slug[i:]
                    if slug_with_dash in slugs and slug_with_dash != slug:
                        print(f"ℹ️  Группа: {group_name}")
                        print(f"   Без дефиса: {slug} → {slugs[slug]}")
                        print(f"   С дефисом:  {slug_with_dash} → {slugs[slug_with_dash]}")
                        print()

print("=" * 80)
print("\n✅ Проверка завершена!")
