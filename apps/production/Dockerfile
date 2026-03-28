FROM node:20-alpine as build
WORKDIR /app
ARG CLIENT_ID=PROD
ARG ACCENT_COLOR=#10b981
ARG REGION_LABEL=PRODUCTION
ARG API_URL=http://localhost:8000
ENV VITE_CLIENT_ID=$CLIENT_ID
ENV VITE_ACCENT_COLOR=$ACCENT_COLOR
ENV VITE_REGION_LABEL=$REGION_LABEL
ENV VITE_API_URL=$API_URL
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
