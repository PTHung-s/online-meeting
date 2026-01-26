# Docker + Nginx OSS deployment

This adds production-ready Docker packaging and an Nginx reverse proxy for the `video-call` app.

## What you get
- Node app container (port 5173)
- Nginx reverse proxy (port 80, optional 443)
- WebSocket upgrade config for Socket.IO
- Optional Certbot helper to fetch Let's Encrypt TLS certs

## Prereqs
- A server (your Proxmox Ubuntu VM)
- Docker and Docker Compose
- A DNS A record pointing your domain to the server (for TLS)

## Quick start (HTTP only)
1. Copy the project to the server.
2. From `video-call/`, build and start:
   - docker compose up -d --build
3. Open http://SERVER_IP/ in a browser.

## Enable HTTPS with Let's Encrypt (optional)
1. Make sure DNS points your domain to the server public IP.
2. Edit `nginx/conf.d/video-call.conf` and replace `example.com` with your domain in the HTTPS block (currently commented).
3. Obtain certificates using the `certbot` service once (interactive example):
   - docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d example.com --agree-tos -m you@example.com --no-eff-email
   This will store certs in the named volume `video-call-certs`.
4. Uncomment the HTTPS server block in `nginx/conf.d/video-call.conf` and also map `443:443` in `docker-compose.yml` under the `nginx` service.
5. Reload Nginx:
   - docker compose restart nginx
6. Visit https://example.com/

Renewal (monthly cron or systemd timer):
- docker compose run --rm certbot renew
- docker compose exec nginx nginx -s reload

## TURN server (recommended for NAT traversal)
For wider connectivity, deploy a TURN server (coturn). Example compose service:

```
  turn:
    image: coturn/coturn:latest
    container_name: video-call-turn
    network_mode: host
    command: [
      "-n", "--log-file=stdout",
      "--external-ip=$(detect-external-ip)",
      "--realm=example.com",
      "--listening-port=3478",
      "--min-port=49160", "--max-port=49200",
      "--lt-cred-mech",
      "--user=appuser:apppass"
    ]
    restart: unless-stopped
```

Then configure your client to use this TURN in RTCPeerConnection ICE servers.

## Notes
- Nginx OSS is free and open-source.
- The app runs as a non-root user in the container.
- Socket.IO websockets are properly upgraded via `/socket.io/` location.
