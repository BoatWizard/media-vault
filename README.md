Quick notes to make this work locally:

Make sure VITE_API_URL in .env is blank unless you have an nginx proxy forwarding, then it should be set to /api.  You'll need to set your nginx.conf to have location / proxypass to http://media_inventory_frontend:80 and location /api proxypass to http://mediat_inventory_backend:8000.

You'll need to docker create network nginx_reverse_proxy if it doesn't already exist.

