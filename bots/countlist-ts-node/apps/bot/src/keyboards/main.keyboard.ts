import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';

export function mainInlineKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Bugun', 'stats:today'),
      Markup.button.callback('📆 Hafta', 'stats:week'),
      Markup.button.callback('🗓 Oy', 'stats:month'),
    ],
    [
      Markup.button.callback('📊 Kategoriyalar', 'stats:categories'),
      Markup.button.callback('⚡ Top', 'stats:top'),
    ],
    [
      Markup.button.callback('💰 Limitlar', 'limits:view'),
      Markup.button.callback('🔄 Takroriy', 'recurring:list'),
    ],
    [
      Markup.button.callback('📤 Export', 'export:menu'),
      Markup.button.callback('⚙️ Sozlamalar', 'settings:menu'),
    ],
  ]);
}

export function exportKeyboard(groupId: string): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📄 PDF', `export:pdf:${groupId}`),
      Markup.button.callback('📊 CSV', `export:csv:${groupId}`),
      Markup.button.callback('📈 Excel', `export:excel:${groupId}`),
    ],
    [Markup.button.callback('⬅️ Orqaga', 'back:main')],
  ]);
}

export function confirmKeyboard(action: string): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ha', `confirm:${action}`),
      Markup.button.callback('❌ Yo\'q', 'cancel'),
    ],
  ]);
}

export function categoryKeyboard(
  categories: Array<{ id: string; name: string; icon: string }>,
  prefix: string,
): { reply_markup: InlineKeyboardMarkup } {
  const buttons = categories.map((cat) =>
    Markup.button.callback(`${cat.icon} ${cat.name}`, `${prefix}:${cat.id}`),
  );

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([Markup.button.callback('⬅️ Orqaga', 'back:main')]);

  return Markup.inlineKeyboard(rows);
}

export function statsNavKeyboard(current: 'today' | 'week' | 'month'): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      current === 'today'
        ? Markup.button.callback('📅 ✓ Bugun', 'stats:today')
        : Markup.button.callback('📅 Bugun', 'stats:today'),
      current === 'week'
        ? Markup.button.callback('📆 ✓ Hafta', 'stats:week')
        : Markup.button.callback('📆 Hafta', 'stats:week'),
      current === 'month'
        ? Markup.button.callback('🗓 ✓ Oy', 'stats:month')
        : Markup.button.callback('🗓 Oy', 'stats:month'),
    ],
    [Markup.button.callback('📊 Kategoriyalar', 'stats:categories')],
    [Markup.button.callback('⬅️ Bosh menyu', 'back:main')],
  ]);
}
