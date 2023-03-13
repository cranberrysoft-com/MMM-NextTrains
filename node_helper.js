// var request = require('request');
var NodeHelper = require("node_helper");
const sqlite3 = require('sqlite3').verbose();

const fs = require('fs');







let db = new sqlite3.Database('./modules/NextTrains/trains.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err)
      console.error(err.message);
	 else
    	console.log('_____________________Connected to the chinook database.');
  });






module.exports = NodeHelper.create({

	trains: [],
	targetStation: "",
	
	start: function() {
		console.log("Starting node helper: " + this.name);


		fs.readFile('./modules/NextTrains/serverconf', 'utf8', (err, data) => {
			if (err) {
			  console.error(err);
			  return;
			}
			console.log("++++++++++++++++" + data);
			this.targetStation = data;
			console.log(this.getTrains());
		 });

		console.log("---------------xxxx" + this.targetStation);


	// 		});
	// 	 });
		
		

		
	},
	
	socketNotificationReceived: function(notification, payload) {

		var self = this;
		console.log("Notification: " + notification + " Payload: " + JSON.stringify(payload));
		// self.sendSocketNotification("ACTIVITY", this.trains[0].stop_name);
		// self.sendSocketNotification("ACTIVITY", "xxxxxxxx");

		if(notification === "GET_TRAINS") {
			self.sendSocketNotification("ACTIVITY", this.trains[0]);
		}


	},


	getTrains()
	{

		// console.log("____________" + `${this.targetStation}`;
//${this.targetStation}
		db.serialize(() => {
			
			db.each(`select * from calendar c join 
			(select * from trips t join 
				(select * from stop_times st JOIN
					(select p.stop_name, c.stop_name, c.stop_id from stops p 
							join stops c on p.stop_id = c.parent_station
							where p.stop_name = "${this.targetStation}") target_stops on st.stop_id = target_stops.stop_id
	) st
				on t.trip_id = st.trip_id) t
					on c.service_id = t.service_id
	where c.start_date <= strftime('%Y%m%d','now') AND  strftime('%Y%m%d','now') < c.end_date
	ORDER by t.arrival_time`, (err, row) => {
			  if (err) {
				 console.error(err.message);
			  }
			//   console.log(row["stop_name:1"], row["arrival_time"]);
			console.log(row);
			this.trains.push(row);
			});
		 });



		
		
	}


});
