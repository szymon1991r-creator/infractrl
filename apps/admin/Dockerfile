FROM node:20-alpine as build
WORKDIR /app
ARG CLIENT_ID=A
ARG ACCENT_COLOR=#0ea5e9
ARG REGION_LABEL=AWS EU-WEST-1
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
