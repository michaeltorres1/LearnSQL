/**
 * route-config.js - LearnSQL
 *
 * Kevin Kelly
 * Web Applications and Databases for Education (WADE)
 *
 * This file sets up the routes for the express router.
 */

(function (routeConfig) {

  'use strict';

  routeConfig.init = function (app) {

    // *** routes *** //
    const routes = require('../routes/index');
    const authRoutes = require('../routes/auth');
    const userRoutes = require('../routes/user');
    const adminRoutes = require('../routes/admin');

    // *** register routes *** //
    app.use('/', routes);
    app.use('/auth', authRoutes);
    app.use('/', userRoutes);
    app.use('/admin', adminRoutes);

  };

})(module.exports);