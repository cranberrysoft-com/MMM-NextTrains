var NodeHelper = require("node_helper");
const sqlite3 = require('sqlite3').verbose();
var https = require('https');
const fs = require('fs');
var protobuf = require("protobufjs");
const decompress = require('decompress');

let db = new sqlite3.Database('./modules/NextTrains/trains.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err)
      console.error(err.message);
	 else
    	console.log('Connected to the NextTrain database.');
  });

module.exports = NodeHelper.create({
	config: {
		checkForGTFSUpdates: false,
		checkForRealTimeUpdates: true
		//config to set GTFS static interval
		//config to real time interval
	},

	maxTrains: 50,
	apikey: "",
	GTFSLastModified: null,
	realTimeLastModified: null, //Perhaps down the road these can't stay, if I wanted to enable the plugin for different regions

	GTFSRealTimeMessage: null,
	realTimeData: {},

	
	start: function() {
		console.log("Starting node helper: " + this.name);
		this.apikey = this.getApiKey();
		
		//Protobuffer setup for realtime updates
		let root = protobuf.loadSync("./modules/NextTrains/gtfs-realtime.proto");
		this.GTFSRealTimeMessage = root.lookupType("transit_realtime.FeedMessage");

		this.checkForUpdates()

		setInterval(() => {
			this.checkForUpdates();
		}, 5000);
	},

	buildDatabase: function () {
		const { spawn } = require('child_process');
		const pathToBashFile = './create_db.sh';
		const executePath = './modules/NextTrains/dist/';
		const childProcess = spawn('bash', [pathToBashFile], { cwd: executePath });

		// Handle the output of the Bash script
		childProcess.stdout.on('data', (data) => {
		  console.log(`stdout: ${data}`);
		});
		// Handle any errors that occur while running the Bash script
		childProcess.on('error', (error) => {
		  console.error(`error: ${error}`);
		});
		// Handle the end of the Bash script
		childProcess.on('close', (code) => {
		  console.log(`child process exited with code ${code}`);
		});
	},

	downloadGTFSData: function () {

		const customPromise = new Promise((resolve, reject) => {

			const httpsoptions = {
				protocol: "https:",
				hostname: "api.transport.nsw.gov.au",
				path: "/v1/gtfs/schedule/sydneytrains",
				method: 'GET',
				headers: {"Authorization": "apikey " + this.apikey}
			}

			const req = https.request(httpsoptions, res => {
				if (res.statusCode == 200)
				{
					const path = `./modules/NextTrains/StaticGTFS.zip`; 
					const filePath = fs.createWriteStream(path);
					res.pipe(filePath);
					filePath.on('finish',() => {
						 filePath.close();
						 console.log('Download Completed'); 
						 resolve();
					})
				}
				else
					reject();
			});
			req.end();
		})
		return customPromise;
	},


	updateGTFSData: function () {

		console.log("(STUB) Updating static GTFS database...");
		this.downloadGTFSData().then(() => {
			decompress('./modules/NextTrains/StaticGTFS.zip', './modules/NextTrains/dist').then(() => {
				this.buildDatabase();
			})
		});	
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
						//this.realTimeData = this.processRealTime(this.realTimeData);
					}).catch((err) => {
						console.log(err);
					});
			});
		}
	},

	processRealTime: function(data) {
		// Stub function that will filter out excessive records from real time data to reduce overhead on the client
		
		// for (let i = 0; i < data.entity.length; i++) {
			
		// 	let type = data.entity[i].tripUpdate.trip.scheduleRelationship;
		// 	if(type == 0) // SCHEDULED //0 SCHEDULED, 
		// 	{
		// 	}
		// 	else if(type == 5){}	

		// }
		// return data;
	},



	getApiKey: function()
	{
		let key = "";
		try {
			const data = fs.readFileSync('./modules/NextTrains/key', 'utf8');
			key = data;
			key = key.replace(/[\n\r]/g, '');  //Note: On a Raspberry Pi the API key is appended with a newline
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
			this.getTrains(payload.context, this.getDay()).then((trains) => {
				this.sendSocketNotification("ACTIVITY", {"id": payload.context.id, "trains": trains}  );
			});
		else if(notification === "GET_REALTIME")
			this.sendSocketNotification("REALTIME_DATA", {"id": payload.context.id, "updates": this.realTimeData}  );
		
	},

	getTrains: function(context, day="monday")
	{
		const customPromise = new Promise((resolve, reject) => {

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
								AND strftime('%Y%m%d', 'now') <= c.end_date 
							ORDER by 
								t.departure_time 
							LIMIT ${context.maxTrains}`, (err, trains) => {
				  if (err) {
					  console.error(err.message);
					}
					resolve(trains);
				});
			 });
		});

		return customPromise;

	},

	isStaticGTFSUpdateAvailable: function()
	{		
		
		const customPromise = new Promise((resolve, reject) => {

			const httpsoptions = {
				protocol: "https:",
				hostname: "api.transport.nsw.gov.au",
				path: "/v1/gtfs/schedule/sydneytrains",
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
		// This function had the intention to reduce API requests, unfortunetly the upstream realtime API does not
		// provide any 'light' way of checking for changes.
		// To be removed.

		const availabilityPromise = new Promise((resolve, reject) => {

			this.getRealTimeUpdates().then((buffer) => {
				let feedMessage = this.GTFSRealTimeMessage.decode(buffer);
				let lastModified = Number.parseInt(feedMessage.header.timestamp);

				resolve( !this.realTimeLastModified || this.realTimeLastModified < lastModified );				
			}).catch(  (err) => { 
				reject(err); 
			});
		})
		return availabilityPromise;

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
						d.forEach(i => { buffer.push(i); });
					});

					res.on('end', () => {
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
