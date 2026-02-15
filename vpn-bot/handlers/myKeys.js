const db = require('../db');

function formatKeysList(keysByServer) {
  const entries = Object.entries(keysByServer);
  if (entries.length === 0) {
    return 'У вас пока нет ключей. Создайте ключ: /generate_key';
  }
  let text = '';
  for (const [, { serverName, keys }] of entries) {
    text += `**${serverName}**\n`;
    for (const k of keys) {
      text += `• ${k.key_name}\n\`\`\`\n${k.vless_link}\n\`\`\`\n`;
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
