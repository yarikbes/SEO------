# Рекомендованные добавления в slugs.json

## 1. CASHBACK (универсальное слово - копипаста для всех языков)

```json
"cashback": {
  "description": "Кэшбэк",
  "slugs": {
    "/cashback": "en",
    "/cashback-sv": "Swedish (SV)",     // или просто /cashback
    "/cashback-nl": "Dutch (NL)",       // или просто /cashback
    "/cashback-de": "German (DE)",      // или просто /cashback
    "/cashback-fr": "French (FR)",      // или просто /cashback
    "/cashback-es": "Spanish (ES)",     // или просто /cashback
    "/cashback-it": "Italian (IT)",     // или просто /cashback
    "/cashback-pl": "Polish (PL)",      // или просто /cashback
    "/cashback-fi": "Finnish (FI)",     // или просто /cashback
    "/cashback-da": "Danish (DA)",      // или просто /cashback
    "/cashback-no": "Norwegian (NO)",   // или просто /cashback
    "/cashback-pt": "Portuguese (PT)",  // или просто /cashback
    "/cashback-cs": "Czech (CS)",       // или просто /cashback
    "/cashback-ro": "Romanian (RO)",    // или просто /cashback
    "/cashback-gr": "Greek (GR)",       // или просто /cashback
    "/cashback-ee": "Estonian (EE)",    // или просто /cashback
    "/cashback-hu": "Hungarian (HU)"    // или просто /cashback
  }
}
```

**ПРОБЛЕМА:** Если использовать просто `/cashback` для всех - будут дубликаты ключей в JSON!

**РЕШЕНИЕ:** В cashback все языки используют `/cashback` без локализации - это нормально, не нужно добавлять варианты.

---

## 2. SPORT (universal)

```json
"sport": {
  "description": "Спорт",
  "slugs": {
    "/sport": "en",
    "/deportes": "Spanish (ES)",  // уже есть
    "/urheilu": "Finnish (FI)",   // уже есть
    "/desportos": "Portuguese (PT)", // уже есть
    "/athlimata": "Greek (GR)"    // уже есть
    // Добавить:
    // Большинство языков используют /sport универсально
  }
}
```

---

## 3. APP (нужны локализованные варианты)

Добавить в группу `app`:

- `/aplicacion` - Spanish (ES)
- `/aplicacao` - Portuguese (PT)
- `/applicazione` - Italian (IT)
- `/anwendung` - German (DE)
- `/rakendus` - Estonian (EE)
- `/alkalmazas` - Hungarian (HU)

---

## 4. VIPPROGRAMME

Добавить:

- `/programa-vip` - Spanish (ES) (уже есть!)
- `/vip-programma` - Dutch (NL)  (уже есть!)
- `/vip-program` - Swedish (SV)
- `/program-vip` - Danish (DA)
- `/vip-program` - Norwegian (NO)
- `/vip-program` - Czech (CS)

---

## 5. CONTACTS

Добавить:

- `/kontakt` - Swedish (SV), German (DE), Danish (DA), Norwegian (NO), Czech (CS)
- `/contact` - French (FR), Dutch (NL)
- `/contacto` - Spanish (ES) (уже есть!)
- `/contatti` - Italian (IT) (уже есть!)
- `/kontakt` - Polish (PL)

