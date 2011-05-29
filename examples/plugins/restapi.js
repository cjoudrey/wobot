var http = require('http');
var qs = require('querystring');
var server;

module.exports.load = function(bot, options) {
  options = options || {};
  options.port = options.port || 8080;
  options.hostname = options.hostname || '127.0.0.1';

  server = http.createServer(function(req, res) {
    var action = req.url.substring(1);

    var httpErr = function(statusCode) {
      res.statusCode = statusCode;
      res.end();
    };

    if (req.method !== 'POST') return httpErr(405);

    var data = '';

    req.on('data', function(chunk) {
      data += chunk;
    });

    req.on('end', function() {
      data = qs.parse(data);

      switch(action) {
        default:
          return httpErr(404);
          break;

        case 'connect':
          bot.connect();
          res.end();
          break;

        case 'disconnect':
          bot.disconnect();
          res.end();
          break;

        case 'join':
          if (!data.roomJid) return httpErr(400);
          bot.join(data.roomJid);
          res.end();
          break;

        case 'part':
          if (!data.roomJid) return httpErr(400);
          bot.part(data.roomJid);
          res.end();

        case 'message':
          if (!data.message || !data.targetJid) return httpErr(400);
          bot.message(data.targetJid, data.message);
          res.end();
          break;
      }
    });
  }).listen(options.port, options.hostname);
};

module.exports.unload = function() {
  server.close();
};
