# MMM-NextTrains
A MagicMirror module that displays the Sydney trains using GTFS transport data from the [NSW Transport API](https://opendata.transport.nsw.gov.au/).


## Dependencies
  * A [MagicMirror<sup>2</sup>](https://github.com/MichMich/MagicMirror) installation


## Examples
![name-of-you-image](/screenshots/screenshot1.png)


## Installation

### Linux 
  1. Clone this repository into your MagicMirror/modules directory.
  2. ```sudo apt-get install libsqlite3-dev```
  3. cd into MagicMirror/modules/NextTrains directory folder
  4. ```npm install sqlite3 --build-from-source --sqlite=/usr```
  5. ```sudo apt-get install sqlite3```
  6. Create an account on [Transport NSW OpenData](https://opendata.transport.nsw.gov.au/)
  7. Create an application and obtain an API key from [Transport NSW OpenData Applications](https://opendata.transport.nsw.gov.au/applications)
  8. Create a file named 'key' with the apikey inside in the NextTrains directory (No new line character)
  9. Insert the module configurations into the MagicMirror config file
  
### Windows
- No Windows version available yet
  
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
| `station` | The name of the Sydney train station to monitor |
| `updateInterval` | How often the widget should refresh it's data (in seconds), default is `10`. |
| `maxTrains` | The maximum number of trains to display at a time, default is `10` |

---

<a href="https://www.buymeacoffee.com/CptMeetKat" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>
