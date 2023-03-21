# NextTrains
A Magic Mirror module to display the Sydney trains via the [NSW Transport API](https://opendata.transport.nsw.gov.au/).

## Dependencies
  * A [MagicMirror<sup>2</sup>](https://github.com/MichMich/MagicMirror) installation


## Examples
![name-of-you-image](/screenshots/screenshot1.png)


## Installation
  1. Clone this repository into your `modules` directory.
  2. ```sudo apt-get install libsqlite3-dev```
  3. ```npm install sqlite3 --build-from-source --sqlite=/usr```
  4. ```sudo apt install sqlite3```
  5. run ```npm install```
  6. Create an account on [Transport NSW OpenData](https://opendata.transport.nsw.gov.au/)
  7. Create an application and obtain an API key from [OpenData](https://opendata.transport.nsw.gov.au/applications)
  8. Create a file named key and paste the API key inside (No new line character)
  9. Create a config and customise as detailed below
  
 **Example Configuration:**
```
		{
			module: 'NextTrains',
			position: 'bottom_right',
			config: {
				updateInterval: "10",
				station: "Central Station",
				maxTrains: 10
			}
		}
```

## Config
| **Option** | **Description** |
| --- | --- |
| `updateInterval` | Set to desired update interval (in seconds), default is `10` (10 seconds). |
| `station` | The name of the station to monitor |
| `maxTrains` | The maximum number of trains to display at a time |
