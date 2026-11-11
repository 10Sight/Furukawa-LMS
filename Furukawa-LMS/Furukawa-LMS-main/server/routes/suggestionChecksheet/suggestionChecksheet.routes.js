import { Router } from "express";
import {
  getAllSuggestionChecksheets,
  getSuggestionChecksheetById,
  createSuggestionChecksheet,
  updateSuggestionChecksheet,
  deleteSuggestionChecksheet,
  getSuggestionTargets,
  saveSuggestionTargets
} from "../../controllers/suggestionChecksheet/suggestionChecksheet.controller.js";

const router = Router();

router.route("/")
  .get(getAllSuggestionChecksheets)
  .post(createSuggestionChecksheet);

router.route("/targets")
  .get(getSuggestionTargets)
  .post(saveSuggestionTargets);

router.route("/:id")
  .get(getSuggestionChecksheetById)
  .put(updateSuggestionChecksheet)
  .delete(deleteSuggestionChecksheet);

export default router;

