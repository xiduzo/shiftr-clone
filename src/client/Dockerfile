FROM node:20

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

# Build the client
CMD ["npm", "run", "build:client"]
