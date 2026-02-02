const { App } = require('vako');

const app = new App({
    port: 3000,
    viewsDir: 'views',
    staticDir: 'public',
    routesDir: 'routes',
    layouts: {
        enabled: true,
        defaultLayout: 'main'
    }
});

app.loadRoutes().listen();