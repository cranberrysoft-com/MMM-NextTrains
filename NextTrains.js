/* Magic Mirror
 * Module: BoredDaily
 *
 * By CptMeetKat
 * MIT Licensed.
 */

Module.register("NextTrains", {
   // Default module config.

   defaults: {
      boredURL: "https://www.boredapi.com/api/activity",
      updateInterval : 10, //Seconds before changeing
      type: "Welcome to NextTrains!",
      xtext: "Keeping you on top of your trains",
      trains: [],
      targetStation: "",
      numberoftrains: 4
   },

   start: function() {
      this.config.updateInterval = this.config.updateInterval * 1000
      
      this.getActivity();
      setInterval(() => {
         this.getActivity();
      }, this.config.updateInterval);

   },


    getDom: function() {    
        var wrapper = document.createElement("div");
        let trains = this.config.trains;

        console.log(trains);

        for(let i = 0; i < trains.length; i++)
        {
            var nextTrain = document.createElement("div");
            nextTrain.innerHTML = trains[i].departure_time + " " + trains[i]["stop_name:1"];
            wrapper.appendChild(nextTrain);
        }

      return wrapper;
   },

   socketNotificationReceived: function(notification, payload) {
        if (notification === "ACTIVITY") {

            this.config.trains = payload;

            this.updateDom(1000);
        }
    },

    getActivity: function() {
        Log.info("BORED: Getting activity.");

        this.sendSocketNotification("GET_TRAINS", {
            config: this.config
        });
    },

    // Define required styles.
    getStyles: function() {
        return ["nextTrains.css"];
    }

});
