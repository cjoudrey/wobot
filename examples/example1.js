var Bot = require('../lib/').Bot;

var b = new Bot({
  jid: '?_?@chat.hipchat.com/bot',
  password: ''
});

b.loadPlugin('chuckjokes', require('./plugins/chuckjokes'));
b.loadPlugin('weather', require('./plugins/weather'));
b.connect();

b.onConnect(function() {
  console.log(' -=- > Connect');
  this.join('????_????@conf.hipchat.com');

  // fetch and print roster contacts (buddy list)
  this.getRoster(function(err, items, stanza) {
    if (err) {
      console.log(' -=- > Error getting roster: ' + err);
      return;
    }
    items.forEach(function(item) {
      console.log(' -=- > Roster contact: ' + item.name);
    });
  });
});

b.onInvite(function(roomJid, fromJid, reason) {
  console.log(' -=- > Invite to ' + roomJid + ' by ' + fromJid + ': ' + reason);
  this.join(roomJid);
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
