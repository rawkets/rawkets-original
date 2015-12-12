# Rawkets

## Test locally

Install dependencies and start the game client and server:

```bash
npm install
npm start
```

Then open the game in your browser at [http://localhost:3000](http://localhost:3000)


## Set up Docker and run Rawkets container

First you'll need to [install Docker](https://www.docker.com/) and then run the following from the terminal:

```bash
$ docker-compose build
$ docker-compose up
```


## Find Docker IP and play the game

Change `default` to the name of your Docker image &ndash; if you've only just set up Docker then using `default` may be ok.

```bash
docker-machine ip default
```

Load the given IP in your favourite browser.
