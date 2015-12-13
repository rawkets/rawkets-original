// Clone function
function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;

	var copy;
    // Handle Array
    if (obj instanceof Array) {
        var i, len = obj.length;
		copy = [];
        for (i = 0; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    };

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    };

    throw new Error("Unable to copy obj! Its type isn't supported.");
};

var socketById = function(io, id) {
  var sockets = io.sockets.sockets;
  var socket;

  for (var i = 0; i < sockets.length; i += 1) {
    if (sockets[i].id === id) {
      socket = sockets[i];
      return socket;
    }
  }

  return socket;
};

// Vector object
var Vector = function(opts) {
	// Public variables
	var x = opts.x || 0,
		y = opts.y || 0;

	return {
		x: x,
		y: y
	};
};

// Player state object
var PlayerState = function(opts) {
	// Public variables
	var currentKeys = {left: false, right: false, up: false, down: false, space: false, mine: false},
		pos = new Vector({x: opts.x, y: opts.y}),
		thrust = 0,
		maxThrust = 2800,
		acc = new Vector({x: 0, y: 0}),
		angle = 0,
		moving = false,
		health = 100,
		score = 0;

	return {
		pos: pos,
		acc: acc,
		thrust: thrust,
		maxThrust: maxThrust,
		angle: angle,
		moving: moving,
		currentKeys: currentKeys,
		health: health,
		score: score
	};
};

// Player object
var Player = function(opts) {
	// Public variables
	var id = opts.id || false,
		username = opts.username,
		idleAge = 0,
		currentState = new PlayerState({x: opts.x, y: opts.y}),
		previousState = clone(currentState),
		weaponsHotBullet = true,
		weaponsHotMine = true,
		mineCount = 0,
		rotationSpeed = 0,
		maxRotationSpeed = 0.09,
		screen = new Vector({x: opts.w, y: opts.h});

	// Public methods
	var update = function(dtdt) {
		// Update previous state (fix the clone issues)
		previousState.currentKeys = clone(currentState.currentKeys);
		previousState.pos = clone(currentState.pos);
		previousState.angle = currentState.angle;
		previousState.moving = currentState.moving;
		previousState.health = currentState.health;

		if (currentState.health <= 0) {
			return;
		};

		if (currentState.health < 100) {
			currentState.health += 0.25;
		};

		if (currentState.currentKeys.left || currentState.currentKeys.right) {
			rotationSpeed += 0.01;
			if (rotationSpeed > maxRotationSpeed) {
				rotationSpeed = maxRotationSpeed;
			};
		} else {
			rotationSpeed = 0;
		};

		if (currentState.currentKeys.left) {
			currentState.angle -= rotationSpeed;
		};

		if (currentState.currentKeys.right) {
			currentState.angle += rotationSpeed;
		};

		if (currentState.currentKeys.up) {
			currentState.moving = true;

			currentState.thrust += 50;
			if (currentState.thrust > currentState.maxThrust) {
				currentState.thrust = currentState.maxThrust;
			};

			// Change this so it takes into consideration the previous acceleration
			// At the moment this stops you dead if you coast a little, then change direction
			currentState.acc.x = Math.cos(currentState.angle)*currentState.thrust;
			currentState.acc.y = Math.sin(currentState.angle)*currentState.thrust;
		} else {
			currentState.moving = false;
			currentState.thrust = 0;
			if (Math.abs(currentState.acc.x) > 0.1 || Math.abs(currentState.acc.y) > 0.1) {
				currentState.acc.x *= 0.99;
				currentState.acc.y *= 0.99;
			} else {
				currentState.acc.x = 0;
				currentState.acc.y = 0;
			};
		};

		// Verlet integration (http://www.gotoandplay.it/_articles/2005/08/advCharPhysics.php)
		currentState.pos.x = 2 * currentState.pos.x - previousState.pos.x + currentState.acc.x * dtdt;
		currentState.pos.y = 2 * currentState.pos.y - previousState.pos.y + currentState.acc.y * dtdt;

		if (!withinWorldBounds(currentState.pos.x, currentState.pos.y)) {
			if (currentState.pos.x > worldWidth)
				currentState.pos.x = worldWidth;

			if (currentState.pos.x < 0)
				currentState.pos.x = 0;

			if (currentState.pos.y > worldHeight)
				currentState.pos.y = worldHeight;

			if (currentState.pos.y < 0)
				currentState.pos.y = 0;
		};
	};

	var respawn = function() {
		currentState.pos.x = 50+Math.random()*(worldWidth-100);
		currentState.pos.y = 50+Math.random()*(worldHeight-100);
	};

	var withinScreen = function(pos) {
		if (pos.x >= currentState.pos.x-(screen.x/2) &&
			pos.x <= currentState.pos.x+(screen.x/2) &&
			pos.y >= currentState.pos.y-(screen.y/2) &&
			pos.y <= currentState.pos.y+(screen.y/2)) {
			return true;
		};

		return false;
	};

	var sendUpdate = function(killedById) {
		var client = socketById(io, id);

		if (!client) {
			return;
		};

		var pos = new Vector({x: Math.floor(currentState.pos.x), y: Math.floor(currentState.pos.y)});

		var rawMsg = {id: id};
		if (currentState.pos.x != previousState.pos.x || currentState.pos.y != previousState.pos.y) {
			rawMsg.p = currentState.pos;
		};
		if (currentState.angle != previousState.angle) {
			rawMsg.a = currentState.angle;
		};
		if (currentState.moving != previousState.moving) {
			rawMsg.m = currentState.moving;
		};
		if (currentState.health != previousState.health) {
			rawMsg.h = currentState.health;
		};

		var msg = formatMessage(MESSAGE_TYPE_UPDATE_REMOTE_PLAYER_STATE, rawMsg);
		msgOutQueue.push({client: client, msg: msg});

		client.emit("message", formatMessage(MESSAGE_TYPE_UPDATE_LOCAL_PLAYER_POSITION, rawMsg));
	};

	return {
		id: id,
		username: username,
		idleAge: idleAge,
		update: update,
		currentState: currentState,
		previousState: previousState,
		weaponsHotBullet: weaponsHotBullet,
		weaponsHotMine: weaponsHotMine,
		mineCount: mineCount,
		respawn: respawn,
		screen: screen,
		withinScreen: withinScreen,
		sendUpdate: sendUpdate
	};
};

var killPlayer = function(playerId, killedByPlayerId) {
	var player = playerById(playerId);
	var killedById = (killedByPlayerId) ? killedByPlayerId : false;
	if (player) {
		//console.log("Kill player", player.id);
		player.currentState.moving = false;
		player.currentState.acc.x = 0;
		player.currentState.acc.y = 0;
		player.currentState.health = 0;

		if (killedById) {
			var client = socketById(io, player.id);
			client.emit("message", formatMessage(MESSAGE_TYPE_KILLED_BY, {id: killedById}));
		};

		var self = player;
		setTimeout(function() {
			//console.log("Revive player", self.id);
			self.respawn();
			self.currentState.health = 100;
			self.sendUpdate();
		}, 2000);
	};
};

var getPlayerColour = function(sessionId) {
	var client = socketById(io, sessionId),
		colour = false;

  // TODO: Re-implement with working IP detection

	// if (client) {
	//  	switch (client.request.socket.remoteAddress) {
	// 		case "213.104.213.216": // John
	// 			colour = "255,255,0";
	// 			//name = "John";
	// 			break;
	// 		case "93.97.234.238": // Hannah
	// 			colour = "199,68,145";
	// 			//name = "ErisDS";
	// 			break;
	// 		case "87.194.135.193": // Me
	// 		case "127.0.0.1": // Me
	// 			colour = "217,65,30";
	// 			//name = "Rob";
	// 			break;
	// 	};
	// };

	return colour;
};

var setBulletTimer = function(playerId) {
	var player = playerById(playerId);
	if (player) {
		player.weaponsHotBullet = false;
		var self = player;
		setTimeout(function() {
			//console.log("Weapons hot", self.id);
			self.weaponsHotBullet = true;
		}, 350);
	};
};

var setMineTimer = function(playerId) {
	var player = playerById(playerId);
	if (player) {
		player.weaponsHotMine = false;
		var self = player;
		setTimeout(function() {
			//console.log("Weapons hot", self.id);
			self.weaponsHotMine = true;
		}, 600);
	};
};

// Bullet state object
var BulletState = function(opts) {
	// Public variables
	var pos = new Vector({x: opts.x, y: opts.y}),
		vel = 8000,
		acc = new Vector({x: Math.cos(opts.angle)*vel, y:Math.sin(opts.angle)*vel}),
		age = 0;

	return {
		pos: pos,
		acc: acc,
		age: age
	};
};

// Bullet object
var Bullet = function(opts) {
	// Public variables
	var id = opts.id || false,
		playerId = opts.playerId || false,
		currentState = new BulletState({x: opts.x, y: opts.y, angle: opts.a}),
		previousState = clone(currentState);

	// Public methods
	var update = function(dtdt) {
		// Update previous state
		previousState.pos = clone(currentState.pos);
		previousState.age = currentState.age;

		currentState.age++;

		currentState.pos.x = 2 * currentState.pos.x - previousState.pos.x + currentState.acc.x * dtdt;
		currentState.pos.y = 2 * currentState.pos.y - previousState.pos.y + currentState.acc.y * dtdt;
	};

	return {
		id: id,
		playerId: playerId,
		currentState: currentState,
		update: update
	};
};

// Mine state object
var MineState = function(opts) {
	// Public variables
	var pos = new Vector({x: opts.x, y: opts.y}),
		age = 0;

	return {
		pos: pos,
		age: age
	};
};

// Mine object
var Mine = function(opts) {
	// Public variables
	var id = opts.id || false,
		playerId = opts.playerId || false,
		currentState = new MineState({x: opts.x, y: opts.y});
		//previousState = clone(currentState);

	// Public methods
	var update = function() {
		// Update previous state
		//previousState.pos = clone(currentState.pos);
		//previousState.age = currentState.age;

		currentState.age++;

		//currentState.pos.x = 2 * currentState.pos.x - previousState.pos.x + currentState.acc.x * dtdt;
		//currentState.pos.y = 2 * currentState.pos.y - previousState.pos.y + currentState.acc.y * dtdt;
	};

	return {
		id: id,
		playerId: playerId,
		currentState: currentState,
		update: update
	};
};

// Message formatter helper
function formatMessage(type, args) {
	var msg = {z: type};

	for (var arg in args) {
		// Don't overwrite the message type
		if (arg != "z")
			msg[arg] = args[arg];
	};

	return BISON.encode(msg);
};

// World boundary helper
function withinWorldBounds(x, y) {
	if (x > 0 &&
		x < worldWidth &&
		y > 0 &&
		y < worldHeight) {
		return true;
	}

	return false;
};

// Ping helper
function sendPing(client) {
	setTimeout(function() {
		var timestamp = new Date().getTime();
		client.emit("message", formatMessage(MESSAGE_TYPE_PING, {t: timestamp.toString()}));
	}, 1000);
};

// Check username
function checkUsernameExists(username) {
	var p, player, playerCount = players.length;
	for (p = 0; p < playerCount; p++) {
		player = players[p];
		if (player) {
			if (player.username == username) {
				return true;
			};
		};
	};
	return false;
};

// Benchmarks for server
function startBenchmarkTimer() {
	if (runUpdate) {
		setInterval(function() {
			if (updateTime != undefined) {
				console.log("Update time: ", updateTime);
			};
		}, 5000);
	};
};

// Message types
var MESSAGE_TYPE_UPDATE_REMOTE_PLAYER_STATE = 0,
	MESSAGE_TYPE_NEW_PLAYER = 1,
	MESSAGE_TYPE_REMOVE_PLAYER = 2,
	MESSAGE_TYPE_ENABLE_PLAYER_KEY = 3,
	MESSAGE_TYPE_DISABLE_PLAYER_KEY = 4,
	MESSAGE_TYPE_UPDATE_LOCAL_PLAYER_POSITION = 5,
	MESSAGE_TYPE_PING = 6,
	MESSAGE_TYPE_NEW_BULLET = 7,
	MESSAGE_TYPE_UPDATE_BULLET_STATE = 8,
	MESSAGE_TYPE_REMOVE_BULLET = 9,
	MESSAGE_TYPE_UPDATE_LOCAL_PLAYER_COLOUR = 10,
	MESSAGE_TYPE_UPDATE_PLAYER_SCREEN = 11,
	MESSAGE_TYPE_KILLED_BY = 12,
	MESSAGE_TYPE_UPDATE_SCORE = 13,
	MESSAGE_TYPE_CHECK_USERNAME = 14,
	MESSAGE_TYPE_CHAT = 15,
	MESSAGE_TYPE_NEW_MINE = 16,
	MESSAGE_TYPE_REMOVE_MINE = 17;

// Start of main game setup
var io = require("socket.io")(8000, {transports: ['websocket']}),
	BISON = require("./bison"),

	// Run game
	runUpdate = true,
	serverStart = new Date().getTime(),
	updateStart,
	updateEnd,
	updateTime,

	// Fixed physics update
	t = 0,
	dt = 1/30,
	dtdt = dt*dt,

	// Game world
	worldWidth = 2000,
	worldHeight = 2000,

	// Players
	players = [],

	// Weapons
	bullets = [],
	mines = [],

	// Communication
	msgInQueue = [], // Incoming messages
	msgOutQueue = []; // Outgoing messages

// Client connected
io.sockets.on("connection", function(client){
  if (client.id === undefined) {
		console.log("Failed to retrieve client session ID");
		return;
	};

	// Add new player to the game
	console.log("New player has connected: ", client.id);

	// Client disconnected
	client.on("disconnect", function(){
		console.log("Player has disconnected: ", client.id);

		var player = playerById(client.id);

		// Safely remove player from the game
		if (player) {
			// Remove player from the players array
			var id = player.id;
			players.splice(indexOfByPlayerId(player.id), 1);
			console.log("Removed player: ", id);
			console.log("Players connected: ", players.length);

			// Sync other players
			io.emit("message", formatMessage(MESSAGE_TYPE_REMOVE_PLAYER, {id: player.id}), [player.id]);
		};
	});

	// Client sent a message
	client.on("message", function(msg){
		if (msg) {
			// Add message to queue
			msgInQueue.push({client: client, msg: msg});
		};
	});
});

// Main update loop
function update() {
	updateStart = new Date().getTime();

	// Deal with queued incoming messages
	unqueueIncomingMessages(msgInQueue);

	// Clear incoming messages queue (move into unqueueReceivedMessages?)
	msgInQueue = [];

	// Update every single player in the game
	var i, player, bullet, bulletPos, mine, minePos, timestamp, id, client, msg, removedPlayers = [], playerCount = players.length;
	for (i = 0; i < playerCount; i++) {
		player = players[i];

		if (player) {
			if (++player.idleAge > 1800) { // 30 seconds without ping
				removedPlayers.push(player);
				continue;
			};

			player.update(dtdt);

			if (player.currentState.health > 20) {
				if (player.currentState.currentKeys.space && player.weaponsHotBullet) {
					bulletPos = new Vector({x: 0, y: 0});
					timestamp = new Date().getTime();

					bulletPos.x = player.currentState.pos.x+(Math.cos(player.currentState.angle)*7);
					bulletPos.y = player.currentState.pos.y+(Math.sin(player.currentState.angle)*7);

					id = timestamp+player.id.toString()+(Math.round(Math.random()*99));

					bullet = new Bullet({id: id, playerId: player.id, x: bulletPos.x, y: bulletPos.y, a: player.currentState.angle});
					bullets.push(bullet);

					player.currentState.health -= 10;

					io.emit("message", formatMessage(MESSAGE_TYPE_NEW_BULLET, {id: id, x: Math.floor(bullet.currentState.pos.x), y: Math.floor(bullet.currentState.pos.y), a: player.currentState.angle}));

					setBulletTimer(players[i].id);
				};

				if (player.currentState.currentKeys.mine && player.weaponsHotMine && player.mineCount < 3) {
					minePos = new Vector({x: 0, y: 0});
					timestamp = new Date().getTime();

					minePos.x = player.currentState.pos.x;
					minePos.y = player.currentState.pos.y;

					id = timestamp+player.id.toString()+(Math.round(Math.random()*99));

					mine = new Mine({id: id, playerId: player.id, x: minePos.x, y: minePos.y});
					mines.push(mine);

					player.mineCount++;

					io.emit("message", formatMessage(MESSAGE_TYPE_NEW_MINE, {id: id, pid: player.id, x: Math.floor(mine.currentState.pos.x), y: Math.floor(mine.currentState.pos.y)}));

					setMineTimer(players[i].id);
				};
			};

			client = socketById(io, player.id);

			if (client) {
				if (Math.abs(player.previousState.pos.x - player.currentState.pos.x) > 0.1 ||
					Math.abs(player.previousState.pos.y - player.currentState.pos.y) > 0.1 ||
					Math.abs(player.previousState.angle != player.currentState.angle) ||
					player.previousState.moving != player.currentState.moving ||
					player.previousState.health != player.currentState.health) {
					player.sendUpdate();
				};
			};
		};
	};

	// Remove idle players
	var rp, playerIndex, removedPlayerCount = removedPlayers.length;
	for (rp = 0; rp < removedPlayerCount; rp++) {
		player = players[rp];

		if (player) {
			playerIndex = indexOfByPlayerId(player.id);
			players.splice(playerIndex, 1);
			console.log("Removed player: ", player.id);
			console.log("Players connected: ", players.length);

			// Sync other players
			io.emit("message", formatMessage(MESSAGE_TYPE_REMOVE_PLAYER, {id: player.id}), [player.id]);
		};
	};

	// Update every single weapon in the game
	var b, bulletsToUpdate = [], deadBullets = [], bulletCount = bullets.length, m, deadMines = [], mineCount = mines.length, alive, deadBulletPlayers = [], deadMinePlayers = [], p, dx, dy, dd, d;
	playerCount = players.length;
	for (b = 0; b < bulletCount; b++) {
		bullet = bullets[b];

		if (bullet) {
			if (bullet.currentState.age > 75) {
				deadBullets.push(bullet);
				continue;
			};

			bullet.update(dtdt);

			// Check for kills
			for (p = 0; p < playerCount; p++) {
				player = players[p];

				if (player.id == bullet.playerId) {
					continue;
				};

				if (player && player.currentState.health > 0) {
					dx = bullet.currentState.pos.x - player.currentState.pos.x;
					dy = bullet.currentState.pos.y - player.currentState.pos.y;
					dd = (dx * dx) + (dy * dy);
					d = Math.sqrt(dd);

					if (d < 10) {
						if (player.currentState.health > 0) {
							player.currentState.health -= 35;

							if (player.currentState.health <= 0) {
								deadBulletPlayers.push({player: player, bulletPlayerId: bullet.playerId});
							};

							//socket.broadcast(formatMessage(MESSAGE_TYPE_REMOVE_BULLET, {id: bullet.id}));
						};
						deadBullets.push(bullet);
						continue;
					};
				};
			};
			bulletsToUpdate.push({
				id: bullet.id,
				x: Math.floor(bullet.currentState.pos.x),
				y: Math.floor(bullet.currentState.pos.y)
			});
		};
	};

	// Removed in an attempt to predict/animate this on the client to save bandwidth
	// A bullet will never change trajectory, so why bother updating state?
	/*if (bulletsToUpdate.length > 0) {
		msg = formatMessage(MESSAGE_TYPE_UPDATE_BULLET_STATE, {b: bulletsToUpdate});
		msgOutQueue.push({client: client, msg: msg});
	};*/

	var dpb, bulletPlayerId, bulletPlayer, bulletClient, deadBulletPlayerCount = deadBulletPlayers.length;
	for (dpb = 0; dpb < deadBulletPlayerCount; dpb++) {
		player = deadBulletPlayers[dpb].player;
		bulletPlayerId = deadBulletPlayers[dpb].bulletPlayerId;

		if (player) {
			killPlayer(player.id, bulletPlayerId);

			bulletPlayer = playerById(bulletPlayerId);
			bulletClient = socketById(io, bulletPlayerId);
			if (bulletPlayer && bulletClient) {
				bulletPlayer.currentState.score++;
				bulletClient.emit("message", formatMessage(MESSAGE_TYPE_UPDATE_SCORE, {s: bulletPlayer.currentState.score}));
			};

			client = socketById(io, player.id);
			if (client) {
				player.sendUpdate();
			};
		};
	};

	// Remove dead bullets
	var db, bulletIndex, deadBulletCount = deadBullets.length;
	for (db = 0; db < deadBulletCount; db++) {
		bullet = deadBullets[db];
		bulletIndex = indexOfByBulletId(deadBullets[db].id);

		if (bullet) {
			io.emit("message", formatMessage(MESSAGE_TYPE_REMOVE_BULLET, {id: bullet.id}));
			bullets.splice(bulletIndex, 1);
			//console.log("Remove bullet", bullets.length);
		};
	};

	// Mines
	for (m = 0; m < mineCount; m++) {
		mine = mines[m];

		if (mine) {
			if (mine.currentState.age > 1500) {
				deadMines.push(mine);
				continue;
			};

			mine.update();

			// Check for kills
			for (p = 0; p < playerCount; p++) {
				player = players[p];

				if (player.id == mine.playerId) {
					continue;
				};

				if (player && player.currentState.health > 0) {
					dx = mine.currentState.pos.x - player.currentState.pos.x;
					dy = mine.currentState.pos.y - player.currentState.pos.y;
					dd = (dx * dx) + (dy * dy);
					d = Math.sqrt(dd);

					if (d < 30) {
						if (player.currentState.health > 0) {
							player.currentState.health -= 90;

							if (player.currentState.health <= 0) {
								deadMinePlayers.push({player: player, minePlayerId: mine.playerId});
							};

							//socket.broadcast(formatMessage(MESSAGE_TYPE_REMOVE_MINE, {id: mine.id}));
						};
						deadMines.push(mine);
						continue;
					};
				};
			};
			/*minesToUpdate.push({
				id: mine.id,
				x: Math.floor(mine.currentState.pos.x),
				y: Math.floor(mine.currentState.pos.y)
			});*/
		};
	};

	/*
	if (minesToUpdate.length > 0) {
		msg = formatMessage(MESSAGE_TYPE_UPDATE_MINE_STATE, {b: bulletsToUpdate});
		msgOutQueue.push({client: client, msg: msg});
	};
	*/

	var dpm, minePlayerId, minePlayer, mineClient, deadMinePlayerCount = deadMinePlayers.length;
	for (dpm = 0; dpm < deadMinePlayerCount; dpm++) {
		player = deadMinePlayers[dpm].player;
		minePlayerId = deadMinePlayers[dpm].minePlayerId;

		if (player) {
			killPlayer(player.id, minePlayerId);

			minePlayer = playerById(minePlayerId);
			mineClient = socketById(io, minePlayerId);
			if (minePlayer && mineClient) {
				minePlayer.currentState.score++;
				mineClient.emit("message", formatMessage(MESSAGE_TYPE_UPDATE_SCORE, {s: minePlayer.currentState.score}));
			};

			client = socketById(io, player.id);
			if (client) {
				player.sendUpdate();
			};
		};
	};

	// Remove dead mines
	var dm, mineIndex, deadMineCount = deadMines.length;
	for (dm = 0; dm < deadMineCount; dm++) {
		mine = deadMines[dm];
		mineIndex = indexOfByMineId(deadMines[dm].id);

		if (mine) {
			io.emit("message", formatMessage(MESSAGE_TYPE_REMOVE_MINE, {id: mine.id}));
			mines.splice(mineIndex, 1);

			minePlayer = playerById(mine.playerId);
			if (minePlayer) {
				minePlayer.mineCount--;
			};
		};
	};

	// Move game time forward
	t += dt;

	// Deal with queued outgoing messages
	unqueueOutgoingMessages(msgOutQueue);

	// Clear outgoing messages queue
	msgOutQueue = [];

	updateEnd = new Date().getTime();
	updateTime = updateEnd-updateStart;

	// Schedule next game update
	if (runUpdate) {;
		setTimeout(update, 1000/60); // Remember, this is however long it take to update PLUS 60ms
	};
};

// Unqueue incoming messages and do stuff with them
function unqueueIncomingMessages(msgQueue) {
	// Check for messages
	if (msgQueue.length == 0) {
		return;
	};

	// Copy message queue
	var msgs = msgQueue.slice(0); // Necessary?

	// Do stuff with message queue
	var data, client, msg, username;
	while (msgs.length > 0) {
		// Grab and remove the oldest message in the array
		data = msgs.shift();

		if (!data.msg || !data.client) {
			continue;
		};

		client = data.client;
		try {
			msg = BISON.decode(data.msg);
		} catch (err) {
			console.log("Dodgy message: ", data.msg);
			continue;
		};

		// Only deal with messages using the correct protocol
		if (msg !== undefined && msg.z !== undefined) {
			var player, colour;
			switch (msg.z) {
				case MESSAGE_TYPE_PING:
					player = players[indexOfByPlayerId(client.id)];

					if (player == null) {
						break;
					};

					player.idleAge = 0; // Player is active

					var newTimestamp = new Date().getTime();
					//console.log("Round trip: "+(newTimestamp-data.ts)+"ms", client.id);
					var ping = newTimestamp-msg.t;

					// Send ping back to player
					client.emit("message", formatMessage(MESSAGE_TYPE_PING, {i: player.id, p: ping}));

					// Log ping to server after every 10 seconds
					//if ((newTimestamp-serverStart) % 5000 <= 3000) {
						//console.log("PING ["+client.id+"]: "+ping);
					//};

					// Request a new ping
					sendPing(client);
					break;
				case MESSAGE_TYPE_CHECK_USERNAME:
					var code = 0, response = 0, rawMsg;
					username = msg.u;
					if (username == "" || !username.match(/^[\d\w]*$/)) {
						code = 0;
						response = 2;
					} else if (username.length > 15) {
						code = 0;
						response = 3;
					} else if (checkUsernameExists(username)) {
						code = 0;
						response = 1;
					} else {
						code = 1; // Valid and available username
					};

					rawMsg = (code == 1) ? {id: client.id, c: code} : {id: client.id, c: code, r: response};
					client.emit("message", formatMessage(MESSAGE_TYPE_CHECK_USERNAME, rawMsg));
					break;
				case MESSAGE_TYPE_NEW_PLAYER:
					console.log("Adding new player: ", client.id);
					colour = getPlayerColour(client.id);

					username = msg.u;
					if (username == "" || !username.match(/^[\d\w]*$/)) {
						console.log("Halted addition of player: dodgy username");
						return;
					};

					// Sync game state with new player
					var i, playerCount = players.length;
					if (playerCount > 0) {
						for (i = 0; i < playerCount; i++) {
							player = players[i];
							playerColour = getPlayerColour(player.id);
							client.emit("message", formatMessage(MESSAGE_TYPE_NEW_PLAYER, {id: player.id, s: player.currentState, c: playerColour, u: player.username}));
						};
					};

					var m, mineCount = mines.length, mine;
					if (mineCount > 0) {
						for (m = 0; m < mineCount; m++) {
							mine = mines[m];
							client.emit("message", formatMessage(MESSAGE_TYPE_NEW_MINE, {id: mine.id, pid: mine.playerId, x: Math.floor(mine.currentState.pos.x), y: Math.floor(mine.currentState.pos.y)}));
						};
					};

					players.push(new Player({id: client.id, x: worldWidth/2, y: worldWidth/2, w: msg.w, h: msg.h, username: username}));
					console.log("Players connected: ", players.length);

					// Move into a queueing system
					client.broadcast.emit("message", formatMessage(MESSAGE_TYPE_NEW_PLAYER, {id: client.id, s: msg.s, c: colour, u: username}));
					client.emit("message", formatMessage(MESSAGE_TYPE_UPDATE_LOCAL_PLAYER_COLOUR, {c: colour}));
					sendPing(client);
					break;
				case MESSAGE_TYPE_ENABLE_PLAYER_KEY:
					player = playerById(client.id);
          // console.log("[" + client.id + "] Enable key: ", msg.k);
					if (player) {
						switch (msg.k) {
							case 32: // Space
								player.currentState.currentKeys.space = true;
								break;
							case 37: // Left
								player.currentState.currentKeys.left = true;
								break;
							case 38: // Up
								player.currentState.currentKeys.up = true;
								break;
							case 39: // Right
								player.currentState.currentKeys.right = true;
								break;
							case 40: // Down
								player.currentState.currentKeys.down = true;
								break;
							case 77: // m
								player.currentState.currentKeys.mine = true;
								break;
						};
					};
					break;
				case MESSAGE_TYPE_DISABLE_PLAYER_KEY:
					player = playerById(client.id);
          // console.log("[" + client.id + "] Disable key: ", msg.k);
					if (player) {
						switch (msg.k) {
							case 32: // Space
								player.currentState.currentKeys.space = false;
								break;
							case 37: // Left
								player.currentState.currentKeys.left = false;
								break;
							case 38: // Up
								player.currentState.currentKeys.up = false;
								break;
							case 39: // Right
								player.currentState.currentKeys.right = false;
								break;
							case 40: // Down
								player.currentState.currentKeys.down = false;
								break;
							case 77: // m
								player.currentState.currentKeys.mine = false;
								break;
						};
					};
					break;
				case MESSAGE_TYPE_UPDATE_PLAYER_SCREEN:
					player = playerById(client.id);
					if (player) {
						player.screen.x = msg.w;
						player.screen.y = msg.h;
					};
					break;
				case MESSAGE_TYPE_CHAT:
					if (msg.m) {
						var chatMsg;
						if (msg.m.length > 60) {
							chatMsg = msg.m.slice(0, 60);
							chatMsg += "...";
						} else {
							chatMsg = msg.m;
						};
						io.emit("message", formatMessage(MESSAGE_TYPE_CHAT, {id: client.id, m: chatMsg}));
					};
					break;
			};
		};
	};
};

// Unqueue outgoing messages and do stuff with them
function unqueueOutgoingMessages(msgQueue) {
	// Check for messages
	if (msgQueue.length == 0) {
		return;
	};

	// Copy message queue
	var msgs = msgQueue.slice(0); // Necessary?

	// Do stuff with message queue
	var data, client, msg;
	while (msgs.length > 0) {
		// Grab and remove the oldest message in the array
		data = msgs.shift();
		client = data.client;
		msg = BISON.decode(data.msg);

		// Only deal with messages using the correct protocol
		if (msg.z !== undefined) {
			var p, player, playerClient, excudedSessionIds, playerCount;
			switch (msg.z) {
				case MESSAGE_TYPE_UPDATE_REMOTE_PLAYER_STATE:
					// Only broadcast this in full to players that will see this in their screen
 					// Otherwise send a cut down version that only news new coordinates (for off-screen markers)
					excudedSessionIds = [];
					playerCount = players.length;
					for (p = 0; p < playerCount; p++) {
						player = players[p];

						if (player) {
							if (player.id == msg.id) {
								continue;
							};

							if (!player.withinScreen(player.currentState.pos)) {
								//excudedSessionIds.push(player.id);
								// Only send position data
								var rawMsg = {id: id};
								if (msg.pos.x != undefined) {
									rawMsg.p = msg.p;
								};
								if (msg.h != undefined) {
									rawMsg.h = msg.h;
								};
								data.msg = formatMessage(MESSAGE_TYPE_UPDATE_REMOTE_PLAYER_STATE, rawMsg);
							} else {
								// Send full state update
							};

							playerClient = socketById(io, player.id);
							if (playerClient) {
								playerClient.emit("message", data.msg);
							};
						};
					};
					break;
				/*case MESSAGE_TYPE_UPDATE_BULLET_STATE: // Depricated
					// Only broadcast this in full to players that will see this in their screen
					excudedSessionIds = [];
					playerCount = players.length;

					var b, bulletCount = msg.b.length;
					for (b = 0; b > bulletCount; b++) {
						var bulletPos = new Vector({x: msg.x, y: msg.y});
						for (p = 0; p < playerCount; p++) {
							player = players[p];

							//if (!player.withinScreen(bulletPos)) {
							//	excudedSessionIds.push(player.id);
							//};
						};
					};
					socket.broadcast(data.msg);
					break;*/
			};
		};
	};
};

// Find player by ID
function playerById(id) {
	for (var i = 0; i < players.length; i++) {
		if (players[i].id == id)
			return players[i];
	};

	return false;
};

// Find player index by ID
function indexOfByPlayerId(id) {
	for (var i = 0; i < players.length; i++) {
		if (players[i].id == id) {
			return i;
		};
	};

	return false;
};

// Find bullet index by ID
function indexOfByBulletId(id) {
	for (var i = 0; i < bullets.length; i++) {
		if (bullets[i].id == id) {
			return i;
		};
	};

	return false;
};

// Find mine index by ID
function indexOfByMineId(id) {
	for (var i = 0; i < mines.length; i++) {
		if (mines[i].id == id) {
			return i;
		};
	};

	return false;
};

// Start main update loop
update();
//startBenchmarkTimer();
