const { authenticate } = require('@feathersjs/authentication').hooks;
const jwt = require('jsonwebtoken');
const lms = require('../../models/lms.model');
const crypto = require('crypto');
const { NotAuthenticated } = require('@feathersjs/errors')

module.exports = {
  before: {
    all: [],
    find: [

      async context => {
      const { headers } = context.params;
      const lmsModel = lms(context.app);

      // Check if the `Authorization` header is present
      if (!headers.authorization) {
        throw new Error('Missing `Authorization` header');
      }

      // Extract the JWT from the `Authorization` header
      const [, token] = headers.authorization.split(' ');

      // Verify the JWT using the secret key
      try {
        const secret = context.app.get('authentication').secret;
        const payload = jwt.verify(token, secret);

        const clientData = {
          payload
        }
        context.data = clientData;
      } catch (error) {
        // If the JWT is invalid, throw an error
        throw new NotAuthenticated('Unauthorized, token not valid!')
      }

      const user = await lmsModel.findOne({
        where: {
          email: context.data.payload.email
        }
      });

      if(!user){
        context.params = {statusMsg: "email"};
        return context;
      }

      const secret =  crypto.randomBytes(6).toString('hex');
      await lmsModel.update({secret},{
        where:{
          verified:true,
          email: context.data.payload.email
        }
      })
      context.params = {statusMsg:"Secret resettato", secret}
      return context;
    }],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};