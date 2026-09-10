# Claude Code uchun yo'riqnoma

Bu loyihani Claude Code orqali GitHub repoga ulash uchun. Terminalda loyiha papkasida
`claude` ni ishga tushir va quyidagini ber:

---

Bu Node.js Telegram bot loyihasi. Quyidagilarni bajar:

1. Avval `.gitignore` faylni tekshir — `.env` va `node_modules/` chiqarib tashlanganiga
   ishonch hosil qil (maxfiy API kalit repoga tushmasligi shart).
2. `git init` qil, hamma faylni qo'sh (`.gitignore` hisobga olingan holda) va birinchi
   commit yarat: "Initial commit: Gemini Q&A Telegram bot".
3. `gh` CLI yordamida GitHub'da `gemini-qa-bot` nomli **private** repo yarat va push qil.
   (Agar `gh auth` qilinmagan bo'lsa, avval `gh auth login` kerakligini ayt.)
4. Push tugagach, repo URL'ini menga ko'rsat.

Diqqat: `.env` faylni hech qachon commit qilma. Faqat `.env.example` repoda bo'lsin.

---

## Keyingi qadamlar uchun foydali so'rovlar

- "Bu botga inline tugmalar (masalan 'Yangi suhbat' tugmasi) qo'sh."
- "Javoblarni Telegram Markdown formatida chiroyli ko'rsatadigan qilib o'zgartir
  (parse xatolarini ham hisobga ol)."
- "Suhbat tarixini `data/` papkaga JSON sifatida saqlab, qayta ishga tushganda
  tiklaydigan qil (Railway Volume bilan)."
- "`/security-review` ishlatib, xavfsizlik bo'yicha tekshir."
