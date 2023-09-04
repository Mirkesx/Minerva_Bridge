const { authenticate } = require("@feathersjs/authentication").hooks;
const bcrypt = require("bcrypt");
const { hashPassword, protect } =
  require("@feathersjs/authentication-local").hooks;
const { hasHeader } = require("../../hasHeader");
const { NotAuthenticated } = require("@feathersjs/errors");
const jwt = require("jsonwebtoken");
const admin = require("../../models/admin.model");

module.exports = {
  before: {
    all: [],
    find: [
      async (context) => {
        const hasHeaderObj = new hasHeader();
        const { headers } = context.params;
        //console.log("DATA:", context.data)
        // Check if the `Authorization` header is present
        await hasHeaderObj.hasAuthorization(headers);
        // Extract the JWT from the `Authorization` header
        const [, token] = headers.authorization.split(" ");
        console.log(token);

        // Verify the JWT using the secret key
        try {
          const secret = context.app.get("authentication").secret;
          const payload = jwt.verify(token, secret);
          context.params.idAdmin = payload.idAdmin;
          console.log("payload", payload.idAdmin);
          console.log("idADmin", context.params.idAdmin);
          return context;
        } catch (error) {
          // If the JWT is invalid, throw an error
          throw new NotAuthenticated("Token non valido!");
        }
      },
    ],
    get: [],
    create: [
      async (context) => {
        const hasHeaderObj = new hasHeader();
        const { headers } = context.params;
        //console.log("DATA:", context.data)
        // Check if the `Authorization` header is present
        await hasHeaderObj.hasAuthorization(headers);
        // Extract the JWT from the `Authorization` header
        const [, token] = headers.authorization.split(" ");
        console.log(token);

        // Verify the JWT using the secret key
        try {
          const secret = context.app.get("authentication").secret;
          const payload = jwt.verify(token, secret);

          //controllo se admin è owner di lms in route params
          const adminModel = admin(context.app);
          const _admin = await adminModel.findOne({
            where: {
              id: payload.idAdmin,
              role: "superadmin",
            },
          });

          if (!_admin) {
            context.data.idAdmin = payload.idAdmin;
          } else {
            const tmp_admin = await adminModel.findOne({
              where: {
                id: context.data.idAdmin,
              },
            });

            if (!tmp_admin) {
              throw new NotAuthenticated("Admin non trovato");
            }
          }

          return context;
        } catch (error) {
          // If the JWT is invalid, throw an error
          throw new NotAuthenticated("Token non valido!");
        }
      },
    ],
    update: [],
    patch: [
      async (context) => {
        const hasHeaderObj = new hasHeader();
        const { headers } = context.params;
        console.log("DATA:", context.data);
        // Check if the `Authorization` header is present
        await hasHeaderObj.hasAuthorization(headers);
        // Extract the JWT from the `Authorization` header
        const [, token] = headers.authorization.split(" ");
        console.log(token);

        // Verify the JWT using the secret key
        try {
          const secret = context.app.get("authentication").secret;
          const payload = jwt.verify(token, secret);
          //controllo se admin è owner di lms in route params
          const lmsModel = context.app.service("/admin/lms").Model;
          const _lms = await lmsModel.findOne({
            where: {
              id: context.id,
              idAdmin: payload.idAdmin,
            },
          });

          if (!_lms) {
            throw new NotAuthenticated(
              "Non sei autorizzato a modificare questo lms"
            );
          }

          //eliminare dal context.data eventuale se presente campo secret e idAdmin
          delete context.data.secret;
          delete context.data.idAdmin;
          return context;
        } catch (error) {
          // If the JWT is invalid, throw an error
          console.log(error);
          throw new NotAuthenticated("Token non valido!");
        }
      },
    ],
    remove: [],
  },

  after: {
    all: [
      // Make sure the password field is never sent to the client
      // Always must be the last hook
      protect("password"),
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
