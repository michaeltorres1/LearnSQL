/**
 * app.js - LearnSQL
 *
 * Kevin Kelly
 * Web Applications and Databases for Education (WADE)
 *
 * This file is the base startup config for the webapp
 */
(function () {
  // *** dependencies *** //
  const express = require('express');

  const appConfig = require('./server/config/main-config.js');
  const routeConfig = require('./server/config/route-config.js');
  const errorConfig = require('./server/config/error-config.js');

  // *** express instance *** //
  const app = express();

  // *** config *** //
  appConfig.init(app, express);
  routeConfig.init(app);
  errorConfig.init(app);

  module.exports = app;
}());
