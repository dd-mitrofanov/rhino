const db = require('./db');

function attachUser() {
  return async (ctx, next) => {
    const id = ctx.from?.id;
    if (id) {
      ctx.userDoc = db.getUserById(id);
      // Обновляем username, если он изменился
      if (ctx.userDoc && ctx.from.username !== ctx.userDoc.username) {
        db.updateUserUsername(id, ctx.from.username || null);
        ctx.userDoc = db.getUserById(id); // Обновляем объект
      }
    }
    await next();
  };
}

function requireRegistered() {
  return async (ctx, next) => {
    if (!ctx.userDoc) {
      await ctx.reply(
        'Сначала необходимо активировать инвайт-код. Используйте команду /activate <код>'
      );
      return;
    }
    await next();
  };
}

function requireRole(...roles) {
  return async (ctx, next) => {
    if (!ctx.userDoc) {
      await ctx.reply('Сначала активируйте инвайт-код: /activate <код>');
      return;
    }
    if (!roles.includes(ctx.userDoc.role)) {
      await ctx.reply('У вас нет доступа к этой команде.');
      return;
    }
    await next();
  };
}

function requireAdmin() {
  return requireRole('admin');
}

function requireUserOrAdmin() {
  return requireRole('admin', 'user');
}

module.exports = {
  attachUser,
  requireRegistered,
  requireRole,
  requireAdmin,
  requireUserOrAdmin,
};
