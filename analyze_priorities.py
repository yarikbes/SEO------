import pandas as pd

# Читаем Excel файл
file_path = r'e:\Облако\2. Работа\Букмарклет разклоака\URL на разных языках.xlsx'
df = pd.read_excel(file_path)

print("=" * 100)
print("АНАЛИЗ АЛЬТЕРНАТИВНЫХ ВАРИАНТОВ URL")
print("=" * 100)

# Находим все страницы с множественными вариантами
languages = df.columns[1:]  # Все столбцы кроме первого

for lang in languages:
    print(f"\n{'='*100}")
    print(f"ЯЗЫК: {lang}")
    print(f"{'='*100}")
    
    # Группируем последовательные непустые значения
    current_page = None
    variants = []
    
    for idx, row in df.iterrows():
        eng_value = df.iloc[idx, 0]  # Английский вариант
        lang_value = row[lang]
        
        # Определяем начало новой группы (есть английский вариант)
        if pd.notna(eng_value) and eng_value != '':
            # Если были накоплены варианты - выводим
            if current_page and len(variants) > 1:
                print(f"\n📄 Страница: {current_page}")
                print(f"   Варианты ({len(variants)}):")
                for i, var in enumerate(variants, 1):
                    print(f"   {i}. {var}")
            
            # Начинаем новую страницу
            current_page = eng_value
            variants = []
            
            # Добавляем текущее значение если есть
            if pd.notna(lang_value) and lang_value != '':
                variants.append(lang_value)
        else:
            # Продолжаем текущую страницу
            if pd.notna(lang_value) and lang_value != '':
                variants.append(lang_value)
    
    # Проверяем последнюю группу
    if current_page and len(variants) > 1:
        print(f"\n📄 Страница: {current_page}")
        print(f"   Варианты ({len(variants)}):")
        for i, var in enumerate(variants, 1):
            print(f"   {i}. {var}")

print("\n" + "=" * 100)
print("СТАТИСТИКА")
print("=" * 100)

# Подсчитаем общее количество альтернативных вариантов
total_alternatives = 0
for lang in languages:
    lang_alternatives = 0
    current_page = None
    variants = []
    
    for idx, row in df.iterrows():
        eng_value = df.iloc[idx, 0]
        lang_value = row[lang]
        
        if pd.notna(eng_value) and eng_value != '':
            if current_page and len(variants) > 1:
                lang_alternatives += 1
            current_page = eng_value
            variants = []
            if pd.notna(lang_value) and lang_value != '':
                variants.append(lang_value)
        else:
            if pd.notna(lang_value) and lang_value != '':
                variants.append(lang_value)
    
    if current_page and len(variants) > 1:
        lang_alternatives += 1
    
    if lang_alternatives > 0:
        print(f"{lang}: {lang_alternatives} страниц с альтернативами")
        total_alternatives += lang_alternatives

print(f"\n💡 ИТОГО: {total_alternatives} случаев с множественными вариантами")
