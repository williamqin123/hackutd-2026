const spacetimeOrigin = (process.env.SPACETIMEDB_ORIGIN || 'http://127.0.0.1:3001').replace(/\/$/, '');

export default {
  async rewrites() {
    return [{ source: '/v1/:path*', destination: `${spacetimeOrigin}/v1/:path*` }];
  },
};
