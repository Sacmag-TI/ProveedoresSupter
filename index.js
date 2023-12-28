'use strict'
var mongoose = require('mongoose');
var app = require('./app');
var port = 3000;

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://AdminSacDevelop:SacDev2022Ur@localhost:27017/proveedores?authSource=admin',
	{ useNewUrlParser: true, useUnifiedTopology : true}).then(() => {
        console.log("Conexión a la base de datos establecida con éxito...");
        //Creación del servidor

        app.listen(port, () => {
            console.log("Servidor corriendo correctamente en la url: localhost:3000");
        })

    })
    .catch(err => console.log(err));
