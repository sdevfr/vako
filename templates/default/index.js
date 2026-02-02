const { App } = require('vako');

const app = new App({
    port: 3000,
    viewsDir: 'views',
    staticDir: 'public',
    routesDir: 'routes',
    layouts: {
        enabled: true,
        defaultLayout: 'main'
    },
    plugins: {
        enabled: true,
        autoLoad: true,
        pluginsDir: 'plugins'
    }
});

app.loadRoutes().listen();