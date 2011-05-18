var util = require('util');
var events = require('events');
var xmpp = require('node-xmpp');
var bind = require('underscore').bind;

var Bot;

module.exports.Bot = (function() {
  function Bot(options) {
    events.EventEmitter.call(this);
    this.once('connect', function() {}); // listener bug
    this.setMaxListeners(0);

    this.jabber = null;
    this.keepalive = null;

    this.plugins = {};

    options = options || {};

    this.jid = options.jid;
    this.password = options.password;
    this.debug = options.debug;
    this.name = options.name;
  };

  util.inherits(Bot, events.EventEmitter);

  // Called whenever an XMPP error occurs
  var onError = function(error) {
    if (error instanceof xmpp.Element) {
      var errorMessage = 'Unknown error';

      // Check of see-other-host error
      if (error.getChild('see-other-host')) {
        errorMessage = 'This account is signing in somewhere else. Maybe HipChat web version?';
      } else {
        // Handle XMPP text errors (when available)
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

  // Called when debug is enabled
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

  // Called whenever XMPP connection is made
  var onOnline = function() {
    var self = this;

    // Send online presence
    self.setAvailability('chat');

    // Server will disconnect us after 150s of inactivity
    self.keepalive = setInterval(function() {
      self.jabber.send(' ');
      self.emit('pong');
    }, 30000);

    self.emit('connect');
  };

  // Called whenever there is an incoming XMPP stanza
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

      // Do not trigger when message is from self.
      if (from == this.name) return;

      this.emit('message', channel, from, body.getText());
    } else if (stanza.is('message') && stanza.attrs.type == 'chat') {
      var body = stanza.getChild('body');
      if (!body) return;

      var attrFrom = stanza.attrs.from;
      var offset = attrFrom.indexOf('/');

      var jid = attrFrom.substring(0, offset);

      this.emit('pm', jid, body.getText());
    }
  };

  // Public API

  // `connect()`
  // Connects to HipChat.
  Bot.prototype.connect = function() {
    // Create XMPP connection.
    this.jabber = new xmpp.Client({
      jid: this.jid,
      password: this.password
    });

    // If `options.debug` is set to `true`, all incoming
    // and outgoing XMPP packets will be printed to the console.
    if (this.debug === true) {
      enableDebug.call(this);
    }

    // Bind to XMPP events.
    this.jabber.on('error', bind(onError, this));
    this.jabber.on('online', bind(onOnline, this));
    this.jabber.on('stanza', bind(onStanza, this));
  };

  // `setAvailability(availability, status)`
  // Update availability status.
  // - `availability`: Jabber availability codes
  //    - `away`
  //    - `chat` (Free for chat)
  //    - `dnd` (Do not disturb)
  // - `status`: Status message to display
  Bot.prototype.setAvailability = function(availability, status) {
    var packet = new xmpp.Element('presence', { type: 'available' });
    packet.c('show').t(availability);

    if (status) {
      packet.c('status').t(status);
    }

    this.jabber.send(packet);
  };

  // `join(roomJid)`
  // Join the specified room.
  // - `roomJid`: Target room, in the form of `????_????@conf.hipchat.com`
  Bot.prototype.join = function(roomJid) {
    var packet = new xmpp.Element('presence', { to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    this.jabber.send(packet);
  };

  // `part(roomJid)`
  // Part the specified room.
  // - `roomJid`: Target room, in the form of `????_????@conf.hipchat.com`
  Bot.prototype.part = function(roomJid) {
    var packet = new xmpp.Element('presence', { type: 'unavailable', to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    packet.c('status').t('hc-leave');
    this.jabber.send(packet);
  };

  // `message(roomJid, message)`
  // Send a message to the given room.
  // - `roomJid`: Target room, in the form of `????_????@conf.hipchat.com`
  // - `message`: Message to be sent to the room
  Bot.prototype.message = function(roomJid, message) {
    var packet = new xmpp.Element('message', {
      to: roomJid + '/' + this.name,
      type: 'groupchat'
    });
    packet.c('body').t(message);
    this.jabber.send(packet);
  };

  // `pm(jid, message)`
  // Send a private message to a user.
  // - `jid`: Target user, in the form of `????_????@chat.hipchat.com`
  // - `message`: Message to be sent to the user
  Bot.prototype.pm = function(jid, message) {
    var packet = new xmpp.Element('message', {
      to: jid,
      type: 'chat',
      from: this.jid
    });
    packet.c('body').t(message);
    packet.c('inactive', { xmlns: 'http://jabber/protocol/chatstates' });
    this.jabber.send(packet);
  };

  // `disconnect()`
  // Disconnect the bot from HipChat.
  Bot.prototype.disconnect = function() {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = null;
    }
    this.jabber.end();
    this.emit('disconnect');
  };

  Bot.prototype.loadPlugin = function(identifier, plugin, options) {
    if (typeof(this.plugins[identifier]) !== 'undefined') {
      return false;
    }

    if (typeof(plugin) !== 'object') {
      plugin = require(plugin);
    }

    this.plugins[identifier] = plugin;
    this.plugins[identifier].load(this, options);

    return true;
  };

  Bot.prototype.unloadPlugin = function(identifier) {
    if (typeof(this.plugins[identifier]) === 'undefined') {
      return false;
    }

    if (typeof(this.plugins[identifier].unload) === 'function') {
      this.plugins[identifier].unload(this);
    }

    delete this.plugins[identifier];

    return true;
  };

  return Bot;
}());
