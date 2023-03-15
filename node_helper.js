// var request = require('request');
var NodeHelper = require("node_helper");
const sqlite3 = require('sqlite3').verbose();
var https = require('https');
const fs = require('fs');

let db = new sqlite3.Database('./modules/NextTrains/trains.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err)
      console.error(err.message);
	 else
    	console.log('Connected to the NextTrain database.');
  });

module.exports = NodeHelper.create({

	maxTrains: 10,
	apikey: "",
	lastModified: null,
	checkForUpdates: true,
	updateAvailable: false,
	
	start: function() {
		console.log("Starting node helper: " + this.name);
		this.apikey = this.getApiKey();
		this.isStaticGTFSUpdateAvailable()
		console.log("_______IS UPDATE AVAILABLE: " + updateAvaiable);
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
		
		if(notification === "GET_TRAINS") {
			// this.getTrains(payload.context, this.getDay());
		}

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
		if(!this.checkForUpdates) // Always return unavailable if the we do not want the database to update
		{
			this.updateAvaiable = false;
			return;
		}

		const httpsoptions = {
			hostname: "api.transport.nsw.gov.au",
			path: "/v1/publictransport/timetables/complete/gtfs",
			method: 'HEAD',
			headers: {"Authorization": "apikey " + this.apikey}
		}

		const req = https.request(httpsoptions, res => {
			if (res.statusCode == 200)
			{
				console.log("+++++++++++++" + res.headers["last-modified"]);
				GTFSLastModified = new Date(res.headers["last-modified"]);

				if(!this.lastModified || GTFSLastModified > this.lastModified)  // If last modified is unpopulated, update is available
				{
					this.lastModified = GTFSLastModified;
					this.updateAvailable = true;
				}
			}
			else
				this.updateAvailable = false;
		 });
	 	req.end();
	}
	
});
