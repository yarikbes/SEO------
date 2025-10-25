import pandas as pd
import json
from collections import defaultdict
from datetime import datetime

# Читаем Excel файл
file_path = r'e:\Облако\2. Работа\Букмарклет разклоака\URL на разных языках.xlsx'
df = pd.read_excel(file_path)

# Определяем группы синонимов для типов страниц
PAGE_GROUPS = {
    'main': {'aliases': [], 'description': 'Главная страница'},
    'privacy': {'aliases': ['privacy', 'privacy-policy', 'privacy-notice'], 'description': 'Политика конфиденциальности'},
    'terms': {'aliases': ['terms', 'terms-condition'], 'description': 'Условия использования'},
    'responsible': {'aliases': ['responsible', 'responsible-gaming'], 'description': 'Ответственная игра'},
    'cookies': {'aliases': ['cookies-policy', 'cookies'], 'description': 'Политика cookies'},
    'faq': {'aliases': [], 'description': 'Часто задаваемые вопросы'},
    'contacts': {'aliases': [], 'description': 'Контакты'},
    'support': {'aliases': [], 'description': 'Поддержка'},
    'login': {'aliases': [], 'description': 'Вход в систему'},
    'bonus': {'aliases': [], 'description': 'Бонусы'},
    'promoCode': {'aliases': ['promo-code', 'bonus-code'], 'description': 'Промокод / Бонус код'},
    'noDepositBonus': {'aliases': [], 'description': 'Бонус без депозита'},
    'review': {'aliases': [], 'description': 'Обзор казино'},
    'withdrawal': {'aliases': [], 'description': 'Вывод средств'},
    'freeSpins': {'aliases': [], 'description': 'Бесплатные вращения'},
    'app': {'aliases': [], 'description': 'Мобильное приложение'},
    'games': {'aliases': [], 'description': 'Игры'},
    'slots': {'aliases': ['slots', 'online-slots'], 'description': 'Слоты'},
    'lottery': {'aliases': [], 'description': 'Лотерея'},
    'vipProgram': {'aliases': [], 'description': 'VIP программа'},
    'verification': {'aliases': [], 'description': 'Верификация'},
    'cashback': {'aliases': [], 'description': 'Кэшбэк'},
    'sport': {'aliases': [], 'description': 'Спорт'},
    'betting': {'aliases': ['betting', 'sports-betting'], 'description': 'Ставки на спорт'}
}

# Маппинг старых типов на новые группы
TYPE_TO_GROUP = {
    'main': 'main',
    'privacy-notice': 'privacy',
    'privacy': 'privacy',
    'privacy-policy': 'privacy',
    'terms': 'terms',
    'terms-condition': 'terms',
    'responsible': 'responsible',
    'responsible-gaming': 'responsible',
    'cookies-policy': 'cookies',
    'cookies': 'cookies',
    'faq': 'faq',
    'contacts': 'contacts',
    'support': 'support',
    'login': 'login',
    'bonus': 'bonus',
    'promo-code': 'promoCode',
    'bonus-code': 'promoCode',
    'no-deposit-bonus': 'noDepositBonus',
    'review': 'review',
    'withdrawal': 'withdrawal',
    'free-spins': 'freeSpins',
    'app': 'app',
    'games': 'games',
    'slots': 'slots',
    'online-slots': 'slots',
    'lottery': 'lottery',
    'vip-program': 'vipProgram',
    'verification': 'verification',
    'cashback': 'cashback',
    'sport': 'sport',
    'betting': 'betting',
    'sports-betting': 'betting',
    '/privacy-notice': 'privacy',
    '/promo-code': 'promoCode',
    '/bonus-code': 'promoCode',
    '/no-deposit-bonus': 'noDepositBonus',
    '/free-spins': 'freeSpins',
    '/vip-program': 'vipProgram',
    'en-GB': 'main'
}

# Собираем слаги по группам
groups_data = defaultdict(lambda: {'slugs': {}})

# Проходим по всем строкам
current_page = None
current_type = None

for idx, row in df.iterrows():
    eng_value = df.iloc[idx, 0]  # Английский вариант (первая колонка)
    
    # Если есть английский вариант - это начало новой страницы
    if pd.notna(eng_value) and str(eng_value).strip() != '':
        current_page = str(eng_value).strip()
        # Определяем тип страницы (убираем слеш в начале для поиска)
        page_key = current_page.lstrip('/')
        current_type = TYPE_TO_GROUP.get(current_page, TYPE_TO_GROUP.get(page_key, page_key))
        
    # Если определена текущая страница, добавляем все варианты
    if current_page and current_type:
        for col in df.columns[1:]:  # Все языки кроме английского
            slug = row[col]
            if pd.notna(slug) and str(slug).strip() != '':
                slug_clean = str(slug).strip()
                # Убираем пробелы в начале слага если есть
                slug_clean = slug_clean.lstrip('/')
                slug_clean = '/' + slug_clean
                
                # Определяем язык из названия колонки
                lang = col
                
                # Добавляем в соответствующую группу
                groups_data[current_type]['slugs'][slug_clean] = lang

# Также добавляем английские варианты
current_page = None
current_type = None

for idx, row in df.iterrows():
    eng_value = df.iloc[idx, 0]
    
    if pd.notna(eng_value) and str(eng_value).strip() != '':
        current_page = str(eng_value).strip()
        page_key = current_page.lstrip('/')
        current_type = TYPE_TO_GROUP.get(current_page, TYPE_TO_GROUP.get(page_key, page_key))
        
        # Добавляем английский вариант
        groups_data[current_type]['slugs'][current_page] = 'en'

# Формируем итоговую структуру
page_groups = {}

for group_key, group_data in groups_data.items():
    # Если группа определена в PAGE_GROUPS, берём её настройки
    if group_key in PAGE_GROUPS:
        page_groups[group_key] = {
            'description': PAGE_GROUPS[group_key]['description'],
            'slugs': group_data['slugs']
        }
        # Добавляем aliases если есть
        if PAGE_GROUPS[group_key]['aliases']:
            page_groups[group_key]['aliases'] = PAGE_GROUPS[group_key]['aliases']
    else:
        # Для неизвестных групп просто добавляем слаги
        page_groups[group_key] = {
            'description': group_key,
            'slugs': group_data['slugs']
        }

# Сохраняем в JSON
output = {
    "version": "2.0",
    "updated": datetime.now().strftime("%Y-%m-%d"),
    "pageGroups": page_groups
}

json_path = r'e:\Облако\2. Работа\Букмарклет разклоака\slugs.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ JSON создан: {json_path}")
print(f"📊 Всего групп: {len(page_groups)}")
print(f"\n📝 Список групп:")
for i, (group_key, group_data) in enumerate(page_groups.items(), 1):
    slug_count = len(group_data['slugs'])
    aliases = ', '.join(group_data.get('aliases', [])) if group_data.get('aliases') else 'нет'
    print(f"   {i}. {group_key} ({slug_count} слагов, aliases: {aliases})")
