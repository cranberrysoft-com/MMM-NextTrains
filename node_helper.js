// var request = require('request');
var NodeHelper = require("node_helper");
const sqlite3 = require('sqlite3').verbose();
var https = require('https');
const fs = require('fs');
var protobuf = require("protobufjs");

let db = new sqlite3.Database('./modules/NextTrains/trains.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err)
      console.error(err.message);
	 else
    	console.log('Connected to the NextTrain database.');
  });

module.exports = NodeHelper.create({

	config: {
		checkForGTFSUpdates: true,
		checkForRealTimeUpdates: true
	},

	maxTrains: 10,
	apikey: "",
	GTFSLastModified: null,
	realTimeLastModified: null,
	staticGTFSUpdateAvailable: false,
	realTimeUpdateAvailable: false,
	messages: null,
	buffer: [],
	GTFSRealTimeMessage: null,


	checkForUpdates: function()
	{
		if(this.config.checkForGTFSUpdates)
			this.isStaticGTFSUpdateAvailable();

		if(this.config.checkForRealTimeUpdates)
			this.isRealTimeUpdateAvailable();

	},

	isRealTimeUpdateAvailable: function() {
		const httpsoptions = {
			protocol: "https:",
			hostname: "api.transport.nsw.gov.au",
			path: "/v2/gtfs/realtime/sydneytrains",
			method: 'HEAD',
			headers: {"Authorization": "apikey " + this.apikey}
		}

		const req = https.request(httpsoptions, res => {
			if (res.statusCode == 200)
			{
				console.log(res.headers["last-modified"]);
				realTimeLastModified = new Date(res.headers["last-modified"]);

				if(!this.realTimeLastModified || realTimeLastModified > this.realTimeLastModified)  // If last modified is unpopulated, update is available
				{																					 // OR previous modification is before whats available
					this.realTimeLastModified = realTimeLastModified;
					this.realTimeUpdateAvailable = true;
				}
			}
			else
				this.realTimeUpdateAvailable = false;
		 });
	 	req.end();

		
	},
	
	start: function() {
		console.log("Starting node helper: " + this.name);
		this.apikey = this.getApiKey();

		
		let root = protobuf.loadSync("./modules/NextTrains/gtfs-realtime.proto");
		this.GTFSRealTimeMessage = root.lookupType("transit_realtime.FeedMessage");


		this.isStaticGTFSUpdateAvailable();
		this.getRealTimeUpdates();


		// setInterval(() => {
		// 	checkForUpdates();
		// }, 5000);
		

		setTimeout(() => {
			console.log(this.GTFSRealTimeMessage.decode(this.buffer));
			// console.log(Object.keys(message).toString());
			// console.log(message.entity[0]);

		}, 5000);
	},

	getApiKey: function()
	{
		let key = "";
		try {
			const data = fs.readFileSync('./modules/NextTrains/key', 'utf8');
			key = data;
		 } catch (err) {
			console.error(err);
		 }

		 return key;
	},

	getDay: function() {
		var date = new Date();
		let s = date.toLocaleString('en-US', {
				weekday: 'long'
			 });
		return s.toLowerCase();
	},
	
	socketNotificationReceived: function(notification, payload) {

		console.log("Notification: " + notification + " Payload: " + JSON.stringify(payload));
		
		if(notification === "GET_TRAINS") 
			this.getTrains(payload.context, this.getDay());
		
	},


	getTrains(context, day="monday")
	{
		context.maxTrains = Math.min(context.maxTrains, this.maxTrains);
		db.serialize(() => {
			
			db.all(`select 
							* 
						from 
							calendar c 
							join (
							select 
								* 
							from 
								trips t 
								join (
									select 
									* 
									from 
									stop_times st 
									JOIN (
										select 
											p.stop_name, 
											c.stop_name, 
											c.stop_id 
										from 
											stops p 
											join stops c on p.stop_id = c.parent_station 
										where 
											p.stop_name = "${context.station}"
									) target_stops on st.stop_id = target_stops.stop_id 
									where 
									st.departure_time >= "${context.departedAfter}"
								) st on t.trip_id = st.trip_id
							) t on c.service_id = t.service_id 
						where 
							c.${day} = 1 and c.start_date <= strftime('%Y%m%d', 'now') 
							AND strftime('%Y%m%d', 'now') < c.end_date 
						ORDER by 
							t.departure_time 
						LIMIT ${context.maxTrains}`, (err, trains) => {
			  if (err) {
				 console.error(err.message);
			  }
				console.log(trains);
				this.sendSocketNotification("ACTIVITY", {"id": context.id, "trains": trains}  );
			});

		 });
	},


	isStaticGTFSUpdateAvailable: function()
	{		
		const httpsoptions = {
			protocol: "https:",
			hostname: "api.transport.nsw.gov.au",
			path: "/v1/publictransport/timetables/complete/gtfs",
			method: 'HEAD',
			headers: {"Authorization": "apikey " + this.apikey}
		}

		const req = https.request(httpsoptions, res => {
			if (res.statusCode == 200)
			{
				console.log(res.headers["last-modified"]);
				GTFSLastModified = new Date(res.headers["last-modified"]);

				if(!this.GTFSLastModified || GTFSLastModified > this.GTFSLastModified)  // If last modified is unpopulated, update is available
				{																					 // OR previous modification is before whats available
					this.GTFSLastModified = GTFSLastModified;
					this.staticGTFSUpdateAvailable = true;
				}
			}
			else
				this.staticGTFSUpdateAvailable = false;
		 });
	 	req.end();
	},

	getRealTimeUpdates: function()
	{		
		const httpsoptions = {
			protocol: "https:",
			hostname: "api.transport.nsw.gov.au",
			path: "/v2/gtfs/realtime/sydneytrains",
			method: 'GET',
			headers: {"Authorization": "apikey " + this.apikey}
		}

		const req = https.request(httpsoptions, res => {
			if (res.statusCode == 200)
			{
				// console.log(res.headers);
				res.on('data', (d) => {
					// console.log(Object.prototype.toString.call(d)); //prints type
					d.forEach(i => {
						this.buffer.push(i);
					});
				 });
			}

		 });
	 	req.end();
	}
	
});
