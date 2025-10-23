import pandas as pd

# Читаем Excel файл
file_path = r'e:\Облако\2. Работа\Букмарклет разклоака\URL на разных языках.xlsx'
df = pd.read_excel(file_path)

# Выводим информацию о таблице
print("=" * 100)
print("СТРУКТУРА ТАБЛИЦЫ")
print("=" * 100)
print(f"\nКоличество строк: {len(df)}")
print(f"Количество столбцов: {len(df.columns)}")
print(f"\nНазвания столбцов (языки):")
for i, col in enumerate(df.columns, 1):
    print(f"{i}. {col}")

print("\n" + "=" * 100)
print("СОДЕРЖИМОЕ ТАБЛИЦЫ")
print("=" * 100)

# Выводим всю таблицу
pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', None)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', None)

print("\n")
print(df.to_string(index=False))
