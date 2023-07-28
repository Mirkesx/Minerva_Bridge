const _utenti = require('../../models/access.model');
const _lmsModel = require('../../models/lms.model');
const getAuth = require('../../models/get-auth-code.model');
const axios = require('axios')
const { BadRequest } = require('@feathersjs/errors');
const lmsModel = require('../../models/lms.model');
const {ngsild} = require('../../ngsild.js');

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
        statements[i] = await this.generateXAPIStatement(save_data[i], idUsr, idLms, idApp3D);
      }
      //send XAPI data to LRS
      const res = await this.sendXAPIStatement(statements, baseURL, postfix, authToken, key, secret);
      const ngsi = await this.generateNGSILD(save_data, idUsr, idLms, idApp3D, authCode);

      console.log(ngsi)
      return {res};
    }else if(statementType == "SCORM"){
      //routine per SCORM
      var scorm;
      scorm = await this.generateSCORMData(save_data,idUsr);
      console.log(scorm);
      if(scorm != null){
        const resp = await this.sendSCORMData(scorm, baseURL, postfix, authToken, key, secret);
        return resp;
      }
      return {statusMsg:"Non erano presenti statements SCORM da inviare!"};
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
          console.log(response.data)
          return {statusMsg:"Statements salvati correttamente!"};
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
        console.log(response.data);
        return {statusMsg:"Statements salvati correttamente!"};
      }

    } catch (err) {
      return BadRequest("Errore, Statements non salvati! Dettagli: "  + err);
    }
  }

  async areSCORMStatementsValid(data){
    for(let i = 0; i < data.length; i++){
      const {identifier} = data[i];
      if(identifier == "defaultplayer"){
        console.log("defaultplayer!");
        return true;
      }
    }
    console.log("not defaultplayer!");
    return false;
  }

  async isSCORMValueValid(data){
    for(let i = 0; i < data.length; i++){
      const {identifier, parameter, value, timestamp} = data[i];
      if(identifier == "defaultplayer"){
        if(parameter == "cmi.core.score.raw" || parameter == "adlcp:masteryscore" || parameter == "cmi.student_data.mastery_score"){
          if(value == null || value == undefined || value == "" || value == " "){
            return false;
          }
        }
      }
    }
    return true;
  }

  async generateSCORMData(data, idUsr){
    const isDefaultPlayer = await this.areSCORMStatementsValid(data);
    if(!isDefaultPlayer){
      return null;
    }

    const scorm = {
      "data" : [
          {
              "element":"cmi.core.score.raw",
              "value":"10"
          },
          {
              "element":"adlcp:masteryscore",
              "value":"10"
          },
          {
              "element":"cmi.student_data.mastery_score",
              "value":"10"
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
          },
          {
              "element":"cmi.core.student_id",
              "value":idUsr
          },]
    };

    for(let i = 0; i < data.length; i++){
      const {identifier, parameter, value, timestamp} = data[i];
      if(identifier == "defaultplayer"){
        for(let j = 0; j < scorm.data.length; j++){
          if(scorm.data[j].element == parameter){
            scorm.data[j].value = value;
          }
        }
      }
    }

    return scorm;
  }
  async sendSCORMData(statement, baseURL, postfix, authToken, key, secret){
    try {
      //se il postfix non inizia con / aggiungilo, altrimenti lascialo così
      const _postfix = postfix.indexOf('/') == 0 ? postfix : '/'+postfix;
      if(authToken == null){
          const response = await axios.post(
            baseURL + _postfix,
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
          console.log(response.data, response.status);
          if(response.status == 200 || response.status == 201){
            return {statusMsg:"Statements salvati correttamente!"};
          }else{
            return BadRequest("Errore, Statements non salvati! Dettagli: "  + response.data);
          }
      }else{
        const response = await axios.post(
          baseURL + _postfix,
          statement,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer '+authToken
            },
          },
        );
        console.log(response.data, response.status);
          if(response.status == 200 || response.status == 201){
            return {statusMsg:"Statements salvati correttamente!"};
          }else{
            return BadRequest("Errore, Statements non salvati! Dettagli: "  + response.data);
          }
      }

    } catch (err) {
      return BadRequest("Errore, Statements non salvati! Dettagli: "  + err);
    }
  }

  async generateNGSILD(data, idUsr, idLms, idApp3D, authCode){
    //genera NGSILD
    const ngsildObj = new ngsild("urn:ngsi-ld:Minerva:XAPIStatement:0001",
        "XAPIStatement",
        [{
          name : "color",
          value : {
            "type": "Property",
            "value": "red"
          }
        },
        {
          name : "mbox",
          value : {
            "type": "Property",
            "value": "mailto:"+idUsr+"."+idLms+'.'+idApp3D+'.'+authCode+"@minerva.sferainnovazione.com"
          }
        },],
        [{
          name : "hasObject",
          value : {
            "type": "Relationship",
            "object": "urn:ngsi-ld:Building:001"
          }
        }],
        [
          "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
          "https://schema.lab.fiware.org/ld/context"
        ]
        );

    return ngsildObj.generateEntity();
  }
};
