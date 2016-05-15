'use strict';

/**
 * @ngdoc function
 * @name eyesOnSfApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the eyesOnSfApp
 */
angular.module('eyesOnSfApp')
  .controller('MainCtrl', function (NextBus, MapMaker, $window) {
    
    //an object to use for fetching info about the map
    var map = {
      //get the map div so we can determine size from it
      div: function(){ return angular.element('#map');},
      //the current width of the div containing the map
      width: function(){
        return Number(map.div().css('width').replace('px', ''));
      },
      //the current height of the div containing the map
      height: function(){
        return Number(map.div().css('height').replace('px', ''));
      },
      //the scale we should use based on the three supported sizes
      scale: function(){
        switch( map.width() ){
          case 280:
            return 119000;
          case 320:
            return 136000;
          case 500:
            return 212000;
          default:
            return 250000;
        }
      }
    };

    //hold on to current width so we can tell if it changes enough for a redraw
    var width = map.width();
    drawMap();

    //draw the map based on current size and start fetching data
    function drawMap(){
      MapMaker.drawMap(width, map.height(), map.scale());
      NextBus.startPolling();
    }

    //on a window resize see if we need to redraw the map
    $window.onresize = function(){
      if(map.width() !== width){
        //save the new width for future resizes
        width = map.width();
        //redraw and restart polling of vehicle locations
        drawMap();
      }
    };

    //Routes API for view 
    this.Routes = MapMaker.Routes;

    this.watch = function(){
      MapMaker.Routes.watch(this.addRoute);
      this.addRoute = null;
    };

    //list of all routes from NextBus
    this.routes = NextBus.routes; 

    this.watchFilter = function(route){
      return MapMaker.Routes.watching.indexOf(route) === -1;
    };

  });
