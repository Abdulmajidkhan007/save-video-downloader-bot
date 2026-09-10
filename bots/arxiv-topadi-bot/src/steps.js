'use strict';

// O'chgan xabarlarni tiklash bo'yicha bosqichma-bosqich qo'llanma.
// Har bir qadam: { title, html }. Matnlar Telegram HTML parse_mode uchun.
// MUHIM: bu bot hech kimdan telefon/kod/2FA so'ramaydi — faqat yo'l-yo'riq beradi.

const STEPS = [
  {
    // 1
    title: 'Termux o‘rnatish',
    html:
      '<b>1-qadam — Termux o‘rnatish</b>\n\n' +
      'Termux ilovasini <b>F-Droid</b> orqali o‘rnat.\n\n' +
      '⚠️ Play Store’dagi Termux versiyasi <b>eskirgan</b> va ishlamaydi. ' +
      'Faqat F-Droid versiyasidan foydalan.\n\n' +
      '🔗 F-Droid: <code>https://f-droid.org</code>\n' +
      'U yerdan Termux’ni izlab, o‘rnat.',
  },
  {
    // 2
    title: 'Yangilash',
    html:
      '<b>2-qadam — Paketlarni yangilash</b>\n\n' +
      'Termux’ni ochib, quyidagini kirit:\n\n' +
      '<pre>pkg update &amp;&amp; pkg upgrade -y</pre>\n' +
      'So‘ralsa <b>Y</b> bosib tasdiqla. Tugagach:\n\n' +
      '<pre>pkg install proot-distro -y</pre>\n' +
      'ℹ️ Buyruqlar bitta qatorda <code>&amp;&amp;</code> bilan berilgan — nusxalab qo‘yaver.',
  },
  {
    // 3
    title: 'Ubuntu o‘rnatish',
    html:
      '<b>3-qadam — Ubuntu muhitini o‘rnatish</b>\n\n' +
      'Ubuntu’ni o‘rnat:\n\n' +
      '<pre>proot-distro install ubuntu</pre>\n' +
      'O‘rnatish tugagach, ichiga kir:\n\n' +
      '<pre>proot-distro login ubuntu</pre>\n' +
      'Endi terminal Ubuntu ichida ishlaydi.',
  },
  {
    // 4
    title: 'Python va Telethon',
    html:
      '<b>4-qadam — Python va Telethon</b>\n\n' +
      'Ubuntu ichida quyidagilarni bajar:\n\n' +
      '<pre>apt update &amp;&amp; apt install python3 python3-pip -y</pre>\n' +
      'Keyin Telethon kutubxonasini o‘rnat:\n\n' +
      '<pre>pip3 install telethon</pre>\n' +
      'Ixtiyoriy (tezroq media uchun):\n\n' +
      '<pre>pip3 install cryptg</pre>',
  },
  {
    // 5
    title: 'api_id / api_hash olish',
    html:
      '<b>5-qadam — api_id va api_hash</b>\n\n' +
      '<code>https://my.telegram.org</code> saytiga kir → ' +
      '<b>API development tools</b> bo‘limini och → yangi ilova yarat.\n\n' +
      'U yerdan <b>api_id</b> (raqam) va <b>api_hash</b> (uzun matn) olasan.\n\n' +
      '🔒 Bu <b>shaxsiy kaliting</b>. Hech kimga berma, hech qaysi botga kiritma. ' +
      'Ular faqat o‘z qurilmangda, o‘z skriptingda ishlatiladi.',
  },
  {
    // 6 — bu qadamda bot recover.py faylini yuboradi
    title: 'Skript yaratish',
    html:
      '<b>6-qadam — recover.py skriptini yaratish</b>\n\n' +
      'Men hozir senga <b>recover.py</b> faylini yuboraman ⬇️\n\n' +
      'Ubuntu terminalida quyidagini och:\n\n' +
      '<pre>nano recover.py</pre>\n' +
      'Faylning ichidagi kodni <b>nano</b> oynasiga joyla, so‘ng saqlab chiq:\n' +
      '• <b>Ctrl + O</b> → Enter (saqlash)\n' +
      '• <b>Ctrl + X</b> (chiqish)',
  },
  {
    // 7
    title: 'Ishga tushirish',
    html:
      '<b>7-qadam — Skriptni ishga tushirish</b>\n\n' +
      '<pre>python3 recover.py</pre>\n' +
      'Skript ketma-ket so‘raydi:\n' +
      '• api_id, api_hash\n' +
      '• eski (o‘chgan xabarli) guruh manzili\n' +
      '• yangi guruh manzili\n' +
      '• telefon raqam, login kod va (bo‘lsa) 2FA parol\n\n' +
      '⏱ <b>Admin log faqat 48 soat saqlanadi</b> — kechiktirma, tez bajar.',
  },
  {
    // 8
    title: 'Xavfsizlik',
    html:
      '<b>8-qadam — Xavfsizlik (eng muhimi)</b>\n\n' +
      '🚫 Login kodini yoki 2FA parolini <b>hech qanday botga</b> kiritma — ' +
      'na menga, na boshqasiga. Kodni so‘ragan bot = akkountingni o‘g‘irlamoqchi.\n\n' +
      '✅ <code>recover.py</code> faqat <b>o‘z qurilmangda</b>, lokal ishlaydi.\n' +
      '✅ Faqat o‘zing <b>admin</b> bo‘lgan guruhda ishlaydi (admin log kerak).\n' +
      '✅ <b>api_hash</b> va <code>*.session</code> faylini hech kimga berma.\n\n' +
      'Tayyor! Omad 🎉',
  },
];

module.exports = { STEPS };
