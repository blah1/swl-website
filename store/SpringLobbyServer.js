/*
 * Handles logic related to lobby server state, handles the protocol.
 *
 * This is the only module that knows about the lobby protocol.
 */

'use strict'

var Reflux = require('reflux');
var _ = require('lodash');
var Applet = require('store/Applet.js');
var Settings = require('store/Settings.js');
var setSetting = require('act/Settings.js').set;
var Server = require('act/LobbyServer.js');
var Chat = require('act/Chat.js');
var Log = require('act/Log.js');

var storePrototype = {

	listenables: [Server, require('act/Chat.js')],
	mixins: [require('store/LobbyServerCommon.js')],

	init: function(){
		this.lostPings = 0;
		this.pingInterval = setInterval(this.pingPong, 20000);

		// Set correct this in handlers.
		this.handlers = _.mapValues(this.handlers, function(f){ return f.bind(this); }, this);
	},
	dispose: function(){
		clearInterval(this.pingInterval);
		this.stopListeningToAll();
	},

	// We throttle this to avoid slowdowns due to excessive retriggering
	// (e.g. on login when the server sends a ton of ADDUSER messages).
	triggerSync: _.throttle(function(){
		this.trigger(this.getInitialState());
	}, 100),

	// Action listeners.

	acceptAgreement: function(accept){
		if (accept){
			this.send('CONFIRMAGREEMENT');
			this.login();
		} else {
			Server.disconnect();
		}
		this.agreement = '';
		this.triggerSync();
	},

	sayChannel: function(channel, message, me){
		if (channel in this.channels)
			this.send((me ? 'SAYEX ' : 'SAY ') + channel + ' ' + message);
	},
	sayPrivate: function(user, message){
		if (user in this.users)
			this.send('SAYPRIVATE ' + user + ' ' + message);
		else if (user !== '')
			this.send('SAYPRIVATE Nightwatch !pm ' + user + ' ' + message);
	},
	joinChannel: function(channel, password){
		if (!(channel in this.channels))
			this.send('JOIN ' + channel + (password ? ' ' + password : ''));
	},
	leaveChannel: function(channel){
		if (channel in this.channels){
			this.send('LEAVE ' + channel);
			delete this.channels[channel];
			this.triggerSync();
		}
	},

	// Not action listeners.

	pingPong: function(){
		if (this.lostPings > 4){
			this.lostPings = 0;
			Log.errorBox('Lost connection to server. Trying to reconnect...');
			Server.disconnect();
			Server.connect();
		} else if (this.connection === this.ConnectionState.CONNECTED){
			this.send('PING');
			this.lostPings++;
		}
	},
	login: function(){
		if (this.validateLoginPassword(Settings.name, Settings.password)){
			this.nick = Settings.name;
			this.send("LOGIN " + this.nick + ' ' + this.hashPassword(Settings.password) +
				' 7778 * SpringWebLobbyReactJS dev\t' + this.getUserID() + '\tcl sp p et');
		}
		this.triggerSync();
	},
	// Drop words from a server message.
	dropWords: function(str, n){
		for(var i = 0; i < n; i++)
			str = str.slice(str.indexOf(' ') + 1);
		return str;
	},

	// Handlers for server commands. Unless you return true from a handler
	// triggerSync() will be called after it returns.
	handlers: {
		// LOGIN

		// Hi!
		"TASServer": function(){
			if (this.registering){
				if (this.validateLoginPassword(this.registering.name, this.registering.password)){
					this.send('REGISTER ' + this.registering.name + ' ' + this.hashPassword(this.registering.password) +
						(this.registering.email ? ' ' + this.registering.email : ''));
				}
			} else {
				this.login();
			}
			return true;
		},
		"ACCEPTED": function(){
			this.connection = this.ConnectionState.CONNECTED;
			this.autoJoinChannels();
		},
		"DENIED": function(args, data){
			Log.errorBox('Login denied: ' + data);
			this.needNewLogin = true;
			Server.disconnect();
		},
		"REGISTRATIONACCEPTED": function(){
			setSetting('name', this.registering.name);
			setSetting('password', this.registering.password);
			Server.disconnect();
			Server.connect();
			return true;
		},
		"REGISTRATIONDENIED": function(args, data){
			Log.errorBox('Registration denied: ' + data);
			this.needNewLogin = true;
			Server.disconnect();
		},
		"AGREEMENT": function(args, data){
			this.agreement += (data + '\n');
		},
		"PONG": function(){
			this.lostPings = 0;
			return true;
		},
		"REDIRECT": function(args){
			if (Applet) {
				Applet.disconnect();
				Applet.connect(args[0], args[1]);
			}
		},

		// USER STATUS

		"ADDUSER": function(args){
			this.users[args[0]] = { name: args[0], country: (args[1] === '??' ? 'unknown' : args[1]), cpu: args[2] };
		},
		"CLIENTSTATUS": function(args){
			if(!this.users[args[0]]) return true;
			var user = this.users[args[0]];
			var s = parseInt(args[1]);
			var newStatus = {
				admin: (s & 32) > 0,
				// lobbyBot is not the same as 'bot' used in battle context.
				lobbyBot: (s & 64) > 0,
				timeRank: (s & 28) >> 2,
				inGame: (s & 1) > 0,
				away: (s & 2) > 0,
			};
			if (newStatus.away && !user.away)
				newStatus.awaySince = new Date();
			if (newStatus.inGame && !user.inGame)
				newStatus.inGameSince = new Date();
			_.extend(this.users[args[0]], newStatus);
		},

		// CHANNELS

		// We joined a channel.
		"JOIN": function(args){
			this.channels[args[0]] = { name: args[0], users: {} };
		},
		"CHANNELTOPIC": function(args, data){
			this.channels[args[0]].topic = {
				text: this.dropWords(data, 3),
				author: args[1],
				time: new Date(parseInt(args[2]) * 1000)
			};
		},
		"NOCHANNELTOPIC": function(args){
			this.channels[args[0]].topic = null;
		},
		// List of people in a channel.
		"CLIENTS": function(args){
			args.slice(1).forEach(function(name){
				if (name in this.users) // uberserver can report stale users
					this.channels[args[0]].users[name] = this.users[name];
			}.bind(this));
		},
		// Someone joined a channel.
		"JOINED": function(args){
			this.channels[args[0]].users[args[1]] = this.users[args[1]];
		},
		// Someone left a channel.
		"LEFT": function(args){
			delete this.channels[args[0]].users[args[1]];
		},
		// Someone got kicked. Maybe us.
		"FORCELEAVECHANNEL": function(args){
			delete this.channels[args[0]].users[args[1]];
		},

		// TEXT MESSAGES

		// Someone said something in a channel.
		"SAID": function(args, data){
			Chat.saidChannel(args[0], args[1], this.dropWords(data, 2), false);
			return true;
		},
		"SAIDEX": function(args, data){
			Chat.saidChannel(args[0], args[1], this.dropWords(data, 2), true);
			return true;
		},
		"SAIDPRIVATE": function(args, data){
			Chat.saidPrivate(args[0], this.dropWords(data, 1));
			return true;
		},
		// Confirmation that our private message was delivered.
		"SAYPRIVATE": function(args, data){
			Chat.sentPrivate(args[0], this.dropWords(data, 1));
			return true;
		},
	},
	message: function(msg){
		///console.log("[IN] " + msg);
		var args = msg.split(' ');
		// Call the handler and trigger unless the handler returned true.
		if (this.handlers[args[0]] && !this.handlers[args[0]](args.slice(1), this.dropWords(msg, 1)))
			this.triggerSync();
	},
	send: function(msg){
		//console.log("[OUT] " + msg);
		Applet ? Applet.send(msg + '\n') : this.socket.send(msg);
	},
};

module.exports = _.partial(Reflux.createStore, storePrototype);
