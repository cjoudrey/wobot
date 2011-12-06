var util = require('util');
var events = require('events');
var fs = require('fs');
var xmpp = require('node-xmpp');
var bind = require('underscore').bind;

var Bot;

module.exports.Bot = (function() {
  // ##Private functions

  // Whenever an XMPP error occurs, this function is responsible for triggering
  // the `error` event with the details and disconnecting the bot from the
  // server.
  var onError = function(error) {
    if (error instanceof xmpp.Element) {
      var errorMessage = 'Unknown error';

      if (error.getChild('see-other-host')) {
        errorMessage = 'This account is signing in somewhere else. Maybe HipChat web version?';
      } else {
        var textNode = error.getChild('text');

        if (textNode) {
          errorMessage = textNode.getText();
        }
      }

      this.emit('error', errorMessage, error);
    } else {
      this.emit('error', error);
    }

    this.disconnect();
  };

  // Helper function that overrides the XMPP `send` method to allow
  // incoming and outgoing debugging.
  var enableDebug = function() {
    var self = this;

    self.jabber.on('data', function(buffer) {
      console.log('  IN > ' + buffer.toString());
    });

    var origSend = this.jabber.send;
    self.jabber.send = function(stanza) {
      console.log(' OUT > ' + stanza);
      return origSend.call(self.jabber, stanza);
    };
  };

  // Returns the current version of Wobot
  var getWobotVersion = function() {
    var packageData = fs.readFileSync(__dirname + '/../package.json', 'utf8');
    return JSON.parse(packageData).version;
  };

  // Whenever an XMPP connection is made, this function is responsible for
  // triggering the `connect` event and starting the 30s anti-idle. It will also
  // set the availability of the bot to `chat`.
  var onOnline = function() {
    var self = this;

    self.setAvailability('chat');

    self.keepalive = setInterval(function() {
      self.jabber.send(' ');
      self.emit('ping');
    }, 30000);

    self.emit('connect');
  };

  // This function is responsible for handling incoming XMPP messages. The
  // `data` event will be triggered with the message for custom XMPP
  // handling.
  //
  // The bot will parse the message and trigger the `message`
  // event when it is a group chat message or the `privateMessage` event when it
  // is a private message.
  var onStanza = function(stanza) {
    this.emit('data', stanza);

    if (stanza.is('message') && stanza.attrs.type == 'groupchat') {
      var body = stanza.getChild('body');
      if (!body) return;

      if (stanza.getChild('delay')) return;

      var attrFrom = stanza.attrs.from;
      var offset = attrFrom.indexOf('/');

      var channel = attrFrom.substring(0, offset);
      var from = attrFrom.substring(offset + 1);

      if (from == this.name) return;

      this.emit('message', channel, from, body.getText());
    } else if (stanza.is('message') && stanza.attrs.type == 'chat') {
      var body = stanza.getChild('body');
      if (!body) return;

      var attrFrom = stanza.attrs.from;
      var offset = attrFrom.indexOf('/');

      var jid = attrFrom.substring(0, offset);

      this.emit('privateMessage', jid, body.getText());
    }
  };

  // ##Public API

  // This is the `Bot` constructor.
  //
  // `options` object:
  //
  //   - `jid`: Bot's JabberId
  //   - `password`: Bot's HipChat password
  //   - `name`: Bot's full name (must match HipChat's data)
  //   - `debug`: Set to `true` to show network debug in console
  //   - `caps_ver`: Name and version of bot. Override if Wobot is being used
  //                 to power another bot framework (e.g. Hubot)
  function Bot(options) {
    events.EventEmitter.call(this);
    this.once('connect', function() { }); // listener bug in Node 0.4.2
    this.setMaxListeners(0);

    this.jabber = null;
    this.keepalive = null;
    this.plugins = {};

    options = options || {};
    this.jid = options.jid;
    this.password = options.password;
    this.debug = options.debug;
    this.name = options.name;
    this.caps_ver = options.caps_ver || 'wobot:'+getWobotVersion()
  };

  util.inherits(Bot, events.EventEmitter);

  // Connects the bot to HipChat and sets the XMPP event listeners. This
  // function will also enable network debugging when `options.debug` is set to
  // `true`.
  Bot.prototype.connect = function() {
    this.jabber = new xmpp.Client({
      jid: this.jid,
      password: this.password
    });

    if (this.debug === true) {
      enableDebug.call(this);
    }

    this.jabber.on('error', bind(onError, this));
    this.jabber.on('online', bind(onOnline, this));
    this.jabber.on('stanza', bind(onStanza, this));
  };

  // Updates the bot's availability and status.
  //
  //  - `availability`: Jabber availability codes
  //     - `away`
  //     - `chat` (Free for chat)
  //     - `dnd` (Do not disturb)
  //  - `status`: Status message to display
  Bot.prototype.setAvailability = function(availability, status) {
    var packet = new xmpp.Element('presence', { type: 'available' });
    packet.c('show').t(availability);

    if (status) {
      packet.c('status').t(status);
    }

    // Providing capabilities info (XEP-0115) in presence tells HipChat
    // what type of client is connecting. The rest of the spec is not actually
    // used at this time.
    packet.c('c', {
      xmlns: 'http://jabber.org/protocol/caps',
      node: 'http://hipchat.com/client/bot', // tell HipChat we're a bot
      ver: this.caps_ver
    });

    this.jabber.send(packet);
  };

  // Join the specified room.
  //
  // - `roomJid`: Target room, in the form of `????_????@conf.hipchat.com`
  Bot.prototype.join = function(roomJid) {
    var packet = new xmpp.Element('presence', { to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    this.jabber.send(packet);
  };

  // Part the specified room.
  //
  // - `roomJid`: Target room, in the form of `????_????@conf.hipchat.com`
  Bot.prototype.part = function(roomJid) {
    var packet = new xmpp.Element('presence', { type: 'unavailable', to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    packet.c('status').t('hc-leave');
    this.jabber.send(packet);
  };

  // Send a message to a room or a user.
  //
  // - `targetJid`: Target
  //    - Message to a room: `????_????@conf.hipchat.com`
  //    - Private message to a user: `????_????@chat.hipchat.com`
  // - `message`: Message to be sent to the room
  Bot.prototype.message = function(targetJid, message) {
    var packet;

    if (targetJid.match(/^(.*)@conf.hipchat.com$/)) {
      packet = new xmpp.Element('message', {
        to: targetJid + '/' + this.name,
        type: 'groupchat'
      });
    } else {
      packet = new xmpp.Element('message', {
        to: targetJid,
        type: 'chat',
        from: this.jid
      });
      packet.c('inactive', { xmlns: 'http://jabber/protocol/chatstates' });
    }

    packet.c('body').t(message);
    this.jabber.send(packet);
  };

  // Disconnect the bot from HipChat, remove the anti-idle and emit the
  // `disconnect` event.
  Bot.prototype.disconnect = function() {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = null;
    }
    this.jabber.end();
    this.emit('disconnect');
  };

  Bot.prototype.loadPlugin = function(identifier, plugin, options) {
    if (typeof(plugin) !== 'object') {
      throw new Error('plugin argument must be an object');
    }

    if (typeof(plugin.load) !== 'function') {
      throw new Error('plugin object must have a load function');
    }

    this.plugins[identifier] = plugin;
    this.plugins[identifier].load(this, options);

    return true;
  };

  // ##Events API

  // Emitted whenever the bot connects to the server.
  //
  // - `callback`: Function to be triggered: `function ()`
  Bot.prototype.onConnect = function(callback) {
    this.on('connect', callback);
  };

  // Emitted whenever a message is sent to a channel the bot is in.
  //
  // `onMessage(condition, callback)`
  //
  // `onMessage(callback)`
  //
  // - `condition`: String or RegExp the message must match.
  // - `callback`: Function to be triggered: `function (roomJid, from, message, matches)`
  //   - `roomJid`: Jabber Id of the room in which the message occured.
  //   - `from`: The name of the person who said the message.
  //   - `message`: The message
  //   - `matches`: The matches returned by the condition when it is a RegExp
  Bot.prototype.onMessage = function(condition, callback) {
    if (arguments.length === 1) {
      return this.on('message', condition);
    }

    this.on('message', function(channel, from, message) {
      if (typeof condition === 'string' && message === condition) {
        callback.apply(this, arguments);
      } else if (condition instanceof RegExp) {
        var matches = message.match(condition);

        if (!matches) {
          return;
        }

        var args = Array.prototype.slice.apply(arguments);
        args.push(matches);

        callback.apply(this, args);
      }
    });
  };

  // Emitted whenever a message is sent privately to the bot.
  //
  // `onPrivateMessage(condition, callback)`
  //
  // `onPrivateMessage(callback)`
  //
  // - `condition`: String or RegExp the message must match.
  // - `callback`: Function to be triggered: `function (fromJid, message)`
  Bot.prototype.onPrivateMessage = function(condition, callback) {
    if (arguments.length === 1) {
      return this.on('privateMessage', condition);
    }

    this.on('privateMessage', function(from, message) {
      if (typeof condition === 'string' && message === condition) {
        callback.apply(this, arguments);
      } else if (condition instanceof RegExp) {
        var matches = message.match(condition);

        if (!matches) {
          return;
        }

        var args = Array.prototype.slice.apply(arguments);
        args.push(matches);

        callback.apply(this, args);
      }
    });
  };

  // Emitted whenever the bot pings the server (roughly every 30 seconds).
  //
  // - `callback`: Function to be triggered: `function ()`
  Bot.prototype.onPing = function(callback) {
    this.on('ping', callback);
  };

  // Emitted whenever an error occurs. `disconnect` will be emitted afterwards.
  //
  // - `callback`: Function to be triggered: `function(message, stanza)`
  //   - `message`: string representation of the error.
  //   - `stanza`: instance of `xmpp.Element` (when available)
  Bot.prototype.onError = function(callback) {
    this.on('error', callback);
  };

  // Emitted whenever the bot disconnects from the server.
  //
  // - `callback`: Function to be triggered: `function ()`
  Bot.prototype.onDisconnect = function(callback) {
    this.on('disconnect', callback);
  };

  return Bot;
}());
