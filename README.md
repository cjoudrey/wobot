# wobot

A plugin-based HipChat bot written in Node.js.

# Installation

The easiest way to obtain Wobot is through [npm](http://npmjs.org/):

    npm install wobot

Keep in mind this module depends on `node-xmpp` which cannot be built without:

 - libexpat1-dev: `apt-get install libexpat1-dev`
 - libicu-dev: `apt-get install libicu-dev`

# Your First Bot

Instantiate the `wobot.Bot` class by passing it a hash containing:

  - `jid`: Jabber ID followed by `/bot`
  - `password`: The account's password
  - `name`: The name of the bot as it appears in HipChat. This is usually `firstname + lastname[0]`.

```javascript
var wobot = require('wobot');

var bot = new wobot.Bot({
  jid: '????_????@chat.hipchat.com/bot',
  password: '??????',
  name: '???? ????'
});

bot.connect();
```

# Events

The `wobot.Bot` object extends Node's [EventEmitter](http://nodejs.org/docs/v0.4.7/api/all.html#events.EventEmitter).

The following events are emitted:

**connect()**
Emitted whenever the bot connects to the server.

**message(channel, from, message)**
Emitted whenever a message is sent to a channel the bot is in.

**pm(from, message)**
Emitted whenever a message is sent privately to the bot.

**pong()**
Emitted everytime the bot pings the server (roughly every 30 seconds.)

**disconnect()**
Emitted whenever the bot disconnects from the server.

# Public API

Instances of `wobot.Bot` have the following methods:

**join(roomJid)**
Join a channel.
 - `roomJid` is in the following format: `????_????@conf.hipchat.com`.

**part(roomJid)**
Part a channel.

**message(roomJid, message)**
Send a public message to the channel.

**pm(jid, message)**
Send a private message to a user.
 - `jid` is in the following format: `????_????@chat.hipchat.com`.

**connect()**
Connect to the server.

**disconnect()**
Disconnect from the server.

**loadPlugin(identifier, plugin, options)**
Load a plugin.
 - `identifier`: A unique string that identifies the plugin. This will be used to unload it.
 - `plugin`: Plugin can either be an object or the path to the plugin.
 - `options`: Will be passed as the second argument to `load`.

**unloadPlugin(identifier)**
Unload a plugin.
This essentially calls the `unload` function of the plugin.

# Legal stuff

Copyright (c) 2011 Christian Joudrey. See LICENSE for details.

Node.js is an official trademark of Joyent. This module is not formally related to or endorsed by the official Joyent Node.js open source or commercial project.
