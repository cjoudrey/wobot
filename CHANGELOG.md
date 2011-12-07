0.4.0 / 2011-12-06
==================

  * Added `Bot.getRoster` to obtain the bot's buddy list. (Pull Req. #15 by Garret Heaton)
  * Added `Bot.sendIq` to send an IQ stanza. (Pull Req. #15 by Garret Heaton)
  * XMPP `host` can now be explicitly set in `wobot.Bot`. (Pull Req. #14 by Garret Heaton)

0.3.1 / 2011-11-09
==================

  * Updated `package.json` for Node 0.6.0 support.

0.3.0 / 2011-05-29
==================

  * New events API with RegExp support.
  * `Bot.pm` has been replaced with `Bot.message`.
  * `Bot.unloadPlugin` has been removed.
  * Updated `node-xmpp` to 0.2.7 for Node 0.4.8 support.

0.2.0 / 2011-05-15
==================

  * Added a new `error` event to capture XMPP errors
  * XMPP errors now trigger the `disconnect` event
  * `message` event will no longer be triggered when message is from self
  * Removed keepalive interval on disconnect

0.1.0 / 2011-05-09
==================

  * Passing reference to bot in plugin onload
  * Delayed messages will now be ignored

0.0.1 / 2011-05-05
==================

  * Initial release
