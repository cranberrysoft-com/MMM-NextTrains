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
      updateInterval : 5, //Seconds before changeing
      type: "Welcome to NextTrains!",
      xtext: "Keeping you on top of your trains",
      trains: [],
      targetStation: ""
   },

   start: function() {
    
    
        console.log("TEST123");


    //   this.getActivity();
      this.config.updateInterval = this.config.updateInterval * 1000

      setInterval(() => {
         this.getActivity();
      }, this.config.updateInterval);

   },


    getDom: function() {
      
    var top = document.createElement("div");
    top.className = "bored-banner"
    top.innerHTML = this.config.type;

    var bot = document.createElement("div");
    bot.className = "bored-content"
    if(this.config.text)
        bot.innerHTML = this.config.text;
    else
        bot.innerHTML = this.config.xtext;
          
    var wrapper = document.createElement("div");
    wrapper.appendChild(top)
    wrapper.appendChild(bot)



    let trains = this.config.trains;
    for(let i = 0; i < trains.length; i++)
    {
        var nextTrain = document.createElement("div");
        nextTrain.innerHTML = trains[i].platform + " " + trains[i].arrives;
        wrapper.appendChild(nextTrain);
    }




      return wrapper;
   },

   socketNotificationReceived: function(notification, payload) {
        if (notification === "ACTIVITY") {

            console.log("PAYLOad____________" + JSON.stringify(payload));
            this.config.type = payload["stop_name:1"]
            this.config.text = payload.arrival_time;
            
            // this.config.trains = [];
            // this.config.trains.push({"platform": "platform 1", arrives: "12:00"});
            // this.config.trains.push({"platform": "platform 2", arrives: "12:10"});
            // this.config.trains.push({"platform": "platform 3", arrives: "12:20"});
            // this.config.trains.push({"platform": "platform 4", arrives: "12:30"});

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
        return ["bored.css"];
    }


});
