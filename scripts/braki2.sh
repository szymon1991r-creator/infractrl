#!/bin/bash

# 1. Backend
mkdir -p backend/src
mv backend-api.py backend/src/main.py

cat > backend/Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

cat > backend/requirements.txt << 'EOF'
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
prometheus-client==0.19.0
starlette==0.37.0
EOF

# 2. Client A, B (ten sam kod, różne zmienne)
for app in apps/client-a apps/client-b; do
  mkdir -p "$app/src"
  cp client-app.jsx "$app/src/App.jsx"
  
  cat > "$app/package.json" << 'EOF'
{
  "name": "infractrl-client",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
EOF

  cat > "$app/vite.config.js" << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 },
})
EOF

  cat > "$app/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InfraCtrl Client Portal</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
EOF

  cat > "$app/main.jsx" << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './src/App'

// Mock storage dla artifact storage
window.storage = {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, val) => Promise.resolve(localStorage.setItem(key, val))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF

  cat > "$app/nginx.conf" << 'EOF'
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

  cat > "$app/Dockerfile" << 'EOF'
FROM node:20-alpine as build
WORKDIR /app
ARG CLIENT_ID=A
ARG ACCENT_COLOR=#0ea5e9
ARG REGION_LABEL=AWS EU-WEST-1
ENV VITE_CLIENT_ID=$CLIENT_ID
ENV VITE_ACCENT_COLOR=$ACCENT_COLOR
ENV VITE_REGION_LABEL=$REGION_LABEL
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

done

# 3. Admin
mkdir -p apps/admin/src
mv admin-app.jsx apps/admin/src/App.jsx

for file in package.json vite.config.js index.html main.jsx nginx.conf Dockerfile; do
  cp "apps/client-a/$file" "apps/admin/$file"
done

# 4. Production
mkdir -p apps/production/src
mv production-app.jsx apps/production/src/App.jsx

for file in package.json vite.config.js index.html main.jsx nginx.conf Dockerfile; do
  cp "apps/client-a/$file" "apps/production/$file"
done

# 5. .gitignore
cat > .gitignore << 'EOF'
.env
.env.local
*.pem
*.key
.terraform/
*.tfstate
*.tfstate.backup
.terraform.lock.hcl
node_modules/
dist/
build/
.DS_Store
*.log
terraform/terraform.tfvars
ansible/inventory.ini
EOF

echo "✓ Strukturę katalogów utworzona!"
ls -la apps/
