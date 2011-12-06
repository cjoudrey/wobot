var Bot = require('../lib/').Bot;
var http = require('http');
var xmpp = require('node-xmpp');

var b = new Bot({
  debug: true,
  jid: '?_?@chat.hipchat.com/bot',
  password: '',
  name: '???? ????'
});

b.loadPlugin('chuckjokes', require('./plugins/chuckjokes'));
b.loadPlugin('weather', require('./plugins/weather'));
b.connect();

b.onConnect(function() {
  console.log(' -=- > Connect');
  this.join('????_????@conf.hipchat.com');

  // fetch and print roster contacts (buddy list) as an IQ get/response example
  this.getRoster(function(result) {
    result.getChild('query').getChildren('item').map(function(el) {
      console.log('Contact: '+el.attrs.name+' ('+ el.attrs.jid + ')');
    });
  });
});

b.onPing(function() {
  console.log(' -=- > Ping? Pong!');
});

b.onDisconnect(function() {
  console.log(' -=- > Disconnect');
});

b.onError(function(error, stanza) {
  console.log(' -=- > Error: ' + error);
});

b.onMessage(function(channel, from, message) {
  console.log(' -=- > ' + from + '@' + channel + ' said: ' + message);
});

b.onPrivateMessage(function(jid, message) {
  console.log(' -=- > ' + jid + ' pm\'d: ' + message);
});

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
