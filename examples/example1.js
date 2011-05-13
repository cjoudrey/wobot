var Bot = require('../lib/').Bot;
var http = require('http');

var b = new Bot({
  debug: true,
  jid: '?_?@chat.hipchat.com/bot',
  password: '',
  name: '???? ????'
});

b.loadPlugin('chuckjokes', require('./plugins/chuckjokes'));
b.loadPlugin('weather', require('./plugins/weather'));
b.connect();

b.on('connect', function() {
  console.log(' -=- > Connect');
  this.join('????_????@conf.hipchat.com');
});

b.on('pong', function() {
  console.log(' -=- > Ping? Pong!');
});

b.on('disconnect', function() {
  console.log(' -=- > Disconnect');
});

b.on('message', function(channel, from, message) {
  console.log(' -=- > ' + from + '@' + channel + ' said: ' + message);
});

b.on('pm', function(jid, message) {
  console.log(' -=- > ' + jid + ' pm\'d: ' + message);
});

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
