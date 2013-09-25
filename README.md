Node.js redis dump library
==========

Backup and restore your Redis data written on node.js

## Installation

```
  $ git clone git@github.com:EvilDevRu/node-redis-dump.git
```

## Quick Start
```js
var RedisDump = require('./index.js'),
    dump = new RedisDump({
        host: 'localhost',
        port: 6379,
        password: ''
    });

    dump.connect();
    dump.export({
        type: 'redis',
        //isCompress: false, (not working now)
        callback: function(err, data) {
            if (err) {
                console.log('Could\'t not make redis dump!', err);
                return;
            }

            console.log('--------- REDIS DUMP ----------');
            console.log(data);
            console.log('--------- /REDIS DUMP ----------');
    }
});
```