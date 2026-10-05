import express from "express";
import ENV from "../configs/env.config.js";
import { readAccessToken, isAcceptableAccessToken } from "../utils/accessToken.js";

// Request bodies are read into memory before any route runs — that is, before the
// route's own login check. So the size a caller may send is capped here, in two tiers:
//
//   - every route: JSON_BODY_LIMIT (file uploads don't go through here; they are
//     multipart and are handled by multer on their own routes)
//   - the spreadsheet save routes: SHEET_BODY_LIMIT, because a whole workbook is one
//     JSON body. That larger allowance is only given to a request that already
//     carries a valid access token; anything else is turned away unread.

const LARGE_BODY_ROUTES = [
    /^\/api\/daily-morning-meetings\/[^/]+\/sheet(?:\/patch)?\/?$/,
    /^\/api\/daily-meeting-sheets\/save\/?$/,
];

export const isLargeBodyRoute = (method, path) =>
    method === "POST" && LARGE_BODY_ROUTES.some((pattern) => pattern.test(path));

const standardJson = express.json({ limit: ENV.JSON_BODY_LIMIT });
const sheetJson = express.json({ limit: ENV.SHEET_BODY_LIMIT });

// Must be mounted after cookie-parser: the access token is usually in a cookie.
export const jsonBody = (req, res, next) => {
    if (!isLargeBodyRoute(req.method, req.path)) return standardJson(req, res, next);
    if (!isAcceptableAccessToken(readAccessToken(req))) {
        return res.status(401).json({ success: false, message: "You are not logged in!" });
    }
    return sheetJson(req, res, next);
};

export const urlencodedBody = express.urlencoded({ extended: true, limit: ENV.JSON_BODY_LIMIT });
