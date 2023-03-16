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
		//config to set GTFS static interval
		//config to real time interval
	},

	maxTrains: 10,
	apikey: "",
	GTFSLastModified: null,
	realTimeLastModified: null,

	messages: null,
	GTFSRealTimeMessage: null,

	realTimeData: {},

	
	start: function() {
		console.log("Starting node helper: " + this.name);
		this.apikey = this.getApiKey();
		
		//Protobuffer setup for realtime updates
		let root = protobuf.loadSync("./modules/NextTrains/gtfs-realtime.proto");
		this.GTFSRealTimeMessage = root.lookupType("transit_realtime.FeedMessage");

		setInterval(() => {
			this.checkForUpdates();
		}, 5000);
	},

	updateGTFSData: function () {
		console.log("(STUB) Updating static GTFS database...");
	},

	checkForUpdates: function()
	{
		if(this.config.checkForGTFSUpdates)
		{
			this.isStaticGTFSUpdateAvailable().then(updateAvailable => {
				if(updateAvailable)
					this.updateGTFSData();
			});
		}

		if(this.config.checkForRealTimeUpdates)
		{
			this.isRealTimeUpdateAvailable().then(updateAvailable => {
				if(updateAvailable)
					this.getRealTimeUpdates().then((buffer) => {
						this.realTimeData = this.GTFSRealTimeMessage.decode(buffer);
						console.log(this.realTimeData);
					});
			});
		}
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
		
		const customPromise = new Promise((resolve, reject) => {

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
					GTFSLastModified = new Date(res.headers["last-modified"]);

					if(!this.GTFSLastModified || GTFSLastModified > this.GTFSLastModified)  // If last modified is unpopulated, update is available
					{																					 // OR previous modification is before whats available
						this.GTFSLastModified = GTFSLastModified; //PROBABLY SHOULD NOT SET THIS HERE, could cause super minor edge case if its updated between now and when pulled
						resolve(true)
					}
				}
				else
					resolve(false);
			});
			req.end();
		})
		return customPromise;
	},

	isRealTimeUpdateAvailable: function() {
		//TBH this function is unnecessary and does add overhead
		//Originally thought to leave just in case modified is added to the header
		//But bffr that will never happen.

		const customPromise = new Promise((resolve, reject) => {

			this.getRealTimeUpdates().then((buffer) => {
				let feedMessage = this.GTFSRealTimeMessage.decode(buffer);
				let lastModified = Number.parseInt(feedMessage.header.timestamp);

				resolve( !this.realTimeLastModified || this.realTimeLastModified < lastModified );				
			}).catch(  (err) => { 
				reject(err); 
			});
		})
		return customPromise;

	},

	getRealTimeUpdates: function()
	{		
		const customPromise = new Promise((resolve, reject) => {

			const httpsoptions = {
				protocol: "https:",
				hostname: "api.transport.nsw.gov.au",
				path: "/v2/gtfs/realtime/sydneytrains",
				method: 'GET',
				headers: {"Authorization": "apikey " + this.apikey}
			}
			
			buffer = [];
			const req = https.request(httpsoptions, res => {
				if (res.statusCode == 200)
				{	
					res.on('data', (d) => {
						d.forEach(i => {
							buffer.push(i);
						});
					});

					res.on('end', () => {
						this.realTimeLastModified = Number.parseInt(feedMessage.header.timestamp); //Refresh the timestamp
						resolve(buffer);
					});
				}
				else
					reject("Error: status code " + res.statusCode);

			});
			req.on('error', (e) => {
				console.error(`problem with request: ${e.message}`);
				reject(e.message);
			});

			req.end();
		})
		return customPromise;
	}
});
