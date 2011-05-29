// This is a sample plugin that will display
// a random Chuck Norris joke every time someone
// types !chuck in a channel.

var http = require('http');
var bind = require('underscore').bind;

module.exports.load = function(bot) {
  bot.onMessage('!chuck', onMessage);
};

var onMessage = function(channel, from, message) {
  var self = this;

  var options = {
    host: 'api.icndb.com',
    port: 80,
    path: '/jokes/random'
  };

  http.get(options, function(res) {
    var data = '';
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function(chunk) {
      data = JSON.parse(data);
      self.message(channel, '@' + from.split(' ')[0] + ' ' + data.value.joke);
    });
  });

  return true;
};
