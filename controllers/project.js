'use strict'
var bcrypt = require('bcrypt-nodejs');
var nodemailer = require('nodemailer');

var Archives = require('../models/archives');
var Vendors = require('../models/vendors');
var Users = require('../models/user');
var jwt = require('../services/jwt');
var fs = require('fs').promises;
var fsa = require('fs');
var archiver = require('archiver');

var path = require('path');
const { getMaxListeners } = require('process');
const { arch } = require('os');
var controller = {
    //método para loguear usuario
    login: function(req, res) {
        var params = req.body;
        var login = new Users();
        login.usuario = params.usuario;
        login.password = params.password;
        Users.findOne({ usuario: login.usuario.toLowerCase(), borrado: false }, (err, user) => {
            if (err) return res.status(500).send({ message: "Error en la petición" });
            if (user) {
                bcrypt.compare(login.password, user.password, (err, check) => {
                    if (check) {
                        if (params.gettoken) {
                            //generar y devolver el token
                            return res.status(200).send({
                                token: jwt.createToken(user)
                            })
                        } else {
                            //devolver datos del usuario
                            user.password = undefined;
                            return res.status(200).send({ user });
                        }
                    } else {
                        return res.status(404).send({ message: 'El usuario no se ha podido identificar' });
                    }
                })
            } else {
                return res.status(404).send({ message: "¡El usuario no se ha podido identificar!" });
            }
        })
    },
    //Obtener datos del Usuario
    getUSer: function(req, res) {
        var user = new Users();
        var projectId = req.params.id;
        if (projectId == null) return res.status(404).send({ message: 'El usuario no existe' })
        Users.findById(projectId, (err, user) => {
            if (err) return res.status(500).send({ message: 'Error al buscar el usuario' });
            if (!user) return res.status(404).send({ message: 'El usuario no existe' });
            user.password = undefined;
            return res.status(200).send({
                user
            })
        });
    },
    //guardar usuarios para login
    saveUsersLogin: async function(req, res) {
        var login = new Users();
        var params = req.body;
        var correoP = 'irving.davila@grupo-sacmag.com.mx';
        var pass = "";
        var respuesta = "";
        var rol_usuario = req.user.rol;
         if (rol_usuario == "administrador") {
            if (params.usuario && params.correo && params.rol && params.nombre && params.apellidoM && params.apellidoP && params.rfc && params.empresa) {
                try {
                    const userFind = await Users.find({ $or: [{ usuario: params.usuario.toLowerCase() }, { rfc: params.rfc.toLowerCase() }] }).exec();
                    if (userFind != "") {
                        return res.status(500).send({ message: 'Ya existe el usuario' });
                    } else {
                        if (params.rol != 'administrador') {
                            pass = "";
                            var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                            for (var i = 0; i < 8; i++) {
                                pass += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                        } else {
                            pass = params.password.trim();
                        }
                        const hashedPassword = await new Promise((resolve, reject) => {
                            bcrypt.hash(pass, null, null, function(err, hash) {
                                if (err) reject(err)
                                resolve(hash)
                            });
                        })
                        login.usuario = params.usuario.toLowerCase().trim();
                        login.password = hashedPassword;
                        login.correo = params.correo.toLowerCase().trim();
                        login.rol = params.rol.toLowerCase();
                        login.nombre = params.nombre.toLowerCase().trim();
                        login.apellidoP = params.apellidoP.toLowerCase().trim();
                        login.apellidoM = params.apellidoM.toLowerCase().trim();
                        login.rfc = params.rfc.toLowerCase().trim();
                        login.empresa = params.empresa.toLowerCase().trim();
                        login.borrado = false;
                        var saveInformation = await login.save();
                        saveInformation.password = undefined;
                        var contentHtml = `
                            <img src="cid:unique@kreata.ee">
                            <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                            <h4>Datos del Usuario Para Entrar Al Sistema</h4>
                            <a href="https://proveedores-supter.com.mx/" target="_blank" >Click aquí para entrar al Sitio Web</a>
                            <ul>
        
                                <li>Usuario: ${params.usuario.toLowerCase().trim()}</li>
                                <li>Contraseña ${pass}</li>
                                <br>
                                <br>
                                <p>No responder correo<p>
                            </ul>
                            `;
                        let transporter = nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 465,
                            secure: true, // true for 465, false for other ports
                            auth: {
                                user: 'supter.proveedores@gmail.com', // generated ethereal user
                                pass: 'iodjjwphcfjdsfzy', // generated ethereal password
                            },
                        });
                        // send mail with defined transport object
                        let info = await transporter.sendMail({
                            from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                            to: `${correoP} , ${params.correo.toLowerCase().trim()}`, // list of receivers
                            subject: "Accesos para entrar a la plataforma de Proveedores", // Subject line
                            html: contentHtml, // html body
                            attachments: [{
                                filename: 'image.png',
                                path: __dirname + '/logo.png',
                                cid: 'unique@kreata.ee' //same cid value as in the html img src
                            }]
                        });
                        console.log("Mensaje enviado", info.envelope);
                        return res.status(200).send({
                            user: saveInformation
                        });

                    }
                } catch (error) {
                    console.log("Ocurrió un error");
                    return res.status(500).send({ message: 'Ocurrió un error ' + error });
                }
            } else {
                return res.status(500).send({ message: 'Completa los campos faltantes del formulario' });
            }
      	 } else {
        	 return res.status(500).send({ message: 'No cuentas con los permisos suficientes' });
   	 }
    },
    //guardar los archivos del proveedor
    saveArchives: async function(req, res) {
        var archive = new Archives();
        var userFind = new Users();
        var rfc = req.params.rfc;
        var rol_usuario = req.user.rol;
        var correoUsuarioAlta;
        if (rol_usuario != "usuarioLec") {
            try {
                const archives = await Archives.findOne({ rfc: rfc.toLowerCase().trim() }).exec();
                if (archives) return res.status(500).send({ message: "Ya existe la información" });
                if (!archives) {
                    if (req.files) {
                        if (req.user.alta) var useralta = req.user.alta.toLowerCase().trim()
                        if (rol_usuario == 'administrador' || rol_usuario == 'usuario') {
                            correoUsuarioAlta = req.user.correo;
                        } else {
                            var UsuarioAlta = await Users.findOne({ usuario: useralta }).exec();
                            correoUsuarioAlta = UsuarioAlta.correo;
                        }


                        var filePath1 = req.files.archivo1.path;
                        var filePath2 = req.files.archivo2.path;
                        var filePath3 = req.files.archivo3.path;
                        var filePath4 = req.files.archivo4.path;
                        if (req.files.archivo5) {
                            var filePath5 = req.files.archivo5.path;
                        } else {
                            var filePath5 = '';
                        }
                        var filePath6 = req.files.archivo6.path;
                        var filePath7 = req.files.archivo7.path;
                        var filePath8 = req.files.archivo8.path;
                        var filePath9 = req.files.archivo9.path;
                        var filePath10 = req.files.archivo10.path;
                        var filePath11 = req.files.archivo11.path;
                        var filePath12 = req.files.archivo12.path;
                        var filePath13 = req.files.archivo13.path;
                        var filePath14 = req.files.archivo14.path;
                        var filePath15 = req.files.archivo15.path;
                        /* var fileSplit1 = filePath1.split('\\'); Windows*/
                        /** ('/') linux*/
                        var fileSplit1 = filePath1.split('/');
                        var fileSplit2 = filePath2.split('/');
                        var fileSplit3 = filePath3.split('/');
                        var fileSplit4 = filePath4.split('/');
                        if (req.files.archivo5) {
                            var fileSplit5 = filePath5.split('/');
                        }
                        var fileSplit6 = filePath6.split('/');
                        var fileSplit7 = filePath7.split('/');
                        var fileSplit8 = filePath8.split('/');
                        var fileSplit9 = filePath9.split('/');
                        var fileSplit10 = filePath10.split('/');
                        var fileSplit11 = filePath11.split('/');
                        var fileSplit12 = filePath12.split('/');
                        var fileSplit13 = filePath13.split('/');
                        var fileSplit14 = filePath14.split('/');
                        var fileSplit15 = filePath15.split('/');

                        var fileName1 = fileSplit1[1];
                        var fileName2 = fileSplit2[1];
                        var fileName3 = fileSplit3[1];
                        var fileName4 = fileSplit4[1];
                        if (req.files.archivo5) {
                            var fileName5 = fileSplit5[1];
                        }

                        var fileName6 = fileSplit6[1];
                        var fileName7 = fileSplit7[1];
                        var fileName8 = fileSplit8[1];
                        var fileName9 = fileSplit9[1];
                        var fileName10 = fileSplit10[1];
                        var fileName11 = fileSplit11[1];
                        var fileName12 = fileSplit12[1];
                        var fileName13 = fileSplit13[1];
                        var fileName14 = fileSplit14[1];
                        var fileName15 = fileSplit15[1];


                        var extSplit1 = fileName1.split('\.');
                        var extSplit2 = fileName2.split('\.');
                        var extSplit3 = fileName3.split('\.');
                        var extSplit4 = fileName4.split('\.');
                        if (req.files.archivo5) {
                            var extSplit5 = fileName5.split('\.');
                        }

                        var extSplit6 = fileName6.split('\.');
                        var extSplit7 = fileName7.split('\.');
                        var extSplit8 = fileName8.split('\.');
                        var extSplit9 = fileName9.split('\.');
                        var extSplit10 = fileName10.split('\.');
                        var extSplit11 = fileName11.split('\.');
                        var extSplit12 = fileName12.split('\.');
                        var extSplit13 = fileName13.split('\.');
                        var extSplit14 = fileName14.split('\.');
                        var extSplit15 = fileName15.split('\.');

                        var fileExt1 = extSplit1[1];
                        var fileExt2 = extSplit2[1];
                        var fileExt3 = extSplit3[1];
                        var fileExt4 = extSplit4[1];
                        if (req.files.archivo5) {
                            var fileExt5 = extSplit5[1];
                        }

                        var fileExt6 = extSplit6[1];
                        var fileExt7 = extSplit7[1];
                        var fileExt8 = extSplit8[1];
                        var fileExt9 = extSplit9[1];
                        var fileExt10 = extSplit10[1];
                        var fileExt11 = extSplit11[1];
                        var fileExt12 = extSplit12[1];
                        var fileExt13 = extSplit13[1];
                        var fileExt14 = extSplit14[1];
                        var fileExt15 = extSplit15[1];


                        archive.rfc = rfc.toLowerCase().trim();
                        archive.archivo1 = fileName1;
                        archive.archivo2 = fileName2;
                        archive.archivo3 = fileName3;
                        archive.archivo4 = fileName4;
                        if (req.files.archivo5) {
                            archive.archivo5 = fileName5;
                        }



                        archive.archivo6 = fileName6;
                        archive.archivo7 = fileName7;
                        archive.archivo8 = fileName8;
                        archive.archivo9 = fileName9;
                        archive.archivo10 = fileName10;
                        archive.archivo11 = fileName11;
                        archive.archivo12 = fileName12;
                        archive.archivo13 = fileName13;
                        archive.archivo14 = fileName14;
                        archive.archivo15 = fileName15;

                        archive.validar = false;
                        archive.borrado = false;
                        if ((fileExt1.toLowerCase().trim() == 'pdf' && req.files.archivo1.size < 2000000) && (fileExt2.toLowerCase().trim() == 'pdf' && req.files.archivo2.size < 2000000) && (fileExt3.toLowerCase().trim() == 'pdf' && req.files.archivo3.size < 2000000) && (fileExt4.toLowerCase().trim() == 'pdf' && req.files.archivo4.size < 2000000) &&
                            (fileExt6.toLowerCase().trim() == 'pdf' && req.files.archivo6.size < 2000000) && (fileExt7.toLowerCase().trim() == 'pdf' && req.files.archivo7.size < 2000000) && (fileExt8.toLowerCase().trim() == 'pdf' && req.files.archivo8.size < 2000000) &&
                            (fileExt9.toLowerCase().trim() == 'pdf' && req.files.archivo9.size < 2000000) && (fileExt10.toLowerCase().trim() == 'pdf' && req.files.archivo10.size < 2000000) && (fileExt11.toLowerCase().trim() == 'pdf' && req.files.archivo11.size < 2000000) && (fileExt12.toLowerCase().trim() == 'pdf' && req.files.archivo12.size < 2000000) &&
                            (fileExt13.toLowerCase().trim() == 'pdf' && req.files.archivo13.size < 2000000) && (fileExt14.toLowerCase().trim() == 'pdf' && req.files.archivo14.size < 2000000) && (fileExt15.toLowerCase().trim() == 'pdf' && req.files.archivo15.size < 2000000)) {
                            const archives = await archive.save();
                            var contentHtml = `
                <img src="cid:unique@kreata.ee">
                <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                <a href="https://proveedores-supter.com.mx/" target="_blank" >Click aquí para entrar al Sitio Web</a>
                <br>
                <br>
                <h4>Los archivos del Proveedor: ${req.user.nombre.toUpperCase()} con Rfc: ${req.user.rfc.toUpperCase()} fueron enviados correctamente y están listos para su aprobación</h4>
                <br>
                <br>
                <p>Correo enviado automáticamente, no responder correo<p>
                `;
                            let transporter = nodemailer.createTransport({
                                host: "smtp.gmail.com",
                                port: 465,
                                secure: true, // true for 465, false for other ports
                                auth: {
                                    user: 'supter.proveedores@gmail.com', // generated ethereal user
                                    pass: 'iodjjwphcfjdsfzy', // generated ethereal password
                                },
                            });
                            // send mail with defined transport object
                            let info = await transporter.sendMail({
                                from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                                to: `${correoUsuarioAlta}`, // list of receivers
                                subject: `Aprobación de archivos del Proveedor ${req.user.nombre.toUpperCase()}`, // Subject line
                                html: contentHtml, // html body
                                attachments: [{
                                    filename: 'image.png',
                                    path: __dirname + '/logo.png',
                                    cid: 'unique@kreata.ee' //same cid value as in the html img src
                                }]
                            });
                            console.log("Mensaje enviado", info.envelope);
                            return res.status(200).send({ archives: archives })
                        } else {
                            var files = [];
                            if (filePath5 == '') {
                                files = [
                                    filePath1,
                                    filePath2,
                                    filePath3,
                                    filePath4,
                                    filePath6,
                                    filePath7,
                                    filePath8,
                                    filePath9,
                                    filePath10,
                                    filePath11,
                                    filePath12,
                                    filePath13,
                                    filePath14,
                                    filePath15
                                ]
                            } else {
                                files = [
                                    filePath1,
                                    filePath2,
                                    filePath3,
                                    filePath4,
                                    filePath5,
                                    filePath6,
                                    filePath7,
                                    filePath8,
                                    filePath9,
                                    filePath10,
                                    filePath11,
                                    filePath12,
                                    filePath13,
                                    filePath14,
                                    filePath15
                                ]
                            }
                            Promise.all(files.map(file => fs.unlink(file)))
                                .then(() => {

                                    return res.status(500).send({ message: 'Archivos borrados debido a que no son pdf o exceden el tamaño máximo por archivo de 2MB' });
                                }).catch(err => {
                                    console.error('Algo malo pasó removiendo los archivos', err);
                                })
                        }
                    }
                }

            } catch (error) {
                return res.status(500).send({ message: "Ocurrió un error " + error });
            }



        } else {
            return res.status(500).send({ message: "No tienes permisos " });
        }

    },
    //Actualizar archivos
    /* updateArchives: function(req, res) {
        var archives = new Archives();
        var projectId = req.params.id;

        var filePath1 = req.files.archivo1.path;
        var filePath2 = req.files.archivo2.path;
        var fileSplit1 = filePath1.split('\\');
        var fileSplit2 = filePath2.split('\\');
        var fileName1 = fileSplit1[1];
        var fileName2 = fileSplit2[1];



        Archives.findByIdAndUpdate(projectId, { "archivo1": fileName1, "archivo2": fileName2 }, { new: true }, (err, projectUpdated) => {
            if (err) return res.status(500).send({ message: 'Error al actualizar el proyecto' });
            if (!projectUpdated) return res.status(404).send({ message: 'No existe el proyecto' });
            return res.status(200).send({ archives: projectUpdated })
        })

    }, */

    //obtener path de cada archivo
    getArchive: function(req, res) {
        var file = req.params.file;
        var path_file = './uploads/' + file;
        console.log(path_file);

        fsa.exists(path_file, (exists) => {
            if (exists) {
                //console.log(path.join(__dirname, '../uploads/' + file));
                //console.log(path.resolve(path_file)) 
                return res.sendFile(path.resolve(path_file));
            } else {
                res.status(500).send({
                    message: 'No existe la información'
                });
            }

        })
    },
    getAllArchives: async function(req, res) {

        var rol_usuario = req.user.rol;
        if (rol_usuario) {
            try {
                var projectrfc = req.params.rfc;

                const findArchives = await Archives.findOne({ rfc: projectrfc.toLowerCase().trim() });
                var output = fsa.createWriteStream('./uploads/' + projectrfc.toUpperCase().trim() + '.zip');
                var archive = archiver('zip');
                archive.pipe(output);
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo1), { name: '1.Formato-Requisitado-Alta-Proveedor.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo2), { name: '2.Constancia-Situacion-Fiscal.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo3), { name: '3.Alta-Imss-Registro-Patronal.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo4), { name: '4.Ine-Representante-Legal.pdf' });
                if (findArchives.archivo5) archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo5), { name: '5.Acta-Constitutiva-Y-Modificaciones.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo6), { name: '6.Comprobante-Domicilio.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo7), { name: '7.Estado-Cuenta-Clabe.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo8), { name: '8.Opinion-Cumplimiento-SAT.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo9), { name: '9.Opinion-Cumplimiento-IMSS.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo10), { name: '10.Opinion-Cumplimiento-INFONAVIT.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo11), { name: '11.Curriculum.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo12), { name: '12.REPSE.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo13), { name: '13.Calibracion-Y-Certificaciones-Equipo.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo14), { name: '14.Codigo-De-Etica.pdf' });
                archive.append(fsa.createReadStream('./uploads/' + findArchives.archivo15), { name: '15.Ultima-Declaracion-Anual.pdf' });

                archive.finalize();



            } catch (error) {
                return res.status(500).send({ message: 'Ocurrió un error: ' + error });
            }
        }

    },
    //Obtener archivos de cada proveedor
    getArchivesRfc: function(req, res) {
        //var archives = new Archives();
        var projectrfc = req.params.rfc;

        if (projectrfc == null) return res.status(404).send({ message: 'Los archivos no existen' })
        Archives.findOne({ rfc: projectrfc.toLowerCase().trim() }, (err, project) => {
            if (err) return res.status(500).send({ message: 'Error al buscar los archivos' });
            if (!project) return res.status(404).send({ message: 'Los archivos no existen' });
            return res.status(200).send({
                archives: project

            })

        });


    },
    refuseArchives: async function(req, res) {

        var projectRfc = req.params.rfc;
        var mensaje = req.params.mensaje.toLowerCase().trim();
        var rol_usuario = req.user.rol;
        if (rol_usuario == "administrador" || rol_usuario == "usuario") {
            try {
                const vendorSearch = await Vendors.findOne({ rfc: projectRfc.toLowerCase().trim() }).exec();
                const userAlta = await Users.findOne({ usuario: vendorSearch.userAlta.toLowerCase().trim() }).exec();

                const archivesRemoved = await Archives.remove({ rfc: projectRfc.toLowerCase().trim() });
                const vendorUpdate = await Vendors.updateOne({ rfc: projectRfc.toLowerCase() }, { verificado: false });
                var contentHtml = `
                <img src="cid:unique@kreata.ee">
                <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                <a href="https://proveedores-supter.com.mx/" target="_blank" >Click aquí para entrar al Sitio Web</a>
                <br>
                <br>
                <h4>Rechazo de archivos</h4>

                <br>
                <br>
                <p>Buen día, debido a: ${mensaje} fueron rechazados los archivos subidos al sistema, deberás subir correctamente
                 la documentación para la validación. Si tienes dudas comunícate directamente con el encargado de proyecto</p>

                <p>Correo enviado automáticamente, no responder correo<p>
                `;
                let transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true, // true for 465, false for other ports
                    auth: {
                        user: 'supter.proveedores@gmail.com', // generated ethereal user
                        pass: 'iojdjwphcfjdsfzy', // generated ethereal password
                    },
                });
                // send mail with defined transport object
                let info = await transporter.sendMail({
                    from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                    to: `${vendorSearch.correo} , ${userAlta.correo}`, // list of receivers
                    subject: `Archivos Rechazados ${vendorSearch.razonSocial.toUpperCase()}`, // Subject line
                    html: contentHtml, // html body
                    attachments: [{
                        filename: 'image.png',
                        path: __dirname + '/logo.png',
                        cid: 'unique@kreata.ee' //same cid value as in the html img src
                    }]
                });
                console.log("Mensaje enviado", info.envelope);
                return res.status(200).send({ archives: archivesRemoved });




            } catch (error) {
                res.status(500).send({ message: 'Ocurrió un error: ' + error });
            }
        } else {
            res.status(500).send({ message: 'No tienes permisos suficientes' });
        }


    },
    getVendors: function(req, res) {
        var rol_usuario = req.user.rol;
        var empresa = req.params.empresa.toLowerCase().trim();
        if (rol_usuario != "proveedor") {
            if (empresa == "todas") {
                Vendors.find({}).sort({ razonSocial: 1 }).exec((err, vendors) => {
                    if (err) return res.status(500).send({ message: 'Error al devolver los datos' });
                    if (!vendors || vendors == "") return res.status(404).send({ message: 'No hay Proveedores que mostrar' });
                    return res.status(200).send({ vendors });
                })

            } else {
                Vendors.find({ empresa: { $all: [empresa.toLowerCase().trim()] } }).sort({ razonSocial: 1 }).exec((err, vendors) => {
                    if (err) return res.status(500).send({ message: 'Error al devolver los datos' });
                    if (!vendors || vendors == "") return res.status(404).send({ message: 'No hay Proveedores que mostrar' });
                    return res.status(200).send({ vendors });
                })

            }


        }
    },
    getVendor: function(req, res) {
        var vendorId = req.params.id;
        var rol_usuario = req.user.rol;

        if (vendorId == null) return res.status(404).send({ message: 'Error al buscar proveedor' });
        Vendors.findById(vendorId, (err, vendor) => {
            if (err) return res.status(500).send({ message: 'El proveedor no existe' });
            if (!vendor) return res.status(404).send({ message: 'El proveedor no existe' });
            return res.status(200).send({ vendor });

        })


    },
    getVendorRfc: function(req, res) {
        var vendorrfc = req.params.rfc.toLowerCase().trim();
        var rol_usuario = req.user.rol;
        if (vendorrfc == null) return res.status(404).send({ message: 'Error al buscar proveedor' });
        Vendors.findOne({ rfc: vendorrfc.toLowerCase() }, (err, vendor) => {
            if (err) return res.status(500).send({ message: 'El proveedor no existe' });
            if (!vendor) return res.status(404).send({ message: 'El proveedor no existe' });
            return res.status(200).send({ vendor });

        })
    },
    saveVendor: async function(req, res) {
        var login = new Users();
        var params = req.body;
        var pass = "";
        var correoP = 'irving.davila@grupo-sacmag.com.mx';
        var rol_usuario = req.user.rol;
        var emailUser = req.user.correo;
        var userAlta = req.user.usuario;
        if (rol_usuario == "administrador" || rol_usuario == "usuario") {
            if (params.rfc && params.registroPatronal && params.razonSocial && params.tipoProveedor && params.regimenFiscal && params.nombreContacto && params.correo && params.empresa) {
                try {
                    const resProv = await Vendors.find({ rfc: params.rfc.toLowerCase().trim() }).exec();
                    if (resProv == "") {
                        var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                        for (var i = 0; i < 8; i++) {
                            pass += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        const hashedPassword = await new Promise((resolve, reject) => {
                            bcrypt.hash(pass, null, null, function(err, hash) {
                                if (err) reject(err)
                                resolve(hash)
                            });
                        })
                        var vendor = new Vendors();
                        vendor.rfc = params.rfc.toLowerCase().trim();
                        vendor.registroPatronal = params.registroPatronal.toLowerCase().trim();
                        vendor.razonSocial = params.razonSocial.toLowerCase().trim();
                        vendor.tipoProveedor = params.tipoProveedor.toLowerCase().trim();
                        vendor.regimenFiscal = params.regimenFiscal.toLowerCase().trim();
                        vendor.nombreContacto = params.nombreContacto.toLowerCase().trim();
                        vendor.correo = params.correo.toLowerCase().trim();
                        vendor.telefono = params.telefono;
                        vendor.empresa = params.empresa.toLowerCase().trim();
                        vendor.userAlta = userAlta.toLowerCase().trim();
                        if (params.observaciones != null) {
                            if (params.observaciones.trim() != '') vendor.observaciones = params.observaciones.toLowerCase().trim();
                        } else {
                            vendor.observaciones = '';
                        }
                        vendor.borrado = false;
                        vendor.verificado = false;
                        login.usuario = params.rfc.toLowerCase().trim();
                        login.password = hashedPassword;
                        login.correo = params.correo.toLowerCase().trim();
                        login.rol = 'proveedor';
                        login.nombre = params.razonSocial.toLowerCase().trim();
                        login.apellidoP = '';
                        login.apellidoM = '';
                        login.rfc = params.rfc.toLowerCase().trim();
                        login.alta = userAlta.toLowerCase().trim();
                        login.borrado = false;
                        var saveInformation = await login.save();
                        saveInformation.password = undefined;
                        var vendorInformation = await vendor.save();
                        var contentHtml = `
                <img src="cid:unique@kreata.ee">
                <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                <h4>Datos del Usuario Para Entrar Al Sistema</h4>
                <a href="https://proveedores-supter.com.mx/" target="_blank" >Click aquí para entrar al Sitio Web</a>
                
                <ul>

                    <li><b>Usuario: ${params.rfc.toLowerCase().trim()}</b></li>
                    <li><b>Contraseña ${pass}</b></li>
                </ul>
                    <br>
                    <br>
                    <h4>Archivos a enviar</h4>
                    <ol>
                    <li>Formato requisitado para alta del proveedor</li>
                    <li>Constancia de situación fiscal SAT</li>
                    <li>Alta imss registro patronal</li>
                    <li>Ine representante legal</li>
                    <li>Acta constitutiva y modificaciones(sólo aplica para persona moral) y poder del representante legal</li>
                    <li>Comprobante de domicilio del domicilio fiscal vigente</li>
                    <li>Estado de cuenta con cuenta clabe, sólo caratula</li>
                    <li>Opinión de cumplimiento de 32D SAT</li>
                    <li>Opinión de cumplimiento de 32D IMSS</li>
                    <li>Opinión de cumplimiento de 32D INFONAVIT</li>
                    <li>Curriculum de la empresa o persona fisica y/o cédula de las personas que realizarán el proyecto</li>
                    <li>Registro de prestadoras de servicios especializados u obras especializadas (REPSE)</li>
                    <li>Especificaciones de calibración de equipos y certificaciones en caso de contar con equipo</li>
                    <li>Código de ética firmado por representante legal</li>
                    <li>Última declaración anual y estados financieros del año(cualquiera de los últimos 3 meses)</li>
                    </ol>
                    
                    <h4>Notas</h4>
                    <ol>
                    <li>Todos los campos son requeridos</li>
                    <li>Sólo puedes subir archivos pdf y con un peso máximo de 2 MB por archivo</li>
                    <li>En caso de que algún archivo no aplique, subir un archivo PDF con nombre "No aplica" vacío</li>
                    </ol>
                    
                    <br><br><br><br><br><br>
                    <p>Recuerda subir todos tus archivos al sistema para validarte como proveedor autorizado</p>
                    <p>Correo enviado automáticamente, no responder correo<p>
                
                `;
                        let transporter = nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 465,
                            secure: true, // true for 465, false for other ports
                            auth: {
                                user: 'supter.proveedores@gmail.com', // generated ethereal user
                                pass: 'iodjjwphcfjdsfzy', // generated ethereal password
                            },
                        });
                        // send mail with defined transport object
                        let info = await transporter.sendMail({
                            from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                            to: `${correoP} , ${params.correo.toLowerCase().trim()} , ${emailUser}`, // list of receivers
                            subject: "Accesos para entrar a la plataforma de Proveedores", // Subject line
                            html: contentHtml, // html body
                            attachments: [{
                                filename: 'image.png',
                                path: __dirname + '/logo.png',
                                cid: 'unique@kreata.ee' //same cid value as in the html img src
                            }]
                        });
                        console.log("Mensaje enviado", info.envelope);
                        return res.status(200).send({
                            vendor: vendorInformation,
                            user: saveInformation
                        })
                    } else {
                        const resProv = await Vendors.updateOne({ rfc: params.rfc.toLowerCase().trim() }, { $addToSet: { empresa: params.empresa } }).exec();
                        if (req.user.empresa == "supter") {
                            const SEARCHARCHIVE = await Archives.findOne({ rfc: params.rfc.toLowerCase().trim() });
                            if (SEARCHARCHIVE == null) {
                                return res.status(200).send({ message: 'Se ingresó correctamente el Proveedor' });
                            } else {
                                var addArchives = [];
                                if (SEARCHARCHIVE.archivo1) addArchives.push('project.js');
                               /* if (SEARCHARCHIVE.archivo2) addArchives.push(SEARCHARCHIVE.archivo2);
                                if (SEARCHARCHIVE.archivo3) addArchives.push(SEARCHARCHIVE.archivo3);
                                if (SEARCHARCHIVE.archivo4) addArchives.push(SEARCHARCHIVE.archivo4);
                                if (SEARCHARCHIVE.archivo5) addArchives.push(SEARCHARCHIVE.archivo5);
                                if (SEARCHARCHIVE.archivo6) addArchives.push(SEARCHARCHIVE.archivo6);
                                if (SEARCHARCHIVE.archivo7) addArchives.push(SEARCHARCHIVE.archivo7);
                                if (SEARCHARCHIVE.archivo8) addArchives.push(SEARCHARCHIVE.archivo8);
                                if (SEARCHARCHIVE.archivo9) addArchives.push(SEARCHARCHIVE.archivo9);
                                if (SEARCHARCHIVE.archivo10) addArchives.push(SEARCHARCHIVE.archivo10);
                                if (SEARCHARCHIVE.archivo11) addArchives.push(SEARCHARCHIVE.archivo11);
                                if (SEARCHARCHIVE.archivo12) addArchives.push(SEARCHARCHIVE.archivo12);
                                if (SEARCHARCHIVE.archivo13) addArchives.push(SEARCHARCHIVE.archivo13);
                                if (SEARCHARCHIVE.archivo14) addArchives.push(SEARCHARCHIVE.archivo14);
                                if (SEARCHARCHIVE.archivo15) addArchives.push(SEARCHARCHIVE.archivo15);*/
                               // for (var i = 0; i < addArchives.length; i++) {
                                console.log(__dirname);   
				 await fsa.copyFile(`/${addArchives[0]}`, `hola.js`, (err) => {
                                        if (err) {
                                            console.log("Error Found:", err);

                                        } else {
                                            console.log("\nFile Contents of copied_file:");


                                        }
                                    })

                                //}
                                return res.status(200).send({ vendor: resProv });


                            }
                        } else {
                            return res.status(200).send({ vendor: resProv });
                        }

                    }
                } catch (error) {
                    console.log("Ocurrió un error al registrar Proveedor " + error);
                    return res.status(500).send({ message: 'Ocurrió unerror al registrar la información' + error })

                }
            } else {
                return res.status(500).send({ message: 'Completa los campos faltantes' });
            }

        } else {
            return res.status(500).send({ message: 'No cuentas con los permisos suficientes' });
        }
    },
    updateVendors: async function(req, res) {

        var projectId = req.params.id;
        var send = req.params.send;
        var update = req.body;
        var rol_usuario = req.user.rol;
        var emailUser = req.user.correo;
        var correoP = "irving.davila@grupo-sacmag.com.mx";
        if (rol_usuario == "administrador" || rol_usuario == "usuario") {
            if (update.rfc && update.correo && update.registroPatronal && update.razonSocial && update.tipoProveedor && update.regimenFiscal && update.nombreContacto && update.telefono) {
                update.rfc = update.rfc.toLowerCase().trim();
                update.correo = update.correo.toLowerCase().trim();
                update.registroPatronal = update.registroPatronal.toLowerCase().trim();
                update.razonSocial = update.razonSocial.toLowerCase().trim();
                update.tipoProveedor = update.tipoProveedor.toLowerCase().trim();
                update.regimenFiscal = update.regimenFiscal.toLowerCase().trim();
                update.nombreContacto = update.nombreContacto.toLowerCase().trim();
                if (update.observaciones) {
                    update.observaciones = update.observaciones.toLowerCase().trim();
                }
                try {

                    const projectUpdated = await Vendors.findByIdAndUpdate(projectId, update, { new: true });
                    const userUpdated = await Users.updateOne({ rfc: update.rfc }, { $set: { razonSocial: update.razonSocial, correo: update.correo } });
                    if (Boolean(send) == true) {
                        var pass = "";
                        var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                        for (var i = 0; i < 8; i++) {
                            pass += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        const hashedPassword = await new Promise((resolve, reject) => {
                            bcrypt.hash(pass, null, null, function(err, hash) {
                                if (err) reject(err)
                                resolve(hash)
                            });
                        })
                        const UpdateUserVendor = await Users.updateOne({ rfc: update.rfc }, { $set: { password: hashedPassword } });
                        var contentHtml = `
                        <img src="cid:unique@kreata.ee">
                        <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                        <h4>Datos del Usuario Para Entrar Al Sistema</h4>
                        <a href="https://proveedores-supter.com.mx/" target="_blank" >Click aquí para entrar al Sitio Web</a>
                
                        <ul>

                            <li><b>Usuario: ${update.rfc}</b></li>
                            <li><b>Contraseña ${pass}</b></li>
                        </ul>
                        <br>
                        <br>
                        <h4>Archivos a enviar</h4>
                        <ol>
                        <li>Formato requisitado para alta del proveedor</li>
                        <li>Constancia de situación fiscal SAT</li>
                        <li>Alta imss registro patronal</li>
                        <li>Ine representante legal</li>
                        <li>Acta constitutiva y modificaciones(sólo aplica para persona moral) y poder del representante legal</li>
                        <li>Comprobante de domicilio del domicilio fiscal vigente</li>
                        <li>Estado de cuenta con cuenta clabe, sólo caratula</li>
                        <li>Opinión de cumplimiento de 32D SAT</li>
                        <li>Opinión de cumplimiento de 32D IMSS</li>
                        <li>Opinión de cumplimiento de 32D INFONAVIT</li>
                        <li>Curriculum de la empresa o persona fisica y/o cédula de las personas que realizarán el proyecto</li>
                        <li>Registro de prestadoras de servicios especializados u obras especializadas (REPSE)</li>
                        <li>Especificaciones de calibración de equipos y certificaciones en caso de contar con equipo</li>
                        <li>Código de ética firmado por representante legal</li>
                        <li>Última declaración anual y estados financieros del año(cualquiera de los últimos 3 meses)</li>
                        </ol>
                    
                        <h4>Notas</h4>
                        <ol>
                        <li>Todos los campos son requeridos</li>
                        <li>Sólo puedes subir archivos pdf y con un peso máximo de 2 MB por archivo</li>
                        <li>En caso de que algún archivo no aplique, subir un archivo PDF con nombre "No aplica" vacío</li>
                        </ol>
                    
                        <br><br><br><br><br><br>
                        <p>Recuerda subir todos tus archivos al sistema para validarte como proveedor autorizado</p>
                        <p>Correo enviado automáticamente, no responder correo<p>
                            `;

                        let transporter = nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 465,
                            secure: true, // true for 465, false for other ports
                            auth: {
                                user: 'supter.proveedores@gmail.com', // generated ethereal user
                                pass: 'iodjjwphcfjdsfzy', // generated ethereal password
                            },
                        });
                        // send mail with defined transport object
                        let info = await transporter.sendMail({
                            from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                            to: `${correoP} , ${update.correo} , ${emailUser}`, // list of receivers
                            subject: "Accesos para entrar a la plataforma de Proveedores", // Subject line
                            html: contentHtml, // html body
                            attachments: [{
                                filename: 'image.png',
                                path: __dirname + '/logo.png',
                                cid: 'unique@kreata.ee' //same cid value as in the html img src
                            }]
                        });
                        console.log("Mensaje enviado", info.envelope);

                    }


                    return res.status(200).send({ project: projectUpdated });



                } catch (error) {
                    res.status(500).send({ message: 'Ocurrió un error: ' + error });
                }

            } else {
                res.status(500).send({ message: 'Llena los campos requeridos' });
            }
        } else {
            res.status(500).send({ message: 'No tienes permisos suficientes' });
        }



    },

    validateVendor: function(req, res) {
        var projectRfc = req.params.rfc;
        /* var rol_usuario = req.user.rol;
        if (rol_usuario == "administrador" || rol_usuario == "usuario") { */


        Archives.updateOne({ rfc: projectRfc.toLowerCase().trim() }, { validar: true }, (err, archivesUpdate) => {
                if (err) return res.status(500).send({ message: 'No se han podido borrar los archivos' });
                if (!archivesUpdate) return res.status(404).send({ message: 'Error al borrar los archivos' });
                if (archivesUpdate) {
                    Vendors.updateOne({ rfc: projectRfc.toLowerCase() }, { verificado: true }, (err, vendorUpdate) => {
                        if (err) return res.status(500).send({ message: 'Error al actualizar el proveedor' });
                        if (!vendorUpdate) return res.status(404).send({ message: 'Error al actualizar el proveedor' });

                        return res.status(200).send({

                            archives: archivesUpdate


                        })
                    })

                }
            })
            /* } else {
                res.status(500).send({ message: 'No tienes permisos suficientes' });
            } */


    },
    changePassword: async function(req, res) {
        var newPass = req.params.newPass;
        var params = req.body;

        if (params.rfc && params.correo && newPass) {
            try {
                params.rfc = params.rfc.trim().toLowerCase();
                params.correo = params.correo.trim().toLowerCase();
                if (params.password) params.password = params.password.trim();
                newPass = newPass.trim();
                const userFound = await Users.findOne({ rfc: params.rfc, correo: params.correo });

                if (userFound == null) {
                    return res.status(500).send({ message: 'Ocurrió un error: La información proporcionada es incorrecta' });
                }
                if (params.password) {
                    const passwordCompare = await new Promise((resolve, reject) => {
                        bcrypt.compare(params.password, userFound.password, function(err, check) {
                            if (err) reject(err)
                            resolve(check)
                        });
                    })
                    if (passwordCompare) {
                        const hashedPassword = await new Promise((resolve, reject) => {
                            bcrypt.hash(newPass, null, null, function(err, hash) {
                                if (err) reject(err)
                                resolve(hash)
                            });
                        })
                        const userUpdated = await Users.updateOne({ rfc: params.rfc }, { $set: { password: hashedPassword } });
                        return res.status(200).send({ userUpdated });
                    } else {
                        return res.status(500).send({ message: 'Ocurrió un error: La información no coincide' });
                    }
                } else {
                    const hashedPassword = await new Promise((resolve, reject) => {
                        bcrypt.hash(newPass, null, null, function(err, hash) {
                            if (err) reject(err)
                            resolve(hash)
                        });
                    })
                    const userUpdated = await Users.updateOne({ rfc: params.rfc }, { $set: { password: hashedPassword } });
                    return res.status(200).send({ userUpdated });
                }

            } catch (error) {
                return res.status(500).send({ message: 'Ocurrió un error: ' + error });
            }
        } else {
            return res.status(500).send({ message: 'Llena los campos requeridos' });
        }




    },
    forgotPass: async function(req, res) {
        var usuario = req.params.usuario;
        try {
            const userFound = await Users.findOne({ usuario: usuario.trim().toLowerCase() });
            if (userFound == null) return res.status(500).send({ message: 'Ocurrió un error: La información proporcionada es incorrecta' });
            userFound.password = undefined;
            var correo = userFound.correo;
            //<a href="https://proveedores-grupo-sacmag.com.mx/api/" target="_blank" >Click aquí para recuperar contraseña</a>
            var contentHtml = `
                <img src="cid:unique@kreata.ee">
                <h1>Proveedores Supter - Ingeniería y Supervisión</h1>
                <a href="https://proveedores-supter.com.mx/recuperar-info/${userFound.rfc.toUpperCase()}/${userFound.correo.toUpperCase()}" target="_blank" >Click aquí para recuperar contraseña</a>
                <br>
                <br>
                <p>Correo enviado automáticamente, no responder correo<p>
                `;

            let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true, // true for 465, false for other ports
                auth: {
                    user: 'supter.proveedores@gmail.com', // generated ethereal user
                    pass: 'iodjjwphcfjdsfzy', // generated ethereal password
                },
            });
            // send mail with defined transport object
            let info = await transporter.sendMail({
                from: '"Proveedores Supter " <supter.proveedores@gmail.com>', // sender address
                to: `${userFound.correo}`, // list of receivers
                subject: "Cambio de contraseña", // Subject line
                html: contentHtml, // html body
                attachments: [{
                    filename: 'image.png',
                    path: __dirname + '/logo.png',
                    cid: 'unique@kreata.ee' //same cid value as in the html img src
                }]
            });
            console.log("Mensaje enviado", info.envelope);


            return res.status(200).send({ correo });
        } catch (error) {
            return res.status(500).send({ message: 'Ocurrió un error: ' + error });
        }
    }


}

module.exports = controller;
