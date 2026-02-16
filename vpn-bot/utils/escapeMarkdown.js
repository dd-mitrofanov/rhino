/**
 * Экранирование символов для Telegram Markdown: _ * ` [ ]
 * Использовать для любого пользовательского или внешнего текста перед отправкой с parse_mode: 'Markdown'
 */
const MARKDOWN_SPECIAL = /[\]_*`[]/g;

function escapeMarkdown(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.replace(MARKDOWN_SPECIAL, '\\$&');
}

module.exports = { escapeMarkdown };
