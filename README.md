# ThousandEyes Coding Challenge

## Layout
* `app/scripts/views/main.html` - Main view containting map and control html. 
* `app/scripts/controllers/main.js` - Main controller. Uses the two services MapMaker and NextBus to help create the view.
* `app/scripts/services/mapmaker.js` - MapMaker service. The d3 related mapping functionality resides here.
* `app/scripts/services/nextbus.js` - NextBus service. This service consumes the NextBus API and parses XML into GeoJSON for use in d3 in the MapMaker service.

## Features
* Routes can be selected and added to a list of watched routes via the select box. Watched routes will cause the screen to zoom to the appropriate scale and unwatched routes/vehicles will be removed from the map.
* Vehicles can be hovered over to see more details.
* Vehicles can be clicked in order to zoom in and follow them.
* Responsive - The map and view should resize and scale appropriately on mobile devices or window resize.

## Notes
* On smaller screens the detail streets are not shown on zoom due to lag on mobile devices.
* To avoid lag as much as possible in the browser detail streets are hidden at low zoom. Streets were broken into 11 districts and on hight zoom are displayed only if the bounding box of the district is contained within the view.
