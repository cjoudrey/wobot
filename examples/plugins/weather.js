// This is a sample plugin that will display
// the temperature for a given zip code when
// someone types !weather ZIPCODE in a channel.

var http = require('http');

module.exports.load = function(bot) {
  bot.onMessage(/^\!weather ([0-9]+)$/i, onMessage);
};

var onMessage = function(channel, from, message, matches) {
  var self = this;

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
        response = item.title + ': ' + item.condition.temp + ' degrees and ' + item.condition.text;
      }
      self.message(channel, '@' + from.split(' ')[0] + ' ' + response);
    });
  });

  return true;
};
