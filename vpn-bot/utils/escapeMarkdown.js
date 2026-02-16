/**
 * Экранирование символов для Telegram Markdown: _ * ` [
 * Использовать для любого пользовательского или внешнего текста перед отправкой с parse_mode: 'Markdown'
 */
function escapeMarkdown(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.replace(/([_*`[\])/g, '\\$1');
}

module.exports = { escapeMarkdown };
