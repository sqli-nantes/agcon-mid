var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');

// Connection URL
var mongoURL = 'mongodb://ec2-52-71-79-154.compute-1.amazonaws.com:27017/agcon';
var db;
// Use connect method to connect to the Server
MongoClient.connect(mongoURL, function(err, database) {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  if(err) throw err;
  db = database;
});

//mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
//var brokerURL = 'mqtt://localhost:1883';
//var brokerURL = 'broker.hivemq.com:1883';
//var brokerURL ='mqtt://test.mosquitto.org:1883';
var brokerHost  ='test.mosquitto.org';
var brokerPort  ='1883';
var channelName = 'decibelometre';
var channelNameAlert = 'alert';
var mqtt = require('mqtt'), url = require('url');

// APPROACH 1: Using environment variables created by Docker
//      process.env.APOLLO_PORT_61613_TCP_PORT,
//      process.env.APOLLO_PORT_61613_TCP_ADDR
// APPROACH 2: Using host entries created by Docker in /etc/hosts (RECOMMENDED) --> apollo
// Parse
var url = "mqtt://" + (process.env.APOLLO_PORT_61613_TCP_ADDR || brokerHost);

var options = {
  port: (process.env.APOLLO_PORT_61613_TCP_PORT || brokerPort) ,
  clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
  username: 'admin',
  password: 'password',
  connectTimeout: 240
};

console.log("mqtt.connect url " + url + " options ", options);

// Create a client connection
var client = mqtt.connect(url, options);
client.on('error', function(error) { // Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs.
    console.error("Mqtt client cannot connect",error);
});
client.on('connect', function() { // When connected
  // subscribe to a topic
  client.subscribe(channelName+'/#', function() {
    // when a message arrives, do something with it
    client.on('message', function(topic, message, packet) {
      console.log("Received '" + message + "' on '" + topic + "'");
        var messageArray = JSON.parse(message);
        console.log("Received array",messageArray);
        //message
        var measure = {sensor:channelName,timestamp:messageArray[1],value:messageArray[0]};
        insertMeasures(db,measure, function() {
        //    db.close();
        });
        //Envoyer u  message mqqqt si le seuil dépasse 80
        if(measure.value > 80){
          // publish a message to a topic
          client.publish(channelNameAlert, JSON.stringify(measure), function() {
            console.log("Alert is published");
            //  client.end(); // Close the connection when published
          });
        }
    });
  });

});

var insertMeasures = function(db,measure, callback) {
  // Get the documents collection
  var collection = db.collection('measures');
  // Insert some documents
  collection.insert(measure, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    assert.equal(1, result.ops.length);
    console.log("Inserted 1 measure into the measures collection");
    callback(result);
  });
}

var deployd = require('deployd')
  , options = {port: 3000,db:{'connectionString':mongoURL},'env':(process.env.DEPLOYD_ENV || 'development')};

    console.log("start deploy in " + process.env.DEPLOYD_ENV);

//  db.connectionString {String} - The URI of the mongoDB using standard Connection String. If db.connectionString is set, the other db options are ignored.
//  db.port {Number} - the port of the database server
//  db.host {String} - the ip or domain of the database server
//  db.name {String} - the name of the database
//  db.credentials {Object} - credentials for db
//  db.credentials.username {String}
//  db.credentials.password {String}

var dpd = deployd(options);
////Voir sur host:30000/dashboard en mode development
dpd.listen();
