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

The following events can be binded to:

## onConnect(callback)
Emitted whenever the bot connects to the server.

## onMessage(condition, callback)
Emitted whenever a message is sent to a channel the bot is in.

 - `condition` is either a RegExp or a string which must match the message for the callback to be triggered.
 - `callback` in the form of `function(channel, from, message[, matches])`.

`condition` can also be omitted i.e. `onMessage(callback)`.

## onPrivateMessage(condition, callback)
Emitted whenever a message is sent privately to the bot.

 - `condition` is either a RegExp or a string which must match the message for the callback to be triggered.
 - `callback` in the form of `function(from, message[, matches])`.

`condition` can also be omitted i.e. `onPrivateMessage(callback)`.

## onPing(callback)
Emitted everytime the bot pings the server (roughly every 30 seconds.)

## onError(callback)
Emitted whenever an error occurs. `disconnect` will be emitted afterwards.

 - `callback` in the form of `function(message[, stanza])`
   - `message` is a string representation of the error.
   - `stanza` is an instance of `xmpp.Element`, when available.

## disconnect(callback)
Emitted whenever the bot disconnects from the server.

# Public API

Instances of `wobot.Bot` have the following methods:

## join(roomJid)
Join a channel.

 - `roomJid` is in the following format: `????_????@conf.hipchat.com`.

## part(roomJid)
Part a channel.

## message(targetJid, message)
Send a message to either a channel or a user.

 - `targetJid` is in the following format:
   - `????_????@chat.hipchat.com` for a private message.
   - `????_????@conf.hipchat.com` for a channel message.

## connect()
Connect to the server.

## disconnect()
Disconnect from the server.

## loadPlugin(identifier, plugin, options)
Load a plugin.

 - `identifier`: A unique string that identifies the plugin. This will be used to unload it.
 - `plugin`: Object with a `load` function as so: `function load (bot)`.
 - `options`: Will be passed as the second argument to `load`.

# Legal stuff

Copyright (c) 2011 Christian Joudrey. See LICENSE for details.

Node.js is an official trademark of Joyent. This module is not formally related to or endorsed by the official Joyent Node.js open source or commercial project.
