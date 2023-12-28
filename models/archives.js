'use strict'
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ArchivessSchema = Schema({
        rfc: String,
        archivo1: String,
        archivo2: String,
        archivo3: String,
        archivo4: String,
        archivo5: String,
        archivo6: String,
        archivo7: String,
        archivo8: String,
        archivo9: String,
        archivo10: String,
        archivo11: String,
        archivo12: String,
        archivo13: String,
        archivo14: String,
        archivo15: String,
        validar: Boolean,
        borrado: Boolean
    })
    //Pasa el nombre a minuscula y lo pluraliza
module.exports = mongoose.model('Archive', ArchivessSchema);