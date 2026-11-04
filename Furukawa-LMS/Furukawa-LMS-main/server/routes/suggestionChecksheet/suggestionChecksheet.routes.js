import { Router } from "express";
import {
  getAllSuggestionChecksheets,
  getSuggestionChecksheetById,
  createSuggestionChecksheet,
  updateSuggestionChecksheet,
  deleteSuggestionChecksheet
} from "../../controllers/suggestionChecksheet/suggestionChecksheet.controller.js";

const router = Router();

router.route("/")
  .get(getAllSuggestionChecksheets)
  .post(createSuggestionChecksheet);

router.route("/:id")
  .get(getSuggestionChecksheetById)
  .put(updateSuggestionChecksheet)
  .delete(deleteSuggestionChecksheet);

export default router;

