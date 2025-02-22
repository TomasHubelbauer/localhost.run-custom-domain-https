import Bun from 'bun';

Bun.serve({
  fetch(request) {
    console.log(request.url);
    return new Response('<h1>Hello, World!</h1>',  {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  },
  tls: {
    cert: Bun.file('./fullchain.pem'),
    key: Bun.file('./privkey.pem'),
  },
});
