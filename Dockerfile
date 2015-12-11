FROM node:latest

RUN mkdir /src

RUN npm install forever -g

WORKDIR /src
ADD package.json /src/package.json
RUN npm install

EXPOSE 80
EXPOSE 8000

CMD ls
CMD npm start
