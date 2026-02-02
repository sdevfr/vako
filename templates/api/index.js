const { App } = require('vako');

const app = new App({
    port: 3000,
    routesDir: 'routes'
    // No views or layouts for API
});

app.loadRoutes().listen();