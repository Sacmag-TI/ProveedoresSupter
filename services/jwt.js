'use strict'
var jwt = require('jwt-simple');
var moment = require('moment');
var secret = 'clave_secret_proveedores_sacmag_angular_node';
exports.createToken = function(user) {
    var payload = {
        sub: user._id,
        usuario: user.usuario,
        correo: user.correo,
        rol: user.rol,
        nombre: user.nombre,
        apellidoP: user.apellidoP,
        apellidoM: user.apellidoM,
        rfc: user.rfc,
        alta: user.alta,
	empresa: user.empresa,
        iat: moment().unix(),
        exp: moment().add(3, 'days').unix
    };
    return jwt.encode(payload, secret);
}
