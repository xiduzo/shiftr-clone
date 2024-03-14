FROM nginx:alpine

RUN apk add --update npm

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY vite.config.js ./

COPY src/common ./src/common
COPY src/client ./src/client

ENV VITE_CLIENT_MQTT_CONNECTION_STRING=ws://username:password@127.0.0.1:8083
ENV VITE_CLIENT_HTTP_CONNECTIONS=http://localhost:9999

RUN npm run build:client

RUN cp -r src/client/dist/* /usr/share/nginx/html
RUN rm -rf src

# Run process is started by nginx
