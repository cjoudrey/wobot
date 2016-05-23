var util = require('util');
var events = require('events');
var fs = require('fs');
var xmpp = require('node-xmpp-client');
var bind = require('underscore').bind;

var Bot;

module.exports.Bot = (function() {
  // ##Private functions

  // Whenever an XMPP stream error occurs, this function is responsible for
  // triggering the `error` event with the details and disconnecting the bot
  // from the server.
  //
  // Stream errors (http://xmpp.org/rfcs/rfc6120.html#streams-error) look like:
  // <stream:error>
  //   <system-shutdown xmlns='urn:ietf:params:xml:ns:xmpp-streams'/>
  // </stream:error>
  var onStreamError = function(error) {
    if (error instanceof xmpp.Element) {
      var condition = error.children[0].name;
      var text = error.getChildText('text');
      if (!text) {
        text = "No error text sent by HipChat, see "
               + "http://xmpp.org/rfcs/rfc6120.html#streams-error-conditions"
               + " for error condition descriptions.";
      }

      this.emit('error', condition, text, error);
    } else {
      this.emit('error', null, null, error);
    }
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
  // triggering the `connect` event and starting the 30s anti-idle. It will
  // also set the availability of the bot to `chat`.
  var onOnline = function() {
    var self = this;
    this.setAvailability('chat');

    this.keepalive = setInterval(function() {
      self.jabber.send(new xmpp.Message({}));
      self.emit('ping');
    }, 30000);

    // load our profile to get name
    this.getProfile(function(err, data) {
      if (err) {
        // This isn't technically a stream error which is what the `error`
        // event usually represents, but we want to treat a profile fetch
        // error as a fatal error and disconnect the bot.
        self.emit('error', null, 'Unable to get profile info: ' + err, null);
        return;
      }

      // now that we have our name we can let rooms be joined
      self.name = data.fn;

      // this is the name used to @mention us
      self.mention_name = data.nickname;

      self.emit('connect');
    });
  };

  // This function is responsible for handling incoming XMPP messages. The
  // `data` event will be triggered with the message for custom XMPP
  // handling.
  //
  // The bot will parse the message and trigger the `message`
  // event when it is a group chat message or the `privateMessage` event when
  // it is a private message.
  var onStanza = function(stanza) {
    this.emit('data', stanza);

    if (stanza.is('message') && stanza.attrs.type === 'groupchat') {
      var body = stanza.getChildText('body');
      if (!body) return;

      // Ignore chat history
      if (stanza.getChild('delay')) return;

      var fromJid = new xmpp.JID(stanza.attrs.from);
      var fromChannel = fromJid.bare().toString();
      var fromNick = fromJid.resource;

      // Ignore our own messages
      if (fromNick === this.name) return;

      this.emit('message', fromChannel, fromNick, body);
    } else if (stanza.is('message') && stanza.attrs.type === 'chat') {
      // Message without body is probably a typing notification
      var body = stanza.getChildText('body');
      if (!body) return;

      var fromJid = new xmpp.JID(stanza.attrs.from);

      this.emit('privateMessage', fromJid.bare().toString(), body);
    } else if (stanza.is('message') && !stanza.attrs.type) {
      // TODO: It'd be great if we could have some sort of xpath-based listener
      // so we could just watch for '/message/x/invite' stanzas instead of
      // doing all this manual getChild nonsense.
      var x = stanza.getChild('x', 'http://jabber.org/protocol/muc#user');
      if (!x) return;
      var invite = x.getChild('invite');
      if (!invite) return;
      var reason = invite.getChildText('reason');

      var inviteRoom = new xmpp.JID(stanza.attrs.from);
      var inviteSender = new xmpp.JID(invite.attrs.from);

      this.emit('invite', inviteRoom.bare(), inviteSender.bare(), reason);
    } else if (stanza.is('iq')) {
      // Handle a response to an IQ request
      var event_id = 'iq:' + stanza.attrs.id;
      if (stanza.attrs.type === 'result') {
        this.emit(event_id, null, stanza);
      } else {
        // IQ error response
        // ex: http://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-result
        var condition = 'unknown';
        var error_elem = stanza.getChild('error');
        if (error_elem) {
          condition = error_elem.children[0].name;
        }
        this.emit(event_id, condition, stanza);
      }
    }
  };

  // ##Public API

  // This is the `Bot` constructor.
  //
  // `options` object:
  //
  //   - `jid`: Bot's Jabber ID
  //   - `password`: Bot's HipChat password
  //   - `debug`: Set to `true` to show network debug in console
  //   - `host`: Force host to make XMPP connection to. Will look up DNS SRV
  //        record on JID's host otherwise.
  //   - `caps_ver`: Name and version of bot. Override if Wobot is being used
  //        to power another bot framework (e.g. Hubot).
  function Bot(options) {
    events.EventEmitter.call(this);
    this.once('connect', function() { }); // listener bug in Node 0.4.2
    this.setMaxListeners(0);

    this.jabber = null;
    this.keepalive = null;
    this.name = null;
    this.plugins = {};
    this.iq_count = 1; // current IQ id to use

    // add a JID resource if none was provided
    var jid = new xmpp.JID(options.jid);
    if (!jid.resource) {
      jid.resource = 'wobot';
    }

    options = options || {};
    this.jid = jid.toString();
    this.password = options.password;
    this.debug = options.debug;
    this.host = options.host;
    this.caps_ver = options.caps_ver || 'wobot:'+getWobotVersion();

    // Multi-User-Conference (rooms) service host. Use when directing stanzas
    // to the MUC service.
    this.mucHost = this.host ? "conf." + this.host : "conf.hipchat.com";

    var self = this;
    this.on('error', function(error) {
      self.disconnect();
    });
  };

  util.inherits(Bot, events.EventEmitter);

  // Connects the bot to HipChat and sets the XMPP event listeners. This
  // function will also enable network debugging when `options.debug` is set to
  // `true`.
  Bot.prototype.connect = function() {
    this.jabber = new xmpp.Client({
      jid: this.jid,
      password: this.password,
      host: this.host
    });

    if (this.debug === true) {
      enableDebug.call(this);
    }

    this.jabber.on('error', bind(onStreamError, this));
    this.jabber.on('online', bind(onOnline, this));
    this.jabber.on('stanza', bind(onStanza, this));
  };

  // Fetches our profile info
  //
  // - `callback`: Function to be triggered: `function (err, data, stanza)`
  //   - `err`: Error condition (string) if any
  //   - `data`: Object containing fields returned (fn, title, photo, etc)
  //   - `stanza`: Full response stanza, an `xmpp.Element`
  Bot.prototype.getProfile = function(callback) {
    var stanza = new xmpp.Element('iq', { type: 'get' })
                 .c('vCard', { xmlns: 'vcard-temp' });
    this.sendIq(stanza, function(err, response) {
      var data = {};
      if (!err) {
        var fields = response.getChild('vCard').children;
        fields.forEach(function(field) {
          data[field.name.toLowerCase()] = field.getText();
        });
      }
      callback(err, data, response);
    });
  };

  // Fetches the rooms available to the bot user. This is equivalent to what
  // would show up in the HipChat lobby.
  //
  // - `callback`: Function to be triggered: `function (err, items, stanza)`
  //   - `err`: Error condition (string) if any
  //   - `rooms`: Array of objects containing room data
  //   - `stanza`: Full response stanza, an `xmpp.Element`
  Bot.prototype.getRooms = function(callback) {
    var iq = new xmpp.Element('iq', { to: this.mucHost, type: 'get' })
             .c('query', { xmlns: 'http://jabber.org/protocol/disco#items' });
    this.sendIq(iq, function(err, stanza) {
      var rooms = [];
      if (!err) {
        // parse response into objects
        stanza.getChild('query').getChildren('item').map(function(el) {
          var x = el.getChild('x', 'http://hipchat.com/protocol/muc#room');
          rooms.push({
            jid: el.attrs.jid,
            name: el.attrs.name,
            id: parseInt(x.getChild('id').getText()),
            topic: x.getChild('topic').getText(),
            privacy: x.getChild('privacy').getText(),
            owner: x.getChild('owner').getText(),
            num_participants:
              parseInt(x.getChild('num_participants').getText()),
            guest_url: x.getChild('guest_url').getText(),
            is_archived: x.getChild('is_archived') ? true : false
          });
        });
      }
      callback(err, rooms, stanza);
    });
  };

  // Fetches the roster (buddy list)
  //
  // - `callback`: Function to be triggered: `function (err, items, stanza)`
  //   - `err`: Error condition (string) if any
  //   - `items`: Array of objects containing user data
  //   - `stanza`: Full response stanza, an `xmpp.Element`
  Bot.prototype.getRoster = function(callback) {
    var iq = new xmpp.Element('iq', { type: 'get' })
             .c('query', { xmlns: 'jabber:iq:roster' });
    this.sendIq(iq, function(err, stanza) {
      var rosterItems = [];
      if (!err) {
        // parse response into objects
        stanza.getChild('query').getChildren('item').map(function(el) {
          rosterItems.push({
            jid: el.attrs.jid,
            name: el.attrs.name,
            // name used to @mention this user
            mention_name: el.attrs.mention_name,
          });
        });
      }
      callback(err, rosterItems, stanza);
    });
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
  // - `historyStanzas`: Max number of history entries to request
  Bot.prototype.join = function(roomJid, historyStanzas) {
    if (!historyStanzas) {
      historyStanzas = 0;
    }
    var packet = new xmpp.Element('presence', { to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' })
          .c('history', {
            xmlns: 'http://jabber.org/protocol/muc',
            maxstanzas: String(historyStanzas)
          });
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
    var parsedJid = new xmpp.JID(targetJid);

    if (parsedJid.domain === this.mucHost) {
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

  // Sends an IQ stanza and stores a callback to be called when its response
  // is received.
  //
  // - `stanza`: `xmpp.Element` to send
  // - `callback`: Function to be triggered: `function (err, stanza)`
  //   - `err`: Error condition (string) if any
  //   - `stanza`: Full response stanza, an `xmpp.Element`
  Bot.prototype.sendIq = function(stanza, callback) {
    stanza = stanza.root(); // work with base element
    var id = this.iq_count++;
    stanza.attrs.id = id;
    this.once('iq:' + id, callback);
    this.jabber.send(stanza);
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

  // Emitted whenever the bot is invited to a room.
  //
  // `onInvite(callback)`
  //
  // - `callback`: Function to be triggered:
  //               `function (roomJid, fromJid, reason, matches)`
  //   - `roomJid`: JID of the room being invited to.
  //   - `fromJid`: JID of the person who sent the invite.
  //   - `reason`: Reason for invite (text)
  Bot.prototype.onInvite = function(callback) {
    this.on('invite', callback);
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

  // Emitted whenever an XMPP stream error occurs. The `disconnect` event will
  // always be emitted afterwards.
  //
  // Conditions are defined in the XMPP spec:
  //   http://xmpp.org/rfcs/rfc6120.html#streams-error-conditions
  //
  // - `callback`: Function to be triggered: `function(condition, text, stanza)`
  //   - `condition`: XMPP stream error condition (string)
  //   - `text`: Human-readable error message (string)
  //   - `stanza`: The raw `xmpp.Element` error stanza
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
