import Bun, { $ } from 'bun';
import index from './index.html';

const name = process.argv[2];
if (!name) {
  throw new Error('Pass the domain name as an argument to this script!');
}

const { hostname, port } = Bun.serve({
  static: {
    '/': index,
  },
  fetch() {
    return new Response(null, { status: 404 });
  },

  // @ts-expect-error https://github.com/oven-sh/bun/issues/13167
  tls: {
    cert: Bun.file(`./fullchain-${name}.pem`),
    key: Bun.file(`./privkey-${name}.pem`),
  },
});

await $`ssh -R ${name}:443:${hostname}:${port} localhost.run`;
