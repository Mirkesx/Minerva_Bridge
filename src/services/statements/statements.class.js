const _utenti = require('../../models/access.model');
const _lmsModel = require('../../models/lms.model');
const getAuth = require('../../models/get-auth-code.model');
const axios = require('axios')
const { BadRequest } = require('@feathersjs/errors');
const lmsModel = require('../../models/lms.model');

exports.Statements = class Statements {
  constructor (options, app) {
    this.options = options || {};
    this.app = app;
    }

  async find (params) {
    return [];
  }

  async get (id, params) {
    return {
      id, text: `A new message with ID: ${id}!`
    };
  }

  async create (data, params) {
    const {payload} = params.clientData;

    const {idUsr} = payload;
    const {idLms} = payload
    const {authCode} = payload
    const {idApp3D} = payload

    const save_data = data;

    const getAuthModel = getAuth(this.app);
    const lmsModel = _lmsModel(this.app);
    //const getHook = hook(this.app);
    const _utente = await getAuthModel.findOne({
      where: {
        idLms: idLms,
        idUsr: idUsr,
        idApp3D: idApp3D,
        authCode: authCode,
        validated: true
      }
    });

    //controllare quale sia il baseURL dell'LMS associato
    const _lms = await lmsModel.findOne({
      where: {
        id: idLms
      }
    });

    const baseURL = _lms.baseURL;
    const statementType = _lms.statementsType;
    const postfix = _utente.postfix;
    const authToken = _utente.commitToken;
    const key = _lms.authUsername;
    const secret = _lms.authPassword;

    if(!_utente){
      throw new BadRequest("Errore, token errato o authCode non verificato");
    }

    var statements = [];
    if(statementType == "XAPI"){
      //routine per XAPI
      for(let i = 0; i < save_data.length; i++){
        //routine per statement
        //scorporare il codice attuale in una funzione
        statements[i] = await this.generateXAPIStatement(save_data[i], idUsr, idLms, idApp3D);
        //send XAPI statement to LRS
      }
      const res = await this.sendXAPIStatement(statements, baseURL, postfix, authToken, key, secret);
      return res;
    }else if(statementType == "SCORM"){
      //routine per SCORM
      for(let i = 0; i < save_data.length; i++){
        //routine per statement
        //scorporare il codice attuale in una funzione
        statements[i] = await this.generateSCORMData(save_data[i],idUsr, idLms, idApp3D);
        //send SCORM data to SCORM server
      }
      const res = await this.sendSCORMData(statements, baseURL, postfix, authToken, key, secret);
      return res;
    }
  }

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    return data;
  }

  async remove (id, params) {
    return { id };
  }

  async generateXAPIStatement(data, idUsr, idLms, idApp3D){
    const {identifier, parameter, object, value, timestamp} = data;
    if(value !=undefined){
      const statement = {
        "actor": {
          "mbox": "mailto:"+idUsr+"."+idLms+'.'+idApp3D+'.'+identifier+"@minerva.sferainnovazione.com",
          "name": idUsr+"."+idLms+'.'+idApp3D+'.'+identifier
        },
        "verb": {
          "id": "http://minerva.sferainnovazione.com/verb/isContainedIn",
          "display": { "en-US": "isContainedIn" }
        },
        "object": {
          "id": "http://minerva.sferainnovazione.com/activity/3dApp/"+idApp3D,
          "definition": {
            "name": { "en-US": "E-learning 3D Application." },
            "type": "http://minerva.sferainnovazione.com/activity-type/e-learning"
          }
        },
        "context":{
          "extensions": {
            "http://minerva.sferainnovazione.com/xapi/extensions/properties": {
              "timestamp":timestamp
            }
          }
        }
      }

      statement.context.extensions["http://minerva.sferainnovazione.com/xapi/extensions/properties"][parameter] = value;
      return statement;
    }else if(object != undefined){
      const statement = {
        "actor": {
          "mbox": "mailto:"+idUsr+"."+idLms+'.'+idApp3D+'.'+identifier+"@minerva.sferainnovazione.com",
          "name": idUsr+"."+idLms+'.'+idApp3D+'.'+identifier
        },
        "verb": {
          "id": "http://minerva.sferainnovazione.com/verb/isContainedIn",
          "display": { "en-US": "isContainedIn" }
        },
        "object": {
          "objectType": "Agent",
          "mbox": "mailto:"+idUsr+"."+idLms+'.'+idApp3D+'.'+object+"@minerva.sferainnovazione.com",
          'name': idUsr+"."+idLms+'.'+idApp3D+'.'+object
        },
        "context":{
          "extensions": {
            "http://minerva.sferainnovazione.com/xapi/extensions/properties": {
              "timestamp":timestamp
            }
          }
        }
      }

      statement.context.extensions["http://minerva.sferainnovazione.com/xapi/extensions/properties"][parameter] = "mailto:"+idUsr+"."+idLms+'.'+idApp3D+'.'+object+"@minerva.sferainnovazione.com";
      return statement;
    }
  }

  async generateSCORMData(data, idUsr, idLms, idApp3D){
    const scorm = {
      "id_member" : idUsr,
      "id_modulo" : idApp3D,
      "data" : [
          {
              "element":"cmi.core.score.raw",
              "value":"100"
          },
          {
              "element":"adlcp:masteryscore",
              "value":"100"
          },
          {
              "element":"cmi.student_data.mastery_score",
              "value":"100"
          },
          {
              "element":"cmi.launch_data",
              "value":"launch_data"
          },
          {
              "element":"cmi.suspend_data",
              "value": JSON.stringify(data)
          },
          {
              "element":"cmi.core.lesson_location",
              "value":"lesson_location"
          },
          {
              "element":"cmi.core.lesson_status",
              "value":"incomplete"
          },
          {
              "element":"cmi.core.lesson_location",
              "value":"lesson_location"
          },
          {
              "element":"cmi.core.entry",
              "value":"entry"
          },
          {
              "element":"cmi.core.exit",
              "value":"exit"
          },
          {
              "element":"cmi.core.total_time",
              "value":"12:00:12"
          },
          {
              "element":"cmi.core.session_time",
              "value":"05:00:00"
          }]
    };


    return scorm;
  }

  async sendXAPIStatement(statement, baseURL, postfix, authToken, key, secret){
    try {
      if(authToken == null){
          const response = await axios.post(
            baseURL + postfix,
            statement,
            {
              auth: {
                username: key,
                password: secret,
              },

              headers: {
                'Content-Type': 'application/json',
                'X-Experience-API-Version' : '1.0.2'
              },
            },
          );

          return {statusMsg:"Statements salvati correttamente!", statementsId: response.data};
      }else{
        const response = await axios.post(
          baseURL + postfix,
          statement,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Experience-API-Version' : '1.0.2',
              'Authorization': 'Bearer '+authToken,
            },
          },
        );

        return {statusMsg:"Statements salvati correttamente!", statementsId: response.data};
      }

    } catch (err) {
      return {statusMsg:"Errore, Statements non salvati!", statementsId: null};
    }
  }

  async sendSCORMData(statement, baseURL, postfix, authToken, key, secret){
    try {
      if(authToken == null){
          const response = await axios.post(
            baseURL + postfix,
            statement,
            {
              auth: {
                username: key,
                password: secret,
              },

              headers: {
                'Content-Type': 'application/json'
              },
            },
          );

          return {statusMsg:"Statements salvati correttamente!", statementsId: response.data};
      }else{
        const response = await axios.post(
          baseURL + postfix,
          statement,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer '+authToken
            },
          },
        );

        return {statusMsg:"Statements salvati correttamente!", statementsId: response.data};
      }

    } catch (err) {
      return {statusMsg:"Errore, Statements non salvati!", statementsId: null};
    }
  }
};
