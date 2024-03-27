# Dev

## Pre-requisites

1. Node.js

Make sure you have Node.js installed on your machine. You can download it from [nodejs.org](https://nodejs.org/en/).

2. MQTT broker

For this project to run, make sure there is a MQTT broker running which you can connect to.

3. Docker

Preferably the `Mosquitto` broker is used from the `docker-compose` file. You can install [docker-desktop](https://docs.docker.com/desktop/release-notes/).

```bash
docker-compose up -d mosquitto
```

## Run locally

First, install the dependencies:

```bash
npm i
```

Then start the server:

```bash
npm run dev
```

## Run in docker

To run the project in docker, run the following command:

```bash
docker-compose up -d --build
```

# Docker

## Server

This Docker-container will build and run the server.

The server is responsible for reading the `Mosquitto` log-stream and re-publishing the messages to the client.

## Client

This Docker-container will only build the client files and put them at `/src/client/dist/`.

It could be served by a web-server like `nginx` or `apache`.

Or temporarily by running the following commands:

```bash
npm install http-server -g
```

```bash
# From within the src/client/dist folder
http-server -p 8080
```

## Mosquitto

This Docker-container will run the `Mosquitto` broker.

The most important settings in the `mosquitto.conf` are:

1. `log_type all` -- making sure all internal actions are exposed to the `server`.
2. `log_dest file /mosquitto/log/mosquitto.log` -- making sure the log is written to a file which the `server` has access to.

### User management

The default user configured is `username:password`.

```bash
# Encrypt the password file
docker exec mosquitto mosquitto_passwd -U /mosquitto/config/passwd
```

```bash
# Add a user
docker exec mosquitto mosquitto_passwd -b /mosquitto/config/passwd user password
```
