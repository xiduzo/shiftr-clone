FROM nginx:alpine

RUN apk add --update npm

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY vite.config.js ./

COPY src/common ./src/common
COPY src/client ./src/client

ARG VITE_CLIENT_MQTT_CONNECTION_STRING
ARG VITE_CLIENT_HTTP_CONNECTIONS

ENV VITE_CLIENT_MQTT_CONNECTION_STRING=$VITE_CLIENT_MQTT_CONNECTION_STRING
ENV VITE_CLIENT_HTTP_CONNECTIONS=$VITE_CLIENT_HTTP_CONNECTIONS

RUN npm run build:client

RUN cp -r src/client/dist/* /usr/share/nginx/html
RUN rm -rf src

# Run process is started by nginx
