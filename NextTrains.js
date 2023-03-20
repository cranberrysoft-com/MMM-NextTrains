/* Magic Mirror
 * Module: BoredDaily
 *
 * By CptMeetKat
 * MIT Licensed.
 */


Module.register("NextTrains", {
    
    trains: [],
    realTimeUpdates: null,
    welcomeMessage: "Welcome to NextTrains!",
    welcomed: false,
    // Default module config.
    defaults: {
        updateInterval : 10, //Seconds before changeing
        station: "",
        maxTrains: 4,
        lateCriticalLimit: 600,
        etd: false,
        debug: false
    },

    context: {
        id: null,
        station: "",
        maxTrains: 0,
        departedAfter: "" //HH:MM:SS
    },

    start: function() {
        this.config.updateInterval = this.config.updateInterval * 1000
        this.context.id = this.identifier;
        this.context.station = this.config.station;
        this.context.maxTrains = this.config.maxTrains;

        this.getRealTimeUpdates();
        this.getTrains();
        setInterval(() => {
            this.getTrains();
            this.getRealTimeUpdates();
        }, this.config.updateInterval);

    },

    initialMessage: function() {
        let x = document.createElement("div");
        if(!this.welcomed)
        {
            x.innerHTML = this.welcomeMessage;
            this.welcomed = true;
        }
        else
            x.innerHTML = "Loading...";
        return x
    },


    getDateTime: function(time)
    {
        let d = new Date()
        var datestring = d.getFullYear()  + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2)

        return new Date(datestring + "T" + time)
        
    },

    getMinutesDiff: function(d1, d2)
    {
        var diffMs = (d1 - d2); // milliseconds between now & Christmas
        // var diffDays = Math.floor(diffMs / 86400000); // days
        // var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
        var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

        return diffMins;
    }, 

    getHeader: function() {
        return this.name + ": " + this.config.station;
    },

    createTableHeader: function() {
        let header_row = document.createElement('tr')
        header_row.className = "align-left regular xsmall dimmed"
        
        let header_destination = document.createElement('td')
        let route = document.createElement('td')
        let header_time = document.createElement('td')
        let delay = document.createElement('td')

        
        header_destination.innerText = "Platform"
        route.innerText = "Route"
        header_time.innerText = "Departs"
        // delay.innerText = "Delay (min)";
        delay.innerText = "";
        
        header_row.appendChild(header_destination);
        header_row.appendChild(route);
        header_row.appendChild(header_time);
        header_row.appendChild(delay);
        
        return header_row
    },

    getDelayClass: function(type)
    {
        let cssClass = "";
        if(type == -1)
            cssClass = "early-mild"
        else if(type == 0)
            cssClass = "";
        else if(type == 1)
            cssClass = "late-mild";
        else if(type == 2)
            cssClass = "late-critical";

        return cssClass;
    },

    createTrainRow: function(destination_name, route_name, local_time, secondsDelayed=0, type=0) {
        let row = document.createElement('tr');
        row.className = "align-left small normal";

        let classA = this.getDelayClass(this.getDelayType(secondsDelayed));
        if(classA != "")
            row.classList.add(   classA   );
        
        let destination = document.createElement('td');
        let route = document.createElement('td');
        let time = document.createElement('td');
        let delay = document.createElement('td');

        destination.innerText = destination_name.split(' ').pop();
        route.innerText = route_name;
        time.innerText = local_time;
        if(secondsDelayed >= this.config.lateCriticalLimit)
        {
            delay.classList.add("late-critical");
            delay.innerText = "+" + parseInt(secondsDelayed/60) + "m";
            // delay.innerText = "+" + secondsDelayed;
        }
        else if ( secondsDelayed > 0)
        {
            delay.classList.add("late-mild");
            delay.innerText = "+" + parseInt(secondsDelayed/60) + "m";
            // delay.innerText = "+" + secondsDelayed;
        }
        else
        {
            // delay.innerText = parseInt(secondsDelayed/60);
            // delay.innerText = secondsDelayed;
        }

        
        row.appendChild(destination);
        row.appendChild(route);
        row.appendChild(time);
        row.appendChild(delay);

        return row;
    },

    getDom: function() {

        if(this.trains.length == 0)
            return this.initialMessage()

        const wrapper = document.createElement("table");
        const header_row = this.createTableHeader()
        wrapper.appendChild(header_row)

        let row = null
        this.trains.forEach(t => {
            let minsUntilTrain = this.getMinutesDiff(this.getDateTime(t.departure_time), new Date());
            
            let lateSeconds = this.findLateSeconds(t)
            let adjustedDepartureTime = this.getDateTime(t.departure_time);
            adjustedDepartureTime.setSeconds(adjustedDepartureTime.getSeconds() + lateSeconds);
            adjustedDepartureTime = adjustedDepartureTime.toLocaleTimeString();
            
            let delayType = this.getDelayType(lateSeconds);

            if(this.config.debug)
            {
                row = this.createTrainRow( t["stop_name:1"],
                t.trip_headsign,
                (minsUntilTrain + parseInt(lateSeconds/60))+"m" + " - " + t.departure_time + " (" + adjustedDepartureTime + ")",
                lateSeconds, delayType);
            }
            else if(this.config.etd)
            {
                row = this.createTrainRow( t["stop_name:1"],
                t.trip_headsign,
                adjustedDepartureTime,
                lateSeconds, delayType);
            }
            else
            {
                row = this.createTrainRow( t["stop_name:1"],
                t.trip_headsign,
                (minsUntilTrain + parseInt(lateSeconds/60))+"m",
                lateSeconds, delayType);
            }

            wrapper.appendChild(row)
        });

        return wrapper;
    },

    getDelayType: function(secondsLate) {
        let type = 0;
        if(secondsLate >= this.config.lateCriticalLimit)
            type = 2;
        else if(secondsLate > 0)
            type = 1;
        else if(secondsLate < -1)
            type = -1;

        return type;
    },

    findLateSeconds: function(train) {

        if (!this.realTimeUpdates) {
            return 0;
        }

        let arr = this.realTimeUpdates.entity;
        for (let i in arr) {
                
            let type = arr[i].tripUpdate.trip.scheduleRelationship;
            if(type == undefined || type == "SCHEDULED") 
            {   
                if(train.trip_id == arr[i].tripUpdate.trip.tripId )    
                {
                    for (let j in arr[i].tripUpdate.stopTimeUpdate) 
                    {
                        if(arr[i].tripUpdate.stopTimeUpdate[j].stopId == train.stop_id)
                            return arr[i].tripUpdate.stopTimeUpdate[j].departure.delay;
                    }
                }
            }
        }


        return 0;
    },


   socketNotificationReceived: function(notification, payload) {

        if(payload.id != this.context.id)
        {
            // console.log(payload); // Only print payload if we own it
            return;
        }
        
        if (notification === "ACTIVITY")
            this.trains = payload.trains;
        else if(notification === "REALTIME_DATA")
            this.realTimeUpdates = payload.updates;

        this.updateDom(1000);
    },

    getTrains: function() {
        Log.info(this.name + ": Getting trains");
        
        let now = new Date(); 
        this.context.departedAfter = now.toLocaleTimeString(); //Retrieve trains from after now

        this.sendSocketNotification("GET_TRAINS", {
            context: this.context 
        });
    },

    getRealTimeUpdates: function() {
        Log.info(this.name + ": Getting real time updates");

        this.sendSocketNotification("GET_REALTIME", {
            context: this.context//Needs its own context, tbh maybe both context should be local to their function..investigate
        });
    },


    

    // Define required styles.
    getStyles: function() {
        return ["nextTrains.css"];
    }

});
