'use strict';

/**
 * @ngdoc service
 * @name eyesOnSfApp.NextBus
 * @description
 * # NextBus
 * Service in the eyesOnSfApp.
 */
angular.module('eyesOnSfApp')
  .service('NextBus', function (MapMaker, $interval, $q) {

    var self = this;
    
    //the base for all requests to the NextBus API
    var base = "http://webservices.nextbus.com/service/publicXMLFeed?command=";
    var agency = "a=sf-muni"; //the agency isn't changing

    //store routes here as we get info about them
    this.routes = [];

    //takes the cmd and appropriate parameters and constructs url for the request
    function command(cmd, params){
      return base + cmd +"&" + params.join("&"); 
    }
    
    var getRouteInfo = (function(){
      //using this to cache route info so time isn't wasted
      //building the info every time something wants it
      var routeCache = {};
      return function(rTag){
        if(routeCache[rTag]){
          //if the tag exists it will either be the info object
          //or a promise that will get resolved with the info object
          //meaning this function should be called with a $q.when() handler.
          return routeCache[rTag];
        }else{
          //Nothing cached so create a defered and fetch and build
          var p = $q.defer();
          //while building set the cache to the promise that will be 
          //resolved with the info once it's loaded so that anything trying
          //to get the info while it's building doesn't fire another build and 
          //still gets the final product when it's ready
          routeCache[rTag] = p.promise;
          d3.xml(command('routeConfig', [agency, 'r='+rTag]), 'application/xml', storeRouteInfo.bind(p, routeCache));
          return p.promise;
        }
      };
    })();

    function storeRouteInfo(routeCache, xml){
      //grab the info about the route
      var routes = xml.documentElement.getElementsByTagName("route");
      var attrs = routes[0].attributes;
      var info = {
        tag: attrs.tag.value,
        id: Number(attrs.tag.value.replace(/\D+/g, '')),
        title: attrs.title.value,
        color: "#" + attrs.color.value,
        bgcolor: "#" + attrs.oppositeColor.value,
        bounds: buildGeoFeature("LineString", 
          [
           [attrs.lonMax.value, attrs.latMax.value],
           [attrs.lonMin.value, attrs.latMin.value]
          ],
        {})
      }
    
      //grab the titles for any direction headings
      var dirs = xml.documentElement.getElementsByTagName("direction");
      for(var i = 0; i < dirs.length; i++){
        var attr = dirs[i].attributes;
        info[attr.tag.value] = attr.title.value;
      }

      //build the GeoLine for the route from its points
      var paths = xml.documentElement.getElementsByTagName("path");
      for(var i = 0; i < paths.length; i++){
        var points = paths[i].children;
        var coords = []; // set of points to build route GeoLine
        for(var j = 0; j < points.length; j++){
          var attr = points[j].attributes;
          coords.push([attr.lon.value, attr.lat.value]);
        }
        var rpProps = {color: info.color, bgcolor: info.bgcolor, title: info.title, tag: info.tag, bounds: info.bounds};
        info.routePaths = info.routePaths || [];
        info.routePaths.push(buildGeoFeature("LineString", coords, rpProps));
      }

      //cache it for later
      routeCache[info.tag] = info;
      //add it to the public routes array
      self.routes.push(info);
      //resolve the original promise that was bound as this
      //so that anyone waiting gets the info
      this.resolve(info);
    }

    var getLocations = (function(){
      var last_ts = 0; //start with the last 15 minutes worth of data
      return function(reset){
        if(reset){
          last_ts = 0; //reset last_ts to get last 15 minutes worth of data
        }
        //poll the NextBus API for location data
        d3.xml(command('vehicleLocations', [agency, 't='+last_ts]), 'application/xml', 
          //handle xml data
          function(xml){
            //update the last ts for future calls
            last_ts = xml.documentElement.getElementsByTagName("lastTime")[0].attributes.time.value;

            //grab the vehicle xml and process
            var vehicles = xml.documentElement.getElementsByTagName("vehicle");
            for(var i = 0; i < vehicles.length; i++){
              //grab the route info use a $q.when since the function 
              //can return a cached info object or a promise
              $q.when(getRouteInfo(vehicles[i].attributes.routeTag.value), function(info){
                //coords of the vehicle
                var coords = [this.lon.value, this.lat.value];

                //useful info about the vehicle
                var props = { 
                  "id": this.id.value,
                  "lastSeen": new Date(Date.now() - Number(this.secsSinceReport.value)),
                  "routeTag": this.routeTag.value,
                  "routeInfo": info
                };
                if(this.dirTag){
                  props.dir = this.dirTag.value;
                }

                //use the helper to turn it in to a proper GeoFeature
                var feature = buildGeoFeature("Point", coords, props);

                //draw it on the map
                MapMaker.plotVehicle(feature);
               //bind the attributes to this so they are accessable in the callback
              }.bind(vehicles[i].attributes));
            }
          });
      };
    })();


    //helper to build GeoJSON Features
    function buildGeoFeature(type, coords, props){
      return { 
        "type": "Feature", 
        "geometry": { "type": type, "coordinates": coords },
        "properties": props
      };
    }
    
    this.startPolling = (function(){
      var interval = null;
      return function(){
        //cancel an interval if it exists
        if(interval){
          $interval.cancel(interval);
        }

        //start getting locations of vehicles and update every 15 secs
        getLocations(true); //pass true to reset last_ts
        interval = $interval(getLocations, 15000);
      };
    })();

    return this
  });
