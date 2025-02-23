# localhost.run custom domain HTTPS

My notes on getting https://localhost.run to tunnel with a custom domain and
custom TLS handling to ensure end to end encryption between the browser and the
server being tunneled through to.

## Motivation

Ultimately, I want to get to a point where I have an intermittently available
local service which is accessible via a tunnel over SSH and the tunnel is
addressable via a custom domain name without the tunneling service being able to
access the traffic in clear text.

I am hoping to host an offline-first web application on the service and have it
collect writes in local storage while the service is inaccessible and sync when
it becomes available.

I specifically want to avoid punching a hole from the Internet to my local
network and worry about having a stable IP or setting up a VPN or, most
importantly, use a server.

I'm happy to maintain and manage servers when paid to do so, but for personal
applications with the user base of one, running a server for them is an
impossible to overcome drag for me.

## How Localhost.run works

1. You run a local process on your machine on some port

   At this point this process is accessible only on the machine itself or the
   local network the machine is connected to unless the web router has an open
   port and the ISP can provide a stable IP etc.

2. An SSH connection to Localhost.run is established

   Localhost.run forwards the requests it gets over the SSH tunnel to the
   locally running service.

3. A custom domain can be connected to Localhost.run for a stable name

   Localhost.run offers rotating free names or custom subdomains and the ability
   to connect a custom domain to it via a few DNS records.
   In case of an HTTPS tunnel, Localhost.run can provide its own HTTPS handling
   and decrypt the requests to forward to the local service so it has to know
   nothing of TLS and we can still get HTTPS.
   In order to not break the end to end encryption, the service can use TLS
   tunneling and handle the TLS certificates itself.

## Basic building blocks

### Localhost.run basic usage with no Localhost.run subdomain / custom domain

Run a local service:

```typescript
import Bun from 'bun';

Bun.serve({
  fetch(request) {
    console.log(request.url);
    return new Response('<h1>Hello, World!</h1>',  {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
});
```

1. Run `bun --hot .` to make this service accessible at http://localhost:3000
2. Run `ssh -R 80:localhost:3000 localhost.run` to establish the tunnel
3. Get the URL from the SSH output or use the QR code to open on mobile
4. Access the URL and notice the HTTPS protocol on it and it actually working
5. Check the `console.log` calls and notice the HTTP protocol on that URL there

This means Localhost.run can establish an HTTPS service for us and forward the
requests to it, accessible on the entire Internet, to the locally running
service and handles the HTTPS termination.

It also means Localhost.run sees the clear text of the requests while it takes
them from the HTTPS endpoint and pushes them through to the SSH tunnel.

### Localhost.run TLS tunneling with a custom Localhost.run subdomain

See the documentation for TLS passthrough here:
https://localhost.run/docs/tls-passthru-tunnels

The action that opts the tunnel into the custom TLS handling is using the port
443 instead of the port 80 in the SSH command:

`ssh -R 443:localhost:3000 localhost.run`

This feature is only available to plans with custom domains purchased.

The administration interface for Localhost.run can be found at this URL:
https://admin.localhost.run

To purchase a custom subdomain (for now without a custom domain):

1. Log in with an email and provide the OTP to be able to sign in
2. Go to the Billing section and subscribe to the service
3. Go to the Domains section and add a new subdomain, e.g.: `example.lhr.rocks`

To connect to a custom subdomain with the stable name with an HTTPS tunnel:
`ssh -R example.lhr.rocks:80:localhost:3000 localhost.run`

To connect to a custom subdomain with the stable name with a TLS tunnel:
`ssh -R example.lhr.rocks:443:localhost:3000 localhost.run`

To handle the certificates:

1. Install Certbot from EFF as recommended by Let's Encrypt:

   `brew install certbot`

2. Run the HTTP challenge for the Localhost.run custom subdomain:

   `certbot certonly --manual --preferred-challenges http -d example.lhr.rocks`

   Add `--config-dir . --work-dir . --logs-dir .` in case of permission error
   trying to access `/var/log/letsencrypt`.

   1. Provide the email address used for renewals
   2. Read and accept the terms of service for Let's Encrypt and ACME
   3. Consider sharing email address with EFF to get news about LE etc.
   4. Copy over the data string printed by Certbot and expose it by the server:

      ```typescript
      import Bun from 'bun';

      Bun.serve({
        fetch() {
          return new Response('...');
        }
      });
      ```

   5. Run the server: `bun .`
   6. Establish an HTTP tunnel to the local server:

      `ssh -R example.lhr.rocks:80:localhost:3000 localhost.run`

   7. Go to `http://example.lhr.rocks` to check the HTTP (not HTTPS) tunnel runs
   8. Go to `.well-known/acme-challenge/...` to check the challenge string shows
   9. Hit Enter to submit and check the `fullchain.pem` and `privkey.pem` certs
   10. Copy over the certificate files (Not the symbolic links! Check `ls -l`)
   11. Adjust the server code to reference the copied-over certificate files:

       See https://bun.sh/guides/http/tls for details

       ```typescript
       import Bun from 'bun';

       Bun.serve({
         fetch() {
           console.log(request.url);
           return new Response('<h1>Hello, World!</h1>',  {
             headers: {
               'Content-Type': 'text/html'
             }
           });
         },
         tls: {
           cert: Bun.file("fullchain.pem"),
           key: Bun.file("privkey.pem"),
         },
       });
       ```

       Ignore the TypeScript types error, see here for a tracking issue:
       https://github.com/oven-sh/bun/issues/13167
    
    12. Establish a TLS tunnel to the local server with the certificates:

        `ssh -R example.lhr.rocks:443:localhost:3000 localhost.run`

3. Hit the HTTPS URL again and check the `console.log` in the server output

   `http://example.lhr.rocks/`

   This lets us know we're not using an HTTPS tunnel anymore, with Localhost.run
   decrypting the calls for us and forwarding them in clear text to our server,
   but instead a TLS tunnel where Localhost.run forwards the cypher text as-is
   and our server takes care of the decryption leaving Localhost.run blind to
   its cleartext content.

### Localhost.run TLS tunneling with a custom domain

This is similar to the above section, but in addition we need to configure the
DNS records of the custom domain to point to Localhost.run and add the custom
domain the the Localhost.run admin interface instead of the custom subdomain.

See https://localhost.run/docs/custom-domains for how to do that.

For an apex domain:

1. Add new A records for these IPs:

   Use `@` for the "host" value if required.

   - 54.161.197.247
   - 54.82.85.249
   - 35.171.254.69

   Use https://toolbox.googleapps.com/apps/dig/#A/ to check the records and make
   sure they are live.
   This might take a while due to DNS TTL.
   The banner in the domain detail in the Localhost.run admin will disappear
   once Localhost.run notices your DNS records.

2. Add a new TXT record with the value show in the domain detail in the admin

   Set the "host" value to `_lhr.example.org` (use your own domain name here).
   (Or maybe just to `_lhr`? I am not sure which one of the two worked.)

   Use https://toolbox.googleapps.com/apps/dig/#TXT/ to check the records and
   make sure they are live.
   This might take a while due to DNS TTL.
   The banner in the domain detail in the Localhost.run admin will disappear
   once Localhost.run notices your DNS records.

3. Run the site in HTTP tunnel mode to be able to host the LE HTTP challenge

   `ssh -R example.org:80:localhost:3000 localhost.run`

4. Create a public and private key value pair for the domain using LE

   Follow the same steps as shown in the above section.

5. Adjust the server to use the certificates for the custom domain name
6. Run the site in TLS tunnel mode to use the custom certificates for the domain

   `ssh -R example.org:443:localhost:3000 localhost.run`

### Self-tunneling server snippet

I've expanded the script to start the SSH tunnel from within itself once the
server starts so only a single command is needed to get the session going now:

```typescript
await $`ssh -R ${name}:443:${hostname}:${port} localhost.run`;
```

Note that we can't do something like this:

```typescript
let state: undefined | 'a' | 'b' | 'c';
for await (let line of $`ssh -R ${name}:443:${hostname}:${port} localhost.run`.lines()) {
  switch (state) {
    // Ensure the output is going as we expect it line-by-line and advance state
  }
}
```

This is because `$.lines` is buffered and only returns at the end of the command
execution, but the SSH tunnel is a long-running process that will run as long as
the server itself, so we need to be able to get its messages interactively.

See tracking issue here: https://github.com/oven-sh/bun/issues/8365

With this, killing the script now works like this:

1. Press Ctrl + C to instruct the SSH tunnel to close
2. Wait for the SSH command to print "Connection to localhost.run closed."
3. Press Ctrl + C again to kill the Bun process itself

Spamming Ctrl + C twice closes the process right away without waiting on the
remote host to process the Ctrl + C forwarded to it.
