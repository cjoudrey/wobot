var util = require('util');
var events = require('events');
var xmpp = require('node-xmpp');
var bind = require('underscore').bind;

var Bot;

module.exports.Bot = (function() {
  function Bot(configs) {
    events.EventEmitter.call(this);
    this.once('connect', function() {}); // listener bug
    this.setMaxListeners(0);

    this.jabber = null;
    this.keepalive = null;

    this.plugins = {};

    configs = configs || {};

    this.jid = configs.jid;
    this.password = configs.password;
    this.debug = configs.debug;
    this.name = configs.name;
  };

  util.inherits(Bot, events.EventEmitter);

  Bot.prototype.connect = function() {
    var self = this;

    this.jabber = new xmpp.Client({
      jid: this.jid,
      password: this.password
    });

    if (this.debug === true) {
      this.jabber.on('data', function(buffer) {
        console.log('  IN > ' + buffer.toString());
      });

      var origSend = this.jabber.send;
      this.jabber.send = function(stanza) {
        console.log(' OUT > ' + stanza);
        return origSend.call(self.jabber, stanza);
      };
    }

    this.jabber.on('error', function() {
      console.log('uhoh');
      console.dir(arguments);
    });

    this.jabber.on('online', function() {
      // Send online presence
      self.setAvailability('chat');

      // Serve will disconnect us after 150s of inactivity
      setInterval(function() {
        self.jabber.send(' ');
        self.emit('pong');
      }, 30000);

      self.emit('connect');
    });

    this.jabber.on('stanza', bind(this._onStanza, this));
  };

  Bot.prototype._onStanza = function(stanza) {
    this.emit('data', stanza);

    if (stanza.is('message') && stanza.attrs.type == 'groupchat') {
      var body = stanza.getChild('body');
      if (!body) return;

      if (stanza.getChild('delay')) return;

      var attrFrom = stanza.attrs.from;
      var offset = attrFrom.indexOf('/');

      var channel = attrFrom.substring(0, offset);
      var from = attrFrom.substring(offset + 1);

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

  Bot.prototype.setAvailability = function(availability, status) {
    var packet = new xmpp.Element('presence', { type: 'available' });
    packet.c('show').t(availability);

    if (status) {
      packet.c('status').t(status);
    }

    this.jabber.send(packet);
  };

  Bot.prototype.join = function(roomJid) {
    var packet = new xmpp.Element('presence', { to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    this.jabber.send(packet);
  };

  Bot.prototype.part = function(roomJid) {
    var packet = new xmpp.Element('presence', { type: 'unavailable', to: roomJid + '/' + this.name });
    packet.c('x', { xmlns: 'http://jabber.org/protocol/muc' });
    packet.c('status').t('hc-leave');
    this.jabber.send(packet);
  };

  Bot.prototype.message = function(roomJid, message) {
    var packet = new xmpp.Element('message', {
      to: roomJid + '/' + this.name,
      type: 'groupchat'
    });
    packet.c('body').t(message);
    this.jabber.send(packet);
  };

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

  Bot.prototype.disconnect = function() {
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
      this.plugins[identifier].unload();
    }

    delete this.plugins[identifier];

    return true;
  };

  return Bot;
}());
