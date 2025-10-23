import pandas as pd
import json

# Читаем Excel файл
file_path = r'e:\Облако\2. Работа\Букмарклет разклоака\URL на разных языках.xlsx'
df = pd.read_excel(file_path)

# Структура: {slug: pageType}
# Например: {"/review": "review", "/recenzja": "review", "/wyplata": "withdrawal"}
slug_map = {}

# Проходим по всем строкам
current_page = None
for idx, row in df.iterrows():
    eng_value = df.iloc[idx, 0]  # Английский вариант (первая колонка)
    
    # Если есть английский вариант - это начало новой страницы
    if pd.notna(eng_value) and str(eng_value).strip() != '':
        current_page = str(eng_value).strip()
        
    # Если определена текущая страница, добавляем все варианты
    if current_page:
        for col in df.columns[1:]:  # Все языки кроме английского
            slug = row[col]
            if pd.notna(slug) and str(slug).strip() != '':
                slug_clean = str(slug).strip()
                # Убираем пробелы в начале слага если есть
                slug_clean = slug_clean.lstrip('/')
                slug_clean = '/' + slug_clean
                slug_map[slug_clean] = current_page

# Также добавляем английские варианты
current_page = None
for idx, row in df.iterrows():
    eng_value = df.iloc[idx, 0]
    
    if pd.notna(eng_value) and str(eng_value).strip() != '':
        current_page = str(eng_value).strip()
        slug_map[current_page] = current_page

# Сохраняем в JSON
output = {
    "version": "1.0",
    "updated": "2025-10-24",
    "slugs": slug_map
}

json_path = r'e:\Облако\2. Работа\Букмарклет разклоака\slugs.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ JSON создан: {json_path}")
print(f"📊 Всего слагов: {len(slug_map)}")
print("\n📝 Первые 10 записей:")
for i, (slug, page) in enumerate(list(slug_map.items())[:10], 1):
    print(f"   {i}. {slug} → {page}")
