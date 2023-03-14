// var request = require('request');
var NodeHelper = require("node_helper");
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./modules/NextTrains/trains.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err)
      console.error(err.message);
	 else
    	console.log('Connected to the NextTrain database.');
  });

module.exports = NodeHelper.create({

	maxTrains: 10,
	
	start: function() {
		console.log("Starting node helper: " + this.name);
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
			this.getTrains(payload.context, undefined, this.getDay());
		}

	},


	getTrains(context, time, day="monday")
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
	}
});
