var Bot = require('../lib/').Bot;
var http = require('http');

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

var b = new Bot({
  debug: true,
  jid: '?_?@chat.hipchat.com/bot',
  password: '',
  name: '???? ????'
});

b.loadPlugin('restapi', require('./plugins/restapi'), { port: 9999 });

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
  var self = this;
  var matches = message.match(/\!weather ([0-9]+)/i);
  if (matches) {
    var options = {
      host: 'query.yahooapis.com',
      port: 80,
      path: '/v1/public/yql/jonathan/weather?format=json&zip=' + matches[1]
    };

    http.get(options, function(res) {
      var data = '';
      res.on('data', function(chunk) {
        data += chunk;
      });
      res.on('end', function(chunk) {
        data = JSON.parse(data);
        var item = data.query.results.channel.item;
        if (!item.condition) {
          response = item.title;
        } else {
          response = item.title+': '+item.condition.temp+' degrees and '+item.condition.text;
        }
        self.message(channel, '@' + from.split(' ')[0] + ' ' + response);
        self.part(channel);
      });
    });
  };
});

b.on('pm', function(jid, message) {
  this.pm(jid, 'You just said: ' + message);
});
