import Bun from 'bun';
import index from './index.html';

const hostName = process.argv[2];
if (!hostName) {
  throw new Error('Please provide a hostname to use for the TLS certificates');
}

Bun.serve({
  static: {
    '/': index,
  },
  fetch() {
    return new Response(null, { status: 404 });
  },
  tls: {
    cert: Bun.file(`./fullchain-${hostName}.pem`),
    key: Bun.file(`./privkey-${hostName}.pem`),
  },
});
