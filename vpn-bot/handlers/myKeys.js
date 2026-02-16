const db = require('../db');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

function formatKeysList(keysByServer) {
  const entries = Object.entries(keysByServer);
  if (entries.length === 0) {
    return 'У вас пока нет ключей. Используйте кнопку «Создать ключ» или команду /generatekey';
  }
  let text = '';
  for (const [, { serverName, keys }] of entries) {
    text += `**${escapeMarkdown(serverName)}**\n`;
    for (const k of keys) {
      text += `• ${escapeMarkdown(k.key_name)}\n\`\`\`\n${k.vless_link}\n\`\`\`\n`;
    }
    text += '\n';
  }
  return text.trim();
}

async function myKeys(ctx) {
  const userId = ctx.from.id;
  const byServer = db.getKeysByServerForUser(userId);
  const text = formatKeysList(byServer);
  await ctx.reply(text || 'У вас нет ключей.', { parse_mode: 'Markdown' });
}

module.exports = { myKeys, formatKeysList };
