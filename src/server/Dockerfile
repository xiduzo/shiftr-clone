FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./

COPY src/common ./src/common
COPY src/server ./src/server

RUN npm run build:server

RUN cp -r src/server/dist/* .
RUN rm -rf src

# Run node process
CMD [ "node", "server/src/index.js" ]
# CMD ["tail", "-f", "/dev/null"]
