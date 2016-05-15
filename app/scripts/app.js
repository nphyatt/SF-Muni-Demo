'use strict';

/**
 * @ngdoc overview
 * @name eyesOnSfApp
 * @description
 * # eyesOnSfApp
 *
 * Main module of the application.
 */
angular
  .module('eyesOnSfApp', [
    'ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        controllerAs: 'main'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
