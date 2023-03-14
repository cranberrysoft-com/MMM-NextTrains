/* Magic Mirror
 * Module: BoredDaily
 *
 * By CptMeetKat
 * MIT Licensed.
 */

Module.register("NextTrains", {
    
    trains: [],
    welcomeMessage: "Welcome to NextTrains!",
    welcomed: false,
    // Default module config.
    defaults: {
        updateInterval : 10, //Seconds before changeing
        station: "",
        maxTrains: 4
    },

    context: {
        id: null,
        station: "",
        maxTrains: 0
    },

    start: function() {

        this.config.updateInterval = this.config.updateInterval * 1000
        
        this.context.id = this.identifier;
        this.context.station = this.config.station;
        this.context.maxTrains = this.config.maxTrains;

        this.getTrains();
        setInterval(() => {
            this.getTrains();
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


    getDom: function() {

        if(this.trains.length == 0)
            return this.initialMessage()

        const wrapper = document.createElement("table");
        const header_row = this.createTableHeader()
        wrapper.appendChild(header_row)

        let row = null
        this.trains.forEach(t => {
            let minsUntilTrain = this.getMinutesDiff(this.getDateTime(t.departure_time), new Date());
            row = this.createTableRow( t["stop_name:1"], minsUntilTrain+"m" + " - " + t.departure_time, t.trip_headsign)
            wrapper.appendChild(row)
        });

        return wrapper;
    },

    getDateTime: function(time)
    {
        let yourDate = new Date()
        return new Date(yourDate.toISOString().split('T')[0] + "T" + time)

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
        let route_time = document.createElement('td')
        let header_time = document.createElement('td')

        
        header_destination.innerText = "Platform"
        route_time.innerText = "Route"
        header_time.innerText = "Departs"
        
        header_row.appendChild(header_destination)
        header_row.appendChild(route_time)
        header_row.appendChild(header_time)
        return header_row
    },

    createTableRow: function(destination_name, local_time, route_name) {
        let row = document.createElement('tr')
        row.className = "align-left small normal"
        
        let destination = document.createElement('td')
        let route = document.createElement('td')
        let time = document.createElement('td')

        destination.innerText = destination_name.split(' ').pop()
        route.innerText = route_name;
        time.innerText = local_time
        
        // if(this.config.etd) {

        //     let etd = local_time
        //     time.innerText = etd + " mins"
        //     if(etd == 0) {
        //         time.innerText = "now"
        //     }
        // }
        
        row.appendChild(destination)
        row.appendChild(route)
        row.appendChild(time)
        return row

    },

   socketNotificationReceived: function(notification, payload) {
        
    if (notification === "ACTIVITY") {

        console.log(payload);
        if(payload.id == this.context.id)
        {
            this.trains = payload.trains;
            this.updateDom(1000);
        }
    }
    },

    getTrains: function() {
        Log.info(this.name + ": Getting trains");

        this.sendSocketNotification("GET_TRAINS", {
            context: this.context
        });
    },

    // Define required styles.
    getStyles: function() {
        return ["nextTrains.css"];
    }

});
