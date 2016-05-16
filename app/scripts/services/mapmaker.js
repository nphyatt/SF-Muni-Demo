'use strict';

/**
 * @ngdoc service
 * @name eyesOnSfApp.MapMaker
 * @description
 * # MapMaker
 * Service in the eyesOnSfApp.
 */
angular.module('eyesOnSfApp')
  .service('MapMaker', function (SF_NEIGHBORHOODS, SF_STREETS, SF_ARTERIES, SF_FREEWAYS) {

    var self = this;

    /**
     * The Map object is for interaction with the map.
     * It stores references to neccessary map items and
     * provides methods for drawing the map as well as
     * adding and hiding certain elements.
     */
    var Map = {
      //set at draw time path function for translations
      geoPath: null,

      //the svg for the map set by draw
      svg: null,

      //seperate the streets by district
      districts: (function(){
        var districts = [];
        for(var street in SF_STREETS.features){
          var dst = SF_STREETS.features[street].properties.DISTRICT;
          districts[dst] = districts[dst] || [];
          districts[dst].push(SF_STREETS.features[street]);
        }
        return districts;
      })(),

      //The function that draws and inits the map given the correct
      //width, height, and scale.
      draw: function(width, height, bScale){

        //If we're redrawing start from scratch
        d3.select("svg").remove();

        //set the zoom behavior since we know the width, height
        Zoom.set(width, height);

        //create the projection
        var projection = d3.geo.albers()
          .rotate([122.431297, 0])
          .center([0, 37.7749])
          .translate([width/2, height/2])
          .scale(bScale);

        //for all the paths I'm going to be making
        Map.geoPath = d3.geo.path()
          .projection(projection);

        //The base svg.
        Map.svg = d3.select("#map").append("svg")
          .attr("width", width)
          .attr("height", height)
          .append("g");

        //the map we'll use to add in everything.
        Map.canvas = Map.svg.append("g");

        //setup the map and the draw order for everything
        Map.plotFeatures(SF_NEIGHBORHOODS, "neighborhood");
        Map.streets = Map.canvas.append("g");
        Map.plotFeatures(SF_ARTERIES, "artery");
        Map.plotFeatures(SF_FREEWAYS, "freeway");
        self.Routes.map = Map.canvas.append("g");
        Vehicles.map = Map.canvas.append("g");

      },

      //plots a given set of features
      plotFeatures: function(features, css){
        var selection = Map.canvas.append("g");
        selection.append("path")
          .datum(features)
          .attr("class", css)
          .style("opacity", 0)
          .attr("d", Map.geoPath)
          .transition("ftAdd")
          .duration(500)
          .style("opacity", 1);
        return selection;
      },

      //hide any streets
      hideStreets: function(){
        Map.streets.selectAll("path")
          .transition("stHide")
          .duration(500)
          .style("opacity", 0)
          .remove();
      },

      //the bounds for each district
      districtBounds: null,

      boundsIntersect: function(b1, b2){
        // If one rectangle is on left side of other
        if (b1[0][0] > b2[1][0] || b2[0][0] > b1[1][0]){
          return false;
        }
        // If one rectangle is above other
        if (b1[1][1] < b2[0][1] || b2[1][1] < b1[0][1]){
          return false;
        }
        return true;
      },

      //show the streets for each district within the given bounds
      showDistricts: function(bounds){
        //calc the bounds for each district and save if they haven't been already
        if(!Map.districtBounds){
          Map.districtBounds = {};
          for(var d in Map.districts){
            Map.districtBounds[d] = Map.geoPath.bounds({"type": "FeatureCollection", "features": Map.districts[d]});
          }
        }
        
        //grab any districts that fall in the given bounds`
        var features = [];
        for(var d in Map.districtBounds){
          if(Map.boundsIntersect(Map.districtBounds[d], bounds)){
            features = features.concat(Map.districts[d]);
            continue;
          }
        }

        //draw them to the map
        var stData = Map.streets.selectAll('path')
          .data(features);

        stData.attr("d", Map.geoPath)
          
        stData.enter()
          .append("path")
          .attr("class", "street")
          .style("opacity", 0)
          .attr("d", Map.geoPath)
          .transition("newSt")
          .duration(500)
          .style("opacity", 1);

        stData.exit()
          .transition("rmSt")
          .duration(500)
          .style("opacity", 0)
          .remove();
      }
    };

    //drawMap is the only function that needs to be public
    this.drawMap = Map.draw;

    /**
     * The busTip object is a set of functions that can be 
     * used to create new tooltips for vehicles and access
     * functions that and show and hide them.
     */
    var busTip = {
      create: function(d){
        d.properties.tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(busTip.getHTML);
        Map.canvas.call(d.properties.tip);
      },
      show: function(d){d.properties.tip.show(d, this)},
      hide: function(d){d.properties.tip.hide()},
      showFollowTip: function(){
        Vehicles.all()
          .each(function(d){if(Vehicles.following.node() === this){busTip.show.call(this, d);}});
      },

      //helper function which builds HTML for tooltip from the nodes properties
      getHTML: function(d) {
        var info = d.properties;
        var rInfo = info.routeInfo
        var html = "<div class='text-center'>";
        html += "<div class='routebg'  style='color:" + rInfo.color + "; background-color: " +
               rInfo.bgcolor + "'>" + d.properties.routeInfo.title + " #" + d.properties.id + "</div>";

        //it seems some routes don't have the data for the dirTag 
        if(d.properties.routeInfo[d.properties.dir]){
          html += "<div>" + d.properties.routeInfo[d.properties.dir] + "</div>";
        }

        html += "<div>Reported At: " + d.properties.lastSeen.toLocaleTimeString() + "</div>";
        html += "</div>";
        return html;
      }
    };

    /**
     * The Zoom object  holds all the zoom related 
     * API and neccessary logic for executing zoom 
     * behaviors.
     */
    var Zoom = {
      behavior: null, //will be set to our zoom behavior when the map is inited

      //set the zoom behavior
      set: function(width, height){
        Zoom.behavior = d3.behavior.zoom()
        .size([width, height])
        .scaleExtent([1, 8])
        .on("zoom", Zoom.calc)
        .on("zoomend", busTip.showFollowTip);

        //only show street details on zoom if we're not
        //on a phone since phones don't respond well to
        //that much data
        if(width === 700){
          Zoom.streetDetail = true;
        }else{
          Zoom.streetDetail = false;
        }
      },

      //takes care of zooms and pans
      calc: function() {
        Map.svg.attr("transform", "translate("+ d3.event.translate+") scale(" + d3.event.scale + ")");
      },

      //zoom to the bounds of a set of features or all the way out
      go: function(featureSet, duration) {
        duration = duration || 1500;

        var scale, translate;//needed for zooming
        if(featureSet){
          //calculate the scale and translation if given the bounding box
          var bounds = Map.geoPath.bounds(featureSet),
              dx = bounds[1][0] - bounds[0][0],
              dy = bounds[1][1] - bounds[0][1],
              x = (bounds[0][0] + bounds[1][0]) / 2,
              y = (bounds[0][1] + bounds[1][1]) / 2,
              width = d3.select("svg").attr("width"),
              height = d3.select("svg").attr("height");

          scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
          translate = [width / 2 - scale * x, height / 2 - scale * y];
        }else{
          //zoom all the way out
          translate = [0, 0];
          scale = 1;
        }

        if(Zoom.streetDetail){
          if(scale > 4){
            Map.showDistricts(bounds);
          }else{
            Map.hideStreets();
          }
        }

        //do the actual zoom
        Map.svg.transition("boundedZoom")
          .duration(duration)
          .call(Zoom.behavior.translate(translate).scale(scale).event);
      },
    };

    /**
     * Vehicles is an object for interaction with vehicle points.
     * It includes the functions to plot, filter,update and follow
     * vehicle points ont he map.
     */
    var Vehicles = {

      map: null, //set this to the g that'll hold the vehicles

      all: function(){
        return Vehicles.map.selectAll("path");
      },

      //takes a vehicle feature and plots or updates it
      plot: function(feature){
        //look for an existing vehicle
        var vh = Vehicles.all()
          .filter(function(d){ return d.properties.id === feature.properties.id;});

        //new entry
        if(vh.size() === 0){
          vh.data([feature])
            .enter()
            .append("path")
            .classed("bus", true)
            .style("fill", function(d){return d.properties.routeInfo.color})
            .style("display", function(d){ return self.Routes.isWatched(d.properties.routeInfo) ? "inline" : "none";})
            .style("opacity", 0)
            .each(busTip.create)
            .attr("d", Map.geoPath)
            .on('click', Vehicles.follow)
            .on('mouseover', busTip.show)
            .on('mouseout', busTip.hide)
            .transition("newVh")
            .duration(1000)
            .style("opacity", 1);
        }else{
          //update the existing one
          vh.each(function(d){feature.properties.tip = d.properties.tip})//transfer over the tooltip
            .data([feature])
            .transition("mvVh")
            .duration(5000)
            .attr("d", Map.geoPath)
            .each(function(d){ if(Vehicles.following.node() === this) Zoom.go(d, 5000);}); //pan with it if we're following it
        }

        //remove any stale vehicles that haven't been updated for more than 15 minutes
        Vehicles.all()
          .filter(function(d){ return Date.now() - d.properties.lastSeen.getTime() > 1000 * 60 * 15})
          .remove();
      },
       
      //filter any vehicles that aren't on a route being watched
      filter: function(){
        Vehicles.all()
          .filter(function(d){ return self.Routes.isWatched(d.properties.routeInfo);})
          .transition("showVH")
          .duration(1000)
          .style("display", "inline")
          .style('opacity', 1);

        Vehicles.all()
          .filter(function(d){ return !self.Routes.isWatched(d.properties.routeInfo);})
          .transition("hideVH")
          .duration(1000)
          .style('opacity', 0)
          .transition("vhGone")
          .duration(0)
          .style("display", "none");

        //draw any watched routes and zoom
        //to the proper bounds returned by draw function
        Zoom.go(self.Routes.draw());
      },

      //follow a particular vehicle
      follow: function(d){
        if(Vehicles.unfollowAndFilter(this)) return;

        //mark the vehicle we're following
        Vehicles.following = d3.select(this);
        Vehicles.following.classed('active', true);

        //hide all the other vehicles
        Vehicles.all()
          .each(busTip.hide)
          .on('mouseover', null)
          .on('mouseout', null)
          .filter(function(){return Vehicles.following.node() !== this})
          .transition("zoomHide")
          .duration(1000)
          .style('opacity', 0)
          .transition("zoomGone")
          .duration(0)
          .style('display', 'none')

        //draw the route for the vehicle that's being followed
        self.Routes.drawOne(d.properties.routeInfo.routePaths);

        //zoom in on the vehicle
        Zoom.go(d);
      },

      //unfollow any followed vehicles an filter
      unfollowAndFilter: function(node){
        //if we're following a vehicle unmark it
        if(Vehicles.following.node()){
          Vehicles.following.classed('active', false)
            .each(busTip.hide)
          if(Vehicles.following.node() === node){
            Vehicles.following = d3.select(null);
            Vehicles.all()
              .on('mouseover', busTip.show)
              .on('mouseout', busTip.hide);
            Vehicles.filter();
            return true;
          }
          Vehicles.following = d3.select(null);
        }
        Vehicles.filter();
      },

      //set to null to begin
      following: d3.select(null),
    };

    //plotVehicle is the only method that needs to be public
    this.plotVehicle = Vehicles.plot;

    /**
     * The Routes object exposes the 
     * API for watching/unwatching routes and
     * holds the neccessary references associated with routes.
     */
    this.Routes = {

      map: null, //set by drawMap

      //list of watched routes
      watching: [],

      watch: function(route){
        this.watching.push(route);
        Vehicles.unfollowAndFilter();
      },

      unwatch: function(route){
        this.watching.splice(this.watching.indexOf(route), 1);
        Vehicles.unfollowAndFilter();
      },

      unwatchAll: function(){
        this.watching = [];
        Vehicles.unfollowAndFilter();
      },

      isWatched: function(route){
        return this.watching.length === 0 || 
          this.watching.indexOf(route) > -1;
      },

      watchedFeatures: function(){
        var ftrs = [];
        this.watching.forEach(function(rt){if(rt){ftrs = ftrs.concat(rt.routePaths);}});
        return ftrs;
      },

      draw: function(){
        var rtFeats = this.watchedFeatures();
        var data = this.map.selectAll("path")
          .data(rtFeats);

        data.transition("swapRT")
          .duration(1000)
          .style("stroke", function(d){return d.properties.color})
          .style("fill", "transparent")
          .attr("d", Map.geoPath);

        data.enter()
          .append("path")
          .style('opacity', 0)
          .style("stroke", function(d){return d.properties.color})
          .style("stroke-width", 2)
          .style("fill", "transparent")
          .attr("d", Map.geoPath)
          .transition("showRT")
          .duration(1000)
          .style('opacity', 1);

        data.exit()
          .transition("rmRT")
          .duration(1000)
          .style('opacity', 0)
          .remove();

        if(rtFeats.length === 0){
          return null;
        }
        return {"type": "FeatureCollection", "features": rtFeats};
      },
       
      drawOne: function(paths){
       this.map.selectAll("new")
          .data(paths)
          .enter()
          .append("path")
          .style('opacity', 0)
          .style("stroke", function(d){return d.properties.color})
          .style("stroke-width", 2)
          .style("fill", "transparent")
          .attr("d", Map.geoPath)
          .transition()
          .duration(1000)
          .style('opacity', 1);
      },
    };

    return this
  });
