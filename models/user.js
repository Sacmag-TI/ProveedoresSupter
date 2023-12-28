'use strict'
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var UserSchema = Schema({
        usuario: String,
        password: String,
        correo: String,
        rol: String,
        nombre: String,
        apellidoP: String,
        apellidoM: String,
        rfc: String,
        empresa: String,
        alta: String,
        borrado: Boolean
    })
    //Pasa el nombre a minuscula y lo pluraliza
module.exports = mongoose.model('User', UserSchema);