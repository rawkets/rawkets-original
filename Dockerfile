# TODO: Pull in Rawkets source files from somewhere for the volume link, rather # than manually having to move them to the server each time

FROM node:latest

RUN mkdir /src

RUN npm install -g pm2@latest

WORKDIR /src

COPY ./app /src/app
COPY package.json /src/package.json
COPY processes.json /src/processes.json

RUN npm install

EXPOSE 80
EXPOSE 8000

CMD ls
CMD npm start
