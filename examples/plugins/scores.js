//Plugin prints scores for teams for a league.
//Not Found otherwise.
var http = require('http');

module.exports.load = function(bot) {
  //var rgx = new RegExp('\!scores\s[a|MLB|MLS|COL\\sFB|NFL|NBA]', 'g');
  //bot.onMessage(rgx, onMessage);
  bot.onMessage(/^\!scores\s*$/, onMessageHelp);
  bot.onPrivateMessage(/^\!scores\s*$/, onMessageHelp);

  bot.onMessage(/^\!scores\s+(NBA)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(NFL)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(COL FB)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(MLS)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(MLB)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(EPL)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(NHL)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(IQA)\s*$/, onMessage);
  bot.onMessage(/^\!scores\s+(NLL)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(NBA)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(NFL)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(COL FB)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(MLS)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(MLB)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(EPL)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(NHL)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(IQA)\s*$/, onMessage);
  bot.onPrivateMessage(/^\!scores\s+(NLL)\s*$/, onMessage);
};

var exec = require('child_process').exec;

var onMessageHelp = function(channel, from, message, matches) {
    var response = 'Try one of [NBA, NFL, COL FB, MLS, MLB, EPL, NHL, IQA, NLL] (case sensitive) Eg. !scores COL FB';
    var self = this;
    if(matches)
        self.message(channel, '@' + from.split(' ')[0] + ' ' + response);
    else
        self.message(channel, response);
};

var onMessage = function(channel, from, message, matches) {
  var self = this;
  var  tmp = null;
  if (matches) {
    tmp = matches[1];
  } else {
    tmp = message[1];
  }
  console.log('tmp is ' + tmp);
  var cmd = 'plugins/scoreparser.py ' + tmp;
  exec(cmd, [], function(error, data, stderr) {
    self.message(channel, data);
  });
  return true;
};
