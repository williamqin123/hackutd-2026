export function isDeveloper(ctx) {
  return Boolean(ctx.db.developers.identity.find(ctx.sender));
}

export function requireDeveloper(ctx) {
  if (!isDeveloper(ctx)) {
    throw new Error('Developer access required. Use an authorized Spacetime identity token.');
  }
}
