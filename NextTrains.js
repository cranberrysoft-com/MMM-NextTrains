/* Magic Mirror
 * Module: NextTrains
 *
 * By CptMeetKat
 * MIT Licensed.
 */

Module.register("NextTrains", {
    
    trains: [],
    realTimeUpdates: null,
    realTimeTimeStamp: 0,
    welcomeMessage: "Welcome to NextTrains!",
    welcomed: false,
    dbInitialised: false,
    realTimeInitialised: false,
    // Default module config.
    defaults: {
        // updateInterval : 10, //Seconds before changeing

        staticInterval: 1800, //30 minutes
        realTimeInterval: 60,

        station: "",
        maxTrains: 4,
        lateCriticalLimit: 600,
        etd: false,
        delaysFormat: "m", //"m, s, m:s"
        debug: false
    },

    start() {

        // this.config.updateInterval = this.config.updateInterval * 1000
        
        let staticInterval = this.config.staticInterval * 1000;
        let realTimeInterval = this.config.realTimeInterval * 1000;

        this.getRealTimeUpdates();
        this.getTrains();


        //Gremlin looking function, refactor pending..
        //Query for database fast
        let fastStaticLoop = setInterval(() => {
            if(this.dbInitialised)
            {
                clearInterval(fastStaticLoop);
                setInterval(() => {
                    this.getTrains();
                }, staticInterval);
            }
            else
                this.getTrains();
        }, 10 * 1000);



        let fastRealTimeLoop = setInterval(() => {
            if(this.realTimeInitialised)
            {
                clearInterval(fastRealTimeLoop);
                setInterval(() => {
                    this.getRealTimeUpdates();
                }, realTimeInterval);
            }
            else
                this.getRealTimeUpdates();

        }, 10 * 1000);
    },

    initialMessage() {
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


    createDateTimeFromTime(time) {
        let d = new Date()
        let timeAdjusted = time;

        let timeElts = timeAdjusted.split(":");
        let hours = Number.parseInt(timeElts[0]);
        
        //GTFS services may occur at invalid times e.g. 26:30:00  
        if(  hours >= 24  ) 
        {
            hours -= 24;
            d.setDate(d.getDate() + 1);
            timeElts[0] = hours.toString().padStart(2, "0");
            timeAdjusted = timeElts.join(":");
        }

        var datestring = d.getFullYear()  + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2)
        return new Date(datestring + "T" + timeAdjusted);
    },

    getDifferenceInMinutes(d1, d2) 
    {

        var diffMs = (d1 - d2); // milliseconds between d1 & d2
        var diffDays = Math.floor(diffMs / 86400000); // days
        var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
        var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

        return diffMins+(diffHrs*60)+(24*60*diffDays);
    }, 

    getHeader() {
        return this.name + ": " + this.config.station;
    },

    createTableHeader() {
        let header_row = document.createElement('tr')
        header_row.className = "align-left regular xsmall dimmed"
        
        let header_destination = document.createElement('td')
        let route = document.createElement('td')
        let header_time = document.createElement('td')
        let delay = document.createElement('td')

        
        header_destination.innerText = "Platform"
        route.innerText = "Route"
        header_time.innerText = "Departs"
        delay.innerText = "";
        
        header_row.appendChild(header_destination);
        header_row.appendChild(route);
        header_row.appendChild(header_time);
        header_row.appendChild(delay);
        
        return header_row
    },

    getDelayClass(type)
    {
        let cssClass = "";
        if(type == -1)
            cssClass = "early-mild"
        else if(type == 1)
            cssClass = "late-mild";
        else if(type == 2)
            cssClass = "late-critical";

        return cssClass;
    },

    getDelayFormat(secondsDelayed)
    {
        let delay = document.createElement('td');

        let mins = parseInt(secondsDelayed/60);
        let isMinsNotZero = mins != 0;
        let isSecsNotZero = secondsDelayed != 0;

        if ( this.config.debug && isSecsNotZero) // +m:s (+s)
            delay.innerText = "+" + mins.toString().padStart(2, "0") + ":" + (secondsDelayed%60).toString().padStart(2, "0") + " (+" + secondsDelayed + "s)";
        else if( this.config.delaysFormat == "m:s" && isSecsNotZero) //+m:s
            delay.innerText = "+" + mins.toString().padStart(2, "0") + ":" + (secondsDelayed%60).toString().padStart(2, "0");
        else if( this.config.delaysFormat == "m" && isMinsNotZero)  //+min
            delay.innerText = "+" + mins + "m";
        else if ( this.config.delaysFormat == "s" && isSecsNotZero) // +s
            delay.innerText = "+" + secondsDelayed + "s";

        return delay;
    },


    createTrainRow(destination_name, route_name, departure, secondsDelayed=0, cancelled=false) {
        let row = document.createElement('tr');
        row.className = "align-left small normal";


        let destination = document.createElement('td');
        let route = document.createElement('td');
        let time = document.createElement('td');
        let delay = this.getDelayFormat(secondsDelayed);

        if(cancelled == 1)
            row.classList.add(   "cancelled"   );

        if(delay.innerText != "")
        {
            let classA = this.getDelayClass(this.getDelayType(secondsDelayed));
            if(classA != "")
                row.classList.add(   classA   );
        }


        destination.innerText = destination_name;
        route.innerText = route_name;
        time.innerText = departure;

        row.appendChild(destination);
        row.appendChild(route);
        row.appendChild(time);
        row.appendChild(delay);

        return row;
    },

    generateRealTimeStopsMap(realTimeUpdates) {

        let map = {};

        let arr = realTimeUpdates.entity;
        for (let i in arr)
        {
                let tripID = arr[i].tripUpdate.trip.tripId;

                // let startDate = arr[i].tripUpdate.trip.start_date;
                // https://developers.google.com/transit/gtfs-realtime/reference/#message-tripdescriptor
                // Start date should be used to disambiguate trips that are so late that they collide with a scheduled trip on the next day.
                // However this rarely happen, but should eventually be built out for accuracy
                // Ideally the map ID will become startDate + tripID + stopID

                let type = arr[i].tripUpdate.trip.scheduleRelationship;

                if(this.isScheduledTrip(type)) 
                {   
                    for (let j in arr[i].tripUpdate.stopTimeUpdate) 
                    {
                        let stopID = arr[i].tripUpdate.stopTimeUpdate[j].stopId
                        let newID = tripID + "." + stopID;

                        if(map[newID] == undefined)
                        {
                            map[newID] = {"trip": i, "stop": j };
                        }
                        else
                            console.error("Error: multiple IDs found in realtime stop data");
                    }
                }
        }
        return map;
    },

    generateRealTimeTripsMap(realTimeUpdates) {

        let map = {};

        let arr = realTimeUpdates.entity;
        for (let i in arr)
        {
            let dupeID = map[arr[i].tripUpdate.trip.tripId];
            if(map[dupeID] == undefined)
                map[arr[i].tripUpdate.trip.tripId] = i;
            else
                console.error("Error: multiple IDs found in realtime data");
        }
        return map;
    },

    getDom() {

        if(this.trains.length == 0)
            return this.initialMessage();

        const wrapper = document.createElement("table");
        const header_row = this.createTableHeader();
        wrapper.appendChild(header_row);

        let realTimeUpdates = this.realTimeUpdates;


        let row = null;
        
        let realTimeMap = this.generateRealTimeTripsMap(realTimeUpdates);
        let realTimeStopsMap = this.generateRealTimeStopsMap(realTimeUpdates);

        let now = new Date();

        let total = 0;
        let max = this.config.maxTrains;

        this.trains.forEach(t => {

            // All this is too complicated looking, should compress it into one class for easy use/reuse

            let departureDTPlanned = this.createDateTimeFromTime(t.departure_time);
            let secondsModifier = this.findRealTimeChangesInSeconds(t, realTimeStopsMap, realTimeUpdates);
            
            let departureRealTime = new Date(departureDTPlanned);
            departureRealTime.setSeconds(departureRealTime.getSeconds() + secondsModifier);

            if(departureRealTime <= now || total >= max)
                return;

            total++;

            let minsUntilTrain = this.getDifferenceInMinutes(departureRealTime, now);
            

            let departureTimeActual = departureDTPlanned;
            departureTimeActual.setSeconds(departureTimeActual.getSeconds() + secondsModifier);

            let platform = t["stop_name:1"].split(' ').pop();
            let departureDisplay = "";

            if(this.config.debug)
                departureDisplay =  (minsUntilTrain)+"m" + " - " + t.departure_time + " (" + departureRealTime.toLocaleTimeString() + ")";
                
            else if(this.config.etd)
                departureDisplay = departureRealTime.toLocaleTimeString();
                
            else
                departureDisplay = (minsUntilTrain)+"m";


            let cancelled = this.isTrainCancelled(t, realTimeMap, realTimeUpdates);
            row = this.createTrainRow( platform, t.trip_headsign, departureDisplay, secondsModifier, cancelled);

            wrapper.appendChild(row)
        });

        return wrapper;
    },

    getDelayType(secondsLate) {
        let type = 0;
        if(secondsLate >= this.config.lateCriticalLimit)
            type = 2;
        else if(secondsLate > 0)
            type = 1;
        else if(secondsLate < -1)
            type = -1;

        return type;
    },


    findRealTimeChangesInSeconds(train, stopIDMap, realTimeUpdates) {

        let match = stopIDMap[train.trip_id + "." + train.stop_id];

        // IF real time updates have not been obtained OR
        // IF the train does not have a corrosponding record in the real time updates
        if (!realTimeUpdates || match == undefined) 
            return 0;

        if(match != undefined)
        {
            let i = match.trip;
            let j = match.stop;
            let arr = realTimeUpdates.entity;

            //https://developers.google.com/transit/gtfs-realtime/reference/#message-stoptimeevent
            //The field time or delay could be used: TODO
            if(arr[i].tripUpdate.stopTimeUpdate[j].departure.delay == undefined)
                return 0;

            return arr[i].tripUpdate.stopTimeUpdate[j].departure.delay;
        }
        
        return 0;
    },


    isScheduledTrip(type) {
        // Undefined may or may not designate a trip as SCHEDULED, consult protobuf file
        return (type == undefined || type == "SCHEDULED") 
    },



    isTrainCancelled(train, tripIDMap, realTimeUpdates) {

        let i = tripIDMap[train.trip_id];
        
        // IF real time updates have not been obtained OR
        // IF the train does not have a corrosponding record in the real time updates
        if (!realTimeUpdates || i == undefined) 
            return 0;

        let arr = realTimeUpdates.entity;

        let type = arr[i].tripUpdate.trip.scheduleRelationship;


        if(type == "CANCELED")
        {
            return true;
        }


        return false;
    },


   socketNotificationReceived(notification, payload) {

        if(payload.id != this.identifier)
            return;
        
        console.log(payload);
        if (notification === "STATIC_DATA")
        {
            this.trains = payload.trains;
            this.dbInitialised = true;
        }
        else if(notification === "REALTIME_DATA")
        {
            this.realTimeUpdates = payload.updates;
            this.realTimeTimeStamp = payload.timestamp;

            if(this.realTimeUpdates.entity != undefined) //Switches off fast real time querying, TODO
                this.realTimeInitialised = true;


        }
        
        this.updateDom(1000);
    },

    getTrains() {
        Log.info(this.name + ": Getting trains");

        let now = new Date();
        console.log(now.toLocaleTimeString());
        let context = {
            id: this.identifier,
            station: this.config.station,
            departedAfter: "00:00:00"
        };

        this.sendSocketNotification("GET_TRAINS", {
            context: context 
        });
    },

    getRealTimeUpdates() {
        Log.info(this.name + ": Getting real time updates");

        let context = {
            id: this.identifier,
        };

        this.sendSocketNotification("GET_REALTIME", {
            context: context
        });
    },

    // Define required styles.
    getStyles() {
        return ["nextTrains.css"];
    }

});
