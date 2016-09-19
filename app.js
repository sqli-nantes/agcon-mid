var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');


var amqp = require('amqplib/callback_api');
var amqpConn = null;

// Connection URL
var mongoURL = 'mongodb://#.#.#.#:27017/agcon';
//mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
var brokerURL = 'amqp://#.#.#.#:5672';
var channelName = 'hello';

function start() {
  amqp.connect(brokerURL, function(err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(start, 1000);
    }
    conn.on("error", function(err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function() {
      console.error("[AMQP] reconnecting");
      return setTimeout(start, 1000);
    });
    console.log("[AMQP] connected");
    amqpConn = conn;

    //When connected
    startWorker();
    //startPublisher();
  });
}


// A worker that acks messages only if processed successfully
function startWorker() {
  amqpConn.createChannel(function(err, ch) {
    if (closeOnErr(err)) return;
    ch.on("error", function(err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function() {
      console.log("[AMQP] channel closed");
    });

    ch.prefetch(10);
  //  ch.assertQueue(channelName, { durable: true }, function(err, _ok) {
  //    if (closeOnErr(err)) return;
      ch.consume(channelName, processMsg, { noAck: false });
      console.log("Worker is started");
  //  });

    function processMsg(msg) {
      work(msg, function(ok) {
        try {
          if (ok)
            ch.ack(msg);
          else
            ch.reject(msg, true);
        } catch (e) {
          closeOnErr(e);
        }
      });
    }
    function work(msg, cb) {
        console.log("Message à traiter ", msg.content.toString());

        cb(true);
      }
  });
}


// Use connect method to connect to the Server
MongoClient.connect(mongoURL, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  //insertDocuments(db, function() {
  //  db.close();
  //});
});

var insertDocuments = function(db, callback) {
  // Get the documents collection
  var collection = db.collection('documents');
  // Insert some documents
  collection.insertMany([
    {a : 1}, {a : 2}, {a : 3}
  ], function(err, result) {
    assert.equal(err, null);
    assert.equal(3, result.result.n);
    assert.equal(3, result.ops.length);
    console.log("Inserted 3 documents into the document collection");
    callback(result);
  });
}

var deployd = require('deployd')
  , options = {port: 3000,db:{'connectionString':mongoURL},'env':'development'};

//  db.connectionString {String} - The URI of the mongoDB using standard Connection String. If db.connectionString is set, the other db options are ignored.
//  db.port {Number} - the port of the database server
//  db.host {String} - the ip or domain of the database server
//  db.name {String} - the name of the database
//  db.credentials {Object} - credentials for db
//  db.credentials.username {String}
//  db.credentials.password {String}

var dpd = deployd(options);
dpd.listen();
//Voir sur host:30000/dashboard en mode development


//##############################PARTIE PUBLICATION####
var pubChannel = null;
var offlinePubQueue = [];
function startPublisher() {
  amqpConn.createConfirmChannel(function(err, ch) {
    if (closeOnErr(err)) return;
      ch.on("error", function(err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function() {
      console.log("[AMQP] channel closed");
    });

    pubChannel = ch;
    while (true) {
      var m = offlinePubQueue.shift();
      if (!m) break;
      publish(m[0], m[1], m[2]);
    }
  });
}
function publish(exchange, routingKey, content) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
                      function(err, ok) {
                        if (err) {
                          console.error("[AMQP] publish", err);
                          offlinePubQueue.push([exchange, routingKey, content]);
                          pubChannel.connection.close();
                        }
                      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
  }
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

start();

//setInterval(function() {
//  publish("", channelName, new Buffer("work work work"));
//}, 10000);
